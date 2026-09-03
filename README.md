# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for the standalone ST Score Editor App and later ST score products.

## Current reality

- **SSE-00–10 — COMPLETE / MERGED:** canonical V3/V4 score+notation, bounded MusicXML, topology and cross-staff runtime.
- **ST-SCORE-EDITOR-APP / PRODUCTIZATION — ACTIVE:** standalone editor app is the primary product target.
- **APP-00–04 — COMPLETE / MERGED:** standalone authority, document/runtime, unified V4 authoring, browser shell and bounded local file workflow.
- **APP-05 — COMPLETE / MERGED:** validated browser-local recovery/autosave with explicit guarded apply; recovery remains noncanonical.
- **APP-06 — COMPLETE / MERGED:** guarded renderer lifecycle, current-revision opaque-token semantic hit mapping and presentation-only zoom/navigation.
- **APP-07 — COMPLETE / MERGED:** revision-bound local playback plan and browser-local Web Audio transport; playback remains noncanonical and independent from edit admission.
- **APP-08 — NEXT / NOT STARTED:** admitted export/print/PDF workflow.
- **SesliTab V4 product cutover — DEFERRED:** no SesliTab integration before APP-09.

## Standalone product authority

```text
ST Score Editor App
        |
        +--> local file workflow (noncanonical)
        +--> IndexedDB recovery cache (noncanonical)
        +--> viewport zoom/pan/page state (presentation-only)
        +--> local playback transport (noncanonical)
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
        +--> revision-bound playback plan --> local Web Audio output
        |
        v
RendererRequestV4
        |
        +--> admitted projection --> renderer host (presentation-only)
        +--> opaque hit token --> SemanticAddressV3 selection
```

The app consumes Core; it never becomes a second score authority. Local editing and local playback require no backend/service provider. File handles, recovery records, viewport state, renderer DOM/SVG/geometry and playback state remain noncanonical.

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

## APP-06 renderer and viewport result

- **APP-06A:** renderer presentation is driven only by the current guarded `RendererRequestV4` and admitted projection; stale in-flight render results and prior-revision presentation are rejected/invalidated.
- **APP-06B:** renderer hits must carry the exact current document/revision/family/contract plus a bounded opaque manifest token. Valid hits resolve to `SemanticAddressV3` selection only. Unknown, stale or mismatched hits fail closed.
- **APP-06C:** zoom, pan/native scroll and page navigation are presentation-only; touch, pointer and keyboard paths do not create canonical revisions or history entries.

DOM IDs, SVG IDs/paths, selectors, bounding boxes, x/y coordinates and geometry inference never gain canonical authoring authority. Cross-staff visual hits resolve to original source staff/event identity.

## APP-07 local playback result

PR #85 adds a bounded local playback surface without score authority:

- playback plan is derived from the current validated `ScoreDocumentV3` and is bound to document/revision identity;
- normal note/chord pitches and canonical event timing are scheduled locally; rests contribute timeline extent;
- playback never uses renderer coordinates or MusicXML as live authority;
- default tempo is 120 BPM and the bounded 20–300 BPM tempo setting is playback state only, not canonical score state;
- grace playback timing remains explicitly deferred/partial rather than guessed;
- play/pause/stop/seek and semantic playback cursor do not create V4 history entries;
- a canonical revision change stops stale playback;
- unavailable/empty/audio-error playback does not disable canonical editing or OMR admission;
- audio output is browser-local Web Audio and requires no network/backend.

## Canonical pair

```text
ScoreDocumentV3/3.0.0 + NotationDocumentV4/4.0.0
```

`SemanticAddressV3` remains canonical source identity. Cross-staff presentation does not move canonical events.

## Renderer / MusicXML boundary

MusicXML remains exchange/projection data. Non-empty cross-staff placements still return `CROSS_STAFF_XML_PENDING` with `musicXml: null`; no silent flattening is admitted.

Runtime dependencies remain `saxes@6.0.0` and `xmlchars@2.2.0`. Split-chord/grace/rest/percussion cross-staff semantics, independent-source-staff relations, V4-native cross-staff MusicXML, cloud/server authority, production/public-write and SesliTab V4 cutover remain gated.

Full productization sequence: `docs/st-score-editor-app-productization.md`.
