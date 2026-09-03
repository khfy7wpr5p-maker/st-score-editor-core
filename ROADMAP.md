# Roadmap

## Current source of truth

Repository reality only; planned capability is not production capability.

## Completed baseline

- **E0–E7-H — COMPLETE**
- **E8-A/B/C — IMPLEMENTED**
- **E8-D — HUMAN-GATED / NOT AUTHORIZED**
- **SEC-KP-00–10 — COMPLETE**
- **SEC-NE-00–09 + XML ROUNDTRIP — COMPLETE / MERGED** within documented bounded profiles.

## SCORE-SCHEMA-EXPANSION

- **SSE-00–07 — COMPLETE / MERGED:** v2 contract/session, grace/articulation/ornament authoring, bounded MusicXML v2, renderer and SesliTab v2 compatibility.
- **SSE-08 — COMPLETE / MERGED:** human-approved V3 staff/part topology contract freeze.
- **SSE-09 — COMPLETE / MERGED:** bounded V3 topology runtime and authoring.
- **SSE-10 — DESIGN CANDIDATE / HUMAN REVIEW REQUIRED:** cross-staff presentation and relation-ownership boundary. Runtime not started.

## SSE-10 candidate direction

- keep `ScoreDocumentV3/3.0.0` unchanged;
- keep `SemanticAddressV3/3.0.0` unchanged;
- propose `NotationDocumentV4/4.0.0` with `crossStaffPlacements`;
- source event remains in its original canonical staff/measure/voice;
- display assignment is notation semantics only;
- initial profile: whole pitched normal event (`note`/`chord`) to a distinct standard staff in the same part;
- existing beam/tie/slur/tuplet/ornament semantics remain source-owned;
- an existing source-voice beam may render across staves when member events have display assignments;
- no relation between independent source voices/staffs is admitted;
- V3 -> V4 notation migration initializes empty placements;
- V4 -> V3 downgrade is lossless-only and requires empty placements;
- non-empty placement MusicXML/render projection remains fail-closed until a separate admitted V4 projection exists.

Full candidate: `docs/cross-staff-relation-contract.md` and `.json`.

## Still fail-closed / gated

- SSE-10 runtime before explicit design approval/freeze;
- split-chord, grace, rest and percussion cross-staff placement;
- linked TAB as cross-staff target;
- cross-source-staff beam/tie/slur/tuplet/ornament relations;
- V4-native cross-staff MusicXML round trip;
- SesliTab V4 product cutover;
- polymeter/non-controlling topology;
- part groups/brackets/braces;
- arbitrary instrument transposition and percussion maps;
- renderer-coordinate authoring, DOM/SVG authority and host dual-write;
- E8-D direct external-engine invocation;
- persistence/network/public-write/production activation;
- `.mxl` container support.

SSE-10 runtime may begin only after explicit human approval of the design candidate.
