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
- General onset retiming remains unavailable until SEC-NE-05.

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

### SEC-NE-04B2 exact capability

04B2 admits materialization only when all of the following are true:

- current 04B1 evidence validates against the current score revision;
- current 04A window classification is `IMPLICIT_GAP_UNADMITTED` for the exact target voice;
- the requested window lies fully inside one target-voice implicit gap;
- 04B1 effective meter equals 04A timing meter;
- source `implicit` is absent/no, never `yes`;
- source `non-controlling` is absent/no, never `yes`.

If admitted, the entire containing gap becomes one fresh canonical rest. Existing events are not retimed, other gaps remain untouched, and the candidate must pass canonical score validation.

04B2 is low-level. It does not directly enter a pitch and does not add a new browser/session cursor-write API. After notation rebind, the new rest is an ordinary 04A `EXPLICIT_REST_SLOT` for existing explicit-rest authoring composition.

### Next dependency order

1. **SEC-NE-05 — NOT STARTED:** canonical onset mutation / retiming.
2. **SEC-NE-06 — NOT STARTED:** structural score authoring.
3. **SEC-NE-07 — NOT STARTED:** advanced notation/note-entry authoring.
4. **SEC-NE-XML-ROUNDTRIP — BOUNDED SUBSET / HARDENING CONTINUES:** golden preservation/equivalence coverage for new semantics.
5. **SEC-NE-08 — NOT STARTED:** guitar/TAB authoring composition.
6. **SEC-NE-09 — NOT STARTED:** SesliTab product integration.

## SEC-NE-05 gate

Onset movement/retiming must be a separately typed authority. It requires:

- exact current semantic target;
- exact overlap validation;
- measure-boundary validation;
- frozen tie/slur/beam/tuplet coupling policy;
- atomic tuplet retiming;
- unified history atomicity;
- stale selection/insertion rejection or deterministic re-resolution;
- no nearest-target inference.

## Still fail-closed

- pickup / `implicit="yes"` gap materialization;
- non-controlling / multimetric gap materialization;
- unknown or mismatched meter evidence;
- cross-voice gap proof;
- arbitrary onset movement;
- automatic voice creation;
- renderer-coordinate authoring;
- host dual-write;
- production/public-write activation by merge.

## Authority rules

- `ScoreDocument` remains canonical.
- MusicXML and measure evidence are not live editor state.
- 04B2 write authority is limited to adding one explicit rest into a proven target-voice gap; it cannot move existing events.
- Renderer/DOM/SVG coordinates never become musical authority.
- SesliTab may not dual-write score state.
- OMR/AI output is advisory/evidence only.
- Guitar state remains derivative unless separately admitted.
- Original source evidence remains immutable.
