# SSE-10 Cross-Staff Presentation and Relation Ownership Contract

Status: **DESIGN CANDIDATE / HUMAN REVIEW REQUIRED / RUNTIME NOT STARTED**

Date: 2026-09-03

## Purpose

Define a safe canonical boundary for Sibelius-style cross-staff notation without moving musical ownership between staves, duplicating score events, or granting renderer geometry mutation authority.

This stage is design only. It does not implement cross-staff authoring, V4 notation runtime, MusicXML V4, SesliTab V4, production activation, persistence, or renderer mutation authority.

## Fresh-read conclusion

Current `ScoreDocumentV3` already provides exact source ownership:

- part;
- source staff;
- measure frame;
- staff measure;
- voice;
- event/note identity.

Current `SemanticAddressV3` already carries that ancestry exactly. A new score-address kind is therefore not required merely to identify a cross-staff source event.

The missing semantic is **presentation staff assignment**. Moving a note visually to another staff must not move its canonical rhythmic voice or create a second event.

## Proposed version boundary

The design candidate keeps:

- `ScoreDocumentV3/3.0.0` unchanged;
- `SemanticAddressV3/3.0.0` unchanged.

It proposes a new notation contract:

- `NotationDocumentV4/4.0.0`.

Reason: adding canonical cross-staff presentation semantics changes the public notation document shape. Reusing exact `NotationDocumentV3/3.0.0` would silently widen an already frozen contract.

A future V4-capable session would own exactly one canonical pair:

```text
ScoreDocumentV3 + NotationDocumentV4
```

Numeric score/notation major versions are intentionally independent. The score topology does not need a new major version when rhythmic ownership remains unchanged.

## Proposed NotationDocumentV4

