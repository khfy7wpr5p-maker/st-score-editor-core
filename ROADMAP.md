# Roadmap

## Current source of truth

Repository reality only; planned capability is not production capability.

## Completed baseline

- **E0–E7-H — COMPLETE**
- **E8-A/B/C — IMPLEMENTED**
- **E8-D — HUMAN-GATED / NOT AUTHORIZED**
- **SEC-KP-00–10 — COMPLETE**
- **SEC-NE-00–09 + XML ROUNDTRIP — COMPLETE / MERGED** within documented bounded profiles.
- **SSE-00–10 — COMPLETE / MERGED** including bounded V3 topology and V4 cross-staff runtime.

## ST-SCORE-EDITOR-APP / PRODUCTIZATION

The standalone ST Score Editor App is the active product target. SesliTab V4 product cutover is deferred until APP-09.

- **APP-00–04 — COMPLETE / MERGED:** standalone authority, document runtime, unified V4 authoring, browser shell and bounded local file workflow.
- **APP-05 — COMPLETE / MERGED:** validated browser-local recovery/autosave; explicit guarded apply, no persistence authority.
- **APP-06 — COMPLETE / MERGED:** renderer interaction and viewport.
  - current `RendererRequestV4` lifecycle and stale-render rejection;
  - revision-bound opaque manifest token -> `SemanticAddressV3` selection only;
  - DOM/SVG/coordinate/geometry authority forbidden;
  - zoom/pan/native-scroll/page navigation is presentation-only.
- **APP-07 — COMPLETE / MERGED:** local playback transport through PR #85 / `0608e231b536299086cd3a516c5f221ca41b01e8`.
  - revision-bound `PlaybackPlanV1` derived from validated `ScoreDocumentV3`;
  - normal note/chord pitch and canonical event timing scheduled locally;
  - rests contribute observed timeline extent;
  - grace playback timing remains explicitly deferred/partial;
  - browser-local Web Audio output; no network/backend requirement;
  - play/pause/stop/seek plus semantic playback cursor;
  - 20–300 BPM playback-only tempo, default 120 BPM, never written to canonical score;
  - playback operations create no V4 history revision;
  - canonical revision change stops stale playback;
  - playback errors do not disable editing/OMR admission.
- **APP-08 — NEXT / NOT STARTED:** admitted MusicXML export/print/PDF workflow.
- **APP-09 — PLANNED:** iPhone/iPad/desktop hardening, performance, accessibility and standalone release gate.

Local editing and APP-07 local playback require no backend/service provider.

## Product safety result through APP-07

All edit surfaces converge on the same `ScoreDocumentV3 + NotationDocumentV4` session/history. File APIs, recovery cache, renderer presentation, viewport state and playback transport cannot directly mutate canonical score state. Renderer hits can alter selection only after current revision-bound opaque-token resolution. Playback cursor may reference revision-bound semantic identity, but playback state never becomes edit authority or history.

## Still fail-closed / gated

- APP-08 export/print/PDF implementation is not started;
- standalone release before APP-09;
- SesliTab V4 cutover before APP-09 completion;
- grace playback timing semantics beyond APP-07's explicit deferred/partial behavior;
- split-chord/grace/rest/percussion cross-staff placement;
- linked TAB as cross-staff target;
- relations between independent source voices/staffs;
- V4-native cross-staff MusicXML round trip;
- polymeter/non-controlling topology;
- part groups/brackets/braces;
- arbitrary instrument transposition and percussion maps;
- renderer-coordinate authoring, DOM/SVG authority and host dual-write;
- E8-D direct external-engine invocation;
- cloud sync/collaboration/server revision authority;
- public-write/production activation;
- `.mxl` container support.
