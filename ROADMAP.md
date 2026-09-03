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

- **SSE-00–07 — COMPLETE / MERGED:** V2 contract/session, grace/articulation/ornament authoring, bounded MusicXML V2, renderer and SesliTab V2 compatibility.
- **SSE-08 — COMPLETE / MERGED:** approved V3 staff/part topology contract freeze.
- **SSE-09 — COMPLETE / MERGED:** bounded V3 topology runtime and authoring.
- **SSE-10 design — APPROVED / FROZEN / MERGED:** cross-staff presentation ownership contract.
- **SSE-10 runtime — COMPLETE / MERGED:** bounded Notation V4 cross-staff placement runtime.

## SSE-10 exact capability

- `ScoreDocumentV3/3.0.0` unchanged as musical/topology authority;
- `SemanticAddressV3/3.0.0` unchanged as source identity;
- `NotationDocumentV4/4.0.0` adds validated `crossStaffPlacements`;
- normal pitched note/chord event only;
- whole-event display assignment to a distinct standard staff in the same part;
- source staff/measure/voice, identity, pitch and timing preserved;
- V3 -> V4 notation migration is additive with empty placements;
- V4 -> V3 downgrade is lossless-only and rejects non-empty placements;
- explicit set/remove placement authoring with revision-bound semantic source targets;
- existing beam/tie/slur/tuplet/ornament ownership remains source-owned;
- V4-aware topology wrapper rejects placement orphaning and preserves reorder by stable ID;
- atomic score-v3 + notation-v4 history/session with unified undo/redo;
- renderer tokens resolve original source semantic identity;
- non-empty placements produce `CROSS_STAFF_XML_PENDING` with no MusicXML.

## Still fail-closed / gated

- split-chord cross-staff placement;
- grace/rest/percussion cross-staff placement;
- linked TAB as cross-staff target;
- beam/tie/slur/tuplet/ornament relations between independent source voices/staffs;
- V4-native cross-staff MusicXML round trip;
- SesliTab V4 product cutover;
- polymeter/non-controlling topology;
- part groups/brackets/braces;
- arbitrary instrument transposition and percussion maps;
- renderer-coordinate authoring, DOM/SVG authority and host dual-write;
- E8-D direct external-engine invocation;
- persistence/network/public-write/production activation;
- `.mxl` container support.

SSE-10 merge does not activate product/production authority or expand MusicXML beyond proven lossless projections.