V4 retains all V3 notation collections and adds one collection:

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
```

Initial placement shape:

```text
CrossStaffPlacementV4 {
  source: EventAddressV3
  displayStaffId: EntityId
}
```

There is at most one placement per source event. The source event address remains revision-bound and is the semantic mutation target.

## Initial admitted placement profile

A placement is valid only when all of the following are true:

1. `source` resolves exactly to a current normal timed event;
2. the source event is pitched (`note` or `chord`), never a rest;
3. source staff role is `standard`;
4. `displayStaffId` resolves to a distinct `standard` staff;
5. source and display staff belong to the same part;
6. the display staff owns a staff measure for the same global `frameId`;
7. no linked TAB staff is used as source or display target;
8. the event keeps the same source staff, source measure, source voice, onset, duration, event ID and note IDs;
9. the whole event is assigned as one unit in the initial profile.

The initial profile does **not** split one chord event across multiple display staves.

Grace-event placement, percussion cross-staff placement and rest placement are not admitted initially.

## Canonical ownership rule

Cross-staff placement is notation semantics only.

It never changes:

- canonical part ownership;
- canonical staff ownership;
- canonical measure/frame ownership;
- canonical voice ownership;
- event/note identity;
- pitch;
- onset or duration;
- source evidence identity.

The display staff is not a second musical owner.

## Existing relation semantics

Current beam, tie, slur, tuplet and ornament notation remains attached to the **source canonical event/note**.

Cross-staff display does not transfer relation ownership to the display staff.

This has important consequences:

- a beam already owned by events in one source voice may render across staves when some of those events have cross-staff placements;
- tie/slur endpoints continue to identify canonical notes, not rendered staff positions;
- tuplet timing remains source-voice timing;
- ornament relations remain source-event relations;
- renderer layout may draw geometry across staves, but geometry never becomes canonical relation identity.

SSE-10 initial runtime must not create relations between independent source voices/staves merely because they are visually adjacent.

## Cross-staff beam boundary

The initial design admits **presentation of an existing source-voice beam across staves**, not a new beam relation between independent source voices.

A cross-staff beam is therefore valid only if its participating beam-marked events are already valid under the existing source-voice beam semantics. Placement changes only where those events are displayed.

Creating a beam across events owned by different canonical source voices/staves remains a separate future gate.

## Tie / slur / tuplet / ornament boundary

The initial design does not widen existing authoring scopes for ties, slurs, tuplets or spanning ornaments.

If an existing valid source-owned relation becomes visually cross-staff because one endpoint/member is displayed on another staff, its canonical relation remains unchanged.

New cross-source-staff relation authoring remains unsupported until separately designed. No relation-number matching across independent staffs may be inferred from visual placement.

## Selection and renderer hit mapping

A rendered cross-staff note hit must resolve to the original source semantic event/note address.

The display staff must never replace source ancestry in the canonical selection.

Renderer tokens remain opaque and revision-bound. DOM/SVG coordinates, staff Y position, glyph position and nearest-staff heuristics cannot authorize cross-staff mutation.

## Topology mutation safety

A future V4-aware topology mutation must fail closed if it would orphan a current cross-staff placement.

Rules:

- removing a source staff with placed events rejects unless placements are explicitly removed in the same admitted transaction;
- removing a display staff rejects unless affected placements are explicitly removed in the same admitted transaction;
- removing a part containing placements rejects under the same no-implicit-cascade policy;
- staff reorder preserves placements because source/display identities are stable IDs;
- no nearest surviving staff retargeting is allowed;
- linked TAB topology remains independent derivative presentation and cannot absorb cross-staff placement.

Current SSE-09 V3 topology authoring remains unchanged until a future implementation explicitly composes V4 notation safety.

## Migration policy

### V3 notation -> V4 notation

Migration is deterministic and additive:

- all V3 notation entries are preserved;
- `crossStaffPlacements` is initialized as an empty array;
- score, document, revision and semantic target identities remain unchanged.

### V4 notation -> V3 notation

Downgrade is lossless-only.

It is allowed only when `crossStaffPlacements` is empty. Any non-empty placement blocks downgrade with an exact semantic-loss path.

No placement may be flattened by moving the source event into another canonical staff during downgrade.

## MusicXML boundary

Current bounded V2/V3 projection cannot safely preserve the distinction between:

- canonical source staff/voice ownership; and
- cross-staff display staff.

The current serializer derives `<staff>` from canonical source-staff streams. Therefore a non-empty V4 placement must not use the existing serializer as if it were lossless.

A future V4 MusicXML contract must explicitly define how source voice ownership survives export/import. Until then:

- V4 cross-staff MusicXML round trip is **not admitted**;
- renderer projection for non-empty placements must be pending/fail-closed;
- no importer may infer canonical source staff by nearest staff, first occurrence, beam appearance or duplicated voice ordinal.

## Renderer contract candidate

A later runtime stage may introduce `RendererRequestV4/4.0.0`.

Required behavior:

- empty placements may reuse existing lossless V3/V2 projection;
- non-empty placements remain `CROSS_STAFF_XML_PENDING` until an admitted projection exists;
- renderer adapters may use semantic placement only after an admitted projection path exists;
- renderer output cannot mutate canonical source ownership.

## SesliTab boundary

SSE-10 design does not activate SesliTab V4 product integration.

A future host may request a cross-staff placement only through revision-bound semantic source event identity plus an explicit display staff ID. The host may not infer the target from touch coordinates or maintain a parallel mutable staff-assignment tree.

Playback remains independent from edit admission. Cross-staff display does not change canonical playback pitch/timing by itself.

## Explicitly out of scope

- split-chord placement across multiple display staffs;
- grace-event cross-staff placement;
- rest cross-staff placement;
- percussion cross-staff placement;
- linked TAB as a cross-staff target;
- beam relations between independent source voices/staffs;
- new tie/slur relations between independent source staffs;
- cross-source-staff tuplets or ornament relations;
- polymeter/non-controlling frame topology;
- part groups/brackets/braces;
- page/system/layout coordinates as canonical data;
- V4-native MusicXML round trip;
- SesliTab V4 product cutover;
- persistence/network/public-write/production activation.

## Implementation gate

No SSE-10 runtime implementation may begin until this design is explicitly human-approved and frozen.

After approval, the first bounded implementation candidate must prove:

- exact `NotationDocumentV4` validation;
- deterministic V3->V4 migration and lossless-only downgrade;
- exact current-revision source event validation;
- same-part standard-staff display validation;
- no change to canonical score ownership/timing/pitch;
- topology orphan protection;
- renderer/MusicXML fail-closed behavior;
- selection resolves to source canonical identity;
- atomic score+notation history;
- Node 18/20/22 CI.
