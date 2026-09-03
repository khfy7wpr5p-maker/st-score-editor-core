# Safety and Trust Boundaries

## Mandatory controls

The active versioned score remains canonical; notation is same-document/same-revision; source identity is immutable; stale targets fail closed; unsupported or ambiguous semantics are never guessed; renderer/host coordinates never become mutation authority; accepted mutations create one direct-child revision or none; production/public-write is never activated by merge.

## SSE-09 V3 topology safety

V3 topology authoring remains governed by the frozen SSE-08 model: explicit measure frames, stable IDs, guarded migration, no rhythmic invention on new staff creation, no notation orphaning, derivative linked TAB, atomic history and no parallel mutable score authorities.

## SSE-10 V4 cross-staff safety

The SSE-10 design is approved and frozen. The bounded runtime preserves the central invariant: **cross-staff display never moves canonical musical ownership**.

- source part/staff/frame/measure/voice remain unchanged;
- event/note IDs remain unchanged;
- pitch/onset/duration remain unchanged;
- display staff is notation semantics only;
- source/display staffs must be distinct `standard` staffs in the same part;
- only pitched normal `note`/`chord` events are admitted;
- rest, grace, percussion, linked TAB and split-chord placement are rejected;
- one source event has at most one display-staff assignment;
- no nearest-staff, coordinate or renderer inference is allowed.

Existing beam/tie/slur/tuplet/ornament semantics remain source-owned. Visual cross-staff placement does not authorize relations between independent source voices/staffs.

## Authoring and revision safety

Cross-staff placement intents require a current revision-bound `EventAddressV3`, explicit `displayStaffId` and fresh next revision ID. Accepted edits create one direct-child `ScoreDocumentV3` revision without changing musical content, then rebind the entire `NotationDocumentV4` to that same revision.

A stale source event, same-staff target, rest target, non-standard target or cross-part target fails closed. No partial placement apply is admitted.

## Topology safety with V4 notation

`editor-topology-authoring-v4` composes the existing SSE-09 topology engine with V4 placement validation.

A topology edit is first calculated as a candidate. Current placements are then rebound against the candidate score. If any source/display staff or part disappeared, the candidate is rejected as `CROSS_STAFF_ORPHAN_RISK`; no implicit cascade is committed.

Staff reorder preserves assignments by stable IDs. Nearest surviving staff retargeting is forbidden.

## Migration safety

Notation V3 -> V4 is additive with `crossStaffPlacements=[]`.

V4 -> V3 is lossless-only and requires an empty placement collection. Moving canonical events to another staff to simulate downgrade is forbidden.

## Renderer / MusicXML safety

`RendererRequestV4` may reuse the existing V3/V2 projection only when the placement collection is empty and the lower projection is already lossless.

Any non-empty placement returns `CROSS_STAFF_XML_PENDING` and `musicXml:null`. Current MusicXML projection cannot yet prove canonical source-staff versus display-staff ownership on round trip.

Renderer manifests contain source `SemanticAddressV3` identities. A rendered cross-staff hit must resolve to the original source event/note ancestry, never to display staff geometry.

Import may not reconstruct source ownership from nearest staff, first occurrence, beam geometry or reused voice ordinal.

## History / session safety

V4 history stores one atomic `ScoreDocumentV3 + NotationDocumentV4` pair and accepts direct-child commits only. Undo/redo restores exact snapshots. V4 session migration does not retain a second mutable notation authority.

## Product boundary

SSE-10 adds no SesliTab V4 product cutover, network/persistence/server revision authority, publication or production write authority. Cross-staff display alone does not change playback pitch/timing.

## Remaining gates

Explicit approval remains required before split-chord/grace/rest/percussion cross-staff semantics, linked TAB cross-staff targets, cross-source-staff relation authoring, V4-native MusicXML round trip, SesliTab V4 cutover, polymeter/non-controlling topology, material dependency/license changes, E8-D invocation or production/public-write activation.
