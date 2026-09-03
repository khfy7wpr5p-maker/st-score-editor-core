# ST Score Editor Core — Architecture

Status: **SEC-NE and SSE-00–10 are merged. ST-SCORE-EDITOR-APP / PRODUCTIZATION is active; APP-00–04 are complete/merged and APP-05 is next.**

## Product architecture

```text
Standalone HTML / Browser Shell
        |
        v
STScoreEditorApp controller
        |
        +--> browser-local file workflow (noncanonical)
        |
        v
ScoreEditorAppDocument
        |
        v
EditorSessionV4
        |
        +--> ScoreDocumentV3
        +--> NotationDocumentV4
        |
        v
RendererRequestV4
```

SesliTab V4 integration is deferred until APP-09. A backend/service provider is not required for the local editing path.

## Canonical authority

One product session owns exactly one current pair:

```text
ScoreDocumentV3/3.0.0 + NotationDocumentV4/4.0.0
```

`SemanticAddressV3` is the stable revision-bound source identity. MusicXML is exchange/projection data. Browser file handles, shell state, recovery state, renderer DOM/SVG, playback state and future SesliTab state are noncanonical.

## APP-01/02 document and authoring runtime

`score-editor-app-document` provides New, verified-SHA MusicXML Open, admitted lossless-only MusicXML Export, dirty/saved tracking and V4 undo/redo. APP-02 composes basic authoring, grace, articulation, ornament, semantic keypad, topology and cross-staff in one `EditorHistoryV4` without a whole-document V4 -> V2 -> V4 edit bridge.

## APP-03 standalone browser layer

`score-editor-browser-app` exposes the frozen `STScoreEditorApp` product global separately from legacy `STScoreEditorCoreRuntime`. Bundle evaluation never auto-mutates DOM; `mount(root)` creates the responsive toolbar/keypad/viewport/inspector/status shell. The renderer viewport remains a connection slot until APP-06.

## APP-04 local file workflow

APP-04 is complete through PRs #72 and #73.

The file adapter admits only `.musicxml` / `.xml` text with a 32 MiB local bound. `.mxl` remains unsupported. It provides:

- File System Access open picker when available;
- file-like reader for `<input type=file>` fallback;
- File System Access save with explicit `write` then `close` completion;
- abort-on-failure when supported;
- normalized `.musicxml` download artifact creation.

The file-enabled standalone controller composes these primitives with the canonical app document. Safety ordering is mandatory:

```text
current canonical document
        |
        v
lossless MusicXML export must succeed
        |
        +--> local write + close succeeds ------+
        |                                      |
        +--> download handoff succeeds --------+
                                               v
                                           markSaved
```

If export, write, close or handoff fails, `markSaved` is not called and the document stays dirty.

A file handle is associated with the canonical document ID that produced/opened it. If `New` creates a different document, the old handle is not reused. File handles/picker/file status are browser state only and cannot mutate score state directly.

The standalone app manifest records `fileWorkflowBundled:true` but keeps `persistenceCapable:false`, `networkCapable:false`, `serverRevisionAuthority:false` and `publicationAuthority:false`.

## Cross-staff and renderer boundary

`NotationDocumentV4.crossStaffPlacements[]` assigns display staff without changing canonical source identity. Non-empty placements remain `CROSS_STAFF_XML_PENDING` with `musicXml = null`; no V4-native cross-staff MusicXML round trip is claimed.

## Next product layer

APP-05 is next: validated browser-local recovery/autosave envelopes. Recovery storage must remain noncanonical, revision-aware, integrity-checked and unable to overwrite a newer live canonical session silently.

## Remaining gates

APP-06 renderer interaction, APP-07 playback, APP-08 export/print and APP-09 product hardening remain planned. Cloud/server authority, production/public-write and SesliTab V4 cutover remain separately gated.
