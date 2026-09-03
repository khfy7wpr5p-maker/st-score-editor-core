# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for the standalone ST Score Editor App and later ST score products.

## Current reality

- **SSE-00–10 — COMPLETE / MERGED:** canonical V2/V3 score+notation evolution, bounded MusicXML, V3 staff/part topology and bounded V4 cross-staff runtime.
- **ST-SCORE-EDITOR-APP / PRODUCTIZATION — ACTIVE:** standalone editor app is the primary product target.
- **APP-00 — COMPLETE / MERGED:** standalone-product authority boundary.
- **APP-01 — COMPLETE / MERGED:** New, MusicXML Open, lossless-only MusicXML Export, dirty/saved revision tracking and V4 document lifecycle.
- **APP-02 — COMPLETE / MERGED:** basic authoring, grace, articulation, ornament and semantic keypad in one V4 history with topology/cross-staff.
- **APP-03 — COMPLETE / MERGED:** independent `STScoreEditorApp` browser bundle, standalone HTML bootstrap and responsive shell.
- **APP-04 — COMPLETE / MERGED:** bounded browser-local `.musicxml/.xml` Open / Save / Download workflow with File System Access adapter and file-input/download fallbacks.
- **APP-05 — NEXT:** validated browser-local recovery/autosave envelopes; recovery remains noncanonical.
- **SesliTab V4 product cutover — DEFERRED:** no SesliTab integration before APP-09.

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

The app consumes Core; it never becomes a second score authority. Local editing requires no backend/service provider. File handles, recovery records, viewport state, renderer DOM/SVG and playback state remain noncanonical.

## Browser product and file workflow

`npm run build:browser` emits the legacy core runtime plus a separate `STScoreEditorApp` bundle and directly openable HTML shell. The app bundle is self-contained with zero external imports and no network/server authority.

APP-04 adds bounded local file behavior:

- `.musicxml` and `.xml` only; `.mxl` remains unsupported;
- 32 MiB local MusicXML bound;
- File System Access open/save when available;
- hidden file-input open fallback and download fallback;
- current document-bound file handles only; a handle is never reused after `New` creates a different canonical document;
- lossless export is evaluated before any write/download handoff;
- `markSaved` occurs only after `write + close` or a successful download handoff;
- failed write/handoff leaves the document dirty;
- `persistenceCapable` remains false because the file layer is user-selected local handoff, not canonical/server revision authority.

Full productization sequence: `docs/st-score-editor-app-productization.md`.

## Canonical pair

```text
ScoreDocumentV3/3.0.0 + NotationDocumentV4/4.0.0
```

`SemanticAddressV3` remains canonical source identity. Cross-staff presentation does not move canonical events.

## Renderer / MusicXML boundary

Renderer tokens resolve original source semantic identity. MusicXML remains exchange/projection data. Non-empty cross-staff placements still return `CROSS_STAFF_XML_PENDING` with `musicXml: null`; no silent flattening is admitted.

Runtime dependencies remain `saxes@6.0.0` and `xmlchars@2.2.0`. Split-chord/grace/rest/percussion cross-staff semantics, independent-source-staff relations, V4-native cross-staff MusicXML, cloud/server authority, production/public-write and SesliTab V4 cutover remain gated.
