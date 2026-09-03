# SSE-10 Cross-Staff Presentation and Relation Ownership Contract

Status: **APPROVED / FROZEN / BOUNDED RUNTIME COMPLETE / MERGE CANDIDATE**

Date: 2026-09-03

## Purpose

Define and implement a safe Sibelius-style cross-staff presentation model without moving musical ownership between staves, duplicating score events, or granting renderer geometry mutation authority.

The frozen design keeps:

- `ScoreDocumentV3/3.0.0` unchanged;
- `SemanticAddressV3/3.0.0` unchanged.

The bounded runtime adds:

- `NotationDocumentV4/4.0.0`;
- V3↔V4 notation migration;
- explicit cross-staff placement authoring;
- V4-aware topology orphan protection;
- atomic score-v3 + notation-v4 history/session;
- `RendererRequestV4/4.0.0` with fail-closed cross-staff projection.

This contract does not authorize V4-native MusicXML, SesliTab V4 product cutover, relations between independent source voices/staffs, persistence or production/public-write authority.

## Canonical ownership model

`ScoreDocumentV3` already provides exact source ownership:

- part;
- source staff;
- measure frame;
- staff measure;
- voice;
- event/note identity.

`SemanticAddressV3` carries that ancestry exactly. Cross-staff notation therefore changes **display staff assignment only**.

A V4-capable session owns exactly one canonical pair:

```text
ScoreDocumentV3 + NotationDocumentV4
```

Numeric score/notation major versions are intentionally independent because the musical/topology score schema does not change.

## NotationDocumentV4

V4 preserves all V3 notation collections and adds:

```text
NotationDocumentV4 {
  contractVersion: "4.0.0"
  documentId
  revisionId
  frames[]
  measures[]
  events[]
  notes[]
  graceEvents[]
  graceNotes[]
  crossStaffPlacements[]
}

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
4. `displayStaffId` resolves to a distinct `standard` staff;
5. source and display staff belong to the same part;
6. display staff owns a measure for the same global `frameId`;
7. no linked TAB staff is used as source or display target;
8. source staff/measure/voice, event/note IDs, pitch, onset and duration remain unchanged;
9. the whole event is assigned as one unit.

Split-chord, grace-event, percussion and rest placement remain unsupported.

## Existing relation semantics

Beam, tie, slur, tuplet and ornament notation remains attached to the **source canonical event/note**.

Cross-staff display never transfers relation ownership to the display staff.

Consequences:

- an existing valid beam in one source voice may render across staves when member events have display assignments;
- tie/slur endpoints continue to identify canonical notes;
- tuplet timing remains source-voice timing;
- ornament relations remain source-event relations;
- renderer layout geometry is not canonical relation identity.

The bounded runtime does **not** create relations between independent source voices/staffs.

## Cross-staff authoring

`editor-cross-staff-authoring-v4` admits:

- `SET_CROSS_STAFF_PLACEMENT`;
- `REMOVE_CROSS_STAFF_PLACEMENT`.

Each intent uses a current `EventAddressV3`, explicit display staff ID and caller-supplied fresh revision ID.

Accepted placement authoring:

1. validates the current score-v3 + notation-v4 pair;
2. validates exact source event identity;
3. changes only placement semantics;
4. creates one direct-child `ScoreDocumentV3` revision with identical musical content/topology;
5. rebinds all notation targets and placements to that same revision;
6. validates the final V4 pair atomically.

Stale source addresses, same-staff targets, rest targets, invalid staff roles and invalid same-part/frame relations fail closed.

## Topology mutation safety

`editor-topology-authoring-v4` composes the existing SSE-09 topology engine without weakening it.

The V3 topology candidate is calculated first. Existing placements are then rebound to the candidate score. If a source event or display staff no longer resolves under the frozen V4 placement rules, the entire topology candidate is rejected as `CROSS_STAFF_ORPHAN_RISK`.

Therefore:

- source staff removal cannot silently delete placement semantics;
- display staff removal cannot silently delete placement semantics;
- part removal cannot silently orphan placements;
- staff reorder preserves placement by stable IDs;
- no nearest-surviving-staff retargeting or implicit cascade is admitted.

## Migration

### V3 notation -> V4 notation

Deterministic and additive:

- all V3 notation entries are preserved;
- `crossStaffPlacements=[]`;
- score/document/revision/semantic target identities are unchanged.

### V4 notation -> V3 notation

Lossless-only.

It is allowed only when `crossStaffPlacements` is empty. Non-empty placement raises `DOWNGRADE_UNREPRESENTABLE` at the placement collection. Canonical events are never moved to simulate downgrade.

## History and session

`editor-history-v4` stores atomic `ScoreDocumentV3 + NotationDocumentV4` snapshots and accepts only direct-child revisions.

`editor-session-controller-v4` supports:

- native V4 session creation;
- one-time V3 notation -> V4 migration;
- cross-staff placement commits;
- V4-aware topology commits;
- semantic selection;
- unified undo/redo.

No parallel mutable V3/V4 notation authorities are retained.

## Renderer and hit mapping

`RendererRequestV4/4.0.0` uses source semantic identities for its manifest.

A rendered cross-staff note token therefore resolves to the original source `SemanticAddressV3`. Display staff position never replaces source ancestry.

Projection behavior:

- empty placements may reuse the existing lossless V3/V2 projection;
- if lower projection is unavailable, status is `V4_XML_PENDING`;
- non-empty placements are always `CROSS_STAFF_XML_PENDING` with `musicXml:null`.

## MusicXML boundary

Current bounded MusicXML projection derives `<staff>` from canonical source-staff streams and cannot yet prove source/display ownership separation on round trip.

Therefore:

- V4 cross-staff MusicXML round trip is **not admitted**;
- a non-empty placement set never enters current serializers as if lossless;
- importer may not infer source ownership from nearest staff, first occurrence, beam geometry or reused voice ordinal.

A later separately approved MusicXML contract is required before cross-staff XML export/import.

## SesliTab / product boundary

SSE-10 does not activate SesliTab V4 product integration. A future host must submit a revision-bound source event identity and explicit display staff ID through Editor Core; touch/DOM coordinates cannot authorize the semantic target.

Playback remains independent from edit admission. Cross-staff display does not change canonical pitch/timing by itself.

## Explicitly out of scope

- split-chord placement across display staffs;
- grace-event cross-staff placement;
- rest cross-staff placement;
- percussion cross-staff placement;
- linked TAB as cross-staff target;
- beam relations between independent source voices/staffs;
- new tie/slur relations between independent source staffs;
- cross-source-staff tuplets or ornament relations;
- polymeter/non-controlling frame topology;
- part groups/brackets/braces;
- page/system/layout coordinates as canonical data;
- V4-native MusicXML round trip;
- SesliTab V4 product cutover;
- persistence/network/public-write/production activation.

## Completion gate

The bounded SSE-10 runtime is mergeable only with:

- exact V4 validation;
- guarded V3↔V4 migration;
- source ownership immutability;
- topology orphan protection;
- renderer/MusicXML fail-closed behavior;
- source-identity renderer token resolution;
- atomic history/session;
- Node 18/20/22 CI green.
