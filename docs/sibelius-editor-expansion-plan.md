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
04A timing + 04B1 measure semantics + typed authoring/retiming intent
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

- **SEC-NE-00 — COMPLETE:** external editor taxonomy; reference-only by default.
- **SEC-NE-01 — COMPLETE / MERGED:** exact selected-rest note entry.
- **SEC-NE-02 — COMPLETE / MERGED:** selected-rest entry through unified history/session/browser composition.
- **SEC-NE-03 — COMPLETE / MERGED:** revision-bound canonical `InsertionPosition`; coordinates are non-authoritative.
- **SEC-NE-04A — COMPLETE / MERGED:** exact effective-meter and target-voice occupancy analysis.
- **SEC-NE-04C — COMPLETE / MERGED:** low-level position note entry inside an admitted explicit rest.
- **SEC-NE-04B1 — COMPLETE / MERGED:** revision-bound MusicXML measure/time evidence.
- **SEC-NE-04B2 — COMPLETE / MERGED:** proven normal-measure implicit gap → one deterministic explicit rest.

## SEC-NE-05 — COMPLETE / MERGED

**Goal achieved for bounded current authority:** admit canonical onset movement without allowing event-order changes to silently corrupt notation relationships.

Implemented:

### Single event

- additive `editor-event-retiming` package;
- `MOVE_EVENT/1.0.0` contract;
- exact current `EventAddress` required;
- same measure/voice only;
- canonical non-negative new onset;
- event/note identity, duration and pitch preserved;
- deterministic canonical event reorder;
- final target voice independently revalidated by 04A;
- MusicXML-derived scores require current 04B1 evidence;
- `implicit="yes"`, `non-controlling="yes"` and unknown-meter measures rejected;
- target beam/tuplet/tie/slur coupling rejected;
- crossing another relation-coupled event rejected;
- unified history undo/redo composition tested.

### Existing supported triplet

- additive `editor-triplet-retiming` package;
- `MOVE_TRIPLET_GROUP/1.0.0` contract;
- exact three current consecutive equal-duration events;
- canonical contiguity required;
- explicit existing 3:2 tuplet notation required;
- exact start/middle/stop boundary evidence required;
- all three onsets derived from one new group start and moved atomically;
- partial triplet movement impossible;
- beam and tie/slur coupling remain fail-closed in v1;
- final whole voice independently revalidated by 04A;
- unified history composition tested.

SEC-NE-05 does not expose renderer-coordinate drag authority or a new browser/session movement surface. UI composition must route an exact semantic target into these canonical primitives.

## Next autonomous sequence

### SEC-NE-06 — NOT STARTED

**Goal:** structural score authoring without breaking identity, notation or history safety.

Initial order:

1. add/remove measure;
2. add/remove voice;
3. set measure-level time/key/clef/barline through notation authority;
4. copy/paste with fresh canonical identities;
5. staff/part mutation only after separate bounded review.

Required:

- typed structural intents;
- globally fresh IDs;
- deterministic ordinals;
- no notation target orphaning;
- no relation endpoint orphaning;
- exact revision lineage;
- one unified history transaction;
- no implicit production/public-write authority.

### SEC-NE-07 — NOT STARTED

Advanced authoring: chord entry, grace-note policy, broader tuplets, tie/slur during entry, articulations/ornaments, enharmonic spelling, transposition and multi-measure paste. Existing correction-keypad semantics should be reused instead of duplicated where they already express the required notation meaning.

### SEC-NE-XML-ROUNDTRIP — HARDENING CONTINUES

E2 bounded semantic round trip exists. Newly admitted time/measure semantics, retiming and later structural/advanced capabilities require golden preservation/export/re-import equivalence tests before broader claims.

### SEC-NE-08 — NOT STARTED

Guitar/TAB authoring composition; standard notation remains canonical and fingering remains derivative unless separately admitted.

### SEC-NE-09 — NOT STARTED

SesliTab integration; no dual-write, same semantic command path for pointer/keyboard/mobile, renderer remains presentation-only.

## Still not admitted

- pickup / `implicit="yes"` writable-gap materialization;
- non-controlling/multimetric writable-gap materialization;
- cross-measure retiming;
- independent movement of beam/tuplet/tie/slur-coupled events;
- arbitrary unsupported tuplet group retiming;
- automatic voice creation before 06;
- renderer-coordinate edit authority;
- host dual-write state;
- production/public-write activation by merge.

## Definition of done

Each stage records exact base/head/merge SHA, supported Node CI, package-boundary regression tests, contracts changed, dependency/license state, known limitations, current-reality docs and explicit authority-change status.
