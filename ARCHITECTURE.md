# ST Score Editor Core — Architecture

Status: **Core architecture remains implemented through Stage E8-C. The SEC-SMUFL-KEYPAD-01 existing-score correction program is complete through SEC-KP-10. The additive Sibelius-style note-entry expansion is implemented through SEC-NE-04A plus the bounded SEC-NE-04C explicit-rest position primitive in this stage. Direct external-engine invocation, implicit-gap authoring and canonical onset mutation remain unauthorized.**

## 1. Purpose

ST Score Editor Core is the shared semantic score-editing layer between symbolic score data and product-specific user interfaces. It is not an engraving engine, OMR engine, guitar optimizer, AI model host, persistence service, external-engine runner or publication authority.

The repository now supports both:

- bounded existing-score correction; and
- bounded score authoring inside already-authorized explicit rest time.

It still does **not** claim unrestricted Sibelius-style free insertion, arbitrary onset movement, page-layout authority, automatic voice creation or implicit-gap authoring.

## 2. Canonical authority flow

```text
MusicXML / symbolic evidence
        ↓
safe import boundary
        ↓
Canonical ScoreDocument + revision-bound NotationDocument
        ↓
SemanticAddress / SelectionSnapshot / InsertionPosition
        ↓
typed score / notation / note-entry intent
        ↓
independent timing + canonical validation
        ↓
atomic next revision or no mutation
        ↓
unified score+notation history
        ↓
RenderRequest + opaque semantic manifest
        ↓
presentation-only renderer / host UI
```

Canonical musical edit authority belongs to `ScoreDocument`. MusicXML, renderer objects, SVG/DOM state, screen coordinates, glyph state, Guitar Workspace result data and product UI state are non-authoritative.

## 3. Authority boundaries

### Editor Core

Editor Core owns:

- canonical score semantics;
- stable semantic identity;
- revision history;
- admitted MusicXML import/export behavior;
- typed mutation/authoring primitives;
- validation and fail-closed rejection.

### ST Score Rendering Layer

The rendering layer is presentation-only. It may map a visual hit to an opaque token produced by Editor Core, but it cannot create canonical semantic state or mutate the score.

### SesliTab host

SesliTab orchestrates editor, rendering, playback and product UX. It may not create a second canonical score model or dual-write edit state.

### OMR Correction Engine

OMR/correction output remains reversible evidence/proposals. Original source evidence remains immutable.

### Guitar Workspace

String/fret/fingering/voicing state remains derivative-only unless separately admitted by a future explicit contract. Guitar-specific workflows may not bypass generic canonical edit authority.

## 4. Implemented package layers

Core symbolic and safety layers:

- `score-model` — immutable canonical score snapshots.
- `musicxml` — bounded safe import and deterministic notation serialization.
- `addressing` — revision/ancestry-bound semantic identities.
- `commands` — typed bounded score mutations.
- `history` — immutable history primitives.
- `notation-structure` — revision-bound notation semantics.
- `notation-commands` — atomic notation transactions.

Renderer/editor boundary:

- `renderer-contract`, `renderer-osmd`, `renderer-alphatab` — presentation-only render surfaces.
- `editor-ui-contract`, `editor-shell`, `editor-selection` — framework-neutral non-authoritative editor surface.
- `editor-score-intents`, `editor-notation-intents` — runtime-validated typed intents.
- `editor-history`, `editor-accessibility`, `editor-session-safety`, `editor-session-controller` — revision/history/UX composition.
- `browser-runtime` — bounded host-injected browser-safe editor runtime.
- `editor-keypad`, `editor-keypad-execution`, `editor-keypad-advanced` — correction keypad contracts and execution.
- `editor-renderer-selection-bridge` — exact-hit envelope validation and opaque-token resolution.

Note-entry expansion:

- `editor-note-entry` — bounded selected-rest note entry from SEC-NE-01/02.
- `editor-insertion-position` — revision-bound canonical cursor/insertion identity from SEC-NE-03.
- `editor-measure-timing` — effective time-signature, voice occupancy and explicit-rest admission from SEC-NE-04A.
- `editor-position-note-entry` — bounded low-level explicit-rest position note entry from SEC-NE-04C.

Guitar Workspace boundary:

- `guitar-workspace-contract` — derivative-only authority profile plus revision-bound source mapping.
- `guitar-workspace-projection` — deterministic engine MusicXML + source-map projection.
- `guitar-workspace-result` — bounded result evidence validation.

## 5. Unified revision model

The authoritative editor state is conceptually:

```text
EditorRevisionSnapshot
  ├─ ScoreDocument(revision R)
  └─ NotationDocument(revision R)
```

Score and notation must share exact document/revision identity. Accepted edits produce one next canonical revision. Partial authoritative commits are forbidden.

