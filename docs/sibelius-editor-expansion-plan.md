# Sibelius-style Editor Expansion Plan

Date: 2026-09-02

Goal: evolve ST Score Editor Core from bounded correction into a general-purpose score-authoring core without changing canonical authority, renderer independence, source immutability or production/public-write policy.

## Architectural rule

```text
MusicXML import/export
        ↕
Canonical ScoreDocument + revision-bound notation/evidence
        ↕
SemanticAddress / Selection / InsertionPosition
        ↕
04A timing + 04B1 measure semantics + typed authoring intent
        ↕
Atomic canonical revision
        ↕
Unified score+notation history
        ↕
RenderRequest / opaque selection bridge
        ↕
Presentation-only renderer / host
```

## Completed foundation

### SEC-NE-00 — COMPLETE
External editor taxonomy; reference-only by default.

### SEC-NE-01 — COMPLETE / MERGED
Exact selected-rest note entry.

### SEC-NE-02 — COMPLETE / MERGED
Selected-rest entry through unified history/session/browser composition.

### SEC-NE-03 — COMPLETE / MERGED
Revision-bound canonical `InsertionPosition`; coordinates are non-authoritative.

### SEC-NE-04A — COMPLETE / MERGED
Exact effective-meter and target-voice occupancy analysis. Only one full window inside one explicit rest is directly authoring-safe.

### SEC-NE-04C — COMPLETE / MERGED
Low-level position note entry inside an admitted explicit rest; deterministic rest splitting; no second cursor-position browser/session API.

### SEC-NE-04B1 — COMPLETE / MERGED
Revision-bound MusicXML measure/time evidence: simple meter declaration/inheritance/change, `implicit`, `non-controlling`, exact `backup`/`forward` cursor evidence and provenance. Legacy E2 import remains fail-closed for the expanded semantics.

### SEC-NE-04B2 — COMPLETE / MERGED

**Goal achieved for the first conservative profile:** prove a normal-measure target-voice implicit gap from current 04A + 04B1 evidence and represent the entire containing gap deterministically as one explicit canonical rest.

Implemented:

- additive `editor-implicit-gap-materialization` package;
- read-only `assessImplicitGapMaterialization` admission surface;
- low-level `executeImplicitGapMaterialization` mutation primitive;
- exact current `InsertionPosition` required;
- current 04B1 evidence revalidated before use;
- current 04A target-voice timing re-derived independently;
- requested window must currently be `IMPLICIT_GAP_UNADMITTED` and fully contained in one exact implicit-gap interval;
- 04B1 effective meter must equal 04A effective meter;
- MusicXML `implicit="yes"` rejected;
- MusicXML `non-controlling="yes"` rejected;
- absent/no values enter the conservative normal-measure profile;
- no cross-voice false proof;
- entire containing gap → exactly one fresh rest;
- existing event IDs/onsets/durations remain unchanged;
- another implicit gap in the same voice remains untouched;
- final candidate passes canonical `ScoreDocument` validation;
- unified history undo/redo composition tested;
- after same-revision notation rebind, the new rest is an ordinary `EXPLICIT_REST_SLOT`.

04B2 remains low-level. It does not directly enter a pitched note and does not add a new browser/session cursor mutation API. Existing explicit-rest note-entry authority remains the only pitch-entry path.

## Next autonomous sequence

### SEC-NE-05 — NOT STARTED

**Goal:** canonical onset mutation / retiming authority.

Required:

- typed `MOVE_EVENT` / `CHANGE_ONSET` contract;
- exact current revision target;
- exact overlap validation;
- measure-boundary validation;
- deterministic event ordering;
- tie/slur/beam/tuplet coupling policy;
- tuplets retimed atomically;
- one unified history transaction;
- selection/insertion invalidation or deterministic rebound;
- no nearest-target inference.

This stage unlocks real drag/move note and general triplet creation/removal.

### SEC-NE-06 — NOT STARTED
Structural score authoring: measure/voice first, then separately bounded staff/part changes; time/key/clef/barline; copy/paste with fresh IDs.

### SEC-NE-07 — NOT STARTED
Advanced authoring: chord entry, grace notes, true tuplets, tie/slur during entry, articulations/ornaments, enharmonic spelling, transposition and multi-measure paste.

### SEC-NE-XML-ROUNDTRIP — HARDENING CONTINUES
E2 bounded semantic round trip exists. Newly admitted time/measure semantics and later structural/advanced capabilities require golden preservation/export/re-import equivalence tests before broader claims.

### SEC-NE-08 — NOT STARTED
Guitar/TAB authoring composition; standard notation remains canonical and fingering remains derivative unless separately admitted.

### SEC-NE-09 — NOT STARTED
SesliTab integration; no dual-write, same semantic command path for pointer/keyboard/mobile, renderer remains presentation-only.

## Still not admitted

- pickup / `implicit="yes"` writable-gap materialization;
- non-controlling/multimetric writable-gap materialization;
- arbitrary event onset movement;
- automatic voice creation;
- renderer-coordinate gap authority;
- public cursor-position browser/session mutation API from 04C/04B2;
- host dual-write state;
- production/public-write activation by merge.

## Definition of done

Each stage records exact base/head/merge SHA, supported Node CI, package-boundary regression tests, contracts changed, dependency/license state, known limitations, current-reality docs and explicit authority-change status.
