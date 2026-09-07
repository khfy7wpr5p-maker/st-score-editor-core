# P05 Teacher Pilot Corpus and Evidence Contract

Status: **FOUNDATION IMPLEMENTED ON OPEN WORK BRANCH**

Package: `packages/editor-teacher-pilot-corpus-v1`  
Baseline manifest: `corpus/p05-teacher-pilot-baseline-v1.json`

## Purpose

P05 needs measurable product evidence without converting automated regression coverage into claims about real teachers or physical devices. This contract separates those evidence classes at the data-model boundary.

## Evidence levels

### `AUTOMATED`

Repository/CI evidence only.

- Observer must be `AUTOMATION` for executed or blocked rows.
- A non-empty evidence reference is required for `PASS`, `FAIL` or `BLOCKED`.
- Device evidence is forbidden.
- Automated evidence can prove deterministic contracts and regressions, but cannot become teacher or physical-device evidence.

### `TEACHER_PILOT`

Human teacher observation only.

- Executed or blocked rows require observer `TEACHER` and a non-empty evidence reference.
- `NOT_RUN` must use observer `NONE`, null evidence reference and null device.
- CI cannot synthesize a teacher PASS.

### `PHYSICAL_DEVICE`

Observed real-device result only.

- Executed or blocked rows require observer `DEVICE_TESTER`.
- An explicit device descriptor is mandatory: hardware, platform, OS version, browser and browser version.
- `NOT_RUN` must carry no fabricated observation/device evidence.
- WebKit/browser automation cannot satisfy this evidence level.

## Provenance

Every case records:

- source kind;
- stable source reference;
- rights status;
- whether personal data is present;
- `externalTrainingAuthorized: false`.

The corpus contract cannot grant external model-training authority. Any future external upload/training decision remains a separate human gate.

## Metrics

`summarizeTeacherPilotCorpusV1` reports deterministic counts:

- PASS / FAIL / BLOCKED / NOT_RUN;
- automated / teacher-pilot / physical-device case counts;
- teacher-pilot PASS count;
- physical-device PASS count;
- per-capability outcome summaries sorted by capability name.

The metrics object always exposes:

- `externalTrainingAuthority: false`;
- `productionReleaseAuthority: false`.

Evidence summaries therefore describe what was observed; they do not authorize release.

## Baseline manifest

The initial committed baseline contains six rows:

- three automated regression-backed rows marked PASS;
- one teacher-pilot row marked NOT_RUN;
- two physical-device rows marked NOT_RUN.

This is intentional. P05 does not claim real teacher or physical-device evidence until those sessions are actually performed and recorded.

## Safety invariants

- Corpus metadata does not mutate canonical score or notation.
- Corpus metadata does not own editor history.
- Corpus metadata does not authorize production release.
- Corpus metadata does not authorize external training/upload.
- `PASS`, `FAIL`, `BLOCKED` and `NOT_RUN` remain distinct.
- Real-device evidence is never inferred from browser automation.
- Real-teacher evidence is never inferred from CI.

## Next bounded P05 work

After this foundation is green on exact-head CI:

1. expand the representative musical fixture set with provenance;
2. add task-level teacher acceptance criteria and correction-time/error metrics;
3. record real teacher pilot evidence only when a teacher session occurs;
4. record physical device rows only from actual devices;
5. keep P05 in progress until those human/device evidence gates are satisfied.
