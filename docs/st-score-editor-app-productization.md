# ST Score Editor App — Productization Program

Status: **ACTIVE / APP-00–03 COMPLETE / MERGED / APP-04 NEXT**

Date: 2026-09-03

## Product decision

ST Score Editor must become a complete standalone application before any SesliTab V4 product cutover. Core remains a renderer-independent library; the standalone app consumes it through one canonical V4 session.

```text
ST Score Editor Core
        |
        +--> ST Score Editor App   <-- CURRENT PRODUCT TARGET
        |
        +--> SesliTab              <-- DEFERRED UNTIL APP-09
```

Canonical editing remains `ScoreDocumentV3 + NotationDocumentV4` owned by `EditorSessionV4`. UI/file/autosave/renderer/playback state is noncanonical. Local editing does not require a service provider/backend.

## Completed stages

### APP-00 — Standalone product contract
Status: **COMPLETE / MERGED**

Standalone-first authority boundary; SesliTab deferred; no server requirement for local editing.

### APP-01 — Document runtime
Status: **COMPLETE / MERGED**

New score, verified-SHA MusicXML Open, lossless-only MusicXML Export, title/origin, dirty/saved tracking and V4 undo/redo. No persistence/network/server authority.

### APP-02 — Unified V4 authoring session
Status: **COMPLETE / MERGED**

Merged PRs #64–68 established native V4 basic, grace, articulation, ornament and semantic keypad authoring. All accepted edits share the same `EditorHistoryV4` with topology/cross-staff, create one direct-child score revision and one same-revision notation document, and use no whole-document V4 -> V2 -> V4 edit bridge.

### APP-03 — Standalone browser bundle and application shell
Status: **COMPLETE / MERGED**

Merged via PR #70.

Implemented:

- independent `STScoreEditorApp` frozen browser global;
- existing `STScoreEditorCoreRuntime` retained as a separate legacy core API;
- per-instance browser controller over immutable `ScoreEditorAppDocument` state;
- New/Open/Export API delegation, semantic selection, undo/redo and all APP-02 commit surfaces;
- explicit `mount(root)` shell lifecycle; bundle evaluation itself does not auto-touch DOM;
- responsive toolbar and history controls;
- keypad shell generated from the existing semantic keypad manifest;
- renderer viewport connection slot;
- semantic inspector and status/error surface;
- desktop/tablet/mobile responsive layout;
- `st-score-editor-app.js` self-contained IIFE;
- integrity manifest;
- directly openable `st-score-editor-app.html` bootstrap;
- browser build failure on external imports or admitted network/persistence capability tokens.

APP-03 does not bundle renderer implementation, file-system workflow, autosave or playback. Advanced triplet/tie/slur remain available through explicit semantic-target APIs but the generic shell keeps those buttons disabled until a range/pair target UI is admitted.

## Next stage

### APP-04 — Local file workflow
Status: **NEXT**

Required bounded scope:

- File System Access API adapter when available;
- safe `<input type=file>` fallback contract;
- `.musicxml` / `.xml` open;
- admitted MusicXML save/download based only on current lossless export;
- externally completed save must call `markSaved` only after write/download handoff succeeds;
- file handles, picker state and recent-file metadata remain noncanonical;
- no cloud/backend requirement;
- no silent save when current semantics are not exportable.

### APP-05 — Local recovery/autosave
Status: **PLANNED**

Browser-local validated recovery snapshots. Autosave never becomes mutation authority.

### APP-06 — Renderer interaction
Status: **PLANNED**

OSMD primary standard notation, AlphaTab only for admitted derivative guitar/TAB, semantic token hit mapping, zoom/navigation and no renderer geometry authority.

### APP-07 — Playback
Status: **PLANNED**

Local transport independent from OMR/edit admission; playhead is noncanonical.

### APP-08 — Export/print
Status: **PLANNED**

Admitted MusicXML export plus browser print/PDF workflow; unsupported semantics fail closed.

### APP-09 — Product hardening and standalone release gate
Status: **PLANNED**

iPhone/iPad/Safari, desktop browsers, touch/pointer/keyboard, performance, recovery, destructive-action UX, accessibility, user acceptance corpus and release checklist.

Only after APP-09 passes may a separate SesliTab product integration program begin.

## Explicitly deferred

- SesliTab V4 product cutover;
- server revision authority;
- cloud sync/collaboration;
- account system;
- public-write/publication activation;
- cross-staff MusicXML V4 round trip;
- unsupported advanced notation scopes already gated by SSE-10.
