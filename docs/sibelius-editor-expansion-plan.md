# Sibelius-style Editor Expansion Plan

Date: 2026-09-03

Goal: evolve ST Score Editor Core into a renderer-independent general score-authoring core without weakening canonical authority, source immutability or fail-closed validation.

## Completed foundation

SCORE-SCHEMA-EXPANSION through SSE-09 is COMPLETE / MERGED: V2 notation expansion, bounded MusicXML, renderer/SesliTab v2 compatibility, V3 staff/part topology and bounded topology authoring.

## SSE-10 — Cross-staff presentation — DESIGN CANDIDATE / HUMAN REVIEW REQUIRED

Fresh-read shows that Sibelius-style cross-staff notation can be modeled without moving musical events into another canonical staff.

The candidate keeps:

- `ScoreDocumentV3/3.0.0` as musical/topology authority;
- `SemanticAddressV3/3.0.0` as source identity;
- source event staff/measure/voice, pitch, timing and IDs unchanged.

It proposes `NotationDocumentV4/4.0.0` with explicit `crossStaffPlacements` that map a current pitched normal source event to a distinct standard display staff in the same part.

### Initial bounded behavior

- note/chord event only;
- whole event displayed on one target staff;
- source/display staffs are standard and same-part;
- no split chord, rest, grace, percussion or linked-TAB target;
- no coordinate/nearest-staff inference;
- rendered selection resolves back to original source event/note identity.

### Relation behavior

Beams, ties, slurs, tuplets and ornaments remain source-owned. Existing source-voice relationships may become visually cross-staff due to display placement, but SSE-10 does not create relations between independent canonical source voices/staffs.

This preserves the current timing and relation authority while enabling the visual notation concept needed for piano-style cross-staff writing.

### Migration / renderer boundary

Notation V3 -> V4 would preserve V3 semantics and create an empty placement collection. V4 -> V3 downgrade would be allowed only when placements are empty.

Current MusicXML projection does not prove the distinction between canonical source staff and display staff, so cross-staff MusicXML round trip is not admitted by this candidate. Non-empty placements remain fail-closed/pending until a separate projection contract is designed.

## After design approval

The first implementation stage may build V4 notation validation/migration, cross-staff placement authoring, atomic history/session integration, topology orphan guards and pending renderer behavior. Runtime work must not begin before explicit human approval freezes the candidate.

## Remaining gates

- split-chord/grace/rest/percussion cross-staff semantics;
- relations between independent source voices/staffs;
- cross-staff MusicXML V4 round trip;
- SesliTab V4 product cutover;
- polymeter/non-controlling topology;
- part groups/brackets/braces;
- layout geometry as canonical data;
- playback/MIDI routing;
- E8-D direct external-engine invocation;
- persistence/network/public-write/production activation.

Full candidate: `docs/cross-staff-relation-contract.md` and `.json`.
