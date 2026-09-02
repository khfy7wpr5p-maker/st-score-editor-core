# SCORE-SCHEMA-EXPANSION Program

Status: **SSE-09 COMPLETE / MERGED**

SSE-00–09 are complete and merged. SSE-09 implements the frozen V3 staff/part topology contract as an additive core runtime. Cross-staff ownership remains the next human-gated design stage.

## Completed sequence

- **SSE-00–07 — COMPLETE / MERGED:** V2 schema/session, grace/articulation/ornament authoring, bounded MusicXML V2, renderer and SesliTab V2 compatibility.
- **SSE-08 — COMPLETE / MERGED:** V3 staff/part topology design freeze.
- **SSE-09 — COMPLETE / MERGED:** V3 topology substrate, migration, history/session, renderer contract and bounded topology authoring.
- **SSE-10 — HUMAN-GATED DESIGN:** cross-staff canonical relation ownership.

## V3 runtime

The additive contracts are:

- `ScoreDocumentV3/3.0.0`;
- `NotationDocumentV3/3.0.0`;
- `SemanticAddressV3/3.0.0`;
- `RendererRequestV3/3.0.0`.

A V3 session owns exactly one V3 score+notation pair. V2 remains independently supported; V2 input may migrate once into V3, but no session keeps parallel mutable V2/V3 authority.

### Topology authority

- document-global `measureFrames` own aligned measure sequence and display number;
- parts own stable identity, explicit ordinal and stable instrument identity;
- standard/percussion staffs own canonical measures/voices/events;
- linked TAB is derivative presentation with `sourceStaffId`, tuning/capo profile and no independent canonical measure/event stream;
- frame notation owns time/barlines;
- staff-measure notation owns key/clef;
- event/note/grace notation retains V2 meaning.

### Migration

V2 -> V3 requires proven staff alignment and unambiguous frame notation ownership. Existing musical IDs are preserved; fresh frame/instrument IDs are deterministic and collision-safe. TAB clef does not infer linked TAB topology.

V3 -> V2 is lossless-only and rejects linked TAB, non-standard topology or V3 metadata that would disappear.

### Authoring

SSE-09 admits:

- add/remove/reorder part;
- add/remove/reorder standard/percussion staff;
- add/remove linked TAB presentation staff;
- rename part/instrument display metadata.

All intents use exact revision-bound semantic addresses. New identity plans are explicit. Adding content topology requires effective meter for every frame and creates only explicit full-frame rests; no rhythmic copying/inference is allowed. Removals reject notation orphaning, final-part/final-content-staff deletion and linked-TAB source orphaning.

### History and renderer

Accepted topology mutation is one direct-child V3 score revision plus same-revision notation in atomic history.

Renderer V3 reuses the proven V2 projection only when downgrade and serialization are lossless. Otherwise `V3_XML_PENDING` carries no MusicXML. This preserves canonical topology without lossy renderer output.

## Product boundary

SSE-09 does not activate SesliTab V3 product cutover or V3-native topology MusicXML import/export. Existing SesliTab V2 integration remains current. MusicXML remains exchange/projection data; renderer/host/Guitar remain noncanonical.

## Explicitly gated

- cross-staff note/beam/tie/slur/tuplet/ornament ownership;
- polymeter/non-controlling topology;
- part groups/brackets/braces;
- arbitrary transposition and percussion maps;
- layout/page/system geometry;
- playback/MIDI routing;
- V3-native topology exchange beyond existing lossless projection;
- E8-D external-engine invocation;
- persistence/network/public-write/production activation.

Source of truth for topology invariants: `docs/staff-part-topology-contract.md` and `.json`.
