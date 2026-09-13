# P02 Teacher Workflow Gap Audit

Status: **IN PROGRESS — isolated work branch / not merged / not released**

## Scope

This audit maps the current ST Score Editor Core product reality against the P02 teacher workflow goals:

- selection/range endpoints;
- measure/copy/paste/transpose/bulk operations;
- insert-vs-overwrite semantics.

It does not change SesliTab, Smoosic integration or any external production code. The external runtime dependency freeze remains in force.

## Existing selection reality

### Single product selection

The active app/session selection is one current-revision `SemanticAddressV3 | null`. Product controls use this exact semantic identity rather than renderer coordinates.

### `editor-semantic-selection-v4`

The existing V4 selection package provides:

- `SINGLE` — one exact semantic address;
- `NOTE_PAIR` — ordered exact note endpoints in one source part/staff and one canonical Voice ordinal; logical ordering may span measures;
- `EVENT_RANGE` — two or more consecutive exact events, but deliberately restricted to one exact measure/Voice.

`EVENT_RANGE` is therefore suitable for bounded local operations such as the current Triplet path but is not yet a general teacher selection span.

### Browser product surfaces

Current browser authoring uses dedicated semantic capture surfaces for relation/tuplet workflows. Triplet capture builds an exact three-event same-measure `EVENT_RANGE`. Tie/Slur use explicit note-pair capture. These captures are noncanonical and history-free until an admitted authoring operation commits through `EditorSessionV4`.

## Existing measure reality

The standalone product already supports:

- presentation-only previous/next semantic measure navigation;
- bounded append-only synthetic measure-frame growth;
- exact Staff/Voice context preservation within documented limits.

This is not a general measure-range editing system. Existing topology authority must not be reused implicitly for copy/paste or bulk edits.

## Missing teacher operations

Repository reality does not currently expose a general teacher copy/paste clipboard contract or transpose authoring surface. No general insert/overwrite editing mode contract exists either. Existing position note entry is intentionally bounded to explicit-rest replacement rather than an implicit shifting insert model.

These operations must not be introduced before their semantic selection, collision, relation-preservation, timing and history contracts are explicit.

## First bottleneck selected

**P02-SEL01 — Teacher Event Span Selection Foundation**

A teacher needs to choose a start and stop event and have the core prove the exact canonical event list between them before copy/paste/transpose/bulk behavior can be safe.

The first bounded profile therefore:

- uses exact current-revision `EventAddressV3` start/stop endpoints;
- stays in one source part/staff;
- stays in one canonical Voice ordinal across covered measures;
- expands endpoints into an explicit ordered event-address list;
- includes every canonical event from the start event through the stop event;
- requires that Voice ordinal to exist in every covered measure;
- fails closed on stale, duplicate, reversed, cross-staff, cross-Voice or Voice-gap cases;
- performs no canonical score/notation/history mutation;
- gives renderer coordinates no selection authority.

## Why not copy/paste yet

A safe copy/paste contract still needs separate decisions for:

- source timing origin and destination anchor;
- note/rest/chord identity cloning policy;
- notation/relation ownership and remapping;
- destination occupancy/collision admission;
- measure-boundary and Voice materialization policy;
- insert vs overwrite semantics;
- one accepted teacher action / one `EditorSessionV4` revision;
- exact Undo restoration.

P02-SEL01 provides the source target proof needed for those later bounded packages without prematurely granting mutation authority.
