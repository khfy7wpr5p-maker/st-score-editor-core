# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for ST score products.

## Current reality

SCORE-SCHEMA-EXPANSION is implemented through **SSE-05 relation-safe ornament authoring** on this merge candidate.

- **SSE-00–04 — COMPLETE / MERGED:** approved v2 contract, dual-version substrate, one canonical v2 session, grace authoring and typed articulation authoring.
- **SSE-05 — COMPLETE / MERGE CANDIDATE:** local ornament authoring plus bounded atomic tremolo/wavy-line relations.
- **SSE-06 — NEXT:** vNext MusicXML semantic round trip.

## SSE-05 ornament authoring

`editor-ornament-authoring-v2/1.0.0` keeps ornament semantics in `NotationDocumentV2` and exposes two deliberately different authority profiles.

Local authoring admits the frozen simple-ornament vocabulary and single-note tremolo on exact current normal `event` or `grace-event` targets. Add, toggle and remove operations cannot be used to fabricate one endpoint of a spanning relation.

Spanning authoring is atomic and bounded. Two-note tremolo and wavy-line chains are created/removed as whole relations on exact normal pitched events in one part/staff/measure/voice. Targets must be unique and strictly increasing in canonical event order. Rest members, cross-scope targets, grace-spanning relations and relation-number collisions fail closed.

Every accepted ornament edit advances one direct-child `ScoreDocumentV2` revision without changing pitch/onset/duration or other canonical musical content, creates same-revision notation, and commits through unified v2 history. Ornament-bearing pairs remain `VNEXT_XML_PENDING` with `musicXml: null` until SSE-06 rather than silently losing notation.

## Authority and dependencies

One v2 score+notation pair remains canonical per v2 session. Renderer/SesliTab remain noncanonical and Guitar remains derivative-only. Runtime dependencies remain `saxes@6.0.0` and `xmlchars@2.2.0`; no production/public-write, persistence/network, E8-D or staff/part topology authority is activated.