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

- **APP-00 — COMPLETE / MERGED:** standalone product/authority contract.
- **APP-01 — COMPLETE / MERGED:** standalone document runtime and V4 undo/redo.
- **APP-02 — COMPLETE / MERGED:** unified V4 authoring + semantic keypad in one history.
- **APP-03 — COMPLETE / MERGED:** independent `STScoreEditorApp` browser bundle + responsive standalone shell.
- **APP-04 — COMPLETE / MERGED:** bounded local file workflow.
  - File System Access open/save adapters where available;
  - file-input open fallback and download fallback;
  - `.musicxml/.xml` only, 32 MiB bound, `.mxl` unsupported;
  - lossless export before write/handoff;
  - `markSaved` only after successful `write+close` or download handoff;
  - failed external operation leaves document dirty;
  - file handle bound to canonical document ID; never reused across a different New document;
  - browser file state remains noncanonical and `persistenceCapable:false`.
- **APP-05 — NEXT:** browser-local recovery/autosave with validated envelopes.
- **APP-06 — PLANNED:** renderer interaction, semantic hit mapping, zoom/navigation.
- **APP-07 — PLANNED:** local playback transport.
- **APP-08 — PLANNED:** MusicXML export/print/PDF workflow.
- **APP-09 — PLANNED:** iPhone/iPad/desktop hardening, performance, accessibility and standalone release gate.

Local editing still requires no backend/service provider.

## Product safety result through APP-04

All edit surfaces converge on the same `ScoreDocumentV3 + NotationDocumentV4` session/history. Browser file APIs cannot directly mutate canonical score state. Save state is advanced only after an admitted export has successfully crossed the selected local write/download boundary.

## Still fail-closed / gated

- standalone release before APP-09;
- SesliTab V4 cutover before APP-09 completion;
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
