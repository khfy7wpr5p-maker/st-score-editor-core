# Sibelius-style editor expansion plan

Date: 2026-09-02

Goal: evolve ST Score Editor Core from bounded existing-score correction into a general-purpose score-authoring core without changing canonical authority, renderer boundaries, source immutability, or production/public-write policy.

## Architectural rule

```text
MusicXML import/export
        ↕
Canonical ScoreDocument
        ↕
Typed edit / authoring operations
        ↕
Unified revision + history
        ↕
RenderRequest / selection bridge
        ↕
Presentation-only renderer
```

MusicXML, SVG, DOM, OSMD, alphaTab, VexFlow, Smoosic and host UI state are never canonical edit authority.

## Program

### SEC-NE-00 — External editor taxonomy — COMPLETE

Smoosic is recorded as independent technical reference evidence. No runtime dependency or source-copy coupling was introduced.

### SEC-NE-01 — Rest-slot note entry — COMPLETE / MERGED

A bounded authoring primitive writes a note into an exact selected rest while preserving represented time.

Implemented invariants:

- exact current `EventAddress` required;
- target must be a rest;
- exact-duration replacement supported;
- shorter note atomically creates a trailing rest;
- no note may exceed selected rest duration;
- all new ids must be fresh;
- stale targets fail closed;
- one immutable revision or none;
- no renderer/UI/network authority added.

### SEC-NE-02 — Editor note-entry intent + browser surface — COMPLETE / MERGED

The SEC-NE-01 primitive is composed into the existing framework-neutral session controller and browser runtime.

Implemented behavior:

- current semantic selection must resolve to the exact rest event;
- pitch and duration remain typed semantic input;
- ids remain bounded and validated by the SEC-NE-01 primitive;
- successful entry commits through unified score+notation history;
- a new revision-bound `RenderRequest` is generated immediately;
- the surviving event selection is rebound to the new revision;
- browser hosts receive a bounded `commitNoteEntry` entry point with typed success/failure result;
- browser runtime remains non-production, network-disabled, persistence-disabled and renderer-non-authoritative;
- keyboard, pointer and mobile hosts can compose the same semantic entry point rather than creating separate edit semantics.

### SEC-NE-03 — Cursor and insertion-position contract — COMPLETE / MERGED

A canonical insertion position is represented independently of SVG/DOM coordinates.

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

Implemented invariants:

- exact document and revision identity required;
- exact part/staff/measure/voice path must resolve canonically;
- onset is a canonical non-negative rational;
- stale positions cannot be replayed onto newer score revisions;
- document/path mismatches fail closed;
- the contract is immutable and performs no score mutation;
- renderer coordinates cannot become insertion authority.

### SEC-NE-04 — Measure timing and gap authority — PARTIAL

#### SEC-NE-04A — Time signature, occupancy and explicit-rest admission — COMPLETE / MERGED

A read-only timing analyzer establishes the safe subset required before free insertion.

Implemented behavior:

- validates score and notation revision binding;
- resolves the effective time signature by inheritance along the selected staff;
- derives exact measure duration from the active time signature;
- calculates exact event intervals in the selected voice;
- rejects overlapping voice events;
- rejects events extending beyond the active measure duration;
- identifies deterministic implicit gaps;
- classifies requested insertion windows as `EXPLICIT_REST_SLOT`, `BLOCKED_PITCHED`, `OUTSIDE_MEASURE`, `IMPLICIT_GAP_UNADMITTED`, or `MIXED_UNADMITTED`;
- only a window fully contained in one explicit rest is currently marked authoring-safe;
- implicit gaps remain fail-closed because pickup/incomplete-measure semantics are not represented canonically;
- no score mutation, onset mutation or rest materialization is performed.

#### SEC-NE-04C — Explicit-rest position note entry — COMPLETE IN THIS STAGE

A revision-bound `InsertionPosition` may author a note only when SEC-NE-04A classifies the entire requested window as one admitted explicit-rest slot.

Implemented behavior:

- SEC-NE-04A remains the sole timing/admission authority;
- insertion at rest start, middle and end is supported;
- exact rest fill is supported;
- a middle insertion atomically splits the explicit rest into leading rest + note + trailing rest;
- leading-only and trailing-only split forms are supported;
- the original authorized rest event id is preserved as the inserted note event id;
- new note/rest ids are caller-supplied, bounded and rejected on collision with existing canonical ids;
- invalid/zero/negative/non-reduced duration rationals fail closed;
- stale insertion positions and stale notation evidence fail closed;
- pitched overlap, implicit gaps and measure overflow remain unauthorized;
- the resulting `ScoreDocument` must pass canonical validation;
- the primitive composes with notation rebinding, unified score+notation history, undo/redo and a revision-synchronized `RenderRequest`.

