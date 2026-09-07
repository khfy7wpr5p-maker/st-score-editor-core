# P05 Representative MusicXML Corpus and Teacher Task Plan

Status: **CANDIDATE — exact-head CI required before VERIFIED**

Branch: `p05-representative-musicxml-corpus-v1`  
PR: #147

## Purpose

P05-CORPUS02 converts representative MusicXML examples from inline test strings into explicit repository-owned corpus fixtures and connects them to measurable teacher-pilot tasks.

This package does **not** claim that a real teacher or a physical device has run the tasks.

## Repository-owned fixtures

The fixture set contains three deliberately synthetic exercises. They are not transcriptions of named compositions and contain no user material.

1. `corpus/fixtures/p05-synthetic-polyphonic-chord.musicxml`
   - two canonical voices;
   - one chord event;
   - canonical import and serialize/re-import semantic equivalence.

2. `corpus/fixtures/p05-synthetic-two-staff.musicxml`
   - two distinct staves;
   - upper-staff pitched event;
   - lower-staff rest;
   - canonical import and serialize/re-import semantic equivalence.

3. `corpus/fixtures/p05-synthetic-teacher-edit.musicxml`
   - two pitched source events plus an explicit trailing rest;
   - current-revision semantic range selection;
   - read-only copy snapshot and destination admission;
   - deterministic paste identities;
   - one app/session history revision for accepted paste;
   - exact Undo restoration of the prior score+notation pair.

The authoritative fixture metadata is `corpus/p05-representative-musicxml-v1.json`.

Every fixture is declared:

- `sourceKind = REPOSITORY_FIXTURE`;
- `rightsStatus = REPOSITORY_OWNED`;
- `containsPersonalData = false`;
- `externalTrainingAuthorized = false`.

The corpus manifest itself has no external-training or production-release authority.

## Structural acceptance facts

The manifest records expected part, staff, voice, event, note, rest and chord counts. Regression tests import each file using the real MusicXML implementation and compare the resulting canonical document with those expected facts.

For the two canonical-roundtrip profiles, the accepted document is serialized and re-imported and must remain semantically equivalent.

For the teacher-edit profile, the regression test exercises the real bounded teacher flow and asserts one accepted history revision followed by exact Undo restoration.

## Teacher-pilot task plan

`corpus/p05-teacher-pilot-task-plan-v1.json` defines three initial human tasks:

- inspect polyphony/chord preservation;
- copy the first two notes into the trailing rest and Undo;
- inspect two-staff separation/rest placement.

Each task has explicit acceptance criteria and requested observable metrics. The initial metric vocabulary includes:

- `elapsedMs`;
- `canonicalCommitCount`;
- `undoCount`;
- `redoCount`;
- `taskCompleted`;
- `teacherAcceptedFinalResult`;
- `dataLossObserved`.

These are measurement fields, not fabricated results. Until an actual teacher run exists, every teacher task remains:

- evidence level `TEACHER_PILOT`;
- outcome `NOT_RUN`;
- observer `NONE`;
- evidence reference `null`;
- all result values `null`.

The regression suite rejects a task plan that references an unknown fixture, asks for a capability not declared by that fixture, contains duplicate acceptance criteria, uses an unknown metric, or pre-populates a human result in the committed baseline.

## Explicitly not claimed

P05-CORPUS02 does not claim:

- teacher-pilot PASS;
- physical iPhone/iPad/desktop PASS;
- general repertoire coverage;
- OMR corpus coverage;
- external model-training authorization;
- release or production authority.

The next evidence step after this deterministic corpus is real teacher execution against the task plan and later physical-device execution through the separate device gate.

## Safety boundaries

- No merge performed.
- No release/deployment/production activation performed.
- No external dependency added.
- No SesliTab repository work performed.
- No Smoosic integration changed.
- Existing pinned external ST Score Editor dependency remains untouched.
