# ST Score Editor Core — Architecture

Status: **Core architecture is implemented through E8-C. SEC-SMUFL-KEYPAD-01 is complete through SEC-KP-10. The Sibelius-style authoring expansion is COMPLETE / MERGED through SEC-NE-04A and SEC-NE-04C. Implicit-gap authoring, canonical onset mutation and direct external-engine invocation remain unadmitted.**

## 1. Purpose

ST Score Editor Core is the renderer-independent semantic editing authority between symbolic score evidence and product UI. It is not an engraving engine, OMR recognizer, guitar optimizer, AI host, persistence service or publication authority.

Current authoring is deliberately bounded: exact selected-rest entry and revision-bound position entry inside one explicitly represented rest are supported. Unrestricted free insertion, arbitrary retiming, structural editing and general advanced notation authoring are not yet claimed.

## 2. Canonical authority flow

```text
MusicXML / OMR evidence
        ↓
safe import adapters
        ↓
Canonical ScoreDocument + revision-bound NotationDocument/evidence
        ↓
SemanticAddress / SelectionSnapshot / InsertionPosition
        ↓
measure timing + typed edit/authoring intent
        ↓
independent validation
        ↓
atomic canonical child revision or no mutation
        ↓
unified score+notation history
        ↓
RenderRequest + opaque semantic manifest
        ↓
ST Score Rendering Layer / SesliTab UI
```

`ScoreDocument` is the single musical edit authority. MusicXML, renderer objects, SVG/DOM state, coordinates, glyphs, Guitar Workspace results and host UI state are non-authoritative.

## 3. Authority boundaries

### ST Score Editor Core
Owns canonical score semantics, stable semantic identity, admitted edit/authoring operations, revision lineage/history, MusicXML adapters and validation.

### ST Score Rendering Layer
Owns presentation and visual hit testing. It may return opaque hit tokens for the exact RenderRequest; it may not create or mutate canonical score state.

### SesliTab
Owns product orchestration/UI/playback. It may not create a second canonical score model or dual-write mutation path.

### ST OMR Correction Engine
Provides reversible correction evidence/proposals. Original source evidence remains immutable and auditable.

### Guitar Workspace
Provides derivative TAB/fingering/voicing evidence and proposals. It cannot bypass generic Editor Core authoring authority.

## 4. Implemented package layers

Core:

- `score-model` — immutable canonical score snapshots;
- `musicxml` — bounded safe import and deterministic export for admitted semantics;
- `addressing` — revision/ancestry-bound semantic identities;
- `commands` — typed bounded score mutations;
- `history` — immutable history primitives;
- `notation-structure`, `notation-commands` — revision-bound notation semantics and transactions.

Editor/render boundary:

- `renderer-contract`, `renderer-osmd`, `renderer-alphatab` — presentation-only contracts/adapters;
- `editor-ui-contract`, `editor-shell`, `editor-selection` — non-authoritative UI/selection model;
- `editor-score-intents`, `editor-notation-intents` — typed intents;
- `editor-history`, `editor-session-safety`, `editor-session-controller` — unified composition/history;
- `browser-runtime` — bounded host-injected browser runtime;
- `editor-keypad*` — existing-score correction keypad;
- `editor-renderer-selection-bridge` — opaque-token hit bridge.

SEC-NE authoring:

- `editor-note-entry` — SEC-NE-01 selected explicit-rest entry;
- existing session/browser composition — SEC-NE-02;
- `editor-insertion-position` — SEC-NE-03 canonical insertion identity;
- `editor-measure-timing` — SEC-NE-04A timing/occupancy/admission authority;
- `editor-position-note-entry` — SEC-NE-04C low-level explicit-rest position mutation.

Guitar boundary:

- `guitar-workspace-contract`;
- `guitar-workspace-projection`;
- `guitar-workspace-result`.

## 5. Unified revision model

The authoritative editor snapshot is:

```text
EditorRevisionSnapshot
  ├─ ScoreDocument(revision R)
  └─ NotationDocument(revision R)
```

Score and notation must share exact document/revision identity. Accepted editor operations create one direct child revision or none. Partial authoritative commits are forbidden.

Undo/redo restores score+notation together. Old revision-bound addresses, selections, insertion positions and render requests are never replayed as current authority.

## 6. Selection and renderer boundary

