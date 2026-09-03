# ST Score Editor App — Productization Program

Status: **ACTIVE / APP-00–07 COMPLETE / MERGED / APP-08 NEXT / NOT STARTED**

Date: 2026-09-03

## Product decision

ST Score Editor must become a complete standalone application before any SesliTab V4 product cutover. Canonical editing remains `ScoreDocumentV3 + NotationDocumentV4` owned by `EditorSessionV4`. UI/file/recovery/renderer/viewport/playback state is noncanonical. Local editing and APP-07 playback do not require a backend.

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

Merged through PRs #76–79. Recovery stores only a validated current canonical V3/V4 snapshot plus bounded metadata, uses SHA-256 integrity, max 64 MiB payload and max 8 browser-local IndexedDB records, never auto-restores, and applies only through explicit document/revision-guarded canonical revalidation. Recovery remains noncanonical and cannot become persistence/server/publication authority.

### APP-06 — Renderer interaction and viewport
Status: **COMPLETE / MERGED**

- **APP-06A:** current guarded `RendererRequestV4` lifecycle; admitted projection only; stale render completion rejected.
- **APP-06B:** PR #82 / `0965d9267083ef43501960bff308eb02275a1a9c`; current revision-bound opaque manifest token resolves to `SemanticAddressV3` selection only. DOM/SVG/coordinates/geometry remain non-authoritative.
- **APP-06C:** PR #83 / `38b0f6c8d6f66a768927dcbc366138be584c62b6`; zoom/pan/native-scroll/page navigation is presentation-only and touch/pointer/keyboard viewport activity creates no canonical revision.

Cross-staff visual hit identity remains the original source semantic identity. Unsupported V4/cross-staff projection remains fail-closed.

### APP-07 — Local playback transport
Status: **COMPLETE / MERGED**

PR #85, merged at `0608e231b536299086cd3a516c5f221ca41b01e8`.

Implemented bounded behavior:

- `PlaybackPlanV1` is derived directly from the current validated `ScoreDocumentV3` and is bound to exact document/revision identity;
- playback plan is derivative/noncanonical and has no score mutation authority;
- normal note/chord pitch plus canonical onset/duration are scheduled; rests contribute observed timeline extent;
- playback does not use MusicXML or renderer coordinates/DOM/SVG as live authority;
- empty frame timing is not guessed: zero observed extent is retained with an explicit warning;
- grace-note playback timing is explicitly deferred in this version; a plan with supported normal notes remains playable but reports partial semantics;
- local browser Web Audio oscillator output is used with no network/backend requirement and no new runtime dependency;
- play, pause, stop and seek are supported;
- playback tempo is bounded to 20–300 BPM with 120 BPM default; tempo is playback state only and is not written to `ScoreDocumentV3`/`NotationDocumentV4`;
- playback cursor carries revision-bound `SemanticAddressV3` identity while playing/paused, but never mutates canonical score state;
- playback/tempo/seek/cursor operations create no `EditorHistoryV4` revision;
- canonical revision changes stop/dispose stale playback derived from the old revision;
- missing Web Audio, no playable events and audio-operation failures remain playback-specific and do not block authoring, OMR admission or editor history;
- standalone browser manifest keeps playback canonical authority, network capability and editor-admission coupling false;
- no schema change, `SemanticAddressV3` change, MusicXML live authority, SesliTab integration, cloud/server authority or E8-D external-engine invocation was introduced.

## Next stage

### APP-08 — Export/print/PDF workflow
Status: **NEXT / NOT STARTED**

No APP-08 implementation was included in APP-07. The planned stage remains admitted MusicXML export plus print/PDF workflow under existing canonical and fail-closed boundaries.

### APP-09 — Product hardening and standalone release gate
Status: **PLANNED**

iPhone/iPad/Safari, desktop browsers, touch/pointer/keyboard, performance, recovery, accessibility and release checklist.

Only after APP-09 passes may a separate SesliTab product integration program begin.

## Explicitly deferred / gated

- APP-08 implementation until separately started;
- SesliTab V4 product cutover before APP-09;
- server revision authority;
- cloud sync/collaboration;
- account system;
- public-write/publication activation;
- V4-native cross-staff MusicXML round trip;
- `.mxl` container support;
- renderer-coordinate authoring or DOM/SVG/geometry authority;
- grace playback timing beyond APP-07's explicit deferred/partial boundary;
- unsupported advanced notation scopes already gated by SSE-10.
