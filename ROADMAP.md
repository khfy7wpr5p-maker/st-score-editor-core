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
- **APP-02 — COMPLETE / MERGED:** unified V4 authoring and semantic keypad execution.
  - basic pitch/duration/rest/note/chord-tone authoring;
  - grace authoring;
  - articulation authoring;
  - local + bounded spanning ornament authoring;
  - duration/rest/accidental/dot/triplet/tie/slur keypad semantics;
  - topology and cross-staff in the same `EditorHistoryV4`;
  - one direct-child canonical revision per accepted action;
  - no whole-document V4 -> V2 -> V4 edit bridge.
- **APP-03 — NEXT:** independent browser bundle and responsive editor shell.
- **APP-04 — PLANNED:** local file picker/open/save/download workflow.
- **APP-05 — PLANNED:** browser-local recovery/autosave with validated envelopes.
- **APP-06 — PLANNED:** renderer interaction, semantic hit mapping, zoom/navigation.
- **APP-07 — PLANNED:** local playback transport, independent from edit/OMR admission.
- **APP-08 — PLANNED:** MusicXML export/print/PDF workflow within admitted semantics.
- **APP-09 — PLANNED:** iPhone/iPad/desktop hardening, performance, accessibility and standalone release gate.

Local editing does not require a backend/service provider. APP-00–02 introduce no persistence/network/server revision authority.

## APP-02 safety result

All product edit surfaces now converge on the same `ScoreDocumentV3 + NotationDocumentV4` session/history. Semantic selection is revision-bound. Keypad actions do not use renderer coordinates. Destructive identity changes fail closed when notation or cross-staff state would be orphaned.

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
