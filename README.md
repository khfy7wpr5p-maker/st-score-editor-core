# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for ST score products.

## Current reality

SCORE-SCHEMA-EXPANSION is implemented through **SSE-07 renderer + SesliTab v2 compatibility**. SSE-08 is a human-approved **design freeze only** for the next staff/part topology schema.

- **SSE-00–07 — COMPLETE / MERGED:** v2 schema/session, grace/articulation/ornament authoring, bounded MusicXML v2 round trip, renderer v2 projection and SesliTab v2 compatibility.
- **SSE-08 — HUMAN-APPROVED DESIGN FREEZE / MERGE CANDIDATE:** staff/part topology contract for a future `ScoreDocumentV3 + NotationDocumentV3` implementation.
- **SSE-09 — NOT STARTED:** topology authoring against the frozen v3 contract.
- **SSE-10 — NOT STARTED:** cross-staff canonical relation model.

## SSE-08 topology design

The frozen design makes aligned measure ownership explicit instead of relying on the first staff as an implicit reference timeline.

- document-global stable `measureFrames` become the measure-sequence authority;
- parts gain stable explicit ordinals and stable instrument identity;
- content staves are `standard` or `percussion`;
- `tablature-linked` staff is derivative presentation linked to a canonical standard staff and owns no independent note/event stream;
- v3 notation separates frame-owned time/barline semantics from staff-measure key/clef semantics;
- v3 addressing adds exact measure-frame identity and remains revision-bound;
- v2 -> v3 migration must reject misaligned measures or conflicting ownership rather than repair silently.

See `docs/staff-part-topology-contract.md` and its machine-readable JSON mirror.

## Existing SSE-07 renderer / SesliTab boundary

`renderer-contract-v2` chooses the safest available projection:

1. lossless v2 -> v1 downgrade: `V1_COMPATIBLE_XML`;
2. otherwise bounded SSE-06 serialization: `V2_SEMANTIC_XML`;
3. unrepresentable canonical pair: `VNEXT_XML_PENDING` with `musicXml: null`.

Opaque revision-bound manifest tokens remain the only renderer hit/selection bridge. Additive OSMD/alphaTab v2 adapters and `seslitab-editor-host-v2` do not create renderer or host canonical authority. Playback remains host-owned and editor admission does not control playback.

## Authority and dependencies

The active runtime still uses one canonical v2 score+notation pair per v2 session. SSE-08 does not activate v3 runtime code. MusicXML remains exchange/projection data; renderer/SesliTab remain noncanonical; Guitar string/fret/fingering remains derivative. Runtime dependencies remain `saxes@6.0.0` and `xmlchars@2.2.0`; no cross-staff, E8-D, persistence/network or production/public-write authority is activated.