# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for ST score products.

## Current reality

SCORE-SCHEMA-EXPANSION is implemented through **SSE-07 renderer + SesliTab v2 compatibility** on this merge candidate.

- **SSE-00–06 — COMPLETE / MERGED:** v2 schema/session, grace/articulation/ornament authoring and bounded MusicXML v2 round trip.
- **SSE-07 — COMPLETE / MERGE CANDIDATE:** renderer v2 projection, additive OSMD/alphaTab v2 adapters and separate SesliTab v2 host facade.
- **SSE-08 — HUMAN-GATED DESIGN:** staff/part topology contract.

## SSE-07 renderer projection

`renderer-contract-v2` now chooses the safest available projection in order:

1. lossless v2 -> v1 downgrade: `V1_COMPATIBLE_XML`;
2. otherwise bounded SSE-06 serialization: `V2_SEMANTIC_XML`;
3. if the bounded v2 serializer cannot represent the canonical pair: `VNEXT_XML_PENDING` with `musicXml: null`.

Opaque revision-bound v2 manifest tokens remain the only renderer hit/selection bridge and cover normal plus grace semantic addresses. Renderer geometry/DOM state never becomes mutation authority.

Legacy renderer APIs remain unchanged. Additive `renderWithOsmdV2` and `renderWithAlphaTabV2` consume only renderable v2 requests and reject pending requests before renderer load. Exact admitted renderer version/license profiles remain enforced, including the ST Rendering Layer OSMD 2.1.2 integration profile.

## SesliTab v2 boundary

`seslitab-editor-host-v2/2.0.0` wraps one canonical `EditorSessionStateV2`. It exposes v2 render-token selection, grace/articulation/ornament commits and unified undo/redo without creating host-owned score state.

Pointer, keyboard and touch provenance converge on the same semantic editor paths. Host dual-write, renderer mutation authority, DOM-coordinate mutation authority, network/persistence/publication/production authority remain disabled. Playback remains host-owned and editor admission does not control playback.

## MusicXML and authority

SSE-06 direct `serializeNotationMusicXmlV2` / `importNotationMusicXmlV2` exchange remains unchanged. MusicXML is projection/exchange data, not live editor state. One v2 score+notation pair remains canonical per v2 session. Runtime dependencies remain `saxes@6.0.0` and `xmlchars@2.2.0`; no staff/part topology, cross-staff, E8-D or production/public-write authority is activated.