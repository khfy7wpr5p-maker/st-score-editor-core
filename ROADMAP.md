# Roadmap

## Current source of truth

This file records merged/in-progress/not-started repository reality. Planned stages are not production capability.

Current merged SEC-NE baseline: `8e486617fdc6eefad3586f2c4fdcc7db7c04b889` includes SEC-NE-04C.

## Core stages

- **E0 — COMPLETE:** architecture and safety foundation.
- **E1 — COMPLETE:** immutable canonical `ScoreDocument`.
- **E2 — COMPLETE:** bounded safe MusicXML subset + admitted semantic round trip.
- **E3 — COMPLETE:** revision-bound semantic addressing/selection.
- **E4 — COMPLETE:** typed bounded score transactions/history primitives.
- **E5 — COMPLETE:** revision-bound notation structure/export.
- **E6 — COMPLETE:** presentation-only renderer adapters.
- **E7-A through E7-H — COMPLETE:** editor UI authority, shell, selection, typed intents, unified score+notation history, browser runtime/bundle.
- **E8-A — COMPLETE:** Guitar Workspace derivative-only authority contract.
- **E8-B — COMPLETE:** deterministic guitar MusicXML + source-map projection.
- **E8-C — CURRENT / IMPLEMENTED:** bounded read-only `CanonicalTabResult 2.0.0` evidence validation.
- **E8-D — HUMAN-GATED / NOT AUTHORIZED:** direct host/external-engine invocation boundary.
- **E9 — LATER:** advisory music-intelligence overlays.

## SEC-SMUFL-KEYPAD-01 — existing-score correction

- **SEC-KP-00 through SEC-KP-10 — COMPLETE.**

Implemented correction categories include duration/rest, accidental, dots, bounded explicit existing 3:2 triplet metadata, explicit tie/slur targets, selection continuity, browser surface and renderer-hit bridge.

Known limitation: canonical onset mutation is not yet admitted, so general triplet creation/removal that requires retiming remains fail-closed until SEC-NE-05.

## SEC-NE — Sibelius-style authoring expansion

### Completed / merged

- **SEC-NE-00 — COMPLETE:** external editor taxonomy; Smoosic remains reference-only.
- **SEC-NE-01 — COMPLETE / MERGED:** exact selected-rest note entry; shorter note may atomically create trailing rest.
- **SEC-NE-02 — COMPLETE / MERGED:** selected-rest entry through unified session/history/browser flow; RenderRequest follows accepted revision; surviving selection may be deterministically rebound.
- **SEC-NE-03 — COMPLETE / MERGED:** revision-bound canonical `InsertionPosition`; renderer coordinates are not insertion authority.
- **SEC-NE-04A — COMPLETE / MERGED:** effective time-signature inheritance, exact measure/voice occupancy, overlap/overflow rejection and explicit-rest-only admission.
- **SEC-NE-04C — COMPLETE / MERGED:** low-level position note-entry primitive for a window fully contained inside one explicit rest. Supports rest start/middle/end, exact fill and leading/trailing split forms. Composes safely with notation rebinding, unified history, undo/redo and revision-bound rendering. No second cursor-position browser/session API was added.

### Next dependency order

1. **SEC-NE-04B1 — NOT STARTED:** additive MusicXML time/pickup/incomplete-measure evidence.
2. **SEC-NE-04B2 — NOT STARTED:** deterministic explicit-rest materialization for proven legal implicit silence. Depends on 04B1.
3. **SEC-NE-05 — NOT STARTED:** canonical onset mutation / retiming.
4. **SEC-NE-06 — NOT STARTED:** structural score authoring.
5. **SEC-NE-07 — NOT STARTED:** advanced notation/note-entry authoring.
6. **SEC-NE-XML-ROUNDTRIP — IN PROGRESS AS AN EXISTING SUBSET / HARDENING LATER:** admitted E2 round trip exists; broader golden corpus and newly admitted semantics must be hardened as capabilities expand.
7. **SEC-NE-08 — NOT STARTED:** guitar/TAB authoring composition.
8. **SEC-NE-09 — NOT STARTED:** SesliTab product integration.

## SEC-NE-04B1 gate

04B1 must preserve time/measure semantics as additive revision-bound evidence where possible:

- time signatures and changes;
- effective inheritance;
- MusicXML `measure implicit="yes"` evidence where admitted;
- pickup/incomplete vs non-controlling distinction;
- required `backup`/`forward` timing evidence;
- no short-measure → pickup inference;
- ambiguous unsupported semantics fail closed.

A breaking public `ScoreDocument` or `NotationDocument` schema change is human-gated.

## SEC-NE-04B2 gate

Implicit gaps remain non-authoritative until 04B1 is complete and 04B2 can prove legal silence for the exact target voice. No cross-voice proof and no renderer-coordinate inference.

## SEC-NE-05 gate

Onset movement/retiming requires exact overlap and measure validation plus frozen tie/slur/beam/tuplet coupling. Tuplet retiming must be atomic.

## Product and authority rules

- `ScoreDocument` remains canonical.
- MusicXML is exchange/projection data, not live editor state.
- Renderer/DOM/SVG coordinates never become musical authority.
- SesliTab is a host/orchestrator and may not dual-write score state.
- OMR/AI output is evidence/advice only.
- Guitar string/fret/fingering remains derivative unless separately admitted.
- Original source evidence remains immutable.
- Repository merge does not activate production/public write/live AI/direct engine invocation.

## Documentation gates

Architecture-changing PRs must synchronize affected current-reality documents. See:

- `ARCHITECTURE.md`
- `docs/sibelius-editor-expansion-plan.md`
- `docs/score-authoring-capability-matrix.json`
- `docs/insertion-and-timing-authority.md`
- `docs/musicxml-roundtrip-policy.md`
- `docs/seslitab-editor-integration-contract.md`
