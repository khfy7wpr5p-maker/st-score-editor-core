# SSE-08 / SSE-09 Staff / Part Topology Contract

Status: **SSE-08 CONTRACT FROZEN / SSE-09 BOUNDED IMPLEMENTATION COMPLETE / MERGED**

## Purpose

This contract defines the canonical staff/part topology model required for safe topology authoring. SSE-08 froze the design; SSE-09 implements that frozen bounded profile without admitting cross-staff ownership or product/production authority.

## Frozen contract versions

- `ScoreDocumentV3/3.0.0`
- `NotationDocumentV3/3.0.0`
- `SemanticAddressV3/3.0.0`
- `RendererRequestV3/3.0.0`

V1 and V2 remain independently valid. A session owns exactly one versioned canonical score+notation pair.

## Canonical topology

### Measure frames

`ScoreDocumentV3.measureFrames[]` is the document-global aligned measure-sequence authority. A frame has stable `id`, contiguous positive `ordinal`, and `displayNumber`.

Every content-bearing staff has exactly one `StaffMeasureV3 { id, frameId, voices }` for every current frame. Staff measures do not own independent display-number or alignment authority.

### Parts and instruments

`PartV3` contains stable `id`, explicit contiguous `ordinal`, `name`, a stable `InstrumentIdentityV3 { id, name, shortName }`, and one or more staffs. Reorder changes ordinal/order, never identity.

Transposition, playback patches/MIDI and arbitrary instrument metadata are outside this bounded profile.

### Staff roles

Finite roles:

- `standard` — canonical content-bearing staff;
- `percussion` — canonical content-bearing staff;
- `tablature-linked` — derivative presentation linked to a standard source staff in the same part.

A linked TAB staff:

- owns `sourceStaffId` and bounded `TabProfileV3 { stringCount, tuning, capoFret }`;
- owns `measures: []` and no canonical voices/events/notes;
- never becomes an independent pitch authority;
- cannot link across parts or to another linked TAB staff;
- keeps string/fret/fingering/voicing derivative Guitar state.

SSE-09 bounded removal policy does **not** cascade source deletion: if a standard source staff still has linked TAB presentation, source removal fails until the linked TAB staff is explicitly removed.

## Notation ownership

`NotationDocumentV3` splits ownership that was combined in V2:

- frame notation: time signature and admitted barlines/repeats;
- staff-measure notation: key signature and clef;
- event/note/grace notation: existing admitted V2 semantics.

Notation remains sparse, same-document and same-revision. Topology removal that would orphan a notation target rejects.

## Semantic addressing

`SemanticAddressV3` adds `measure-frame` and includes `frameId` on staff-measure descendant paths. Identity is based on stable IDs, never ordinals or renderer coordinates. Stale revisions fail closed. Linked TAB staff has no canonical measure descendants.

Instrument identity is canonical part metadata in this bounded profile but is not a separate semantic address kind.

## Migration

### V2 -> V3

Migration:

1. preserves existing document/source/revision/part/staff/measure/voice/event/note/grace IDs;
2. derives explicit part ordinals from current order;
3. creates deterministic noncolliding frame/instrument IDs;
4. requires matching measure count, ordinal and display number across content staffs;
5. rejects missing/misaligned measures;
6. promotes unambiguous aligned time/barline notation to frame ownership;
7. rejects conflicting frame-owned notation;
8. retains key/clef as staff-local notation;
9. never infers linked TAB merely from a TAB clef.

### V3 -> V2

Downgrade is lossless-only. It rejects linked TAB, non-standard roles or V3 topology metadata that V2 would discard. Frame notation may be duplicated into V2 staff measures only where representation remains conflict-free.

## SSE-09 implemented authoring

Implemented typed operations:

- `ADD_STANDARD_OR_PERCUSSION_PART`
- `REMOVE_PART`
- `REORDER_PART`
- `ADD_STANDARD_OR_PERCUSSION_STAFF`
- `REMOVE_CONTENT_STAFF`
- `REORDER_STAFF`
- `ADD_LINKED_TAB_STAFF`
- `REMOVE_LINKED_TAB_STAFF`
- `RENAME_PART_OR_INSTRUMENT`

All operations use exact current revision-bound targets and one direct-child score revision. Caller-provided identity plans are validated globally.

### Add content topology

New content staffs/parts do not copy rhythm from neighbors. Every frame must have an effective controlling meter. SSE-09 then creates one explicit voice containing one explicit full-frame rest with caller-supplied measure/voice/rest IDs. If meter proof is absent, the operation fails closed.

### Removal/reorder

- final part removal is forbidden;
- final content-bearing staff removal is forbidden;
- notation orphaning rejects;
- linked TAB source removal rejects until the link is explicitly removed;
- reorder changes only order/ordinal and preserves IDs;
- no implicit nearest-part/staff retargeting or cascading deletion is admitted.

## V3 history and session

`editor-history-v3` stores atomic `ScoreDocumentV3 + NotationDocumentV3` snapshots and accepts only direct-child commits. `editor-session-controller-v3` supports native V3 session creation, one-time V2->V3 session migration, topology commits, semantic selection and undo/redo. It never retains a parallel mutable V2 authority.

## Renderer / MusicXML

`RendererRequestV3` uses the existing proven V2 renderer pipeline only after lossless V3->V2 downgrade. If downgrade loses topology or downstream bounded MusicXML cannot represent the pair, status is `V3_XML_PENDING` and `musicXml` is null.

This is intentionally fail-closed. SSE-09 does not implement V3-native staff/part topology MusicXML import/export and does not flatten linked TAB into a second canonical score.

## SesliTab / host boundary

SSE-09 adds V3 core session support but **does not cut SesliTab product integration to V3**. Existing SesliTab V2 facade remains current. Hosts may not maintain a parallel topology tree, dual-write score state, or use DOM/SVG geometry as topology identity.

## Explicitly out of scope / next gates

- cross-staff note relocation and ownership;
- cross-staff beam/tie/slur/tuplet/ornament relations;
- polymeter/non-controlling topology;
- part groups/brackets/braces;
- arbitrary instrument transposition;
- percussion maps;
- page/system/layout geometry;
- playback/MIDI routing;
- V3-native topology MusicXML beyond later admitted contracts;
- `.mxl`;
- E8-D external-engine invocation;
- persistence/network/public-write/production activation.

**SSE-10 is the next human gate and must freeze cross-staff canonical ownership before any cross-staff implementation begins.**
