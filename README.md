# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for the standalone ST Score Editor App and later ST score products.

## Current reality

- **SSE-00–10 — COMPLETE / MERGED:** canonical V2/V3 score+notation evolution, bounded MusicXML, V3 staff/part topology and bounded V4 cross-staff runtime.
- **ST-SCORE-EDITOR-APP / PRODUCTIZATION — ACTIVE:** the standalone editor app is the primary product target.
- **APP-00 — COMPLETE / MERGED:** standalone-product authority boundary.
- **APP-01 — COMPLETE / MERGED:** New, MusicXML Open, lossless-only MusicXML Export, dirty/saved revision tracking and V4 document lifecycle.
- **APP-02 — COMPLETE / MERGED:** basic note/rest/pitch/duration/chord authoring, grace, articulation, ornament and semantic keypad orchestration compose with topology and cross-staff inside one `EditorHistoryV4`.
- **APP-03 — COMPLETE / MERGED:** independent `STScoreEditorApp` browser bundle, standalone HTML bootstrap and responsive toolbar/keypad/viewport/inspector/status shell.
- **APP-04 — NEXT:** local file picker/open/save/download workflow without cloud or server authority.
- **SesliTab V4 product cutover — DEFERRED:** no SesliTab product integration before the standalone app passes APP-09.

## Standalone product authority

```text
ST Score Editor App
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

The app consumes Core; it never becomes a second score authority. Local editing does not require a backend/service provider. File picker, autosave, viewport, renderer DOM/SVG, playback cursor and recent-file state remain noncanonical.

APP-02 uses no whole-document V4 -> V2 -> V4 editing bridge. Every accepted musical/keypad/topology/cross-staff edit produces exactly one direct-child canonical revision and one same-revision notation document in the same V4 history.

## Standalone browser app

APP-03 adds a separate browser product surface without changing the legacy core browser global:

```text
STScoreEditorCoreRuntime   <- legacy core browser API
STScoreEditorApp           <- standalone product API
```

`npm run build:browser` now emits `st-score-editor-app.js`, an integrity manifest and `st-score-editor-app.html`. The app bundle does not auto-touch DOM on load; the standalone HTML explicitly creates a controller and mounts the responsive shell. The shell exposes toolbar/keypad, a renderer connection slot, semantic inspector and status/error surface while remaining noncanonical.

Renderer implementation is intentionally not bundled in APP-03; that belongs to APP-06. File System Access/save/download behavior belongs to APP-04. Browser build validation rejects external imports and admitted network/persistence capability tokens.

Full productization sequence: `docs/st-score-editor-app-productization.md`.

## Canonical pair

```text
ScoreDocumentV3/3.0.0 + NotationDocumentV4/4.0.0
```

`SemanticAddressV3` remains canonical source identity. Cross-staff presentation does not move canonical events: `NotationDocumentV4.crossStaffPlacements[]` assigns a display staff while source part/staff/frame/measure/voice, IDs, pitch, onset and duration remain unchanged.

## Renderer / MusicXML boundary

Renderer tokens resolve original source semantic identity. MusicXML remains exchange/projection data. Non-empty cross-staff placements still return `CROSS_STAFF_XML_PENDING` with `musicXml: null`; no silent flattening is admitted.

Runtime dependencies remain `saxes@6.0.0` and `xmlchars@2.2.0`. Split-chord/grace/rest/percussion cross-staff semantics, independent-source-staff relations, V4-native cross-staff MusicXML, cloud/server authority, production/public-write and SesliTab V4 cutover remain gated.
