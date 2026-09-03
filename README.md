# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for the standalone ST Score Editor App and later ST score products.

## Current reality

- **SSE-00–10 — COMPLETE / MERGED:** canonical V3/V4 score+notation, bounded MusicXML, topology and cross-staff runtime.
- **ST-SCORE-EDITOR-APP / PRODUCTIZATION — ACTIVE:** standalone editor app is the primary product target.
- **APP-00–04 — COMPLETE / MERGED:** standalone authority, document/runtime, unified V4 authoring, browser shell and bounded local file workflow.
- **APP-05 — COMPLETE / MERGED:** validated browser-local recovery/autosave with explicit guarded apply; recovery remains noncanonical.
- **APP-06 — NEXT:** renderer interaction, semantic hit mapping, zoom and navigation.
- **SesliTab V4 product cutover — DEFERRED:** no SesliTab integration before APP-09.

## Standalone product authority

```text
ST Score Editor App
        |
        +--> local file workflow (noncanonical)
        +--> IndexedDB recovery cache (noncanonical)
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

## Local file and recovery safety

APP-04 admits `.musicxml/.xml` only, with a 32 MiB local bound. Lossless export must succeed before write/download. `markSaved` occurs only after `write + close` or successful download handoff; external failure leaves the document dirty. File handles are bound to the canonical document ID.

APP-05 adds bounded recovery without creating persistence authority:

- current canonical `ScoreDocumentV3 + NotationDocumentV4` snapshot only;
- SHA-256 integrity plus canonical/metadata validation;
- 64 MiB recovery-envelope bound;
- IndexedDB cache, maximum 8 document records;
- autosave only after accepted dirty revisions;
- revision-race protection prevents an older digest/snapshot from overwriting a newer live revision;
- corrupt records fail closed;
- no automatic restore;
- explicit recovery apply revalidates canonical state and checks the active document/revision has not changed since prepare;
- successful apply starts a fresh V4 history and clears stale file association;
- recovery cache/storage never becomes canonical, server or publication authority.

Full productization sequence: `docs/st-score-editor-app-productization.md`.

## Canonical pair

```text
ScoreDocumentV3/3.0.0 + NotationDocumentV4/4.0.0
```

`SemanticAddressV3` remains canonical source identity. Cross-staff presentation does not move canonical events.

## Renderer / MusicXML boundary

Renderer tokens resolve original source semantic identity. MusicXML remains exchange/projection data. Non-empty cross-staff placements still return `CROSS_STAFF_XML_PENDING` with `musicXml: null`; no silent flattening is admitted.

Runtime dependencies remain `saxes@6.0.0` and `xmlchars@2.2.0`. Split-chord/grace/rest/percussion cross-staff semantics, independent-source-staff relations, V4-native cross-staff MusicXML, cloud/server authority, production/public-write and SesliTab V4 cutover remain gated.
