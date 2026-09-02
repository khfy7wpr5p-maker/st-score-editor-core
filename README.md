# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for ST score products.

## Current reality

SCORE-SCHEMA-EXPANSION is implemented through **SSE-04 typed articulation authoring** on this merge candidate.

- **SSE-00–03 — COMPLETE / MERGED:** approved v2 contract, dual-version substrate, one canonical v2 session and canonical grace authoring.
- **SSE-04 — COMPLETE / MERGE CANDIDATE:** typed articulation set/toggle/remove on normal and grace events.
- **SSE-05 — NEXT:** ornament authoring.

## SSE-04 articulation authoring

`editor-articulation-authoring-v2/1.0.0` operates only on exact current v2 `event` or `grace-event` semantic addresses. It supports `SET_ARTICULATIONS`, `TOGGLE_ARTICULATION` and `REMOVE_ARTICULATION` using the finite articulation vocabulary frozen in `NotationDocumentV2`.

Articulation state remains notation authority. Every accepted edit creates one direct-child `ScoreDocumentV2` revision without changing canonical musical part/staff/measure/voice/event content, creates same-revision `NotationDocumentV2`, and commits through unified `EditorHistoryStateV2`. The edited semantic event remains selected after commit.

Safety rules include:

- stale event/grace-event targets fail closed;
- duplicate articulation specs reject;
- unsupported articulation kinds, placement or direction combinations reject;
- articulation edits do not mutate pitch, onset, duration, grace identity or normal measure occupancy;
- normal and grace articulation edits share the same atomic history path;
- articulation content remains `VNEXT_XML_PENDING` until SSE-06 rather than being silently omitted from MusicXML.

## Authority and dependencies

One v2 score+notation pair remains canonical per v2 session. Renderer/SesliTab remain noncanonical and Guitar remains derivative-only. Runtime dependencies remain `saxes@6.0.0` and `xmlchars@2.2.0`; no production/public-write, persistence/network, E8-D or staff/part topology authority is activated.