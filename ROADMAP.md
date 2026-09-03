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

The standalone ST Score Editor App is the active product target. SesliTab V4 product cutover is deferred until APP-09 passes.

- **APP-00–04 — COMPLETE / MERGED:** standalone authority, document runtime, unified V4 authoring, browser shell and bounded local file workflow.
- **APP-05 — COMPLETE / MERGED:** validated browser-local recovery/autosave; explicit guarded apply, no persistence authority.
- **APP-06 — COMPLETE / MERGED:** guarded renderer interaction, semantic hit mapping and presentation-only viewport navigation.
- **APP-07 — COMPLETE / MERGED:** PR #85 / `0608e231b536299086cd3a516c5f221ca41b01e8`.
  - revision-bound `PlaybackPlanV1` from validated `ScoreDocumentV3`;
  - browser-local Web Audio transport;
  - play/pause/stop/seek, semantic cursor and playback-only 20–300 BPM tempo;
  - grace timing remains explicitly deferred/partial;
  - no canonical/history/edit-admission authority.
- **APP-08 — COMPLETE / MERGED:** PR #87 / `1d1c821be4c6192bdf562fcd2d9fde6f90f178fa`.
  - explicit MusicXML export reuses the admitted lossless export path;
  - APP-08 export does not call `markSaved` and does not change dirty/saved state;
  - export creates no canonical revision/history entry;
  - print/PDF requires an exact current rendered document/revision;
  - missing/stale/rejected renderer state fails closed before print handoff;
  - PDF workflow is browser print dialog / Save as PDF only; no direct PDF byte generator is claimed;
  - print/export state remains noncanonical and has no network/server/publication authority.
- **APP-09 — NEXT / NOT STARTED:** iPhone/iPad/Safari and desktop hardening, touch/pointer/keyboard validation, performance, recovery, accessibility and standalone release gate.

Local editing, playback and APP-08 orchestration require no backend/service provider.

## Product safety result through APP-08

All edit surfaces converge on the same `ScoreDocumentV3 + NotationDocumentV4` session/history. File APIs, recovery cache, renderer presentation, viewport state, playback transport and export/print state cannot directly mutate canonical score state. MusicXML export remains bounded/lossless, while APP-08 export is deliberately distinct from save semantics. Print/PDF can only hand off an exact current renderer presentation and cannot become edit or publication authority.

## Still fail-closed / gated

- APP-09 implementation is not started;
- standalone release before APP-09 passes;
- SesliTab V4 cutover before APP-09 completion;
- `.mxl` container support;
- direct PDF byte generation;
- grace playback timing beyond APP-07's explicit deferred/partial behavior;
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
- public-write/production activation.
