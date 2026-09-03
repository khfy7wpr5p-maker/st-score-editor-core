# ST Score Editor App — Productization Program

Status: **ACTIVE / APP-00–08 COMPLETE / MERGED / APP-09 NEXT / NOT STARTED**

Date: 2026-09-03

## Product decision

ST Score Editor must become a complete standalone application before any SesliTab V4 product cutover. Canonical editing remains `ScoreDocumentV3 + NotationDocumentV4` owned by `EditorSessionV4`. UI/file/recovery/renderer/viewport/playback/export/print state is noncanonical. Local product operation through APP-08 requires no backend.

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

Independent frozen `STScoreEditorApp` global, self-contained JS bundle, integrity manifest, directly openable HTML bootstrap and responsive shell.

### APP-04 — Local file workflow
Status: **COMPLETE / MERGED**

PRs #72–73 provide bounded `.musicxml/.xml` open/save/download, File System Access where available, fallback paths, 32 MiB bound, lossless-export-first save ordering and document-bound file handles. `.mxl` remains unsupported.

### APP-05 — Local recovery/autosave
Status: **COMPLETE / MERGED**

Merged through PRs #76–79. Recovery stores only a validated current canonical V3/V4 snapshot plus bounded metadata, uses SHA-256 integrity, remains browser-local/noncanonical, never auto-restores and applies only through explicit document/revision-guarded canonical revalidation.

### APP-06 — Renderer interaction and viewport
Status: **COMPLETE / MERGED**

Current guarded `RendererRequestV4`, current-revision opaque token semantic hit mapping and presentation-only viewport navigation are merged. Renderer DOM/SVG/coordinates/geometry remain non-authoritative; stale renderer state fails closed.

### APP-07 — Local playback transport
Status: **COMPLETE / MERGED**

PR #85, merged at `0608e231b536299086cd3a516c5f221ca41b01e8`.

- revision-bound derivative `PlaybackPlanV1` from current validated `ScoreDocumentV3`;
- normal note/chord pitch and canonical timing scheduled locally;
- browser-local Web Audio; no backend/network authority;
- play/pause/stop/seek and playback-only 20–300 BPM tempo;
- semantic playback cursor, no canonical/history authority;
- stale playback stops on canonical revision change;
- grace timing remains explicitly deferred/partial;
- playback failure never blocks editor/OMR admission.

### APP-08 — Export/print/PDF workflow
Status: **COMPLETE / MERGED**

PR #87, merged at `1d1c821be4c6192bdf562fcd2d9fde6f90f178fa`.

Implemented bounded behavior:

- standalone runtime exposes explicit **Export XML** and **Print / PDF** actions;
- MusicXML export reuses the existing admitted lossless current-pair exporter rather than creating a parallel serializer;
- APP-08 export is deliberately separate from APP-04 save/download semantics: successful export does **not** call `markSaved`;
- export handoff does not modify dirty/saved identity, score revision, notation revision or `EditorHistoryV4`;
- export status may record which revision was handed off, but this is presentation-only state;
- print first calls the existing guarded current renderer lifecycle;
- browser print handoff occurs only if the rendered document/revision exactly matches the revision captured when print began;
- missing renderer, unsupported/pending projection, renderer failure or stale revision fails closed before the print host is invoked;
- print-specific CSS hides editor controls and resets presentation zoom for paper output only;
- Print/PDF creates no canonical revision or history entry and has no score-selection/mutation authority;
- PDF support is explicitly `browser-print-dialog-save-as-pdf`; the repository does not claim direct PDF-byte generation;
- export/print remains local and has no network, backend, server-revision, persistence or publication authority;
- APP-08 introduces no schema change, new runtime dependency, `.mxl` support, SesliTab integration or E8-D invocation.

## Next stage

### APP-09 — Product hardening and standalone release gate
Status: **NEXT / NOT STARTED**

Planned scope: iPhone/iPad/Safari and desktop browsers, touch/pointer/keyboard validation, performance, recovery, accessibility and standalone release checklist. APP-09 implementation requires a separate explicit start/approval after fresh-read.

Only after APP-09 passes may a separate SesliTab product integration program begin.

## Explicitly deferred / gated

- APP-09 implementation until separately started;
- standalone release before APP-09 passes;
- SesliTab V4 product cutover before APP-09;
- server revision authority;
- cloud sync/collaboration;
- account system;
- public-write/publication activation;
- direct PDF-byte generation;
- V4-native cross-staff MusicXML round trip;
- `.mxl` container support;
- renderer-coordinate authoring or DOM/SVG/geometry authority;
- grace playback timing beyond APP-07's explicit deferred/partial boundary;
- unsupported advanced notation scopes already gated by SSE-10.
