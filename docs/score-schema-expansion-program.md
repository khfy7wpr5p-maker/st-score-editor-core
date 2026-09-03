# SCORE-SCHEMA-EXPANSION Program

Status: **SSE-10 DESIGN APPROVED/FROZEN; BOUNDED RUNTIME COMPLETE / MERGE CANDIDATE**

SSE-00–09 are complete and merged. The SSE-10 cross-staff presentation design is approved, frozen and merged. The first bounded V4 runtime is implemented on this merge candidate.

## Completed sequence

- **SSE-00–07 — COMPLETE / MERGED:** V2 schema/session, grace/articulation/ornament authoring, bounded MusicXML V2, renderer and SesliTab V2 compatibility.
- **SSE-08 — COMPLETE / MERGED:** V3 staff/part topology design freeze.
- **SSE-09 — COMPLETE / MERGED:** V3 topology substrate, migration, history/session, renderer contract and bounded topology authoring.
- **SSE-10 design — APPROVED / FROZEN / MERGED:** cross-staff presentation and relation ownership.
- **SSE-10 runtime — COMPLETE / MERGE CANDIDATE:** bounded Notation V4 placement runtime.

## SSE-10 runtime contracts

The runtime keeps:

- `ScoreDocumentV3/3.0.0` as musical/topology authority;
- `SemanticAddressV3/3.0.0` as source semantic identity.

It adds:

- `NotationDocumentV4/4.0.0`;
- `schema-migration-v3-v4/1.0.0`;
- `editor-cross-staff-authoring-v4/1.0.0`;
- `editor-topology-authoring-v4/1.0.0`;
- `editor-history-v4/4.0.0`;
- `editor-session-controller-v4/4.0.0`;
- `RendererRequestV4/4.0.0`.

## Admitted cross-staff profile

A placement maps one current `EventAddressV3` to an explicit display staff ID.

- normal timed pitched event only (`note` or `chord`);
- whole event moves visually as one unit;
- source/display are distinct standard staffs in the same part;
- same frame correspondence is required;
- source staff/measure/voice, event/note IDs, pitch and timing remain unchanged;
- no rest/grace/percussion/linked-TAB placement;
- no split chord;
- no coordinate or nearest-staff inference.

Existing beam/tie/slur/tuplet/ornament semantics remain source-owned. Visual placement does not widen relation authoring across independent canonical source voices/staffs.

## Migration and history

Notation V3 -> V4 preserves all existing notation and initializes an empty placement collection.

V4 -> V3 is lossless-only and rejects any non-empty placement set. No canonical event is moved to simulate downgrade.

Accepted placement edits create one direct-child score revision without changing musical content and bind V4 notation to that revision. V4 history/session uses one atomic score-v3 + notation-v4 pair with unified undo/redo.

## Topology composition

The V4 topology wrapper reuses SSE-09 topology behavior and then revalidates every placement against the resulting score. Removal of a source/display staff or part that would orphan placement semantics rejects the whole candidate. Staff reorder remains safe by stable IDs.

## Renderer / MusicXML boundary

Empty V4 placement sets may reuse the existing lossless V3/V2 renderer projection. Non-empty placements return `CROSS_STAFF_XML_PENDING` and no MusicXML.

Renderer tokens keep original source `SemanticAddressV3` ancestry. Cross-staff MusicXML round trip remains unimplemented and separately gated.

## Product boundary

SesliTab V4 product cutover is not activated. MusicXML remains exchange/projection data; renderer/host/Guitar remain noncanonical. Persistence/network/public-write/production activation remains separate.

## Still separately gated

- split-chord/grace/rest/percussion cross-staff semantics;
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

Source of truth: `docs/cross-staff-relation-contract.md` and `.json`.
