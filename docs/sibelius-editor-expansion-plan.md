# Sibelius-style Editor Expansion Plan

Date: 2026-09-02

Goal: evolve ST Score Editor Core from bounded existing-score correction into a general-purpose score-authoring core without changing canonical authority, renderer independence, source immutability or production/public-write policy.

## Architectural rule

```text
MusicXML import/export
        ↕
Canonical ScoreDocument
        ↕
SemanticAddress / Selection / InsertionPosition
        ↕
Timing validation + typed edit/authoring intent
        ↕
Atomic canonical revision
        ↕
Unified score+notation history
        ↕
RenderRequest / opaque selection bridge
        ↕
Presentation-only renderer / product host
```

MusicXML, SVG, DOM, OSMD, alphaTab, VexFlow, Smoosic and host UI state are never canonical edit authority.

## Merged foundation

### SEC-NE-00 — COMPLETE

External editor taxonomy was reviewed. Smoosic is independent reference evidence only; no runtime/source-copy coupling was introduced.

### SEC-NE-01 — COMPLETE / MERGED

Bounded selected-rest note entry:

- exact current rest event target;
- exact fill or shorter note + trailing rest;
- duration overflow rejected;
- fresh IDs required;
- stale target rejected;
- one immutable revision or none.

### SEC-NE-02 — COMPLETE / MERGED

Selected-rest entry is composed through existing editor session/browser infrastructure:

- unified score+notation history;
- RenderRequest regenerated from accepted revision;
- deterministic selection rebind to surviving entity or safe clear;
- typed browser success/failure;
- pointer/keyboard/mobile hosts use the same semantic operation;
- no renderer/network/persistence/production authority.

### SEC-NE-03 — COMPLETE / MERGED

Canonical `InsertionPosition` is revision-bound semantic cursor state:

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

Stale revision/path/onset evidence fails closed. Coordinates do not become insertion authority.

### SEC-NE-04A — COMPLETE / MERGED

Read-only timing/occupancy analysis:

- validates score/notation revision binding;
- resolves effective inherited time signature;
- derives exact rational measure duration;
- computes exact target-voice event intervals;
- rejects overlap and measure overflow;
- identifies implicit gaps without authorizing them;
- admits only a requested window fully inside one explicit rest.

Current admission classes:

- `EXPLICIT_REST_SLOT` — safe;
- `BLOCKED_PITCHED` — rejected;
- `OUTSIDE_MEASURE` — rejected;
- `IMPLICIT_GAP_UNADMITTED` — rejected;
- `MIXED_UNADMITTED` — rejected.

### SEC-NE-04C — COMPLETE / MERGED

Revision-bound position note entry inside one explicit rest:

- SEC-NE-04A remains the sole timing/admission authority;
- supports rest start, middle and end;
- supports exact rest fill;
- supports leading-only, trailing-only and leading+trailing split forms;
- original admitted rest event id becomes the inserted note event id;
- new note/rest ids must be fresh against canonical identities;
- invalid/non-positive/non-canonical rationals fail closed;
- stale insertion position and stale notation evidence fail closed;
- pitched overlap, implicit gaps and measure overflow remain unauthorized;
- final `ScoreDocument` must pass canonical validation;
- closeout regression proves composition with notation rebinding, unified history, undo/redo and revision-bound RenderRequest generation.

Integration decision: `editor-position-note-entry` remains a **low-level first-party primitive**. SEC-NE-04C did not add a second cursor-position session/browser public API. Future UI composition must reuse the existing unified history/session architecture.

## Next autonomous authoring sequence

### SEC-NE-04B1 — NOT STARTED

**Goal:** import/preserve sufficient MusicXML time and measure semantics as additive revision-bound evidence so later code can distinguish legal silence from incomplete/pickup measure span.

Required:

- time-signature import;
- time-signature inheritance/change evidence;
- MusicXML `measure implicit="yes"` evidence preservation where admitted;
- do not confuse non-controlling semantics with pickup/incomplete semantics;
- preserve `backup` / `forward` timing evidence where required;
- do not infer pickup because a measure is short;
- ambiguous/unsupported semantics fail closed;
- keep public `ScoreDocument`/`NotationDocument` schemas unchanged if a safe additive evidence contract is sufficient.

