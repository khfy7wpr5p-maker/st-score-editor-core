# ST Score Editor Core — Architecture

Status: **SEC-NE and SSE-00–10 are merged. ST-SCORE-EDITOR-APP / PRODUCTIZATION is active; APP-00–07 are COMPLETE / MERGED and APP-08 is NEXT / NOT STARTED.**

## Product architecture

```text
Standalone HTML / Browser Shell
        |
        +--> browser-local file workflow (noncanonical)
        +--> recovery/autosave cache (noncanonical)
        +--> viewport zoom/pan/page state (presentation-only)
        +--> playback transport state (noncanonical)
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
        +--> PlaybackPlanV1 (revision-bound derivative)
        |          |
        |          v
        |    local Web Audio transport
        |
        v
RendererRequestV4
        |
        +--> admitted MusicXML projection --> attached renderer host (presentation-only)
        +--> opaque manifest token --> semantic hit bridge --> SemanticAddressV3 selection
```

SesliTab V4 integration is deferred until APP-09. A backend/service provider is not required for the local editing or APP-07 playback path.

## Canonical authority

One product session owns exactly one current pair:

```text
ScoreDocumentV3/3.0.0 + NotationDocumentV4/4.0.0
```

`SemanticAddressV3` is the stable revision-bound source identity. MusicXML is exchange/projection data. Browser file handles, recovery state, shell state, viewport state, renderer DOM/SVG/geometry, playback state and future SesliTab state are noncanonical.

The host/UI/playback layers cannot dual-write canonical score state. Canonical edits continue through `EditorSessionV4` validation and the single unified V4 history.

## APP-01–05 product substrate

APP-01 owns New/Open/export/dirty/saved document lifecycle. APP-02 composes all admitted V4 authoring in one history. APP-03 provides the independent standalone browser bundle/shell. APP-04 provides bounded `.musicxml/.xml` local open/save/download with lossless-export-first ordering and document-bound file handles. APP-05 provides bounded browser-local recovery/autosave with explicit guarded apply; recovery storage is never canonical authority.

## APP-06 renderer interaction and viewport

APP-06 is COMPLETE / MERGED:

- **APP-06A — renderer lifecycle:** merged at `dcc69823fefebd17345738c83efb9958b86f2b00`. Rendering is driven only by the current guarded `RendererRequestV4` and admitted `renderableMusicXmlV4()` projection. Revision changes invalidate old presentation, and in-flight stale render results are rejected.
- **APP-06B — semantic renderer hit bridge:** PR #82, merged at `0965d9267083ef43501960bff308eb02275a1a9c`. External renderer hits are admitted only through the current revision-bound opaque `RendererRequestV4` manifest token. Document, revision, renderer family and contract versions must match exactly. Unknown/stale/mismatched hits fail closed.
- **APP-06C — viewport navigation:** PR #83, merged at `38b0f6c8d6f66a768927dcbc366138be584c62b6`. Zoom, pan/scroll and page navigation are presentation-only. Touch/native scroll, pointer drag and keyboard navigation are supported without creating canonical revisions.

Renderer DOM IDs, SVG IDs/paths, CSS selectors, bounding boxes, x/y coordinates, nearest-note/staff heuristics and geometry inference are never canonical edit targets. A valid renderer hit may change semantic selection only; edits still pass through `EditorSessionV4`.

`NotationDocumentV4.crossStaffPlacements[]` assigns display staff without changing canonical source ownership. A cross-staff visual hit resolves back to original source semantic identity. Non-empty cross-staff placements remain `CROSS_STAFF_XML_PENDING` with `musicXml = null`.

## APP-07 local playback transport

APP-07 is COMPLETE / MERGED through PR #85, merge SHA `0608e231b536299086cd3a516c5f221ca41b01e8`.

### Playback plan boundary

`PlaybackPlanV1` is a revision-bound derivative of the current validated `ScoreDocumentV3`. It is not a second score representation and has no mutation authority. The plan reads canonical normal note/chord pitch and onset/duration; rests contribute observed timeline extent. It does not use renderer geometry or MusicXML as live playback authority.

Where the canonical score does not supply sufficient playback timing evidence, APP-07 does not invent it. Empty frames retain zero observed extent with an explicit warning. Grace-note playback timing is intentionally deferred in this version and marks the plan partial while allowing supported normal-note playback to continue.

### Local transport boundary

The browser transport uses local Web Audio output with no network/backend requirement. It supports play, pause, stop, seek and a bounded playback tempo of 20–300 BPM; 120 BPM is the default playback setting only and is not written into canonical score state.

Playback cursor identity is semantic and revision-bound, but cursor/transport changes create no `EditorHistoryV4` entry. When the canonical revision changes, playback derived from the previous revision is stopped rather than replayed against newer state.

Playback unavailable, empty-plan and audio-operation failures are playback-specific. They do not alter editor admission, canonical score state, OMR admission or renderer authority.

## Next product layer

**APP-08 — Export/print/PDF workflow: NEXT / NOT STARTED.** No APP-08 implementation was included in APP-07.

## Remaining gates

APP-09 product hardening/release remains planned. Standalone release before APP-09, SesliTab V4 cutover before APP-09, V4-native cross-staff MusicXML, cloud/server revision authority, production/public-write and E8-D direct external-engine invocation remain gated.
