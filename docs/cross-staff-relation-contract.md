# SSE-10 Cross-Staff Presentation and Relation Ownership Contract

Status: **APPROVED / FROZEN / BOUNDED RUNTIME COMPLETE / MERGED**

Date: 2026-09-03

## Purpose

Define and implement a safe Sibelius-style cross-staff presentation model without moving musical ownership between staves, duplicating score events, or granting renderer geometry mutation authority.

The frozen design keeps:

- `ScoreDocumentV3/3.0.0` unchanged;
- `SemanticAddressV3/3.0.0` unchanged.

The merged bounded runtime adds:

- `NotationDocumentV4/4.0.0`;
- V3↔V4 notation migration;
- explicit cross-staff placement authoring;
- V4-aware topology orphan protection;
- atomic score-v3 + notation-v4 history/session;
- `RendererRequestV4/4.0.0` with fail-closed cross-staff projection.

This contract does not authorize V4-native MusicXML, SesliTab V4 product cutover, relations between independent source voices/staffs, persistence or production/public-write authority.

## Canonical ownership model

`ScoreDocumentV3` already provides exact source ownership: part, source staff, measure frame, staff measure, voice and event/note identity. `SemanticAddressV3` carries that ancestry exactly. Cross-staff notation therefore changes **display staff assignment only**.

A V4-capable session owns exactly one canonical pair:

```text
ScoreDocumentV3 + NotationDocumentV4
```

Numeric score/notation major versions are intentionally independent because the musical/topology score schema does not change.

## NotationDocumentV4

V4 preserves all V3 notation collections and adds:

```text
CrossStaffPlacementV4 {
  source: EventAddressV3
  displayStaffId: EntityId
}
```

There is at most one placement per source event. The source address remains revision-bound and remains the semantic mutation target.

## Admitted placement profile

A placement is valid only when all of the following are true:

1. `source` resolves exactly to a current normal timed event;
2. source event is pitched (`note` or `chord`), never a rest;
3. source staff role is `standard`;
4. display staff is a distinct `standard` staff;
5. source and display staff belong to the same part;
6. display staff owns a measure for the same global `frameId`;
7. linked TAB is not source or target;
8. source staff/measure/voice, event/note IDs, pitch, onset and duration remain unchanged;
9. the whole event is assigned as one unit.

Split-chord, grace-event, percussion and rest placement remain unsupported.

## Relation ownership

Beam, tie, slur, tuplet and ornament notation remains attached to the **source canonical event/note**. Cross-staff display never transfers relation ownership to the display staff.

An existing valid beam in one source voice may render across staves when member events have display assignments. The bounded runtime does **not** create relations between independent source voices/staffs and does not widen tie/slur/tuplet/spanning-ornament authoring scopes.

## Cross-staff authoring

`editor-cross-staff-authoring-v4` admits `SET_CROSS_STAFF_PLACEMENT` and `REMOVE_CROSS_STAFF_PLACEMENT`.

Each intent uses a current `EventAddressV3`, explicit display staff ID and caller-supplied fresh revision ID. Accepted authoring creates one direct-child `ScoreDocumentV3` revision with identical musical content/topology, rebinds V4 notation to that revision and validates the final pair atomically.

Stale source addresses, same-staff targets, rest targets, invalid staff roles and invalid same-part/frame relations fail closed.

## Topology mutation safety

`editor-topology-authoring-v4` composes the existing SSE-09 topology engine. The V3 topology candidate is calculated first; existing placements are then rebound to the candidate score. If a source event or display staff no longer resolves under V4 rules, the entire candidate is rejected as `CROSS_STAFF_ORPHAN_RISK`.

Source/display staff or part removal therefore cannot silently delete placement semantics. Staff reorder preserves placement by stable IDs. No nearest-surviving-staff retargeting or implicit cascade is admitted.

## Migration

Notation V3 -> V4 is deterministic and additive: all V3 notation is preserved and `crossStaffPlacements=[]`.

V4 -> V3 is lossless-only and is allowed only when placements are empty. Non-empty placement raises `DOWNGRADE_UNREPRESENTABLE`; canonical events are never moved to simulate downgrade.

## History and session

`editor-history-v4` stores atomic `ScoreDocumentV3 + NotationDocumentV4` snapshots and accepts only direct-child revisions.

`editor-session-controller-v4` supports native V4 sessions, one-time V3 notation -> V4 migration, cross-staff placement commits, V4-aware topology commits, semantic selection and unified undo/redo. No parallel mutable V3/V4 notation authorities are retained.

## Renderer and hit mapping

`RendererRequestV4/4.0.0` uses source semantic identities for its manifest. A rendered cross-staff note token resolves to the original source `SemanticAddressV3`; display staff position never replaces source ancestry.

Projection behavior:

- empty placements may reuse the existing lossless V3/V2 projection;
- lower projection gaps return `V4_XML_PENDING`;
- non-empty placements return `CROSS_STAFF_XML_PENDING` with `musicXml:null`.

## MusicXML boundary

Current bounded MusicXML projection derives `<staff>` from canonical source-staff streams and cannot yet prove source/display ownership separation on round trip.

V4 cross-staff MusicXML round trip is **not admitted**. A non-empty placement set never enters current serializers as if lossless, and importer may not infer source ownership from nearest staff, first occurrence, beam geometry or reused voice ordinal.

## Product boundary

SSE-10 does not activate SesliTab V4 product integration. Playback remains independent from edit admission and cross-staff display does not change canonical pitch/timing.

## Explicitly out of scope

- split-chord placement;
- grace/rest/percussion cross-staff placement;
- linked TAB cross-staff targets;
- beam relations between independent source voices/staffs;
- new tie/slur relations between independent source staffs;
- cross-source-staff tuplets or ornament relations;
- polymeter/non-controlling topology;
- layout coordinates as canonical data;
- V4-native MusicXML round trip;
- SesliTab V4 product cutover;
- persistence/network/public-write/production activation.

## Verification

The bounded runtime was merged only after exact-head repository validation and Node 18/20/22 build/test passed. Merge does not activate production authority.
