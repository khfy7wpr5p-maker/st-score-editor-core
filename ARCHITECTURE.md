# ST Score Editor Core — Architecture

Status: **SEC-NE and SSE-00–10 are merged. ST-SCORE-EDITOR-APP / PRODUCTIZATION is active; APP-00–02 are complete/merged and APP-03 is next.**

## Product architecture

The standalone ST Score Editor App is the current product target. SesliTab V4 integration is deferred until the standalone app passes APP-09.

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

The app layer owns product state such as title, dirty/saved marker, future file/autosave/viewport/playback state. None is canonical score authority. A backend/service provider is not required for the local editing path.

## Canonical authority

One product session owns exactly one current pair:

```text
ScoreDocumentV3/3.0.0 + NotationDocumentV4/4.0.0
```

`SemanticAddressV3` is the stable revision-bound source identity. MusicXML is exchange/projection data. Renderer DOM/SVG, app shell state, future SesliTab host state and Guitar derivative state remain noncanonical.

## APP-01 document lifecycle

`score-editor-app-document` provides New, verified-SHA MusicXML Open, admitted lossless-only MusicXML Export, title/origin, dirty/saved revision tracking and V4 undo/redo. It contains no persistence/network/server authority.

## APP-02 unified authoring

APP-02 is complete. The same `EditorHistoryV4` now composes:

- basic normal event/note authoring: pitch, duration, rest/note replacement and chord tones;
- grace group/event authoring and grace-note pitch;
- normal/grace articulation authoring;
- local ornaments plus bounded source-voice tremolo/wavy-line relations;
- semantic keypad correction actions;
- V3 topology authoring;
- V4 cross-staff placement authoring.

There is no whole-document V4 -> V2 -> V4 editing bridge and no parallel mutable authoring authority. Every accepted edit creates exactly one direct-child `ScoreDocumentV3` revision with one `NotationDocumentV4` bound to that same revision, then commits one atomic history snapshot.

### Keypad orchestration

The existing `editor-keypad` action manifest remains the semantic descriptor contract. The V4 execution layer maps those action IDs directly onto the current V4 pair:

- duration whole..32nd sets canonical duration and resets dots to zero;
- rest whole..32nd safely replaces a pitched event when allowed, sets duration, and resets dots;
- flat/natural/sharp changes canonical `pitch.alter` and display accidental in the same revision;
- dot 0..3 recomputes admitted canonical duration and dot notation together;
- triplet requires an explicit exactly-three `EventAddressV3` range with already-correct canonical timing;
- tie/slur requires an explicit `NoteAddressV3` pair and remains source-owned.

Keypad targets are revision-bound semantic addresses. SVG/DOM coordinates, nearest-note inference and renderer objects are never edit targets. Note-notation orphan risk and cross-staff-to-rest conflicts fail closed.

`selectSessionSemanticAddressV4` accepts only a current address that resolves exactly against the current canonical score. Renderer-token selection remains separately available and resolves back to the same source identity.

## Cross-staff boundary

`NotationDocumentV4.crossStaffPlacements[]` assigns a display staff to a normal pitched event without changing canonical source part/staff/frame/measure/voice, event/note IDs, pitch, onset or duration. Rest, grace, percussion, linked TAB and split-chord placement remain outside the admitted profile.

Existing beam/tie/slur/tuplet/ornament semantics remain source-owned. Cross-staff display does not widen relation scopes between independent source voices/staffs.

## Renderer / MusicXML boundary

`RendererRequestV4` may reuse existing lossless projection when placements are empty. Non-empty placements return:

```text
CROSS_STAFF_XML_PENDING
musicXml = null
```

Renderer tokens are built from canonical `SemanticAddressV3` and therefore resolve a visually cross-staff note to its original source address. No V4-native cross-staff MusicXML round trip is claimed.

## Next product layer

APP-03 is the next stage: an independent browser bundle and responsive standalone editor shell over the already-unified V4 document/session API. APP-03 must not introduce DOM/SVG mutation authority or SesliTab dependency.

## Remaining gates

APP-04 local file workflow, APP-05 recovery/autosave, APP-06 renderer interaction, APP-07 playback, APP-08 export/print and APP-09 product hardening remain planned. Split-chord/grace/rest/percussion cross-staff semantics, independent-source-staff relations, V4-native cross-staff MusicXML, cloud/server revision authority, production/public-write and SesliTab V4 cutover remain separately gated.
