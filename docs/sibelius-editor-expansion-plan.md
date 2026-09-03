# Sibelius-style Editor Expansion Plan

Date: 2026-09-03

Goal: evolve ST Score Editor Core into a renderer-independent general score-authoring core without weakening canonical authority, source immutability or fail-closed validation.

## Completed foundation

SCORE-SCHEMA-EXPANSION through SSE-10 bounded scope is COMPLETE / MERGED: V2 notation expansion, bounded MusicXML, renderer/SesliTab V2 compatibility, V3 staff/part topology and bounded topology authoring, plus the first Notation V4 cross-staff presentation runtime.

## SSE-10 — Cross-staff presentation — COMPLETE / MERGED

Cross-staff notation is modeled without moving musical events into another canonical staff.

The runtime keeps:

- `ScoreDocumentV3/3.0.0` as musical/topology authority;
- `SemanticAddressV3/3.0.0` as source identity;
- source event staff/measure/voice, pitch, timing and IDs unchanged.

It adds `NotationDocumentV4/4.0.0` with explicit `crossStaffPlacements` mapping a current pitched normal source event to a distinct standard display staff in the same part.

### Initial bounded behavior

- note/chord event only;
- whole event displayed on one target staff;
- source/display staffs are distinct standard staffs in the same part;
- same measure-frame correspondence required;
- no split chord, rest, grace, percussion or linked-TAB target;
- no coordinate/nearest-staff inference;
- rendered selection resolves to original source semantic identity.

### Relation behavior

Beams, ties, slurs, tuplets and ornaments remain source-owned. Existing source-voice relationships may become visually cross-staff due to display placement, but SSE-10 does not create relations between independent canonical source voices/staffs.

### Runtime surfaces

Merged:

- exact Notation V4 validation;
- deterministic V3 -> V4 notation migration;
- lossless-only V4 -> V3 downgrade;
- explicit set/remove placement authoring;
- V4-aware topology orphan guards;
- atomic score-v3 + notation-v4 history/session;
- fail-closed RendererRequestV4;
- source-identity renderer token mapping.

### Renderer / MusicXML boundary

Empty placement sets may reuse the existing lossless V3/V2 MusicXML path. Non-empty placements return `CROSS_STAFF_XML_PENDING` with no XML.

Current MusicXML projection cannot yet prove canonical source staff versus display staff ownership round trip. V4-native cross-staff MusicXML therefore remains a separate future stage.

### Product boundary

SesliTab V4 product cutover is not part of SSE-10 runtime. Playback timing/pitch is unchanged by display placement. Renderer/host geometry remains noncanonical.

## Remaining gates

- split-chord/grace/rest/percussion cross-staff semantics;
- linked TAB cross-staff targets;
- relations between independent source voices/staffs;
- cross-staff MusicXML V4 round trip;
- SesliTab V4 product cutover;
- polymeter/non-controlling topology;
- part groups/brackets/braces;
- layout geometry as canonical data;
- playback/MIDI routing;
- E8-D direct external-engine invocation;
- persistence/network/public-write/production activation.

Full frozen contract: `docs/cross-staff-relation-contract.md` and `.json`.
