# Roadmap

## Current source of truth

This file records merged/in-progress/not-started repository reality. Planned stages are not production capability.

## Core stages

- **E0–E7-H — COMPLETE**
- **E8-A/B/C — IMPLEMENTED**
- **E8-D — HUMAN-GATED / NOT AUTHORIZED**
- **E9 — LATER**

## SEC-SMUFL-KEYPAD-01

- **SEC-KP-00–10 — COMPLETE.**

## SEC-NE — Sibelius-style authoring expansion

### Complete / merged foundation

- **SEC-NE-00 — COMPLETE:** external editor taxonomy.
- **SEC-NE-01 — COMPLETE / MERGED:** exact selected-rest note entry.
- **SEC-NE-02 — COMPLETE / MERGED:** unified session/history/browser composition for selected-rest entry.
- **SEC-NE-03 — COMPLETE / MERGED:** revision-bound canonical `InsertionPosition`.
- **SEC-NE-04A — COMPLETE / MERGED:** meter/target-voice occupancy, overlap/overflow rejection and explicit-rest admission.
- **SEC-NE-04C — COMPLETE / MERGED:** low-level explicit-rest position note-entry.
- **SEC-NE-04B1 — COMPLETE / MERGED:** bounded revision-bound MusicXML time/measure evidence.
- **SEC-NE-04B2 — COMPLETE / MERGED:** conservative normal-measure implicit-silence assessment and deterministic full-gap rest materialization.
- **SEC-NE-05 — COMPLETE / MERGED:** bounded canonical onset movement and atomic current 3:2 triplet-group retiming.

### SEC-NE-05 exact capability

05 has two first-party low-level primitives:

1. `editor-event-retiming` / `MOVE_EVENT/1.0.0`
   - exact current `EventAddress`;
   - same measure/voice only;
   - only onset changes;
   - deterministic voice-order rebuild;
   - independent 04A overlap/overflow veto;
   - target beam/tuplet/tie/slur coupling rejects;
   - crossing another relation-coupled event rejects.

2. `editor-triplet-retiming` / `MOVE_TRIPLET_GROUP/1.0.0`
   - exactly three current consecutive events;
   - equal canonical durations and contiguous canonical timing;
   - explicit 3:2 start/middle/stop tuplet evidence;
   - all three onsets move atomically in one child revision;
   - beam/tie/slur coupling remains fail-closed in v1;
   - independent 04A timing veto after mutation.

MusicXML-derived retiming additionally requires current 04B1 measure evidence and rejects `implicit="yes"`, `non-controlling="yes"` and unknown-meter measures.

### Next dependency order

1. **SEC-NE-06 — NOT STARTED:** structural score authoring.
2. **SEC-NE-07 — NOT STARTED:** advanced notation/note-entry authoring.
3. **SEC-NE-XML-ROUNDTRIP — BOUNDED SUBSET / HARDENING CONTINUES:** golden preservation/equivalence coverage for new semantics.
4. **SEC-NE-08 — NOT STARTED:** guitar/TAB authoring composition.
5. **SEC-NE-09 — NOT STARTED:** SesliTab product integration.

## SEC-NE-06 gate

Structural authoring must remain explicitly typed and identity-safe. Initial admitted order:

- add/remove measure;
- add/remove voice;
- set current measure time/key/clef/barline through notation authority;
- copy/paste only with fresh canonical identities;
- staff/part mutation only after separate bounded review.

Removal may not silently orphan notation, relation endpoints or derivative evidence.

## Still fail-closed

- pickup / `implicit="yes"` gap materialization;
- non-controlling / multimetric gap materialization;
- cross-measure retiming;
- independent movement of beam/tuplet/tie/slur-coupled events;
- arbitrary unsupported tuplet-group retiming;
- automatic voice creation before SEC-NE-06;
- renderer-coordinate authoring;
- host dual-write;
- production/public-write activation by merge.

## Authority rules

- `ScoreDocument` remains canonical.
- MusicXML and measure evidence are not live editor state.
- Retiming may not bypass independent timing/occupancy validation.
- Relation semantics may not be inferred from renderer/event proximity.
- Renderer/DOM/SVG coordinates never become musical authority.
- SesliTab may not dual-write score state.
- OMR/AI output is advisory/evidence only.
- Guitar state remains derivative unless separately admitted.
- Original source evidence remains immutable.
