# P02 Teacher Copy Snapshot V4

Status: **READ-ONLY FOUNDATION ON ISOLATED WORK BRANCH / NO PASTE AUTHORITY**

Package: `packages/editor-teacher-copy-snapshot-v4/src/index.ts`

## Purpose

Convert a verified `TEACHER_EVENT_SPAN` into an immutable source snapshot that later bounded paste/transpose work can consume without reading renderer geometry or mutating the canonical document.

## Snapshot contents

The snapshot records:

- source document/revision/part/staff and canonical Voice ordinal;
- exact source start/stop event IDs;
- ordered measure segments with zero-based `frameOffset`;
- exact source event onset and duration;
- normalized `onsetFromSegmentOrigin` using exact rational arithmetic;
- note/chord pitches with source note IDs as provenance only;
- admitted local event notation and note notation;
- event/note counts;
- explicit `destinationIdentityAssigned = false`;
- explicit canonical/history mutation authority = false.

For the first selected measure, the segment origin is the selected start event onset so the copied span begins at exact relative onset zero. Later covered measures use measure-local zero as their segment origin, preserving source gaps and local rhythmic placement without inventing an absolute cross-measure duration model.

## Preservation policy

Local notation that does not require relation remapping may be retained in the snapshot, including admitted articulations, accidentals, dots, simple ornaments and single-note tremolo where represented by current notation contracts.

The first version deliberately fails closed when copying would require relation or topology remapping:

- beams;
- tuplets;
- ties;
- slurs;
- spanning tremolo;
- wavy-line ornaments;
- cross-staff placement;
- grace groups anchored to a selected event.

These semantics are not dropped, flattened or silently converted.

## Non-authority

P02-COPY01 does not:

- allocate destination event/note IDs;
- choose a destination target;
- paste or overwrite canonical events;
- shift following events;
- create or materialize measures/Voices;
- transpose pitch;
- rewrite notation relations;
- create an `EditorSessionV4` history revision;
- write renderer, playback, file or network state.

## Next bounded stage

A later paste-admission package must separately prove destination occupancy, identity allocation, relation ownership, measure/Voice policy and explicit insert-vs-overwrite behavior before canonical mutation is allowed.
