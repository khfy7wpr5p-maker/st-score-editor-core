# ST Score Editor App — Productization Program

Status: **ACTIVE / APP-00–05 COMPLETE / MERGED / APP-06 NEXT**

Date: 2026-09-03

## Product decision

ST Score Editor must become a complete standalone application before any SesliTab V4 product cutover. Canonical editing remains `ScoreDocumentV3 + NotationDocumentV4` owned by `EditorSessionV4`. UI/file/recovery/renderer/playback state is noncanonical. Local editing does not require a backend.

## Completed stages

### APP-00 — Standalone product contract
Status: **COMPLETE / MERGED**

### APP-01 — Document runtime
Status: **COMPLETE / MERGED**

New score, verified-SHA MusicXML Open, lossless-only MusicXML Export, title/origin, dirty/saved tracking and V4 undo/redo.

### APP-02 — Unified V4 authoring session
Status: **COMPLETE / MERGED**

Native V4 basic, grace, articulation, ornament, semantic keypad, topology and cross-staff authoring share one `EditorHistoryV4`.

### APP-03 — Standalone browser bundle and shell
Status: **COMPLETE / MERGED**

Independent frozen `STScoreEditorApp` global, self-contained JS bundle, integrity manifest, directly openable HTML bootstrap and responsive toolbar/keypad/viewport/inspector/status shell.

### APP-04 — Local file workflow
Status: **COMPLETE / MERGED**

PRs #72–73 provide bounded `.musicxml/.xml` open/save/download, File System Access where available, fallback paths, 32 MiB bound, lossless-export-first save ordering and document-bound file handles. `.mxl` remains unsupported.

### APP-05 — Local recovery/autosave
Status: **COMPLETE / MERGED**

Merged through PRs #76–79.

Implemented bounded behavior:

- current canonical `ScoreDocumentV3 + NotationDocumentV4` snapshot only;
- title/origin/saved-revision/document/revision/timestamp metadata;
- SHA-256 integrity over normalized payload;
- 64 MiB recovery JSON bound;
- strict canonical V3/V4 and metadata validation;
- fresh V4 history on restore; prior undo/redo history is intentionally not serialized;
- browser-local IndexedDB recovery cache only in the standalone app bundle;
- legacy core browser bundle remains no-IndexedDB;
- maximum 8 distinct recovery document records;
- autosave only for dirty documents after accepted edit history exists;
- duplicate revision writes suppressed;
- digest/revision race protection prevents stale snapshots from being written after the live canonical revision advances;
- corrupt records isolated and rejected;
- missing IndexedDB degrades recovery only and does not block editing/file workflow;
- no automatic restore;
- `prepareRecoveryApplication()` captures active document/revision state without live replacement;
- `applyPreparedRecovery()` rejects if live state changed after prepare;
- recovered canonical pair is revalidated again before adoption;
- successful apply begins a fresh V4 history at the recovered snapshot and clears stale local file association;
- consumed cache cleanup is noncanonical and cannot become score authority;
- `persistenceCapable:false`, no network/cloud/server/publication authority.

## Next stage

### APP-06 — Renderer interaction
Status: **NEXT**

Required bounded scope:

- connect the standalone viewport to the admitted standard-notation renderer path;
- render only from current `RendererRequestV4`/admitted projection;
- semantic hit mapping must resolve through current opaque renderer tokens to `SemanticAddressV3`;
- no DOM/SVG/coordinate identity may become an edit target;
- stale renderer request/hit tokens fail closed;
- zoom and page/system navigation remain presentation state;
- renderer lifecycle follows canonical revision changes without becoming history/score authority;
- unsupported V4 projection remains visibly pending/fail-closed;
- derivative guitar/TAB rendering remains separately bounded;
- no backend/cloud requirement.

### APP-07 — Playback
Status: **PLANNED**

Local transport independent from edit/OMR admission.

### APP-08 — Export/print
Status: **PLANNED**

Admitted MusicXML export plus print/PDF workflow.

### APP-09 — Product hardening and standalone release gate
Status: **PLANNED**

iPhone/iPad/Safari, desktop browsers, touch/pointer/keyboard, performance, recovery, accessibility and release checklist.

Only after APP-09 passes may a separate SesliTab product integration program begin.

## Explicitly deferred

- SesliTab V4 product cutover;
- server revision authority;
- cloud sync/collaboration;
- account system;
- public-write/publication activation;
- V4-native cross-staff MusicXML round trip;
- `.mxl` container support;
- unsupported advanced notation scopes already gated by SSE-10.
