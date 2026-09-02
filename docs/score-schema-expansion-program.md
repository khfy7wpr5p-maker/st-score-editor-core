# SCORE-SCHEMA-EXPANSION Program

Status: **SSE-08 HUMAN-APPROVED DESIGN FREEZE / MERGE CANDIDATE**

SSE-00–07 are implemented and merged. SSE-08 freezes the next major staff/part topology contract without activating v3 runtime code. SSE-09 topology authoring remains not started.

## Mission

Extend ST Score Editor Core without weakening canonical authority, revision binding, source immutability, unified history, MusicXML safety, renderer isolation, Guitar derivative authority or SesliTab no-dual-write rules.

## Completed v2 sequence

- **SSE-00 — COMPLETE / MERGED:** v2 contract freeze and approval.
- **SSE-01 — COMPLETE / MERGED:** v2 score/address/notation substrate and guarded migrations.
- **SSE-02 — COMPLETE / MERGED:** one canonical v2 session/history/render/selection state.
- **SSE-03 — COMPLETE / MERGED:** canonical grace authoring.
- **SSE-04 — COMPLETE / MERGED:** typed articulation authoring.
- **SSE-05 — COMPLETE / MERGED:** relation-safe ornament authoring.
- **SSE-06 — COMPLETE / MERGED:** bounded isolated MusicXML v2 round trip.
- **SSE-07 — COMPLETE / MERGED:** renderer v2 projection and additive SesliTab v2 compatibility.

The active runtime remains `ScoreDocumentV2 + NotationDocumentV2` until a later implementation stage performs an explicit v3 cutover.

## Why SSE-08 requires v3

Current v2 topology inherits the v1 nested structure. Part order is implicit array order, measures are independently nested under each staff, aligned measure identity is not explicit, instrument identity is absent and TAB staff authority is undefined.

MusicXML serializers use one staff as a reference measure sequence. That is acceptable for the current bounded profile, but it is not sufficient authority for safe add/remove/reorder topology authoring.

## Frozen SSE-08 target

The approved design target is:

- `ScoreDocumentV3/3.0.0`;
- `NotationDocumentV3/3.0.0`;
- `SemanticAddressV3/3.0.0`;
- `RendererRequestV3/3.0.0`.

### Part and instrument identity

`PartV3` adds explicit positive unique ordinal and a stable instrument identity. Reordering changes order/ordinal but not part, staff or instrument IDs.

The initial instrument identity profile is intentionally narrow: stable ID, name and short name. Transposition, playback patches/MIDI and arbitrary external metadata remain outside SSE-08.

### Staff roles

Frozen roles:

- `standard` — canonical content-bearing musical staff;
- `percussion` — canonical content-bearing percussion staff;
- `tablature-linked` — derivative presentation staff linked to a standard source staff.

A linked TAB staff owns no independent canonical voices/events/notes. Its note/fret presentation resolves to source canonical event/note identity. String/fret/fingering/voicing assignments remain derivative Guitar state.

### Global measure frames

`ScoreDocumentV3.measureFrames` becomes the document-global aligned measure-sequence authority. A content-bearing staff contains exactly one `StaffMeasureV3` per frame, and each staff measure carries `frameId` rather than its own independent ordinal/display number authority.

The initial profile rejects polymeter/non-controlling topology rather than inferring correspondence.

### Notation ownership

`NotationDocumentV3` splits current measure notation ownership:

- frame notation: controlling time signature and bounded barline/repeat structure;
- staff-measure notation: key signature and clef;
- event/note/grace notation retains current semantics.

All notation remains sparse, same-document and same-revision.

### Addressing

`SemanticAddressV3` adds `measure-frame` identity and includes `frameId` in staff-measure descendant paths. Stable IDs, not ordinals or coordinates, remain identity authority.

## Migration design

### V2 -> V3

Migration preserves all existing document/source/revision/part/staff/measure/voice/event/note/grace IDs. It creates deterministic fresh frame/instrument identities and derives frames only when current content staves prove aligned measure count, ordinal and display number.

Missing/misaligned measures, conflicting frame-owned notation or ambiguous ownership reject rather than being repaired silently. A TAB clef alone does not auto-convert a v2 content staff into linked TAB topology.

### V3 -> V2

Downgrade remains lossless-only. Linked TAB topology or other v3-only semantics block downgrade when they cannot be represented without semantic loss.

## SSE-09 implementation candidate

After SSE-08 merges, bounded implementation may target:

- add/remove/reorder part;
- add/remove/reorder standard/percussion staff;
- add/remove linked TAB presentation staff;
- rename part/instrument display names;
- exact v3 validation/migration/addressing/history support.

Adding a content staff must not invent ambiguous rhythm. The initial implementation requires effective meter for every frame so it can create deterministic explicit full-frame rests; otherwise it fails closed.

## Still separately gated

- cross-staff note/beam/tie/slur/tuplet/ornament ownership;
- polymeter/non-controlling topology;
- part groups/brackets/braces;
- arbitrary instrument transposition;
- percussion-map authoring;
- layout/page/system geometry;
- playback/MIDI routing;
- direct external-engine invocation;
- persistence/network/public-write/production activation.

## Source of truth

The complete frozen design is `docs/staff-part-topology-contract.md` with machine-readable mirror `docs/staff-part-topology-contract.json`.

SSE-08 completion is a design milestone only. It does not activate or implement `ScoreDocumentV3`.