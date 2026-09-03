# ST Score Editor App — Productization Program

Status: **ACTIVE / APP-00–06 COMPLETE / MERGED / APP-07 NEXT / NOT STARTED**

Date: 2026-09-03

## Product decision

ST Score Editor must become a complete standalone application before any SesliTab V4 product cutover. Canonical editing remains `ScoreDocumentV3 + NotationDocumentV4` owned by `EditorSessionV4`. UI/file/recovery/renderer/viewport/playback state is noncanonical. Local editing does not require a backend.

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

### APP-06 — Renderer interaction and viewport
Status: **COMPLETE / MERGED**

#### APP-06A — Guarded renderer lifecycle

Merged at `dcc69823fefebd17345738c83efb9958b86f2b00`.

- renderer remains presentation-only and is not bundled as canonical authority;
- render uses only the current `RendererRequestV4` and admitted `renderableMusicXmlV4()` projection;
- V4/cross-staff pending projection fails closed instead of silently flattening;
- canonical revision changes invalidate prior accepted presentation;
- in-flight stale render results are rejected.

#### APP-06B — Semantic Renderer Hit Bridge

PR #82, merged at `0965d9267083ef43501960bff308eb02275a1a9c`.

- external hits are admitted only through a bounded opaque current `RendererRequestV4` manifest token;
- document ID, revision ID, renderer family, request version and manifest version must match exactly;
- unknown token, stale revision/request, family mismatch and contract mismatch fail closed;
- DOM IDs, SVG IDs/paths, CSS selectors, bounding boxes, x/y coordinates, nearest-note/staff and geometry inference never gain canonical authority;
- valid hit changes semantic selection only;
- hit cannot directly mutate `ScoreDocumentV3 + NotationDocumentV4`;
- subsequent keypad/authoring edit uses the existing `EditorSessionV4` validation/history route;
- cross-staff visual hit resolves to original source staff/event `SemanticAddressV3` identity.

#### APP-06C — Presentation-only viewport navigation

PR #83, merged at `38b0f6c8d6f66a768927dcbc366138be584c62b6`.

- zoom range is bounded to `0.25..4`;
- zoom, pan/native scroll and page navigation are presentation state only;
- touch/native scroll, pointer drag and keyboard navigation are admitted viewport paths;
- viewport operations create no canonical revision or V4 history entry;
- native touch-scroll position is preserved in presentation state across shell rerenders;
- responsive viewport profiles cover iPhone, iPad and desktop contracts;
- rerender continues through the current canonical revision request;
- APP-06B stale renderer hit/token semantics remain fail-closed after canonical revision changes;
- coordinate-based canonical authoring remains forbidden.

## Next stage

### APP-07 — Local playback transport
Status: **NEXT / NOT STARTED**

Playback implementation has not started. It remains a noncanonical local transport stage separate from edit/OMR admission.

### APP-08 — Export/print
Status: **PLANNED**

Admitted MusicXML export plus print/PDF workflow.

### APP-09 — Product hardening and standalone release gate
Status: **PLANNED**

iPhone/iPad/Safari, desktop browsers, touch/pointer/keyboard, performance, recovery, accessibility and release checklist.

Only after APP-09 passes may a separate SesliTab product integration program begin.

## Explicitly deferred / gated

- SesliTab V4 product cutover before APP-09;
- server revision authority;
- cloud sync/collaboration;
- account system;
- public-write/publication activation;
- V4-native cross-staff MusicXML round trip;
- `.mxl` container support;
- renderer-coordinate authoring or DOM/SVG/geometry authority;
- unsupported advanced notation scopes already gated by SSE-10.
