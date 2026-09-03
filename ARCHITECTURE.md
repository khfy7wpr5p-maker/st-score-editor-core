# ST Score Editor Core — Architecture

Status: **SEC-NE and SSE-00–10 are merged. ST-SCORE-EDITOR-APP / PRODUCTIZATION is active; APP-00–03 are complete/merged and APP-04 is next.**

## Product architecture

The standalone ST Score Editor App is the current product target. SesliTab V4 integration is deferred until the standalone app passes APP-09.

```text
Standalone HTML / Browser Shell
        |
        v
STScoreEditorApp controller
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

The app layer owns product state such as title, dirty/saved marker, mount root, future file/autosave/viewport/playback state. None is canonical score authority. A backend/service provider is not required for the local editing path.

## Canonical authority

One product session owns exactly one current pair:

```text
ScoreDocumentV3/3.0.0 + NotationDocumentV4/4.0.0
```

`SemanticAddressV3` is the stable revision-bound source identity. MusicXML is exchange/projection data. Renderer DOM/SVG, app shell state, future SesliTab host state and Guitar derivative state remain noncanonical.

## APP-01 document lifecycle

`score-editor-app-document` provides New, verified-SHA MusicXML Open, admitted lossless-only MusicXML Export, title/origin, dirty/saved revision tracking and V4 undo/redo. It contains no persistence/network/server authority.

## APP-02 unified authoring

The same `EditorHistoryV4` composes basic normal event/note authoring, grace, articulation, ornament, semantic keypad, topology and V4 cross-staff placement. There is no whole-document V4 -> V2 -> V4 editing bridge and no parallel mutable authoring authority. Every accepted edit creates exactly one direct-child score revision with one same-revision notation document and one atomic history snapshot.

Keypad targets are current revision-bound semantic addresses. Duration/rest/dot/accidental operations keep score timing/pitch and notation metadata atomic. Triplet/tie/slur require explicit semantic targets. SVG/DOM coordinates and nearest-note inference are never edit targets.

## APP-03 standalone browser layer

`score-editor-browser-app` is a product adapter over `ScoreEditorAppDocument`, not a new score model. It exposes a frozen `STScoreEditorApp` global with per-instance controllers. The older `STScoreEditorCoreRuntime` global remains separate and unchanged in authority.

The controller owns only a reference to the current immutable app document plus noncanonical shell status/error/mount state. It exposes New/Open/Export, semantic selection, undo/redo and the admitted APP-02 commit surfaces by delegation to the canonical app/session APIs.

Bundle load never auto-mutates DOM. `mount(root)` explicitly builds the shell. The build also emits `st-score-editor-app.html`, whose bootstrap explicitly creates a controller and mounts it.

The responsive shell contains:

- toolbar with New and history controls;
- keypad generated from the semantic keypad manifest;
- renderer viewport connection slot;
- semantic inspector showing current revision/selection/projection;
- status/error surface;
- desktop/tablet/mobile responsive layout.

Advanced triplet/tie/slur actions remain programmatically available but are disabled in the generic keypad shell until an explicit semantic range/pair target UI exists. No proximity inference is introduced.

## Browser build boundary

`npm run build:browser` emits both:

```text
st-score-editor-core.runtime.js
st-score-editor-core.runtime.manifest.json
st-score-editor-app.js
st-score-editor-app.manifest.json
st-score-editor-app.html
```

Both JS bundles are self-contained IIFEs with zero external imports. Build validation rejects admitted network/persistence capability tokens. The standalone app manifest explicitly records no canonical, renderer, persistence, network, server-revision or publication authority.

APP-03 intentionally does not bundle a renderer, file workflow, autosave or playback. Those remain APP-04–07 concerns.

## Cross-staff boundary

`NotationDocumentV4.crossStaffPlacements[]` assigns a display staff to a normal pitched event without changing canonical source part/staff/frame/measure/voice, event/note IDs, pitch, onset or duration. Rest, grace, percussion, linked TAB and split-chord placement remain outside the admitted profile.

Existing beam/tie/slur/tuplet/ornament semantics remain source-owned. Cross-staff display does not widen relation scopes between independent source voices/staffs.

## Renderer / MusicXML boundary

`RendererRequestV4` may reuse existing lossless projection when placements are empty. Non-empty placements return `CROSS_STAFF_XML_PENDING` with `musicXml = null`. Renderer tokens are built from canonical `SemanticAddressV3` and therefore resolve visual hits back to original source identity. No V4-native cross-staff MusicXML round trip is claimed.

## Next product layer

APP-04 is next: browser-local file picker/open/save/download behavior. File handles, picker state and recent-file metadata must remain noncanonical. Cloud/backend authority is not required.

## Remaining gates

APP-05 recovery/autosave, APP-06 renderer interaction, APP-07 playback, APP-08 export/print and APP-09 product hardening remain planned. Split-chord/grace/rest/percussion cross-staff semantics, independent-source-staff relations, V4-native cross-staff MusicXML, cloud/server revision authority, production/public-write and SesliTab V4 cutover remain separately gated.
