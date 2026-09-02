# ST Score Editor Core — Architecture

Status: **Core architecture remains implemented through E8-C. SEC-SMUFL-KEYPAD-01 is complete through SEC-KP-10. The SEC-NE authoring expansion is COMPLETE / MERGED through SEC-NE-04A, SEC-NE-04C and SEC-NE-04B1. Implicit-gap authoring, canonical onset mutation and direct external-engine invocation remain unadmitted.**

## 1. Purpose

ST Score Editor Core is the renderer-independent semantic editing authority between symbolic score evidence and product UI. It is not an engraving engine, OMR recognizer, guitar optimizer, persistence service, publication authority or renderer-owned editor model.

Current authoring is deliberately bounded: selected explicit-rest entry and position entry inside an explicitly represented rest are supported. SEC-NE-04B1 additionally preserves bounded MusicXML time/measure evidence, but does not itself grant new write authority.

## 2. Canonical authority flow

```text
MusicXML / OMR evidence
        ↓
safe import adapters
        ↓
Canonical ScoreDocument
 + revision-bound NotationDocument / admitted evidence
        ↓
SemanticAddress / SelectionSnapshot / InsertionPosition
        ↓
measure timing + typed edit/authoring intent
        ↓
independent validation
        ↓
atomic child revision or no mutation
        ↓
unified score+notation history
        ↓
RenderRequest + opaque manifest
        ↓
ST Score Rendering Layer / SesliTab UI
```

`ScoreDocument` is the single musical edit authority. MusicXML, sidecar evidence, renderer objects, SVG/DOM state, screen coordinates, glyph state, Guitar Workspace results and host UI state cannot independently authorize a mutation.

## 3. Authority boundaries

### Editor Core
Owns canonical score semantics, stable semantic identity, admitted edit/authoring primitives, revision lineage/history, MusicXML adapters and validation.

### ST Score Rendering Layer
Owns presentation and visual hit testing. It may return opaque hit tokens for an exact `RenderRequest`; it may not create or mutate canonical score state.

### SesliTab
Owns orchestration/UI/playback. It may not create a second canonical score model or dual-write score state.

### ST OMR Correction Engine
Provides reversible evidence/proposals. Original source evidence remains immutable and auditable.

### Guitar Workspace
Provides derivative TAB/fingering/voicing evidence and proposals. It cannot bypass Editor Core authoring authority.

## 4. Implemented package layers

Core:

- `score-model` — immutable canonical score snapshots;
- `musicxml` — bounded safe MusicXML parsing/import/export;
- `musicxml-measure-semantics` — SEC-NE-04B1 revision-bound source measure/time evidence;
- `addressing` — revision/ancestry-bound semantic identities;
- `commands` / `history` — bounded mutations and immutable history;
- `notation-structure` / `notation-commands` — revision-bound notation semantics and transactions.

Editor/render boundary:

- `renderer-contract`, `renderer-osmd`, `renderer-alphatab` — presentation-only contracts/adapters;
- `editor-ui-contract`, `editor-shell`, `editor-selection` — non-authoritative UI/selection model;
- `editor-score-intents`, `editor-notation-intents` — typed intents;
- `editor-history`, `editor-session-safety`, `editor-session-controller` — unified composition/history;
- `browser-runtime` — bounded host-injected browser runtime;
- `editor-keypad*` — existing-score correction keypad;
- `editor-renderer-selection-bridge` — opaque-token hit bridge.

SEC-NE authoring:

- `editor-note-entry` — SEC-NE-01 selected-rest entry;
- session/browser composition — SEC-NE-02;
- `editor-insertion-position` — SEC-NE-03 canonical insertion identity;
- `editor-measure-timing` — SEC-NE-04A timing/occupancy/admission authority;
- `editor-position-note-entry` — SEC-NE-04C low-level explicit-rest position mutation;
- `musicxml-measure-semantics` + `importMusicXmlWithMeasureSemantics` — SEC-NE-04B1 evidence import.

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

Accepted editor mutations create one direct child revision or none. Partial authoritative commits are forbidden. Revision-bound evidence such as `MusicXmlMeasureSemanticsDocument` must match the same `documentId`/`revisionId` when used; stale evidence fails closed.

## 6. Selection and renderer boundary

`RenderRequest` contains canonical MusicXML plus an opaque manifest mapping tokens to current `SemanticAddress` values. Renderer-supplied coordinates, DOM/SVG ids, object graphs or semantic addresses are not trusted edit targets.

Stale/unknown/mismatched hits fail closed. Nearest-target guessing is forbidden.

## 7. SEC-NE completed authoring

### SEC-NE-01 / 02 — COMPLETE / MERGED

An exact selected rest can be replaced by a note; a shorter note may atomically create a trailing rest. The public bounded session/browser path commits through unified score+notation history and regenerates a current RenderRequest.

### SEC-NE-03 — COMPLETE / MERGED

`InsertionPosition` is revision-bound semantic cursor state:

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

It is never a renderer coordinate.

### SEC-NE-04A — COMPLETE / MERGED

`editor-measure-timing` is the current write-admission authority for position entry. It validates same-revision notation, derives effective meter and exact measure duration, checks target-voice occupancy, rejects overlap/overflow and classifies windows as:

- `EXPLICIT_REST_SLOT` — authoring-safe;
- `BLOCKED_PITCHED` — rejected;
- `OUTSIDE_MEASURE` — rejected;
- `IMPLICIT_GAP_UNADMITTED` — rejected;
- `MIXED_UNADMITTED` — rejected.

### SEC-NE-04C — COMPLETE / MERGED

`editor-position-note-entry` may mutate only when 04A admits the complete requested interval inside one explicit rest. It supports rest start/middle/end, exact fill and deterministic leading/trailing rest splits. Other event onsets are unchanged.

