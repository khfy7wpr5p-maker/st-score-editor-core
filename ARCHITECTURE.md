# ST Score Editor Core — Architecture

Status: **SEC-NE and SSE-00–10 are merged. ST-SCORE-EDITOR-APP / PRODUCTIZATION is active; APP-00–06 are COMPLETE / MERGED and APP-07 is NEXT / NOT STARTED.**

## Product architecture

```text
Standalone HTML / Browser Shell
        |
        +--> browser-local file workflow (noncanonical)
        +--> recovery/autosave cache (noncanonical)
        +--> viewport zoom/pan/page state (presentation-only)
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
        |
        +--> admitted MusicXML projection --> attached renderer host (presentation-only)
        |
        +--> opaque manifest token --> semantic hit bridge --> SemanticAddressV3 selection
```

SesliTab V4 integration is deferred until APP-09. A backend/service provider is not required for the local editing path.

## Canonical authority

One product session owns exactly one current pair:

```text
ScoreDocumentV3/3.0.0 + NotationDocumentV4/4.0.0
```

`SemanticAddressV3` is the stable revision-bound source identity. MusicXML is exchange/projection data. Browser file handles, recovery state, shell state, viewport state, renderer DOM/SVG/geometry, playback state and future SesliTab state are noncanonical.

The host/UI cannot dual-write canonical score state. Canonical edits continue through `EditorSessionV4` validation and the single unified V4 history.

## APP-01–04 product substrate

APP-01 owns New/Open/export/dirty/saved document lifecycle. APP-02 composes all admitted V4 authoring in one history. APP-03 provides the independent standalone browser bundle/shell. APP-04 provides bounded `.musicxml/.xml` local open/save/download with lossless-export-first ordering and document-bound file handles.

## APP-05 local recovery/autosave

APP-05 is COMPLETE / MERGED through PRs #76–79.

The recovery payload stores only the current canonical `ScoreDocumentV3 + NotationDocumentV4` pair plus bounded metadata; undo/redo history is not serialized. Admission requires canonical V3/V4 validation, metadata alignment and a SHA-256 integrity digest. Recovery JSON is bounded to 64 MiB.

IndexedDB is admitted only in the standalone app bundle for noncanonical recovery cache. The legacy core browser bundle still forbids IndexedDB. At most 8 document records are retained. Autosave is eligible only for dirty documents after at least one accepted history revision. Duplicate revision writes are suppressed, revision/digest races fail closed and corrupt records are rejected.

There is no automatic restore. `prepareRecoveryApplication()` captures the active document/revision guard; `applyPreparedRecovery()` rejects stale live state and revalidates the canonical pair before adoption. A successful apply starts fresh V4 history and clears stale file association. Recovery storage never becomes canonical authority.

## APP-06 renderer interaction and viewport

APP-06 is COMPLETE / MERGED:

- **APP-06A — renderer lifecycle:** merged at `dcc69823fefebd17345738c83efb9958b86f2b00`. Rendering is driven only by the current guarded `RendererRequestV4` and admitted `renderableMusicXmlV4()` projection. Revision changes invalidate old presentation, and in-flight stale render results are rejected.
- **APP-06B — semantic renderer hit bridge:** PR #82, merged at `0965d9267083ef43501960bff308eb02275a1a9c`. External renderer hits are admitted only through the current revision-bound opaque `RendererRequestV4` manifest token. Document, revision, renderer family and contract versions must match exactly. Unknown/stale/mismatched hits fail closed.
- **APP-06C — viewport navigation:** PR #83, merged at `38b0f6c8d6f66a768927dcbc366138be584c62b6`. Zoom, pan/scroll and page navigation are presentation-only. Touch/native scroll, pointer drag and keyboard navigation are supported by the standalone viewport contract without creating canonical revisions.

### Renderer authority boundary

Renderer DOM IDs, SVG IDs/paths, CSS selectors, bounding boxes, x/y coordinates, nearest-note/staff heuristics and geometry inference are never canonical edit targets. The browser manifest records renderer authority and coordinate authoring as false.

A valid renderer hit resolves to `SemanticAddressV3` and may change selection only. Subsequent keypad/authoring edits still pass through the existing `EditorSessionV4` validation/history route; the hit bridge cannot directly mutate the canonical pair.

### Cross-staff identity

`NotationDocumentV4.crossStaffPlacements[]` assigns display staff without changing canonical source ownership. A cross-staff visual hit resolves back to the original source staff/event semantic identity. Non-empty cross-staff placements remain `CROSS_STAFF_XML_PENDING` with `musicXml = null`; no V4-native cross-staff MusicXML round trip is claimed.

### Viewport authority boundary

Viewport zoom is bounded to `0.25..4`. Zoom, scroll offsets and page position are ephemeral presentation state. They do not create score revisions or history entries. A rerender still uses the current canonical revision request, and APP-06B stale-token rejection remains in force after canonical revision changes.

## Next product layer

**APP-07 — Local playback transport: NEXT / NOT STARTED.** Playback remains noncanonical and has not been implemented as part of APP-06.

## Remaining gates

APP-08 export/print and APP-09 product hardening/release remain planned. Standalone release before APP-09, SesliTab V4 cutover before APP-09, V4-native cross-staff MusicXML, cloud/server revision authority, production/public-write and E8-D direct external-engine invocation remain gated.
