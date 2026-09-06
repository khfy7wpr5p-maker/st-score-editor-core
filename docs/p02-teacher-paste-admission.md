# P02 Teacher Paste Admission V4

Status: **READ-ONLY FOUNDATION ON ISOLATED WORK BRANCH / NO PASTE MUTATION AUTHORITY**

Package: `packages/editor-teacher-paste-admission-v4/src/index.ts`

## First admitted profile

`analyzeTeacherPasteDestinationV4(...)` analyzes a verified teacher copy snapshot against one exact current-revision destination event.

The first profile is deliberately narrow:

- source snapshot must contain one measure segment only;
- snapshot must come from the exact current destination document revision;
- destination target must be one explicit rest event;
- destination rest must be notation-neutral, not cross-staff placed and have no anchored grace group;
- source snapshot exact extent must fit entirely inside that destination rest;
- mode is explicitly `OVERWRITE_EXPLICIT_NEUTRAL_REST_PREFIX`;
- the analyzer returns either exact destination-rest removal or exact forward shrink/residual timing;
- no destination event/note IDs are allocated;
- no score, notation or history mutation occurs.

## Why overwrite-rest first

This profile reuses the project's established safety principle that explicit neutral rest space is known canonical occupancy. It does not infer free space from renderer geometry, hidden gaps or visual layout, and it does not shift unrelated following events.

## Fail-closed boundaries

The analyzer rejects:

- malformed copy snapshots;
- snapshots from another document or revision;
- cross-measure snapshots;
- stale destination addresses;
- pitched destination targets;
- destination rests carrying dots/beams/tuplets/articulations/ornaments;
- cross-staff destination rests;
- grace-coupled destination rests;
- insufficient destination-rest duration;
- invalid/unsafe exact rational arithmetic.

## Explicit non-authority

P02-PASTE01 does not:

- allocate destination identities;
- clone source events into the score;
- rewrite notation;
- move following events;
- create or materialize measures/Voices;
- support cross-measure paste;
- expose insert mode;
- expose paste mutation;
- create an `EditorSessionV4` history revision.

A later mutation package may only consume this admission after destination identity-allocation and exact one-action/one-history semantics are separately defined and tested.