RenderRequest contains canonical MusicXML plus an opaque manifest mapping tokens to current `SemanticAddress` values. External renderer hits are accepted only when they identify the exact current request/profile and an opaque token.

Renderer-supplied semantic addresses, coordinates, DOM/SVG ids, glyph identities and renderer object graphs are not trusted edit targets. Stale, unknown, mismatched or ambiguous hits fail closed; nearest-target guessing is forbidden.

## 7. SEC-NE authoring architecture

### SEC-NE-01 — COMPLETE / MERGED

An exact current selected rest can be replaced by a note. If the requested note is shorter, a trailing rest is created atomically. Duration overflow, stale targets and identity collision fail closed.

### SEC-NE-02 — COMPLETE / MERGED

Selected-rest note entry is composed through the session/browser architecture:

- unified score+notation history;
- accepted-revision RenderRequest regeneration;
- deterministic selection rebind to a surviving semantic entity or safe clear;
- typed browser success/failure;
- no network/persistence/renderer/production authority.

### SEC-NE-03 — COMPLETE / MERGED

`InsertionPosition` is canonical revision-bound cursor state:

```text
InsertionPosition {
  contractVersion
  documentId
  revisionId
  partId
  staffId
  measureId
  voiceId
  onset
}
```

It is not an SVG/DOM/screen coordinate. Stale document/revision/path/onset evidence fails closed.

### SEC-NE-04A — COMPLETE / MERGED

`editor-measure-timing` is the sole current timing admission authority for position entry. It:

- validates score/notation revision binding;
- resolves effective inherited time signature;
- derives exact rational measure duration;
- computes exact event intervals per target voice;
- rejects voice overlap and measure overflow;
- identifies implicit gaps without authorizing them;
- authorizes only a requested window fully contained in one explicit rest.

Current classification:

- `EXPLICIT_REST_SLOT` — authoring-safe;
- `BLOCKED_PITCHED` — rejected;
- `OUTSIDE_MEASURE` — rejected;
- `IMPLICIT_GAP_UNADMITTED` — rejected;
- `MIXED_UNADMITTED` — rejected.

### SEC-NE-04C — COMPLETE / MERGED

`editor-position-note-entry` consumes current score, same-revision notation evidence, a current `InsertionPosition`, a typed `ENTER_NOTE_AT_POSITION` intent and next-revision identity.

It may proceed only when SEC-NE-04A admits the complete requested duration as one `EXPLICIT_REST_SLOT`.

Supported exact forms:

```text
rest start:   note + trailing rest
rest middle:  leading rest + note + trailing rest
rest end:     leading rest + note
exact fill:   note only
```

Invariants:

- original admitted rest event id is preserved as the inserted note event id;
- new note/rest ids must be fresh against all canonical ids;
- other event onsets are unchanged;
- pitched overlap and implicit gaps are never displaced or rewritten;
- invalid/non-positive/non-canonical rationals fail closed;
- stale insertion position or stale notation fails closed;
- final candidate must pass canonical `ScoreDocument` validation.

04C is intentionally a **low-level first-party primitive**. It does not add a second cursor-position API to `editor-session-controller` or `browser-runtime`. Closeout regression tests prove safe composition with notation rebinding, unified history, undo/redo and revision-bound RenderRequest generation. A future cursor-entry public surface must reuse those composition layers.

## 8. Remaining authoring gates

### SEC-NE-04B1 — NOT STARTED

Additive revision-bound MusicXML measure-semantics evidence is required before implicit-gap authority. It must cover time-signature import/inheritance/change, `measure implicit="yes"` evidence where admitted, correct pickup/incomplete vs non-controlling semantics, required `backup`/`forward` timing evidence and fail-closed ambiguity.

A short measure alone is never proof of pickup. Prefer an additive versioned evidence contract; a breaking ScoreDocument/NotationDocument schema change is human-gated.

### SEC-NE-04B2 — NOT STARTED

After 04B1, prove legal silence per exact voice and deterministically materialize explicit rests. No cross-voice or renderer-coordinate inference.

### SEC-NE-05 — NOT STARTED

Canonical onset mutation/retiming. Must freeze exact overlap/measure rules and tie/slur/beam/tuplet coupling. This unlocks general drag/move and true tuplet retiming.

### SEC-NE-06 — NOT STARTED
Structural score authoring.

