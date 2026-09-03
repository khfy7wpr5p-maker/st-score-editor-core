# ST Score Editor App — Productization Program

Status: **ACTIVE / APP-00–04 COMPLETE / MERGED / APP-05 NEXT**

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

Merged via PR #72 (adapter) and PR #73 (controller/shell integration).

Implemented bounded behavior:

- File System Access open picker when available;
- hidden `<input type=file>` fallback;
- `.musicxml` / `.xml` text only;
- 32 MiB local file/text limit;
- `.mxl` remains unsupported;
- File System Access save with explicit `write` then `close`;
- abort-on-write-failure when supported;
- download fallback and explicit Download action;
- normalized `.musicxml` output names;
- file handles associated with the canonical document ID;
- old handle is not reused after a different `New` document is created.

Save-state ordering is fixed:

```text
lossless export succeeds
        |
        +--> write + close succeeds
        |             OR
        +--> download handoff succeeds
                      |
                      v
                   markSaved
```

Failure before the handoff boundary leaves the document dirty. File/picker status remains noncanonical. The browser bundle records `fileWorkflowBundled:true` while preserving `persistenceCapable:false`, `networkCapable:false`, `serverRevisionAuthority:false` and `publicationAuthority:false`.

## Next stage

### APP-05 — Local recovery/autosave
Status: **NEXT**

Required bounded scope:

- browser-local recovery envelope for the current canonical V4 snapshot;
- schema/version/document/revision metadata;
- integrity digest over serialized recovery payload;
- explicit validation before recovery admission;
- recovery storage never becomes mutation/canonical authority;
- autosave captures immutable snapshots after accepted revisions, not partial in-flight edits;
- stale/foreign/corrupt recovery records fail closed;
- recovery must never silently overwrite a newer active session;
- explicit restore decision at the app/controller boundary;
- bounded retention/cleanup;
- no cloud/backend requirement.

### APP-06 — Renderer interaction
Status: **PLANNED**

OSMD primary standard notation, admitted derivative TAB rendering, semantic token hit mapping, zoom/navigation and no renderer geometry authority.

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