Undo/redo restores score+notation together. Revision navigation clears semantic selection unless a specific post-commit flow deterministically re-resolves a surviving entity against the new revision.

## 6. Semantic selection and renderer boundary

Editor Core creates a revision-bound `RenderRequest` with canonical MusicXML plus an opaque manifest mapping tokens to revision-bound `SemanticAddress` values.

The renderer-side return envelope may identify only the exact current render request and opaque hit token. Renderer-supplied semantic addresses, coordinates, DOM/SVG ids, renderer object graphs and glyph identities are not edit authority.

Unknown, stale, renderer-mismatched or path-mismatched hits fail closed. Ambiguous visual hits must return no token rather than nearest-note inference.

## 7. SEC-NE note-entry architecture

### 7.1 SEC-NE-01 — selected explicit-rest entry

The original bounded authoring primitive replaces an exact selected rest with a note and, when required, a trailing rest. The target must be a current semantic event address and all represented time remains explicit.

### 7.2 SEC-NE-02 — session/browser composition

Selected-rest note entry is composed through the existing session controller and browser runtime:

- one unified score+notation history commit;
- immediate RenderRequest regeneration for the accepted revision;
- deterministic re-resolution of a surviving event selection;
- typed browser success/failure surface;
- no network, persistence, renderer or production authority.

### 7.3 SEC-NE-03 — canonical insertion position

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

It is not a renderer coordinate. Stale document/revision/path/onset evidence fails closed.

### 7.4 SEC-NE-04A — timing and admission authority

`editor-measure-timing` is the sole admission authority for position-based insertion in the current program.

It:

- validates score/notation revision identity;
- resolves effective time signature by inheritance;
- derives exact measure duration;
- computes exact event intervals for one canonical voice;
- rejects voice overlap;
- rejects measure overflow;
- identifies implicit gaps without authorizing them;
- authorizes only a requested window fully contained inside one explicit rest.

Current classification includes:

- `EXPLICIT_REST_SLOT`;
- `BLOCKED_PITCHED`;
- `OUTSIDE_MEASURE`;
- `IMPLICIT_GAP_UNADMITTED`;
- `MIXED_UNADMITTED`.

Implicit silence is evidence only until pickup/incomplete-measure semantics are admitted.

### 7.5 SEC-NE-04C — explicit-rest position note entry

`editor-position-note-entry` consumes:

- current canonical score;
- same-revision notation evidence;
- revision-bound `InsertionPosition`;
- typed `ENTER_NOTE_AT_POSITION` intent;
- next revision/operation identity.

The operation may proceed only when SEC-NE-04A returns an authoring-safe `EXPLICIT_REST_SLOT` for the complete requested duration.

For an authorized rest interval it can produce:

```text
rest start entry:      note + trailing rest
rest middle entry:     leading rest + note + trailing rest
rest end entry:        leading rest + note
exact rest fill:       note only
```

Invariants:

- the original authorized rest event id becomes the inserted note event id;
- newly created note/rest identities must not collide with canonical ids;
- rest time before/after the note remains explicit;
- no event outside the authorized rest is retimed;
- pitched overlap is never displaced or rewritten;
- implicit gaps remain unauthorized;
- measure overflow remains unauthorized;
- zero/negative/non-canonical duration rationals fail closed;
- stale insertion position or stale notation fails closed;
- final `ScoreDocument` must pass canonical validation;
- one immutable next score revision or no mutation.

#### SEC-NE-04C integration decision

SEC-NE-04C remains a **low-level first-party primitive** in this stage. It does not add a parallel cursor-entry endpoint to `editor-session-controller` or `browser-runtime`.

Closeout regression evidence proves that its accepted result can be safely composed with:

- notation rebinding;
- unified score+notation history;
- undo/redo;
- revision-bound RenderRequest generation.

A future public cursor-entry surface must reuse these existing composition layers rather than introduce a second history or host-owned score mutation path.

## 8. Remaining timing/authoring gates

### SEC-NE-04B1 — MusicXML measure-semantics evidence — NOT STARTED

Required before implicit-gap authority:

- time-signature import/inheritance/change evidence;
- MusicXML `measure implicit="yes"` preservation where admitted;
- correct distinction between pickup/incomplete and non-controlling semantics;
- required `backup` / `forward` timing evidence;
- no short-measure → pickup inference;
- ambiguous semantics fail closed.

Prefer an additive versioned measure-semantics evidence contract. Breaking ScoreDocument/NotationDocument schema changes remain human-gated.

### SEC-NE-04B2 — legal implicit-silence materialization — NOT STARTED

Only after 04B1 may the editor prove a legal per-voice implicit gap, deterministically materialize rests and admit authoring into that span.

### SEC-NE-05 — onset mutation / retiming — NOT STARTED

