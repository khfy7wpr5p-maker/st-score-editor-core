# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for ST score products.

## Current reality

SCORE-SCHEMA-EXPANSION is implemented through **SSE-10 bounded cross-staff notation runtime** on this merge candidate.

- **SSE-00–09 — COMPLETE / MERGED:** v2 schema/session, grace/articulation/ornament authoring, bounded MusicXML v2, renderer/SesliTab v2 compatibility, V3 staff/part topology contract and bounded V3 topology runtime.
- **SSE-10 design — APPROVED / FROZEN / MERGED:** cross-staff presentation ownership keeps musical ownership on the source staff/voice.
- **SSE-10 runtime — COMPLETE / MERGE CANDIDATE:** `NotationDocumentV4`, guarded V3↔V4 notation migration, cross-staff placement authoring, V4-aware topology safety, atomic V4 history/session and fail-closed renderer projection.

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

Cross-staff MusicXML round trip is not claimed. SesliTab V4 product cutover is not activated. MusicXML remains exchange/projection data; renderer/SesliTab remain noncanonical; Guitar string/fret/fingering/voicing remains derivative.

Runtime dependencies remain `saxes@6.0.0` and `xmlchars@2.2.0`. Split-chord/grace/rest/percussion cross-staff semantics, independent-source-staff relations, V4-native MusicXML, persistence/network and production/public-write authority remain gated.
