# ST Score Editor Core — Architecture

Status: **SEC-NE and SSE-00–10 are merged. ST-SCORE-EDITOR-APP / PRODUCTIZATION is active; APP-00/01 are merge candidates and APP-02 is next.**

## Product architecture

The standalone ST Score Editor App is the current product target. SesliTab V4 product integration is deferred until the standalone app passes its final product gate.

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

The app layer owns product concerns such as title, dirty/saved state, file picker state, autosave/recovery metadata, viewport state and playback controls. None of those are canonical score authority.

APP-01 `score-editor-app-document` provides New, MusicXML Open, admitted MusicXML Export, dirty/saved revision tracking, current V4 topology/cross-staff commits and V4 undo/redo. It contains no persistence/network/server authority. An external shell marks a revision saved only after the shell has completed its own local save/export operation.

MusicXML Open binds source identity before import. Browser default hashing uses Web Crypto SHA-256. A host may inject an equivalent verified SHA-256 provider; invalid 64-hex digests fail closed.

APP-02 must unify earlier authoring capabilities under this same V4 history before the visual shell is considered feature-capable. No V4 -> V2 -> V4 lossy editing bridge is admitted.

## Canonical authority

A session owns exactly one versioned canonical score+notation pair. V2 and V3 score runtimes remain supported. The active product pair is:

```text
ScoreDocumentV3/3.0.0 + NotationDocumentV4/4.0.0
```

MusicXML is exchange/projection data. Renderer, DOM/SVG, application shell state, future SesliTab host state and Guitar derivative state remain noncanonical.

## V3 source topology remains canonical

`ScoreDocumentV3` owns document-global `measureFrames`, explicit part/staff topology, stable instrument identity and source musical ownership. Standard/percussion staffs own measures/voices/events. Linked TAB remains derivative presentation only.

`SemanticAddressV3` identifies source part, staff, frame, measure, voice, event and note exactly. SSE-10 does not add a new score address kind.

## NotationDocumentV4

`NotationDocumentV4` preserves all V3 notation collections and adds:

```text
crossStaffPlacements[]
  -> source: EventAddressV3
  -> displayStaffId
```

A placement is valid only for a current pitched normal event owned by a `standard` staff. Display staff must be a distinct `standard` staff in the same part and own the same frame. The whole event moves visually as one unit.

Canonical source staff/measure/voice, event/note identity, pitch, onset and duration never change. Rest, grace, percussion, linked TAB and split-chord placement are rejected.

## Relation ownership

Beams, ties, slurs, tuplets and ornaments remain attached to source canonical event/note notation.

An existing source-voice beam may become visually cross-staff when one or more member events have display assignments. SSE-10 does not create a new relation between independent source voices/staffs and does not widen tie/slur/tuplet/spanning-ornament authoring scopes.

## Migration

Notation V3 -> V4 is deterministic and additive: all notation is preserved and `crossStaffPlacements=[]`.

V4 -> V3 is lossless-only. Any non-empty placement collection raises an exact downgrade-unrepresentable error. Flattening placement by moving canonical events is forbidden.

## Authoring and topology composition

`editor-cross-staff-authoring-v4` admits explicit set/remove placement intents against current `EventAddressV3` targets. A successful placement edit creates exactly one direct-child `ScoreDocumentV3` revision while leaving musical topology/content unchanged and rebinding all V4 notation to that revision.

`editor-topology-authoring-v4` composes the existing SSE-09 topology engine with V4 notation. It calculates the V3 topology candidate, then rebinds every current placement. If a source/display staff or part disappeared, final V4 validation fails and the topology transaction is rejected as `CROSS_STAFF_ORPHAN_RISK`. Reorder is ID-stable and preserves placements.

## V4 history/session

`editor-history-v4` stores atomic `ScoreDocumentV3 + NotationDocumentV4` snapshots and accepts direct-child revisions only.

`editor-session-controller-v4` currently supports native V4 sessions, one-time notation V3 -> V4 migration, placement commits, V4-aware topology commits, semantic selection and undo/redo. No parallel mutable V3/V4 notation authorities are retained.

APP-02 will extend the same session/history authority to the already-existing note/rest, pitch/duration, chord, grace, articulation, ornament and keypad capabilities without downgrading the canonical pair.

## Renderer boundary

`RendererRequestV4` behaves as follows:

```text
placements empty
  -> guarded V4 -> V3 notation downgrade
  -> existing RendererRequestV3
  -> lossless XML available -> V3_COMPATIBLE_XML
  -> otherwise -> V4_XML_PENDING

placements non-empty
  -> CROSS_STAFF_XML_PENDING
  -> musicXml = null
```

The render manifest is built from canonical `SemanticAddressV3`. A visually cross-staff note token therefore resolves to the original source address, not the display staff.

Current MusicXML serializers derive `<staff>` from canonical source streams and cannot yet prove source/display separation on round trip. No V4 cross-staff MusicXML export/import is claimed.

## Service-provider boundary

A backend/service provider is not required for the standalone local editing path. Browser-local files, local recovery and local playback may be layered above the canonical session without granting them mutation authority.

Cloud accounts, sync/collaboration, remote storage, heavy OMR/AI and publishing are optional later services and remain outside the current authority model.

## Remaining gates

Split-chord/grace/rest/percussion cross-staff semantics, linked TAB cross-staff targets, relations between independent source voices/staffs, V4-native MusicXML round trip, SesliTab V4 cutover, polymeter, layout geometry as canonical state, cloud/network authority and production/public-write remain separately gated.