Preferred design: a versioned additive measure-semantics evidence contract bound to canonical semantic measure addresses.

**Human gate:** stop if a breaking public ScoreDocument/NotationDocument schema change is actually required.

### SEC-NE-04B2 — NOT STARTED

**Dependency:** SEC-NE-04B1 complete.

**Goal:** deterministic rest materialization and writable-gap admission for proven legal implicit silence.

Required:

- derive legal measure span from admitted semantics;
- prove occupancy for exact target voice;
- no cross-voice false proof;
- deterministic explicit-rest materialization;
- no overlap;
- one unified history transaction;
- no renderer-coordinate inference.

No unrestricted implicit-gap insertion before 04B1/04B2 complete.

### SEC-NE-05 — NOT STARTED

**Goal:** canonical onset mutation / retiming authority.

Required:

- typed `MOVE_EVENT` / `CHANGE_ONSET` contract;
- exact overlap validation;
- measure-boundary validation;
- frozen tie/slur/beam/tuplet coupling policy;
- tuplets retimed atomically;
- unified history atomicity;
- selection/insertion invalidation or deterministic rebound;
- no nearest-target inference.

Unlocks drag/move note, real triplet creation/removal and general rhythmic restructuring.

### SEC-NE-06 — NOT STARTED

Structural authoring operations:

- add/remove measure;
- add/remove voice;
- add/remove staff/part only after bounded admission;
- set time/key/clef/barline;
- copy/paste with fresh semantic identities.

### SEC-NE-07 — NOT STARTED

Advanced notation authoring:

- chord entry;
- grace notes;
- tuplets with real timing;
- tie/slur during entry;
- articulations/ornaments/dots;
- enharmonic spelling;
- transposition;
- multi-measure paste.

### SEC-NE-XML-ROUNDTRIP — EXISTING BOUNDED SUBSET / HARDENING CONTINUES

E2 already provides semantic round trip for the admitted import subset. Expansion requires a golden corpus and semantic-equivalence tests for every newly admitted time/notation/structure capability.

Policy: supported semantics survive import -> edit -> export -> re-import equivalently; unsupported semantics must not disappear silently.

See `docs/musicxml-roundtrip-policy.md`.

### SEC-NE-08 — NOT STARTED

Guitar/TAB authoring composition:

- standard notation remains canonical;
- string/fret/fingering remains derivative unless separately admitted;
- multiple valid fingerings remain possible;
- TAB UI requests ordinary Editor Core semantic intents;
- TuxGuitar taxonomy remains reference-only.

### SEC-NE-09 — NOT STARTED

SesliTab product integration:

1. ST Score Editor Core canonical edit state;
2. ST Score Rendering Layer presentation/hit testing;
3. SesliTab orchestration/playback/UI;
4. Guitar Workspace / OMR evidence as non-canonical inputs.

Requirements include no dual-write, semantic selection surviving rerender/reflow, one pointer/keyboard/mobile semantic command path and playback not being coupled unnecessarily to edit/OMR completeness.

See `docs/seslitab-editor-integration-contract.md`.

## Explicitly not admitted today

- arbitrary event onset movement;
- automatic voice creation;
- unrestricted note insertion into occupied or implicit time;
- pickup/incomplete inference from event spacing alone;
- renderer-coordinate gap authority;
- public cursor-position note-entry session/browser API from SEC-NE-04C;
- Smoosic/VexFlow runtime dependency;
- renderer-owned edits;
- host dual-write score state;
- production/public-write activation by repository merge.

## Definition-of-done rule per stage

Record and verify:

- exact base/head SHA;
- PR and merge SHA;
- repository validation + full supported Node CI matrix;
- affected package-boundary integration tests;
- exact contracts changed;
- dependency/license changes;
- known limitations;
- affected architecture/current-reality docs updated in the same PR;
- authority change explicitly recorded (`false` unless separately authorized).