04C remains a low-level first-party primitive. It does not add a second cursor-position mutation API to the browser/session layer.

### SEC-NE-04B1 — COMPLETE / MERGED

SEC-NE-04B1 adds **evidence authority, not mutation authority**.

The additive `importMusicXmlWithMeasureSemantics` surface returns:

```text
MusicXmlMeasureSemanticsImportResult
  ├─ ScoreDocument
  ├─ NotationDocument
  └─ MusicXmlMeasureSemanticsDocument
```

All three are bound to the same canonical document/revision.

`MusicXmlMeasureSemanticsDocument` records per canonical measure/staff target:

- source part id;
- source measure index/number;
- source staff ordinal;
- MusicXML `implicit` yes/no/null;
- MusicXML `non-controlling` yes/no/null;
- declared time signature;
- effective inherited time signature;
- whether the meter was declared here, inherited or unknown;
- ordered exact-rational `backup`/`forward` cursor operations.

Admitted 04B1 meter syntax is intentionally narrow: simple unnumbered `<time><beats>…</beats><beat-type>…</beat-type></time>` within existing notation limits. Mid-measure time changes, extra `<time>` attributes and ambiguous forms fail closed.

The XML structural parser may carry the standard `measure` attributes `number`, `implicit` and `non-controlling`, but the legacy E2 semantic importer still accepts only `number`. Therefore legacy `importMusicXml` continues to reject 04B1-only semantics rather than silently discard them.

`beats` and `beat-type` are parser leaf elements; hidden nested semantics are rejected.

A short measure is never inferred to be a pickup. `implicit` and `non-controlling` are preserved independently and are not conflated.

04B1 does **not** change `editor-measure-timing` admission. Apparent gaps remain `IMPLICIT_GAP_UNADMITTED` until 04B2.

## 8. Remaining authoring gates

### SEC-NE-04B2 — NOT STARTED

Use admitted 04B1 evidence plus exact per-voice occupancy to prove legal writable silence and deterministically materialize explicit rests. No cross-voice inference and no renderer-coordinate inference.

### SEC-NE-05 — NOT STARTED

Canonical onset mutation/retiming with exact overlap/measure validation and frozen tie/slur/beam/tuplet coupling.

### SEC-NE-06 — NOT STARTED
Structural score authoring.

### SEC-NE-07 — NOT STARTED
Advanced note/notation authoring.

### SEC-NE-08 — NOT STARTED
Guitar/TAB authoring composition; standard notation remains canonical.

### SEC-NE-09 — NOT STARTED
SesliTab product integration; host dual-write remains forbidden.

## 9. MusicXML boundary

MusicXML is exchange/projection data, not live editor state. For any semantic, an admitted importer must import it, preserve it explicitly as bounded evidence, or reject it. Silent destructive loss is forbidden when musical meaning or authoring safety would change.

Two import profiles now intentionally coexist:

- `importMusicXml` — legacy bounded E2 score-only profile;
- `importMusicXmlWithMeasureSemantics` — additive SEC-NE-04B1 score + notation + measure-evidence profile.

This separation prevents existing score-only callers from silently accepting newly meaningful measure/time semantics without receiving their evidence.

Broader MusicXML export/re-import equivalence for 04B1 evidence remains part of `SEC-NE-XML-ROUNDTRIP` hardening; 04B1 merge alone does not claim full preservation round trip for all MusicXML measure syntax.

`.mxl` remains unadmitted.

## 10. Correction keypad

SEC-KP-00–10 remain complete. General onset mutation is still absent, so ordinary spacing is not silently retimed into tuplets.

## 11. Guitar Workspace boundary

E8-B creates deterministic projection + source map; E8-C re-derives the current projection before accepting bounded derivative result evidence. Direct engine invocation remains human-gated and unauthorized.

## 12. Dependencies

Runtime dependencies remain only:

- `saxes@6.0.0`;
- `xmlchars@2.2.0`.

Build-only:

- `typescript@6.0.3`;
- `esbuild@0.28.2`.

SEC-NE-01/02/03/04A/04C/04B1 add no third-party dependency.

## 13. Non-negotiable invariants

1. `ScoreDocument` is the single musical edit authority.
2. MusicXML is not live editor state.
3. Revision-bound evidence cannot independently mutate canonical state.
4. Renderer/browser/DOM/SVG/coordinate/glyph state is never canonical authority.
5. Every mutation validates current revision identity.
6. Stale selection, insertion positions and evidence fail closed.
7. Timing/overlap/measure safety is validated before acceptance.
8. Partial authoritative commits are forbidden.
9. Source bytes/identity remain immutable.
10. Guitar and OMR/AI evidence cannot bypass canonical edit authority.
11. No production/public-write/direct-engine authority is granted by merge.
12. No new runtime dependency is admitted implicitly.

## 14. Current status

- E0–E7-H — COMPLETE
- E8-A/B/C — IMPLEMENTED; E8-D remains HUMAN-GATED
- SEC-KP-00–10 — COMPLETE
- SEC-NE-00/01/02/03/04A/04C/04B1 — COMPLETE / MERGED
- SEC-NE-04B2 — NEXT / NOT STARTED
- SEC-NE-05/06/07/08/09 — NOT STARTED

Supporting current-reality documents:

- `ROADMAP.md`
- `docs/sibelius-editor-expansion-plan.md`
- `docs/score-authoring-capability-matrix.json`
- `docs/insertion-and-timing-authority.md`
- `docs/musicxml-roundtrip-policy.md`
- `docs/editor-ui-authority-contract.md`
- `docs/seslitab-editor-integration-contract.md`
