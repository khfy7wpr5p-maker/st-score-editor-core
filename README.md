# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for ST score products.

## Current reality

SCORE-SCHEMA-EXPANSION is implemented through **SSE-09 bounded v3 staff/part topology** on this merge candidate.

- **SSE-00–08 — COMPLETE / MERGED:** v2 schema/session, grace/articulation/ornament authoring, bounded MusicXML v2, renderer/SesliTab v2 compatibility, and the approved v3 topology contract.
- **SSE-09 — COMPLETE / MERGE CANDIDATE:** additive V3 score/notation/addressing/migration/history/session/renderer substrate plus bounded staff/part topology authoring.
- **SSE-10 — HUMAN-GATED DESIGN:** cross-staff canonical relation ownership.

## SSE-09 V3 topology runtime

`ScoreDocumentV3/3.0.0` makes staff/part topology explicit:

- document-global stable `measureFrames` are the aligned measure-sequence authority;
- parts have stable IDs, explicit contiguous ordinals, and stable instrument identity;
- `standard` and `percussion` staffs are content-bearing;
- each content staff owns exactly one `StaffMeasureV3` per frame;
- `tablature-linked` staff is derivative presentation linked to a same-part standard staff and owns no independent measures/events/notes;
- V3 notation owns time/barlines at frame level and key/clef at staff-measure level;
- `SemanticAddressV3` includes `measure-frame` and frame identity on descendants.

V2 -> V3 migration is guarded and rejects misaligned measure sequences or conflicting frame-owned notation. V3 -> V2 is lossless-only.

Bounded authoring supports add/remove/reorder part, add/remove/reorder standard/percussion staff, add/remove linked TAB presentation staff, and part/instrument rename. Content-staff creation requires effective meter on every frame and creates explicit caller-identified full-frame rests; missing meter fails closed. Removals never cascade silently or orphan notation.

## V3 session and renderer boundary

`EditorSessionStateV3` stores one canonical V3 score+notation pair with direct-child atomic history. V2 input may be migrated once at the V3 session boundary; no parallel mutable V2/V3 pair is retained.

`RendererRequestV3` uses the proven V2 renderer pipeline only when V3 can be downgraded and serialized without loss. Otherwise it returns `V3_XML_PENDING` with `musicXml: null`. Linked TAB topology and other unrepresentable V3 topology therefore remain canonical without being silently flattened for a renderer.

SSE-09 does **not** cut SesliTab product runtime to V3 and does not add a V3-native topology MusicXML profile. Existing SesliTab v2 integration remains current until a separately admitted integration stage.

## Authority and dependencies

MusicXML remains exchange/projection data; renderer/SesliTab remain noncanonical; Guitar string/fret/fingering/voicing remains derivative. Runtime dependencies remain `saxes@6.0.0` and `xmlchars@2.2.0`. Cross-staff, polymeter/non-controlling topology, E8-D, persistence/network, and production/public-write authority remain unactivated.
