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

The standalone ST Score Editor App is the active product target. SesliTab V4 product cutover is deferred until the standalone product passes APP-09.

- **APP-00 — COMPLETE / MERGED:** standalone product/authority contract.
- **APP-01 — COMPLETE / MERGED:** standalone document runtime: New, MusicXML Open, admitted MusicXML Export, title/origin, dirty/saved tracking and V4 undo/redo.
- **APP-02 — COMPLETE / MERGED:** unified V4 authoring and semantic keypad execution in one history.
- **APP-03 — COMPLETE / MERGED:** independent `STScoreEditorApp` browser product surface.
  - frozen standalone app global separate from legacy core runtime;
  - self-contained JS bundle + integrity manifest + directly openable HTML bootstrap;
  - responsive toolbar/keypad/viewport/inspector/status shell;
  - semantic selection and APP-02 commit delegation;
  - zero external imports;
  - no renderer, persistence, network, file-system, playback or server authority.
- **APP-04 — NEXT:** local file picker/open/save/download workflow.
- **APP-05 — PLANNED:** browser-local recovery/autosave with validated envelopes.
- **APP-06 — PLANNED:** renderer interaction, semantic hit mapping, zoom/navigation.
- **APP-07 — PLANNED:** local playback transport, independent from edit/OMR admission.
- **APP-08 — PLANNED:** MusicXML export/print/PDF workflow within admitted semantics.
- **APP-09 — PLANNED:** iPhone/iPad/desktop hardening, performance, accessibility and standalone release gate.

Local editing does not require a backend/service provider. APP-00–03 introduce no persistence/network/server revision authority.

## Product safety result through APP-03

All edit surfaces converge on the same `ScoreDocumentV3 + NotationDocumentV4` session/history. The standalone browser shell delegates to those APIs and does not become mutation authority. Semantic selection is revision-bound; renderer geometry is not an edit target. Browser bundle validation fails closed on external imports and admitted network/persistence capability tokens.

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
- persistence/network/public-write/production activation;
- `.mxl` container support.