### SEC-NE-07 — NOT STARTED
Advanced note/notation authoring.

### SEC-NE-08 — NOT STARTED
Guitar/TAB authoring composition; standard notation remains canonical and fingering remains derivative unless separately admitted.

### SEC-NE-09 — NOT STARTED
SesliTab product integration; host dual-write remains forbidden.

## 9. Correction keypad

The keypad remains `EXISTING_SCORE_CORRECTION`. Stable action ids are semantic; SMuFL/glyph hints are presentation-only. Duration/rest, accidental, dots, bounded existing 3:2 triplet metadata, explicit tie/slur, selection continuity and browser exposure are implemented.

General onset mutation is still absent, so ordinary spacing is not silently retimed into tuplets.

## 10. MusicXML boundary

MusicXML is exchange/projection data, not live edit state. For an admitted semantic the importer must import it, preserve it explicitly as bounded evidence, or reject unsupported input. Silent destructive loss is forbidden when musical meaning or authoring safety would change.

E2 semantic round trip remains tested for the admitted subset. Advanced notation import remains fail-closed where unsupported. SEC-NE-04B1 is the next stage for time/pickup/incomplete-measure evidence required by implicit-gap authoring.

See `docs/musicxml-roundtrip-policy.md`.

## 11. Guitar Workspace boundary

Reviewed external reference remains `khfy7wpr5p-maker/musicxml-to-guitar-tab-engine` at reviewed SHA `93abe9735a4ed70ad8362ac24ec39869ea34607f` with `CanonicalTabResult 2.0.0` evidence.

E8-B creates deterministic projection + source map; E8-C re-derives the current projection before accepting bounded host/test result evidence. Direct engine invocation remains human-gated and unauthorized.

## 12. Dependencies and external references

Installed runtime dependencies remain only `saxes@6.0.0` and `xmlchars@2.2.0`; build-only dependencies remain `typescript@6.0.3` and `esbuild@0.28.2`.

SEC-NE-01/02/03/04A/04C add no third-party dependency. Smoosic, MuseScore, TuxGuitar, VexFlow and similar projects are reference-only unless a separate dependency/license gate admits them.

## 13. Non-negotiable invariants

1. `ScoreDocument` is the single musical edit authority.
2. MusicXML is not live editor state.
3. Renderer/browser/DOM/SVG/coordinate/glyph state is never canonical authority.
4. Every mutable operation validates current revision identity.
5. Stale selection and stale insertion position fail closed.
6. Timing/overlap/measure safety is validated before acceptance.
7. Partial authoritative commits are forbidden.
8. Score and notation revisions stay aligned when composed into editor history.
9. Renderer reflow/resize cannot independently retarget semantic state.
10. Guitar and OMR/AI evidence cannot bypass canonical edit authority.
11. Source bytes/identity remain immutable.
12. No production/public-write/direct-engine authority is granted by merge.
13. No new runtime dependency is admitted implicitly.

## 14. Current status summary

Core:

- E0–E7-H — COMPLETE
- E8-A — COMPLETE
- E8-B — COMPLETE
- E8-C — CURRENT / IMPLEMENTED
- E8-D — HUMAN-GATED / NOT AUTHORIZED

Correction keypad:

- SEC-KP-00–10 — COMPLETE, with general onset-retiming limitation.

SEC-NE:

- SEC-NE-00 — COMPLETE
- SEC-NE-01 — COMPLETE / MERGED
- SEC-NE-02 — COMPLETE / MERGED
- SEC-NE-03 — COMPLETE / MERGED
- SEC-NE-04A — COMPLETE / MERGED
- SEC-NE-04C — COMPLETE / MERGED
- SEC-NE-04B1 — NOT STARTED
- SEC-NE-04B2 — NOT STARTED
- SEC-NE-05 — NOT STARTED
- SEC-NE-06 — NOT STARTED
- SEC-NE-07 — NOT STARTED
- SEC-NE-08 — NOT STARTED
- SEC-NE-09 — NOT STARTED

Supporting current-reality documents:

- `docs/score-authoring-capability-matrix.json`
- `docs/insertion-and-timing-authority.md`
- `docs/musicxml-roundtrip-policy.md`
- `docs/editor-ui-authority-contract.md`
- `docs/seslitab-editor-integration-contract.md`
- `docs/sibelius-editor-expansion-plan.md`
