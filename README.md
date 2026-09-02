# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for ST score products.

## Current reality

SCORE-SCHEMA-EXPANSION is implemented through **SSE-03 canonical grace authoring** on this merge candidate.

- **SSE-00–02 — COMPLETE / MERGED:** approved v2 contract, dual-version substrate and single canonical v2 session/history/render/selection path.
- **SSE-03 — COMPLETE / MERGE CANDIDATE:** typed grace group/event/pitch authoring.
- **SSE-04 — NEXT:** articulation authoring.

## SSE-03 grace authoring

`editor-grace-authoring-v2/1.0.0` operates only on exact current v2 semantic addresses. It can create/remove grace groups, add/remove/reorder grace events, author note/rest/chord grace content, replace an event while preserving its event identity and edit a grace note/chord-tone pitch.

Every accepted edit creates one direct-child `ScoreDocumentV2` revision, rebinds same-revision `NotationDocumentV2`, and commits through `EditorHistoryStateV2`. The session deterministically selects a created or surviving entity after commit.

Safety rules include:

- grace edits may not alter normal timed `Voice.events` occupancy;
- anchors remain exact normal events in the same voice;
- fresh IDs are checked by canonical validation;
- stale targets fail closed;
- the final event cannot be removed without explicit group removal;
- delete/replace operations that would orphan existing grace notation reject;
- grace content remains `VNEXT_XML_PENDING` until SSE-06 rather than being silently omitted from MusicXML.

## Authority and dependencies

One v2 score+notation pair remains canonical per v2 session. Renderer/SesliTab remain noncanonical and Guitar remains derivative-only. Runtime dependencies remain `saxes@6.0.0` and `xmlchars@2.2.0`; no production/public-write, persistence/network, E8-D or staff/part topology authority is activated.
