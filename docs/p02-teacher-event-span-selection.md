# P02 Teacher Event Span Selection V4

Status: **FOUNDATION ON ISOLATED WORK BRANCH / NO MUTATION AUTHORITY**

Package: `packages/editor-teacher-event-span-v4/src/index.ts`

## Purpose

Provide an exact, current-revision start/stop selection model for teacher workflows that may span more than one measure without granting copy, paste, transpose, bulk-edit or timing mutation authority.

## Contract

`createTeacherEventSpanSelectionV4(score, start, stop)` accepts two exact `EventAddressV3` endpoints and returns a frozen `TEACHER_EVENT_SPAN` containing:

- exact start and stop addresses;
- the ordered explicit canonical event-address list from start through stop;
- covered measure IDs;
- covered frame IDs;
- canonical Voice ordinal;
- whether the span crosses a measure boundary.

The analyzer clones/validates the supplied `ScoreDocumentV3` and mutates neither the input score nor history.

## Admitted profile

- current revision only;
- timed events only;
- one source part;
- one content-bearing source staff;
- one canonical Voice ordinal;
- same-measure or cross-measure endpoints;
- canonical staff-measure order;
- exact event order inside endpoint measures;
- selected Voice ordinal present with explicit event content in every covered measure.

Voice entity IDs may differ between measures. Voice ordinal is the cross-measure semantic continuity rule.

## Fail-closed cases

- stale/invalid endpoint;
- duplicate start/stop event;
- reversed measure or event order;
- cross-part/cross-staff span;
- different endpoint Voice ordinals;
- missing selected Voice ordinal in an intermediate measure;
- empty selected Voice segment;
- non-event semantic target encountered during expansion.

## Explicit non-authority

This package does not:

- copy or paste score content;
- transpose notes;
- create/delete/move measures;
- insert or overwrite events;
- rewrite timing;
- materialize a missing Voice;
- remap ties/slurs/tuplets/beams/cross-staff notation;
- create an `EditorSessionV4` history revision;
- use renderer coordinates, DOM or SVG identity as authoring evidence;
- access the network.

## Next bounded consumer

A later P02 package may use this span as read-only source evidence for a teacher copy snapshot. That package must define identity-cloning, relation preservation and timing-origin rules before any destination mutation exists. Paste/transpose/insert/overwrite remain separate admission and mutation stages.
