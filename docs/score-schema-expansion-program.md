# SCORE-SCHEMA-EXPANSION Program

Status: **SSE-09 COMPLETE / MERGED; SSE-10 DESIGN CANDIDATE / HUMAN REVIEW REQUIRED**

SSE-00–09 are complete and merged. SSE-10 now has a bounded design candidate for Sibelius-style cross-staff presentation; runtime implementation has not started.

## Completed sequence

- **SSE-00–07 — COMPLETE / MERGED:** V2 schema/session, grace/articulation/ornament authoring, bounded MusicXML V2, renderer and SesliTab V2 compatibility.
- **SSE-08 — COMPLETE / MERGED:** V3 staff/part topology design freeze.
- **SSE-09 — COMPLETE / MERGED:** V3 topology substrate, migration, history/session, renderer contract and bounded topology authoring.
- **SSE-10 — DESIGN CANDIDATE / HUMAN REVIEW REQUIRED:** cross-staff presentation and relation ownership. Runtime not started.

## SSE-10 fresh-read conclusion

`ScoreDocumentV3` already owns the exact source part/staff/frame/measure/voice/event hierarchy, and `SemanticAddressV3` already addresses it exactly. Cross-staff notation therefore should not move an event into another canonical staff or create a second score event.

The candidate keeps:

- `ScoreDocumentV3/3.0.0`;
- `SemanticAddressV3/3.0.0`.

It proposes:

- `NotationDocumentV4/4.0.0` with `crossStaffPlacements`.

A placement points from one current `EventAddressV3` to an explicit `displayStaffId`. Source ownership, event/note identity, pitch and timing remain unchanged.

## Initial bounded profile

- normal timed pitched event only (`note` or `chord`);
- whole event moves as one display unit;
- source and display staff are distinct `standard` staffs in the same part;
- same global frame correspondence is required;
- no rest/grace/percussion/linked-TAB placement;
- no split chord;
- no coordinate or nearest-staff inference.

Existing beam/tie/slur/tuplet/ornament semantics remain source-owned. An existing same-source-voice beam may become visually cross-staff because member events have display assignments. New relations between independent source voices/staffs are not admitted.

## Migration candidate

Notation V3 -> V4 preserves all V3 notation and initializes `crossStaffPlacements=[]`.

V4 -> V3 is lossless-only and requires empty placements. Flattening by moving canonical events into display staffs is forbidden.

## MusicXML / renderer boundary

Current serializer uses canonical source-staff streams for `<staff>` and cannot prove source/display ownership round-trip for non-empty placements. Cross-staff MusicXML is therefore not admitted by this design candidate. A future V4 renderer/export contract must remain pending/fail-closed until preservation is explicitly solved.

## Human gate

The candidate is documented in `docs/cross-staff-relation-contract.md` and `.json`.

No SSE-10 runtime may begin until explicit human approval freezes this design. After approval, implementation must separately prove V4 validation/migration, topology orphan protection, source-identity selection, atomic history, renderer/MusicXML fail-closed behavior and Node 18/20/22 CI.

## Still separately gated

- split-chord, grace, rest and percussion cross-staff semantics;
- linked TAB cross-staff targets;
- relations between independent source voices/staffs;
- V4-native cross-staff MusicXML round trip;
- SesliTab V4 product cutover;
- polymeter/non-controlling topology;
- part groups/brackets/braces;
- arbitrary transposition and percussion maps;
- layout/page/system geometry as canonical state;
- E8-D external-engine invocation;
- persistence/network/public-write/production activation.