Integration decision for this stage:

- `editor-position-note-entry` remains a **low-level first-party primitive**;
- this stage does **not** add a second cursor-entry path to `editor-session-controller` or `browser-runtime`;
- the existing selected-rest `commitNoteEntry` surface from SEC-NE-02 remains unchanged;
- a future public cursor-entry surface must compose this primitive through the existing unified history and browser/session authority model rather than introducing parallel edit state.

This bounded decision avoids scope drift while preserving a safe canonical primitive for later product composition.

#### SEC-NE-04B1 — MusicXML time / pickup / incomplete-measure evidence — NOT STARTED

Required before an implicit gap can become authoring authority:

- import time-signature evidence additively;
- preserve time-signature inheritance/change evidence;
- preserve MusicXML measure `implicit="yes"` evidence where admitted;
- do not confuse non-controlling measure semantics with pickup semantics;
- preserve `backup` / `forward` timing evidence where required;
- do not infer pickup merely because a measure is short;
- fail closed on ambiguous unsupported semantics;
- prefer a versioned additive measure-semantics/notation evidence contract rather than breaking public ScoreDocument/NotationDocument schemas.

A breaking public schema change remains human-gated.

#### SEC-NE-04B2 — Legal implicit-silence materialization — NOT STARTED

After SEC-NE-04B1 provides sufficient measure semantics evidence:

- distinguish legal implicit silence from pickup/incomplete-measure span;
- prove writable gaps per voice without cross-voice false inference;
- deterministically materialize explicit rests for admitted legal silence;
- preserve no-overlap and measure-span invariants;
- commit through one unified history transaction;
- never infer writable time from renderer coordinates.

No unrestricted free insertion is admitted until SEC-NE-04B1 and SEC-NE-04B2 are complete.

### SEC-NE-05 — Onset mutation / retiming — NOT STARTED

Introduce separately reviewed onset mutation only after notation coupling is frozen.

Required invariants:

- event ordering remains canonical;
- no invalid overlap in a voice;
- tuplets are retimed atomically with canonical events;
- ties/slurs/beams and notation metadata cannot silently become stale;
- unified score+notation history remains one transaction;
- stale selection/insertion positions fail closed;
- no nearest-target inference.

This stage also unlocks ordinary triplet creation/removal currently blocked by the correction keypad.

### SEC-NE-06 — Structural score authoring — NOT STARTED

Add bounded operations for:

- add/remove measure;
- add/remove voice;
- add/remove staff where admitted;
- add/remove part/instrument where admitted;
- barline/time/key/clef authoring with explicit scope;
- copy/paste with fresh semantic identities.

Each structural operation requires deterministic identity creation and rollback-safe validation.

### SEC-NE-07 — Advanced note entry — NOT STARTED

Add:

- chord entry at insertion position;
- grace notes;
- tuplets with real retiming;
- articulations/ornaments;
- ties/slurs during entry;
- enharmonic spelling policy;
- transposition;
- multi-measure paste.

### SEC-NE-08 — Guitar authoring surface — NOT STARTED

Compose canonical notation entry with Guitar Workspace evidence:

- standard notation remains canonical;
- string/fret assignments remain derivative unless separately admitted;
- TAB can propose fingering/voicing without bypassing canonical score edits;
- guitar-specific entry can request ordinary Editor Core intents.

### SEC-NE-09 — Product integration — NOT STARTED

Host integration order:

1. ST Score Editor Core
2. ST Score Rendering Layer
3. SesliTab Guitar Reader
4. Guitar Workspace / TAB evidence

The host orchestrates. It does not create a second canonical model or dual-write score state.

## Explicitly not admitted yet

- arbitrary event onset movement;
- automatic voice creation;
- unrestricted note insertion into occupied or implicit time;
- pickup/incomplete-measure inference from event spacing;
- renderer-coordinate gap authority;
- public cursor-position note-entry surface in browser/session for SEC-NE-04C;
- Smoosic/VexFlow dependency;
- renderer-owned edits;
- production/public-write activation.

## Completion evidence per stage

Every stage should record:

- exact base/head SHA;
- tests/checks and CI status;
- changed public contracts;
- dependency/license changes;
- known limitations;
- runtime/production authority change (`false` unless separately authorized).
