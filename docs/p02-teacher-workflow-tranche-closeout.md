# P02 Teacher Workflow Tranche Closeout

Status: VERIFIED ON ISOLATED WORK BRANCH / NOT MERGED / NOT RELEASED

Branch: `p02-teacher-event-span-selection-v4`
PR: #143
Verified PASTE02 code/test head: `3c005014e688c25703e98260bed63e336abf7e95`
CI: `34048203830`
Result: repository validation + build + full test chain PASS on Node 18, 20 and 22.
Physical-device validation: NOT_RUN.

## Completed bounded tranche

### P02-SEL01 — Teacher Event Span Selection
- exact current-revision EventAddressV3 start/stop endpoints;
- same-measure and cross-measure ordered canonical expansion;
- one exact source part/staff and one canonical Voice ordinal;
- stale, duplicate, reversed, cross-staff, cross-Voice and Voice-gap cases fail closed;
- read-only; no canonical/history mutation.

### P02-COPY01 — Read-only Teacher Copy Snapshot
- consumes verified event spans;
- preserves exact event timing, note/chord pitches and admitted local notation;
- allocates no destination identities;
- relation-coupled beam, tuplet, tie, slur, spanning ornament, cross-staff and selected-event grace semantics fail closed instead of being silently dropped.

### P02-PASTE01 — Read-only Paste Admission
- first profile supports one contiguous source-measure snapshot only;
- destination must be an exact current-revision explicit neutral rest;
- source extent must fit the destination rest;
- residual-rest remove/shrink plan is explicit;
- source/destination self-overwrite and timing-gap ambiguity fail closed;
- no canonical/history mutation.

### P02-ID01 — Deterministic Destination Identity Plan
- deterministic destination event/note identities are planned before mutation;
- current canonical identity collisions fail closed;
- the plan carries no canonical/history mutation authority.

### P02-PASTE02 — Atomic Paste Authoring Primitive
- revalidates paste admission and identity plan immediately before mutation;
- creates a fresh ScoreDocumentV3 revision with parentId set to the source revision;
- atomically replaces the admitted neutral-rest prefix with copied events;
- preserves copied local event/note notation admitted by COPY01;
- preserves a residual destination rest identity when the destination rest is larger than the source extent;
- removes the destination rest only when exactly consumed;
- returns the first inserted event as the new semantic selection;
- does not mutate the input score, notation, snapshot, admission or identity plan;
- tampered/stale admission or identity-plan facts fail closed before a canonical candidate is returned;
- `historyMutationAuthority=false`: EditorSessionV4 history integration is intentionally not yet exposed.

## Explicitly not complete

P02 as a whole is still IN_PROGRESS. This tranche does not claim:
- EditorSessionV4 one-history-revision paste commit/Undo/Redo integration;
- cross-measure paste mutation;
- relation remapping for tie/slur/beam/tuplet/spanning ornaments/grace/cross-staff;
- insert-mode semantics;
- transpose or other bulk-edit mutation;
- automatic Voice/measure/topology creation;
- physical-device PASS;
- merge, release or production activation.

## External product boundary

No SesliTab repository, Smoosic integration or SesliTab production-code change is part of this tranche. The existing pinned ST Score Editor runtime/build dependency in SesliTab remains unchanged.
