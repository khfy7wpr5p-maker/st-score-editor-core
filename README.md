# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for ST score products.

## Current reality

SCORE-SCHEMA-EXPANSION is implemented through **SSE-09 bounded v3 staff/part topology**.

- **SSE-00–09 — COMPLETE / MERGED:** v2 schema/session, grace/articulation/ornament authoring, bounded MusicXML v2, renderer/SesliTab v2 compatibility, the approved v3 topology contract, and bounded V3 staff/part topology runtime.
- **SSE-10 — DESIGN CANDIDATE / HUMAN REVIEW REQUIRED:** cross-staff presentation and relation-ownership boundary. Runtime is not started.

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

## SSE-10 design candidate

Fresh-read shows that cross-staff notation does not require moving canonical events between staffs. The proposed boundary keeps `ScoreDocumentV3` and `SemanticAddressV3` unchanged and introduces a future `NotationDocumentV4/4.0.0` with explicit event-level `crossStaffPlacements`.

The source part/staff/measure/voice, event/note identity, pitch and timing remain unchanged. The display staff is notation semantics only. Existing beam/tie/slur/tuplet/ornament ownership remains attached to source canonical events/notes; visually cross-staff rendering does not create a second relation model.

Initial design is intentionally bounded to whole pitched normal events moving between distinct standard staffs in the same part. Split chords, grace/rest/percussion placement, linked TAB targets and relations between independent source voices/staffs remain outside the initial profile.

See `docs/cross-staff-relation-contract.md` and `.json`. The contract is not frozen until explicit human approval.

## Renderer / product boundary

Current V3 renderer uses the proven V2 projection only when lossless; otherwise it returns `V3_XML_PENDING`. The SSE-10 design does not claim cross-staff MusicXML round trip. Non-empty future cross-staff placements must remain fail-closed/pending until an admitted projection exists.

SesliTab V3/V4 product cutover is not activated. MusicXML remains exchange/projection data; renderer/SesliTab remain noncanonical; Guitar string/fret/fingering/voicing remains derivative. Runtime dependencies remain `saxes@6.0.0` and `xmlchars@2.2.0`.
