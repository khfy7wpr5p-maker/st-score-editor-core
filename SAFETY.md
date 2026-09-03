# Safety and Trust Boundaries

## Mandatory controls

The active versioned score remains canonical; notation is same-document/same-revision; source identity is immutable; stale targets fail closed; unsupported or ambiguous semantics are never guessed; renderer/host coordinates never become mutation authority; accepted mutations create one direct-child revision or none; production/public-write is never activated by merge.

## SSE-09 V3 topology safety

V3 topology authoring remains governed by the frozen SSE-08 model: explicit measure frames, stable IDs, guarded migration, no rhythmic invention on new staff creation, no notation orphaning, derivative linked TAB, atomic V3 history and no parallel mutable V2/V3 authority.

## SSE-10 design-candidate safety

SSE-10 is design only. No cross-staff runtime authority is activated by this candidate.

The proposed safety rule is that cross-staff display **never moves canonical musical ownership**.

- source part/staff/frame/measure/voice remain unchanged;
- event/note IDs remain unchanged;
- pitch/onset/duration remain unchanged;
- display staff is notation semantics only;
- initial source and display staffs must be distinct `standard` staffs in the same part;
- only pitched normal `note`/`chord` events are admitted initially;
- rests, grace events, percussion, linked TAB targets and split chords remain unsupported;
- no nearest-staff or coordinate inference is allowed;
- one source event may have at most one display-staff assignment.

Existing beam/tie/slur/tuplet/ornament semantics remain source-owned. Visual cross-staff placement does not authorize new relations between independent source voices/staffs.

## Topology safety with future V4 notation

A source/display staff cannot be removed if doing so would orphan a cross-staff placement unless explicit placement removal is part of the same admitted atomic transaction. Staff reorder preserves assignments by stable IDs. Silent cascade or nearest-surviving-staff retargeting is forbidden.

Current SSE-09 topology runtime remains unchanged until an explicitly approved V4 integration stage composes these checks.

## Renderer / MusicXML safety

Current projection cannot prove lossless source-staff versus display-staff ownership for non-empty cross-staff placements. A future V4 notation document with placements must therefore remain pending/fail-closed until a separately admitted projection exists.

Import may not reconstruct source ownership by nearest staff, first occurrence, beam geometry or duplicated voice ordinal. Renderer hits must resolve to the original source semantic identity, not the display staff position.

## Migration safety

Proposed V3 notation -> V4 notation migration is additive with empty placements. V4 -> V3 is lossless-only and requires an empty placement collection. Moving canonical events to another staff to simulate downgrade is forbidden.

## Product boundary

SSE-10 design adds no SesliTab V4 cutover, network/persistence/server revision authority, publication or production write authority. Cross-staff display alone does not change playback pitch/timing.

## Human gate

Explicit human approval is required before the SSE-10 design is frozen and before any `NotationDocumentV4`, V4 migration/session/renderer, cross-staff authoring or topology integration runtime is implemented.

Full candidate: `docs/cross-staff-relation-contract.md` and `.json`.
