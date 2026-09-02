# Roadmap

## Current source of truth

This file records merged/in-progress/not-started repository reality. Planned stages are not production capability.

## Core stages

- **E0–E7-H — COMPLETE**
- **E8-A — COMPLETE:** Guitar Workspace derivative-only authority contract.
- **E8-B — COMPLETE:** deterministic guitar MusicXML + source-map projection.
- **E8-C — CURRENT / IMPLEMENTED:** bounded read-only `CanonicalTabResult 2.0.0` evidence validation.
- **E8-D — HUMAN-GATED / NOT AUTHORIZED:** direct host/external-engine invocation.
- **E9 — LATER:** advisory music-intelligence overlays.

## SEC-SMUFL-KEYPAD-01

- **SEC-KP-00–10 — COMPLETE.**
- General onset retiming remains unavailable until SEC-NE-05.

## SEC-NE — Sibelius-style authoring expansion

### Complete / merged

- **SEC-NE-00 — COMPLETE:** external editor taxonomy; Smoosic reference-only.
- **SEC-NE-01 — COMPLETE / MERGED:** exact selected-rest note entry.
- **SEC-NE-02 — COMPLETE / MERGED:** unified session/history/browser composition for selected-rest entry.
- **SEC-NE-03 — COMPLETE / MERGED:** revision-bound canonical `InsertionPosition`.
- **SEC-NE-04A — COMPLETE / MERGED:** effective meter inheritance, exact occupancy, overlap/overflow rejection and explicit-rest-only admission.
- **SEC-NE-04C — COMPLETE / MERGED:** low-level explicit-rest position note-entry primitive; no second cursor-position browser/session API.
- **SEC-NE-04B1 — COMPLETE / MERGED:** additive MusicXML measure-semantics evidence without breaking `ScoreDocument` or `NotationDocument` 1.0.0.

SEC-NE-04B1 admits a bounded new import surface, `importMusicXmlWithMeasureSemantics`, preserving:

- simple time-signature declarations;
- effective inheritance and changes;
- MusicXML measure `implicit` evidence;
- `non-controlling` evidence independently from `implicit`;
- exact rational `backup` / `forward` cursor operations;
- source part/measure/staff identity bound to canonical measure addresses.

Legacy `importMusicXml` remains the E2 score-only profile and continues to reject these newly admitted semantics rather than silently discarding them. Short measure length alone is never interpreted as pickup evidence. SEC-NE-04B1 grants no implicit-gap write authority.

### Next dependency order

1. **SEC-NE-04B2 — NOT STARTED:** prove legal per-voice implicit silence and deterministically materialize explicit rests.
2. **SEC-NE-05 — NOT STARTED:** canonical onset mutation / retiming.
3. **SEC-NE-06 — NOT STARTED:** structural score authoring.
4. **SEC-NE-07 — NOT STARTED:** advanced notation/note-entry authoring.
5. **SEC-NE-XML-ROUNDTRIP — IN PROGRESS AS BOUNDED SUBSET / HARDENING CONTINUES:** expand golden semantic-equivalence coverage as new semantics are admitted.
6. **SEC-NE-08 — NOT STARTED:** guitar/TAB authoring composition.
7. **SEC-NE-09 — NOT STARTED:** SesliTab product integration.

## SEC-NE-04B2 gate

04B1 evidence is necessary but not sufficient for writing into an implicit gap. 04B2 must additionally prove:

- legal measure span for the exact target measure;
- legal silence for the exact target voice;
- no cross-voice false proof;
- deterministic explicit-rest materialization;
- no overlap;
- one unified history transaction;
- no renderer-coordinate inference.

Until 04B2 completes, `IMPLICIT_GAP_UNADMITTED` remains fail-closed.

## SEC-NE-05 gate

Onset movement/retiming requires exact overlap and measure validation plus frozen tie/slur/beam/tuplet coupling. Tuplet retiming must be atomic.

## Authority rules

- `ScoreDocument` remains canonical.
- MusicXML is exchange/projection data, not live editor state.
- Revision-bound measure semantics are evidence, not independent mutation authority.
- Renderer/DOM/SVG coordinates never become musical authority.
- SesliTab may not dual-write score state.
- OMR/AI output is advisory/evidence only.
- Guitar string/fret/fingering remains derivative unless separately admitted.
- Original source evidence remains immutable.
- Repository merge does not activate production/public write/live AI/direct engine invocation.

## Documentation gates

Architecture-changing PRs must synchronize affected current-reality documents:

- `README.md`
- `ARCHITECTURE.md`
- `docs/sibelius-editor-expansion-plan.md`
- `docs/score-authoring-capability-matrix.json`
- `docs/insertion-and-timing-authority.md`
- `docs/musicxml-roundtrip-policy.md`
