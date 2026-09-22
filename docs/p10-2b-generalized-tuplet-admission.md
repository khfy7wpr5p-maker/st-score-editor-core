# P10-2B — Generalized Tuplet Admission Foundation

Status: **READ-ONLY 4:3 ADMISSION IMPLEMENTED / QUALIFICATION PENDING / GENERALIZED MUTATION NOT AUTHORIZED**

## What exists

P10-2B adds `editor-generalized-tuplet-admission-v4` as a separate analysis-only package.

The first admitted profile is deliberately narrow:

- `actualNotes = 4`;
- `normalNotes = 3`;
- exactly four explicit current-revision `EventAddressV3` targets;
- same part/staff/frame/measure/Voice;
- exact consecutive ordering and contiguous equal current durations;
- one exact 4:3 start / middle / middle / stop tuplet range;
- exact rational restoration to a supported simple straight written base;
- one immediate adjacent neutral same-Voice rest with enough capacity.

The analyzer returns immutable evidence only. It does not mutate the score or notation.

## Authority boundary

P10-2B is **read-only**.

```text
canonicalMutationAuthority = false
historyMutationAuthority = false
rendererCoordinateAuthority = false
browserAuthoringAuthority = false
```

APP-11J remains the existing 3:2 removal/unretiming admission authority. P10-2 remains the bounded 3:2 inverse mutation path. P10-2B does not widen either one.

**Generalized tuplet mutation is not authorized.** No 4:3 mutation, generalized browser authoring, public-write activation, production release or SesliTab cutover is created by this tranche.

## Fail-closed boundaries

The 4:3 analyzer rejects or blocks:

- stale, duplicate, wrong-kind, reordered or nonconsecutive targets;
- cross-part/staff/frame/measure/Voice ranges;
- invalid or noncontiguous current occupancy;
- ratios other than the admitted 4:3 profile;
- malformed, nested or overlapping tuplet boundaries;
- unsupported restored written bases;
- dots;
- beams;
- ties;
- selected cross-staff timing;
- missing/non-neutral adjacent rest capacity;
- insufficient adjacent-rest capacity;
- bounded exact-rational arithmetic overflow.

Slurs do not by themselves block admission because event/note identity is preserved and P10-2B performs no mutation.

## Imported MusicXML evidence

The real app MusicXML import path is covered by regression evidence. An exact imported 4:3 group remains in the same canonical event/note identities and is admitted without replacing or reordering those identities.

The regression uses MusicXML `divisions=8` with event `duration=3`, which maps to canonical `3/32` timing; restoration produces the straight `1/8` written base.

## Verification state

The focused P10-2B suite currently covers:

- positive 4:3 admission;
- current-revision target safety;
- exact profile/boundary validation;
- timing and arithmetic safety;
- dots/beams/ties/slur behavior;
- selected cross-staff rejection;
- adjacent-rest remove/shrink planning;
- deep immutability;
- imported MusicXML identity preservation.

Node 18/20/22 and retained WebKit gates must be re-run on the final exact head before merge.

## SonarQube status

SonarQube Cloud Automatic Analysis remains the intended integration mode. No duplicate scanner, `sonar-project.properties` or `SONAR_TOKEN` path is introduced.

The handoff baseline recorded 14 open security findings, security rating D and Quality Gate not computed. The current execution environment cannot retrieve the live rule/file/line rows, so live issue-detail triage remains pending.

No Sonar Quality Gate PASS is claimed.

## Release state

P10-2B does not change release authority:

```text
standaloneReleaseGatePassed = false
seslitabCutoverAuthorized = false
generalizedTupletMutationAuthorized = false
```

Physical-device validation and any future generalized tuplet mutation remain separate human-gated decisions.