General event movement and real tuplet creation/removal require separately admitted onset authority with exact overlap, measure-boundary and notation-coupling validation.

### SEC-NE-06/07/08/09 — NOT STARTED

Structural authoring, advanced notation, guitar/TAB authoring composition and SesliTab product integration remain later stages.

## 9. Correction keypad semantics

The keypad mode remains `EXISTING_SCORE_CORRECTION`. Stable `actionId` is semantic authority; SMuFL glyph metadata and host primitive hints are presentation-only.

Implemented groups include duration/rest, accidental, dots, bounded explicit-range triplet metadata, explicit-endpoint tie/slur, selection continuity and browser keypad exposure.

The E4 command set still has no general onset-mutation primitive, so ordinary spacing is not silently retimed into tuplets.

## 10. MusicXML boundary

MusicXML is an exchange/projection format, not live editor state.

Canonical E2 semantic round-trip remains supported for the admitted import subset. Advanced notation import remains fail-closed where unsupported. Time-signature/pickup/incomplete-measure evidence needed for implicit-gap authoring is not yet admitted through SEC-NE-04B1.

Unsupported semantics must never be silently discarded when that would alter musical meaning.

## 11. Guitar Workspace boundary

Reviewed external reference:

- `khfy7wpr5p-maker/musicxml-to-guitar-tab-engine`
- reviewed main SHA: `93abe9735a4ed70ad8362ac24ec39869ea34607f`
- result: `CanonicalTabResult 2.0.0`
- source model: `PolyphonicSourceModel 1.0.0`

E8-B emits deterministic engine-safe MusicXML plus a current canonical source map. E8-C accepts bounded host/test-supplied result JSON and re-derives the current projection before retaining read-only derivative evidence.

Direct external-engine invocation remains human-gated and unauthorized.

## 12. Renderer integration targets

Host-injected presentation targets remain:

- OSMD legacy profile `2.1.1`, BSD-3-Clause;
- ST Rendering Layer OSMD profile `2.1.2`, BSD-3-Clause;
- alphaTab `1.8.4`, MPL-2.0.

Renderer packages are not canonical authority and are not installed as Editor Core runtime dependencies.

## 13. Dependency and source policy

Installed runtime dependencies remain only:

- `saxes@6.0.0`;
- `xmlchars@2.2.0`.

Build-only:

- `typescript@6.0.3`;
- `esbuild@0.28.2`.

SEC-NE-01/02/03/04A/04C add no third-party dependency. Smoosic, VexFlow and other editor/rendering projects remain reference-only unless separately admitted.

Original source bytes and source identity remain immutable.

## 14. Non-negotiable invariants

1. Canonical ScoreDocument is the single musical edit authority.
2. MusicXML is not live edit state.
3. Renderer/browser/DOM/SVG/coordinate/glyph state is never canonical authority.
4. Every mutable operation validates current revision identity.
5. Stale selection and stale insertion positions fail closed.
6. Timing/overlap/measure safety is validated before acceptance.
7. Partial authoritative commits are forbidden.
8. Score and notation revisions remain aligned when composed into editor history.
9. Renderer reflow/resize cannot invalidate canonical semantic identity by itself.
10. Guitar fingering/voicing evidence cannot bypass generic score authoring.
11. OMR/AI output remains advisory/evidence unless separately authorized.
12. No production/public-write/direct-engine authority is granted by repository merge.
13. No new runtime dependency is admitted implicitly.

## 15. Stage/status summary

Core architectural stages:

- E0 through E7-H — COMPLETE
- E8-A — COMPLETE
- E8-B — COMPLETE
- **E8-C — CURRENT**
- E8-D — HUMAN-GATED / NOT AUTHORIZED
- E9 — later

Correction keypad:

- SEC-KP-00 through SEC-KP-10 — COMPLETE, with the documented onset-retiming limitation.

Sibelius-style note-entry expansion:

- SEC-NE-00 — COMPLETE
- SEC-NE-01 — COMPLETE / MERGED
- SEC-NE-02 — COMPLETE / MERGED
- SEC-NE-03 — COMPLETE / MERGED
- SEC-NE-04A — COMPLETE / MERGED
- SEC-NE-04C — COMPLETE IN THIS STAGE, primitive-only integration decision
- SEC-NE-04B1 — NOT STARTED
- SEC-NE-04B2 — NOT STARTED
- SEC-NE-05 — NOT STARTED
- SEC-NE-06 — NOT STARTED
- SEC-NE-07 — NOT STARTED
- SEC-NE-08 — NOT STARTED
- SEC-NE-09 — NOT STARTED

Production activation, public write APIs, live AI edit authority, canonical onset-authority expansion, implicit-gap authoring and direct external-engine invocation remain separately gated.
