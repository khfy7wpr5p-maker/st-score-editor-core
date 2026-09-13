# P05 Representative MusicXML Corpus and Teacher Task Plan

Status: **VERIFIED ON OPEN PR / P05 REMAINS IN_PROGRESS**

Branch: `p05-representative-musicxml-corpus-v1`  
PR: #147  
Verified feature head: `9825398e7c3b00e91a95ac8ad1a1c93fa7bd9970`  
Verified feature CI: `34145108992` — Node 18 / 20 / 22 PASS

## Scope closed in P05-CORPUS02

P05-CORPUS02 converts representative MusicXML examples from inline test strings into explicit repository-owned corpus fixtures and connects them to measurable teacher-pilot tasks.

This package does **not** claim that a real teacher or a physical device has run the tasks.

### Repository-owned fixtures

The fixture set contains three deliberately synthetic exercises. They are not transcriptions of named compositions and contain no user material:

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

Every fixture is declared `REPOSITORY_FIXTURE`, `REPOSITORY_OWNED`, without personal data, and with `externalTrainingAuthorized=false`. The corpus manifest grants neither external-training nor production-release authority.

### Structural acceptance facts

The manifest records expected part, staff, voice, event, note, rest and chord counts. Regression tests import each file using the real MusicXML implementation and compare the canonical document with those expected facts.

For canonical-roundtrip profiles, the accepted document is serialized and re-imported and must remain semantically equivalent.

For the teacher-edit profile, the regression test executes the real bounded teacher path: semantic selection → copy snapshot → paste admission → deterministic identities → one app/session history commit → exact Undo restoration.

### Teacher-pilot task plan

`corpus/p05-teacher-pilot-task-plan-v1.json` defines three initial human tasks:

- inspect polyphony/chord preservation;
- copy the first two notes into the trailing rest and Undo;
- inspect two-staff separation/rest placement.

The initial metric vocabulary is:

- `elapsedMs`;
- `canonicalCommitCount`;
- `undoCount`;
- `redoCount`;
- `taskCompleted`;
- `teacherAcceptedFinalResult`;
- `dataLossObserved`.

These are measurement fields, not fabricated results. Until an actual teacher session occurs, every teacher task remains `TEACHER_PILOT / NOT_RUN / NONE`, its evidence reference is null, and every result value is null.

The regression suite rejects unknown fixture references, undeclared fixture capabilities, duplicate acceptance criteria, unknown metrics, and pre-populated human results in the committed baseline.

## Explicitly not claimed

P05-CORPUS02 does not claim:

- teacher-pilot PASS;
- physical iPhone/iPad/desktop PASS;
- general repertoire coverage;
- OMR corpus coverage;
- external model-training authorization;
- release or production authority.

## Remaining P05 evidence work

- execute the task plan with an actual teacher and record observed evidence;
- expand repertoire coverage only with explicit provenance/rights;
- establish pilot acceptance thresholds from observed results rather than invented targets;
- run physical-device evidence separately;
- synthesize release gates only after teacher and device evidence exist.

## Safety / authority

- No merge performed.
- No release/deployment/production activation performed.
- No external dependency added.
- No SesliTab repository work performed.
- No Smoosic integration changed.
- Existing pinned external ST Score Editor dependency remains untouched.
