# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for the standalone ST Score Editor App and later ST score products.

## Current reality

SCORE-SCHEMA-EXPANSION is implemented through **SSE-10 bounded cross-staff notation runtime**.

- **SSE-00–10 — COMPLETE / MERGED:** canonical V2/V3 score+notation evolution, grace/articulation/ornament authoring, bounded MusicXML, renderer compatibility, V3 staff/part topology and bounded V4 cross-staff runtime.
- **ST-SCORE-EDITOR-APP / PRODUCTIZATION — ACTIVE:** the standalone editor app is now the primary product target.
- **APP-00 — COMPLETE / MERGED:** standalone-product authority boundary is documented.
- **APP-01 — COMPLETE / MERGED:** reusable standalone document runtime supports New, MusicXML Open, lossless-only MusicXML Export, dirty/saved revision tracking, V4 undo/redo and current V4 topology/cross-staff commits.
- **APP-02 — NEXT:** compose the existing note/rest/pitch/duration/chord/grace/articulation/ornament/keypad capabilities into one canonical V4 product session.
- **SesliTab V4 product cutover — DEFERRED:** it must not begin before the standalone app passes the final product gate.

## Standalone product boundary

The standalone app consumes Core; it does not become another score authority.

```text
ST Score Editor Core
        |
        +--> ST Score Editor App   <-- current target
        |
        +--> SesliTab              <-- deferred until app complete
```

Local editing does not require a backend/service provider. File picker state, autosave state, renderer DOM/SVG, playback cursor and recent-file metadata remain noncanonical product state.

APP-01 owns one `EditorSessionV4` document lifecycle. MusicXML Open computes a SHA-256 source identity before import. MusicXML Export is allowed only when `RendererRequestV4` exposes an admitted lossless XML projection; otherwise export fails closed. `markSaved` records an externally completed save but performs no persistence itself.

Full productization sequence: `docs/st-score-editor-app-productization.md`.

## SSE-10 canonical boundary

Cross-staff notation does **not** move a canonical event into another staff. `ScoreDocumentV3/3.0.0` and `SemanticAddressV3/3.0.0` remain unchanged.

A V4-capable session owns exactly one pair:

```text
ScoreDocumentV3 + NotationDocumentV4
```

`NotationDocumentV4/4.0.0` preserves all V3 notation collections and adds `crossStaffPlacements[]`:

```text
source: EventAddressV3
  -> displayStaffId
```

The source part/staff/frame/measure/voice, event/note IDs, pitch, onset and duration remain unchanged. The display staff is notation semantics only.

Initial admitted profile:

- normal timed pitched `note`/`chord` events only;
- whole event assigned as one display unit;
- source/display are distinct `standard` staffs in the same part;
- same global frame correspondence required;
- no rest, grace, percussion, split-chord or linked-TAB placement;
- no coordinate or nearest-staff inference.

Existing beam/tie/slur/tuplet/ornament semantics remain source-owned. Visual cross-staff placement does not create relations between independent canonical source voices/staffs.

## V4 safety and history

V3 notation -> V4 migration is additive and initializes an empty placement collection. V4 -> V3 is lossless-only and rejects any non-empty placement set.

Cross-staff authoring uses exact revision-bound source event addresses and explicit display staff IDs. Accepted edits create one direct-child score revision while preserving canonical musical content and rebinding V4 notation to the same revision.

V4-aware topology composition rejects any staff/part edit that would orphan a source/display placement. Stable staff reorder preserves placement by ID; no implicit cascade or nearest surviving staff retarget is admitted.

`EditorSessionStateV4` uses one atomic score-v3 + notation-v4 history. Undo/redo restores exact pairs. Renderer tokens resolve to the original source `SemanticAddressV3`, never display-staff geometry.

## Renderer / product boundary

`RendererRequestV4/4.0.0` may reuse existing lossless V3/V2 MusicXML projection only when `crossStaffPlacements` is empty. A non-empty placement set returns:

```text
CROSS_STAFF_XML_PENDING
musicXml: null
```

Cross-staff MusicXML round trip is not claimed. MusicXML remains exchange/projection data; renderer and future hosts remain noncanonical; Guitar string/fret/fingering/voicing remains derivative.

Runtime dependencies remain `saxes@6.0.0` and `xmlchars@2.2.0`. Split-chord/grace/rest/percussion cross-staff semantics, independent-source-staff relations, V4-native MusicXML, persistence/network and production/public-write authority remain gated.
