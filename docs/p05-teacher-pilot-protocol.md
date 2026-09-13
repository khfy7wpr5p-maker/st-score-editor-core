# P05 Teacher Pilot Protocol

Status: PREPARED — human observation required before any TEACHER_PILOT PASS.

## Purpose

Run the bounded teacher workflow against the repository-owned P05 MusicXML fixtures with a real teacher observer. Automation, CI, browser emulation, or synthetic assertions cannot substitute for this observation.

## Observer rule

A teacher-pilot result may only be recorded when:
- the task was actually performed by a teacher;
- the observer is recorded as `TEACHER`;
- an evidence reference identifies the observed session record;
- no physical-device PASS is inferred from the teacher result;
- no release, merge, external-training, or production authority is implied.

## Pilot tasks

### 1. Polyphony inspection
Fixture: `corpus/fixtures/p05-synthetic-polyphonic-chord.musicxml`

Do:
1. Open the file in ST Score Editor.
2. Inspect the exercise.
3. Confirm that two voices remain distinct.
4. Confirm that the chord remains a single chord event containing two pitches.

Record:
- elapsed time;
- task completed yes/no;
- final result accepted by teacher yes/no;
- any visible data loss yes/no.

### 2. Copy → Paste → Undo
Fixture: `corpus/fixtures/p05-synthetic-teacher-edit.musicxml`

Do:
1. Open the file.
2. Select the first two notes as the semantic range.
3. Copy the range.
4. Paste it into the trailing rest using the bounded overwrite workflow.
5. Confirm the edit appears once.
6. Undo once.
7. Confirm the exact pre-edit musical state is restored from the teacher's perspective.

Record:
- elapsed time;
- canonical edit count if shown/available;
- Undo count;
- Redo count;
- task completed yes/no;
- final result accepted yes/no;
- any visible data loss yes/no.

### 3. Two-staff inspection
Fixture: `corpus/fixtures/p05-synthetic-two-staff.musicxml`

Do:
1. Open the file.
2. Confirm the score remains two-staff.
3. Confirm the upper-staff note remains on the upper staff.
4. Confirm the lower-staff rest remains on the lower staff.

Record the same observation fields.

## Result interpretation

- `PASS`: task completed and teacher accepts the final result with no observed silent data loss.
- `FAIL`: task ran but one or more acceptance criteria failed.
- `BLOCKED`: task could not be meaningfully executed because the required UI/capability was unavailable or unusable.
- `NOT_RUN`: task was not attempted. No result metrics may be invented.

## Evidence boundary

A teacher observation may establish `TEACHER_PILOT` evidence only. It does not establish `PHYSICAL_DEVICE` evidence unless a separate device-test record is created under the physical-device evidence contract.

## Current state

All three teacher tasks remain `NOT_RUN` until an observed session is reported. This document authorizes no merge, release, deployment, external training, or SesliTab/Smoosic dependency change.
