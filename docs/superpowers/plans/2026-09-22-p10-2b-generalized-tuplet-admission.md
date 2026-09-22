# P10-2B Generalized Tuplet Admission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only, fail-closed 4:3 generalized tuplet admission analyzer without changing the existing 3:2 APP-11J/P10-2 mutation path, while establishing a truthful SonarQube Cloud security baseline.

**Architecture:** Keep APP-11J and P10-2 Triplet mutation untouched. Add one separate `editor-generalized-tuplet-admission-v4` package whose only admitted profile is exactly four current-revision events carrying one exact 4:3 tuplet range; it computes immutable exact-rational straightening evidence and adjacent-rest capacity but owns no mutation, history, renderer, browser, or topology authority. Sonar triage is a prerequisite evidence task, not a scanner/configuration change.

**Tech Stack:** TypeScript 6.0.3, Node.js >=18, `node:test`, exact bigint-backed rational arithmetic, `ScoreDocumentV3`, `NotationDocumentV4`, `SemanticAddressV3`, existing MusicXML app import path, GitHub Actions Node 18/20/22 + retained WebKit gates, SonarQube Cloud Automatic Analysis.

**Spec:** `docs/superpowers/specs/2026-09-22-p10-2b-generalized-tuplet-admission-design.md`

## Global Constraints

- Baseline main is `cb82b4c8903a140b85f58fec147c1ee5b2f966a0`; PR #194 is already merged.
- Only the profile `actualNotes=4`, `normalNotes=3`, `targetCardinality=4` is newly admitted.
- APP-11J remains the 3:2 read-only admission authority and must not be generalized in place.
- Existing P10-2 3:2 mutation/history/browser behavior remains unchanged.
- Canonical timing comes from `ScoreDocumentV3`; SVG/DOM/renderer geometry never becomes timing authority.
- Inputs are current-revision `EventAddressV3` targets only.
- Exact rational arithmetic only; no floating-point timing calculations.
- No target sorting, inferred neighbors, target repair, Voice invention, measure growth, topology repair, or renderer-derived range selection.
- Generalized canonical mutation authority remains false.
- History mutation authority remains false.
- Renderer-coordinate authority remains false.
- Imported event/note identity must remain unchanged.
- SonarQube Cloud Automatic Analysis stays active; do not add `sonar-project.properties`, a duplicate GitHub Actions scanner, or `SONAR_TOKEN`.
- Do not suppress Sonar findings just to improve the rating.
- Do not claim Sonar Quality Gate PASS unless SonarQube Cloud reports PASS.
- Do not merge, release, activate public write, cut over SesliTab, or authorize generalized tuplet mutation in this plan.

## Frozen public interface

Create `packages/editor-generalized-tuplet-admission-v4/src/index.ts` with these names:

```ts
export const GENERALIZED_TUPLET_ADMISSION_V4_VERSION = '1.0.0' as const;

export const FOUR_TO_THREE_TUPLET_PROFILE_V4 = Object.freeze({
  version: '1.0.0',
  actualNotes: 4,
  normalNotes: 3,
  targetCardinality: 4
} as const);

export type GeneralizedTupletAdmissionReasonV4 =
  | 'ADMITTED_4_TO_3_TO_STRAIGHT_FOUR'
  | 'BLOCKED_WRONG_CARDINALITY'
  | 'BLOCKED_STALE_TARGET'
  | 'BLOCKED_TARGET_KIND'
  | 'BLOCKED_DUPLICATE_TARGET'
  | 'BLOCKED_REORDERED_OR_NONCONSECUTIVE_TARGET'
  | 'BLOCKED_CROSS_SCOPE_TARGET'
  | 'BLOCKED_CURRENT_TIMING_INVALID'
  | 'BLOCKED_TUPLET_PROFILE_UNSUPPORTED'
  | 'BLOCKED_TUPLET_BOUNDARY_INVALID'
  | 'BLOCKED_NESTED_OR_OVERLAPPING_TUPLET'
  | 'BLOCKED_WRITTEN_BASE_UNSUPPORTED'
  | 'BLOCKED_TIMING_COUPLED_DOTS'
  | 'BLOCKED_TIMING_COUPLED_BEAMS'
  | 'BLOCKED_TIMING_COUPLED_TIES'
  | 'BLOCKED_CROSS_STAFF_TARGET'
  | 'BLOCKED_ADJACENT_REST_REQUIRED'
  | 'BLOCKED_ADJACENT_REST_INSUFFICIENT'
  | 'BLOCKED_ARITHMETIC';

export interface GeneralizedTupletProfileV4 {
  readonly version: '1.0.0';
  readonly actualNotes: 4;
  readonly normalNotes: 3;
  readonly targetCardinality: 4;
}

export interface GeneralizedTupletEventPlanV4 {
  readonly eventId: string;
  readonly currentOnset: Rational;
  readonly currentDuration: Rational;
  readonly proposedOnset: Rational;
  readonly proposedDuration: Rational;
}

export interface GeneralizedTupletGrowthIntervalV4 {
  readonly onset: Rational;
  readonly duration: Rational;
  readonly end: Rational;
}

export type GeneralizedTupletRestActionV4 =
  | 'REMOVE_ADJACENT_REST'
  | 'SHRINK_ADJACENT_REST_FORWARD';

export interface GeneralizedTupletRestPlanV4 {
  readonly action: GeneralizedTupletRestActionV4;
  readonly restEventId: string;
  readonly currentOnset: Rational;
  readonly currentDuration: Rational;
  readonly proposedOnset: Rational | null;
  readonly proposedDuration: Rational | null;
}

export interface GeneralizedTupletAdmissionV4 {
  readonly version: typeof GENERALIZED_TUPLET_ADMISSION_V4_VERSION;
  readonly documentId: string;
  readonly revisionId: string;
  readonly profile: Readonly<GeneralizedTupletProfileV4>;
  readonly targetEventIds: readonly string[];
  readonly currentTupletDuration: Rational | null;
  readonly restoredWrittenBase: Rational | null;
  readonly currentGroupOnset: Rational | null;
  readonly currentGroupEnd: Rational | null;
  readonly proposedGroupEnd: Rational | null;
  readonly eventPlans: readonly GeneralizedTupletEventPlanV4[];
  readonly requiredGrowthInterval: GeneralizedTupletGrowthIntervalV4 | null;
  readonly nextEventId: string | null;
  readonly nextEventOnset: Rational | null;
  readonly couplingReasons: readonly string[];
  readonly restPlan: GeneralizedTupletRestPlanV4 | null;
  readonly balancePolicy: 'CONSUME_EXACT_ADJACENT_NEUTRAL_REST' | null;
  readonly atomicMutationRequired: true;
  readonly canonicalMutationAuthority: false;
  readonly historyMutationAuthority: false;
  readonly rendererCoordinateAuthority: false;
  readonly admitted: boolean;
  readonly reason: GeneralizedTupletAdmissionReasonV4;
}

export const analyzeGeneralizedTupletToStraightV4 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  targetsInput: readonly EventAddressV3[],
  profileInput: GeneralizedTupletProfileV4
): Readonly<GeneralizedTupletAdmissionV4>;
```

All expected user/input rejections return `admitted:false` with one frozen public reason above. Reserve thrown errors for impossible/internal construction failures after validated model creation; do not use exceptions as the normal stale/wrong-cardinality path.

## Review Focus

1. A valid 4:3 range supplied in the wrong event order must return `BLOCKED_REORDERED_OR_NONCONSECUTIVE_TARGET`; the analyzer must never sort it.
2. A MusicXML-imported 4:3 range must retain imported event/note ids and path identities in the returned evidence.
3. Extra tuplet boundary marks on an otherwise 4:3 group must return `BLOCKED_NESTED_OR_OVERLAPPING_TUPLET`, not be normalized away.
4. A neutral adjacent rest with exactly the growth duration must produce `REMOVE_ADJACENT_REST`; a larger one must produce `SHRINK_ADJACENT_REST_FORWARD` with exact rational residual timing.
5. A slur-only selected range must remain admissible, while dots, beams, ties, and selected cross-staff placement each fail closed with their specific reason.

---

### Task 1: Establish the live SonarQube security baseline before product code

**Files:**
- Create after live evidence is available: `docs/p10-2b-sonar-security-triage.md`
- Do not modify: `.github/workflows/**`
- Do not create: `sonar-project.properties`

**Interfaces:**
- Consumes: SonarQube Cloud project `khfy7wpr5p-maker_st-score-editor-core`, organization `khfy7wpr5p-maker`, Automatic Analysis.
- Produces: a checked-in evidence report containing all 14 open security findings and their classification.

- [ ] **Step 1: Confirm repository-side Sonar integration remains Automatic-Analysis-only**

Run:

```bash
git grep -n -E 'SONAR_TOKEN|sonar-project\.properties|sonar-scanner|SonarSource/sonarqube-scan-action' -- . ':!docs/superpowers/plans/*' ':!docs/superpowers/specs/*'
```

Expected: no scanner/token/configuration path is found.

- [ ] **Step 2: Retrieve the current Sonar issue list from the service**

Use the SonarQube Cloud project issue/security view for `khfy7wpr5p-maker_st-score-editor-core`. Capture each currently open security finding's exact rule/key, severity, file, line, issue type, new-code/overall-code status, and current status.

If the execution environment cannot read the live Sonar issue details, stop Task 1 and report `SONAR_LIVE_ISSUE_DETAILS_UNAVAILABLE`. Do not invent the 14 rows from the handoff summary, and do not start Task 2 until the 14 live findings are accessible.

- [ ] **Step 3: Read the code context for every finding before classification**

For every live row, inspect at least the flagged line plus the containing function/module. Classify exactly one of:

```text
TRUE_POSITIVE_FIX
REVIEW_REQUIRED
FALSE_POSITIVE_CANDIDATE
ACCEPTED_RISK_CANDIDATE
```

A `TRUE_POSITIVE_FIX` entry must state the concrete unsafe mechanism and the regression test that will fail before the fix. A candidate false positive or accepted risk must state why the runtime path is not exploitable or why the risk remains intentionally accepted; do not change Sonar status during this task.

- [ ] **Step 4: Write the evidence report**

Use this exact structure:

```markdown
# P10-2B SonarQube Security Triage

Project: khfy7wpr5p-maker_st-score-editor-core
Analysis mode: Automatic Analysis
Observed Quality Gate: <copy exact live service value>
Observed open security findings: 14

| # | Rule/key | Severity | File:line | Type | New/overall | Scope | Classification | Rationale |
|---|---|---|---|---|---|---|---|---|

## Scanner/configuration ruling

No duplicate scanner, sonar-project.properties, or SONAR_TOKEN path is introduced.

## Fix queue

List only rows classified TRUE_POSITIVE_FIX, each with its planned regression test file.

## Unresolved review queue

List only REVIEW_REQUIRED rows.

## Service truth

Record the exact Sonar Quality Gate value observed during this task. CI success is not a substitute.
```

Replace the angle-bracket service value with the exact live value before saving; the final document must contain no angle-bracket placeholders.

- [ ] **Step 5: Verify all 14 rows are present and no unsupported PASS claim exists**

Run:

```bash
node - <<'NODE'
const fs=require('node:fs');
const s=fs.readFileSync('docs/p10-2b-sonar-security-triage.md','utf8');
const rows=s.split('\n').filter(line=>/^\| [0-9]+ \|/.test(line));
if(rows.length!==14) throw new Error(`expected 14 Sonar rows, got ${rows.length}`);
if(/Quality Gate:\s*PASS/i.test(s) && !/service-reported PASS/i.test(s)) {
  throw new Error('unsupported Sonar PASS wording');
}
console.log('P10-2B Sonar triage shape: PASS');
NODE
```

Expected: `P10-2B Sonar triage shape: PASS`.

- [ ] **Step 6: Commit only the evidence report**

```bash
git add docs/p10-2b-sonar-security-triage.md
git commit -m "docs(P10-2B): record Sonar security triage"
```

Do not fix any Sonar row inside this task. Each `TRUE_POSITIVE_FIX` becomes a separate TDD slice before final qualification.

---

### Task 2: Add the 4:3 analyzer API and one exact positive admission

**Files:**
- Create: `packages/editor-generalized-tuplet-admission-v4/src/index.ts`
- Create: `test/p10-2b-generalized-tuplet-admission-v4.test.mjs`

**Interfaces:**
- Consumes: `createScoreDocumentV3`, `createNotationDocumentV4`, `resolveSemanticAddressV3`, `EventAddressV3`, `Rational`, `ScoreEvent`.
- Produces: the frozen public interface defined in this plan, especially `FOUR_TO_THREE_TUPLET_PROFILE_V4` and `analyzeGeneralizedTupletToStraightV4`.

- [ ] **Step 1: Write the first failing 4:3 admission test**

Create the test fixture with four contiguous 4:3 notes and one adjacent eighth rest:

```js
const fourToThree=(position,number=1)=>eventNotation({
  tuplet:{
    actualNotes:4,
    normalNotes:3,
    marks:position==='middle'?[]:[{number,type:position}]
  }
});

const eighthFourToThree=(restDuration={numerator:1,denominator:8})=>[
  note('e1','n1',{numerator:0,denominator:1},{numerator:3,denominator:32},'C'),
  note('e2','n2',{numerator:3,denominator:32},{numerator:3,denominator:32},'D'),
  note('e3','n3',{numerator:3,denominator:16},{numerator:3,denominator:32},'E'),
  note('e4','n4',{numerator:9,denominator:32},{numerator:3,denominator:32},'F'),
  rest('r1',{numerator:3,denominator:8},restDuration)
];

const fourToThreeNotationById=()=>({
  e1:fourToThree('start'),
  e2:fourToThree('middle'),
  e3:fourToThree('middle'),
  e4:fourToThree('stop')
});
```

Add the behavior assertion:

```js
test('P10-2B admits exact four-event 4:3 timing and returns immutable straight-four evidence',()=>{
  const {score,notation}=state({
    events:eighthFourToThree(),
    eventNotationById:fourToThreeNotationById()
  });
  const beforeScore=structuredClone(score);
  const beforeNotation=structuredClone(notation);
  const result=analyzeGeneralizedTupletToStraightV4(
    score,
    notation,
    targets(score,'e1','e2','e3','e4'),
    FOUR_TO_THREE_TUPLET_PROFILE_V4
  );

  assert.equal(result.admitted,true);
  assert.equal(result.reason,'ADMITTED_4_TO_3_TO_STRAIGHT_FOUR');
  assert.deepEqual(result.currentTupletDuration,{numerator:3,denominator:32});
  assert.deepEqual(result.restoredWrittenBase,{numerator:1,denominator:8});
  assert.deepEqual(result.eventPlans.map(plan=>({
    id:plan.eventId,
    onset:plan.proposedOnset,
    duration:plan.proposedDuration
  })),[
    {id:'e1',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:8}},
    {id:'e2',onset:{numerator:1,denominator:8},duration:{numerator:1,denominator:8}},
    {id:'e3',onset:{numerator:1,denominator:4},duration:{numerator:1,denominator:8}},
    {id:'e4',onset:{numerator:3,denominator:8},duration:{numerator:1,denominator:8}}
  ]);
  assert.deepEqual(result.currentGroupEnd,{numerator:3,denominator:8});
  assert.deepEqual(result.proposedGroupEnd,{numerator:1,denominator:2});
  assert.deepEqual(result.requiredGrowthInterval,{
    onset:{numerator:3,denominator:8},
    duration:{numerator:1,denominator:8},
    end:{numerator:1,denominator:2}
  });
  assert.equal(result.atomicMutationRequired,true);
  assert.equal(result.canonicalMutationAuthority,false);
  assert.equal(result.historyMutationAuthority,false);
  assert.equal(result.rendererCoordinateAuthority,false);
  assert.equal(Object.isFrozen(result),true);
  assert.deepEqual(score,beforeScore);
  assert.deepEqual(notation,beforeNotation);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm run build
node --test test/p10-2b-generalized-tuplet-admission-v4.test.mjs
```

Expected: FAIL because `../dist/packages/editor-generalized-tuplet-admission-v4/src/index.js` does not exist.

- [ ] **Step 3: Implement the minimum immutable analyzer for the happy path**

In the new package:

1. import V3/V4 model/addressing types;
2. define the frozen interface exactly as in this plan;
3. copy the bounded bigint rational helpers from APP-11J, generalized only enough for multiplying by `actualNotes/normalNotes`;
4. validate model inputs through `createScoreDocumentV3` and `createNotationDocumentV4`;
5. resolve four targets without mutating them;
6. require exact 4:3 notation;
7. compute:
   - `restoredWrittenBase = duration * 4 / 3`;
   - four proposed onsets from the first onset;
   - exact current/proposed group ends;
   - exact growth interval;
8. return a deeply frozen result;
9. set all mutation/history/renderer authority flags to false.

Keep `SIMPLE_WRITTEN_BASES` identical to APP-11J:

```ts
const SIMPLE_WRITTEN_BASES: readonly Readonly<Rational>[] = Object.freeze([
  Object.freeze({ numerator: 1, denominator: 1 }),
  Object.freeze({ numerator: 1, denominator: 2 }),
  Object.freeze({ numerator: 1, denominator: 4 }),
  Object.freeze({ numerator: 1, denominator: 8 }),
  Object.freeze({ numerator: 1, denominator: 16 }),
  Object.freeze({ numerator: 1, denominator: 32 })
]);
```

Do not import or call the P10-2 mutation package.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm run build
node --test test/p10-2b-generalized-tuplet-admission-v4.test.mjs
```

Expected: 1 test PASS.

- [ ] **Step 5: Inspect the diff for accidental mutation authority**

Run:

```bash
git diff -- packages/editor-generalized-tuplet-admission-v4/src/index.ts test/p10-2b-generalized-tuplet-admission-v4.test.mjs
git grep -n -E 'commitEditorHistory|execute.*Authoring|renderer|document\.querySelector|querySelector' -- packages/editor-generalized-tuplet-admission-v4
```

Expected: no history/authoring/DOM dependency.

- [ ] **Step 6: Commit**

```bash
git add packages/editor-generalized-tuplet-admission-v4/src/index.ts test/p10-2b-generalized-tuplet-admission-v4.test.mjs
git commit -m "feat(P10-2B): add read-only 4:3 tuplet admission"
```

---

### Task 3: Make semantic target validation fail closed without sorting or repair

**Files:**
- Modify: `packages/editor-generalized-tuplet-admission-v4/src/index.ts`
- Modify: `test/p10-2b-generalized-tuplet-admission-v4.test.mjs`

**Interfaces:**
- Consumes: Task 2 analyzer/result.
- Produces: deterministic target-rejection reasons without exceptions for ordinary invalid/stale selections.

- [ ] **Step 1: Add RED tests for cardinality, duplicate, stale, reordered, nonconsecutive, and cross-scope targets**

Add these assertions:

```js
test('P10-2B fails closed for wrong cardinality and duplicate targets',()=>{
  const {score,notation}=validState();
  const exact=targets(score,'e1','e2','e3','e4');

  let result=analyzeGeneralizedTupletToStraightV4(
    score,notation,exact.slice(0,3),FOUR_TO_THREE_TUPLET_PROFILE_V4
  );
  assert.equal(result.admitted,false);
  assert.equal(result.reason,'BLOCKED_WRONG_CARDINALITY');

  result=analyzeGeneralizedTupletToStraightV4(
    score,notation,[exact[0],exact[1],exact[1],exact[3]],FOUR_TO_THREE_TUPLET_PROFILE_V4
  );
  assert.equal(result.admitted,false);
  assert.equal(result.reason,'BLOCKED_DUPLICATE_TARGET');
});

test('P10-2B never sorts reordered or nonconsecutive targets',()=>{
  const {score,notation}=validState();

  let result=analyzeGeneralizedTupletToStraightV4(
    score,notation,targets(score,'e2','e1','e3','e4'),FOUR_TO_THREE_TUPLET_PROFILE_V4
  );
  assert.equal(result.reason,'BLOCKED_REORDERED_OR_NONCONSECUTIVE_TARGET');

  result=analyzeGeneralizedTupletToStraightV4(
    score,notation,targets(score,'e1','e2','e4','r1'),FOUR_TO_THREE_TUPLET_PROFILE_V4
  );
  assert.equal(result.reason,'BLOCKED_REORDERED_OR_NONCONSECUTIVE_TARGET');
});
```

For stale targeting, take addresses from revision A and analyze against a cloned score whose revision id is changed to revision B; expect `BLOCKED_STALE_TARGET`.

For cross-scope coverage, extend the fixture to create:
- another Voice in the same measure;
- another measure/frame;
- another standard staff;
- another part.

Pass one foreign target at a time and assert `BLOCKED_CROSS_SCOPE_TARGET`.

- [ ] **Step 2: Verify RED**

Run:

```bash
npm run build
node --test --test-name-pattern='P10-2B.*(cardinality|reordered|stale|cross-scope)' test/p10-2b-generalized-tuplet-admission-v4.test.mjs
```

Expected: one or more assertions FAIL because Task 2 only supports the happy path.

- [ ] **Step 3: Implement ordered current-revision target resolution**

Implement validation in this order so reasons stay deterministic:

```text
profile supported
-> cardinality exactly 4
-> each address resolves in current revision
-> each resolved kind is event
-> event ids distinct
-> same part/staff/frame/measure/Voice path
-> indices are exactly [i, i+1, i+2, i+3]
```

Rules:

- do not call `.sort()`;
- do not replace an address with a neighbor;
- stale resolution returns `BLOCKED_STALE_TARGET`;
- wrong kind returns `BLOCKED_TARGET_KIND`;
- same-path failure returns `BLOCKED_CROSS_SCOPE_TARGET`;
- wrong order/gap returns `BLOCKED_REORDERED_OR_NONCONSECUTIVE_TARGET`.

- [ ] **Step 4: Verify GREEN and retain the Task 2 positive case**

Run:

```bash
npm run build
node --test test/p10-2b-generalized-tuplet-admission-v4.test.mjs
```

Expected: all P10-2B tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/editor-generalized-tuplet-admission-v4/src/index.ts test/p10-2b-generalized-tuplet-admission-v4.test.mjs
git commit -m "test(P10-2B): lock semantic target admission"
```

---

### Task 4: Enforce exact 4:3 notation, timing, and coupling boundaries

**Files:**
- Modify: `packages/editor-generalized-tuplet-admission-v4/src/index.ts`
- Modify: `test/p10-2b-generalized-tuplet-admission-v4.test.mjs`

**Interfaces:**
- Consumes: validated ordered four-event target range.
- Produces: exact profile/timing/coupling rejection reasons and slur-only admission.

- [ ] **Step 1: Add RED profile and boundary-mark tests**

Add a helper that can set an arbitrary tuplet ratio and marks, then assert:

```js
test('P10-2B admits only the frozen 4:3 profile and one exact start-middle-middle-stop range',()=>{
  let current=validState({
    eventNotationById:{
      e1:tupletNotation(5,4,[{number:1,type:'start'}]),
      e2:tupletNotation(5,4,[]),
      e3:tupletNotation(5,4,[]),
      e4:tupletNotation(5,4,[{number:1,type:'stop'}])
    }
  });
  let result=analyzeCurrent(current);
  assert.equal(result.reason,'BLOCKED_TUPLET_PROFILE_UNSUPPORTED');

  current=validState({
    eventNotationById:{
      e1:tupletNotation(4,3,[{number:1,type:'start'}]),
      e2:tupletNotation(4,3,[]),
      e3:tupletNotation(4,3,[]),
      e4:tupletNotation(4,3,[{number:2,type:'stop'}])
    }
  });
  result=analyzeCurrent(current);
  assert.equal(result.reason,'BLOCKED_TUPLET_BOUNDARY_INVALID');

  current=validState({
    eventNotationById:{
      e1:tupletNotation(4,3,[{number:1,type:'start'},{number:2,type:'start'}]),
      e2:tupletNotation(4,3,[]),
      e3:tupletNotation(4,3,[]),
      e4:tupletNotation(4,3,[{number:1,type:'stop'}])
    }
  });
  result=analyzeCurrent(current);
  assert.equal(result.reason,'BLOCKED_NESTED_OR_OVERLAPPING_TUPLET');
});
```

- [ ] **Step 2: Add RED timing tests**

Create cases for:
- unequal selected durations;
- one onset gap;
- one selected overlap;
- preceding event overlapping the first selected event;
- following event beginning before the current group end;
- a current duration whose `* 4 / 3` result is not in `SIMPLE_WRITTEN_BASES`.

All invalid occupancy cases expect `BLOCKED_CURRENT_TIMING_INVALID`; unsupported written base expects `BLOCKED_WRITTEN_BASE_UNSUPPORTED`.

- [ ] **Step 3: Add RED coupling tests**

Assert exact reasons:

```js
assert.equal(analyzeWith({dotsOn:'e1'}).reason,'BLOCKED_TIMING_COUPLED_DOTS');
assert.equal(analyzeWith({beamsOn:'e2'}).reason,'BLOCKED_TIMING_COUPLED_BEAMS');
assert.equal(analyzeWith({tiesOn:'n3'}).reason,'BLOCKED_TIMING_COUPLED_TIES');
assert.equal(analyzeWith({crossStaffEvent:'e4'}).reason,'BLOCKED_CROSS_STAFF_TARGET');
assert.equal(analyzeWith({slurStart:'n1',slurStop:'n4'}).admitted,true);
```

Also assert `couplingReasons` contains the exact source id, for example `['dots:e1']`, `['beams:e2']`, or `['tie:n3']`.

- [ ] **Step 4: Verify RED**

Run:

```bash
npm run build
node --test --test-name-pattern='P10-2B.*(profile|timing|coupling)' test/p10-2b-generalized-tuplet-admission-v4.test.mjs
```

Expected: FAIL until the new guards exist.

- [ ] **Step 5: Implement the guards in deterministic order**

Within the already validated Voice range:

1. require equal duration;
2. require exact canonical contiguity and no preceding/following overlap;
3. inspect all four `TupletSpec` values;
4. reject any ratio other than 4:3;
5. reject extra marks as nested/overlapping;
6. require one start mark on event 1, none on 2/3, one same-number stop on 4;
7. detect dots, then beams, then ties;
8. detect selected cross-staff placement;
9. compute `restoredWrittenBase = currentDuration * 4 / 3`;
10. require one bounded simple written base.

Keep slurs out of timing-coupling detection.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
npm run build
node --test test/p10-2b-generalized-tuplet-admission-v4.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/editor-generalized-tuplet-admission-v4/src/index.ts test/p10-2b-generalized-tuplet-admission-v4.test.mjs
git commit -m "feat(P10-2B): enforce 4:3 fail-closed boundaries"
```

---

### Task 5: Complete adjacent-rest planning and immutable evidence

**Files:**
- Modify: `packages/editor-generalized-tuplet-admission-v4/src/index.ts`
- Modify: `test/p10-2b-generalized-tuplet-admission-v4.test.mjs`

**Interfaces:**
- Consumes: exact 4:3 target timing from Tasks 2-4.
- Produces: exact immutable `restPlan`, growth interval, and input-preservation guarantees.

- [ ] **Step 1: Add RED exact-remove and forward-shrink tests**

For the existing 1/8 adjacent rest:

```js
assert.deepEqual(result.restPlan,{
  action:'REMOVE_ADJACENT_REST',
  restEventId:'r1',
  currentOnset:{numerator:3,denominator:8},
  currentDuration:{numerator:1,denominator:8},
  proposedOnset:null,
  proposedDuration:null
});
```

For a `3/8` adjacent rest, expected residual:

```js
assert.deepEqual(result.restPlan,{
  action:'SHRINK_ADJACENT_REST_FORWARD',
  restEventId:'r1',
  currentOnset:{numerator:3,denominator:8},
  currentDuration:{numerator:3,denominator:8},
  proposedOnset:{numerator:1,denominator:2},
  proposedDuration:{numerator:1,denominator:4}
});
```

- [ ] **Step 2: Add RED missing/decorated/insufficient rest tests**

Assert:
- no next event -> `BLOCKED_ADJACENT_REST_REQUIRED`;
- next event is note -> same reason;
- rest does not begin exactly at current group end -> same reason;
- rest has dots/beams/tuplet/articulation/ornament -> same reason;
- rest has cross-staff placement -> same reason;
- rest duration `1/16` for an eighth-growth group -> `BLOCKED_ADJACENT_REST_INSUFFICIENT`.

- [ ] **Step 3: Add RED deep immutability checks**

Assert:

```js
assert.equal(Object.isFrozen(result),true);
assert.equal(Object.isFrozen(result.profile),true);
assert.equal(Object.isFrozen(result.targetEventIds),true);
assert.equal(Object.isFrozen(result.eventPlans),true);
assert.equal(Object.isFrozen(result.requiredGrowthInterval),true);
assert.equal(Object.isFrozen(result.restPlan),true);
assert.deepEqual(score,beforeScore);
assert.deepEqual(notation,beforeNotation);
```

- [ ] **Step 4: Verify RED**

Run:

```bash
npm run build
node --test --test-name-pattern='P10-2B.*(rest|immutable)' test/p10-2b-generalized-tuplet-admission-v4.test.mjs
```

Expected: FAIL until rest-plan and deep-freeze behavior are complete.

- [ ] **Step 5: Implement exact adjacent-rest analysis**

Use the same neutral-rest definition as APP-11J:

```text
dots === 0
beams.length === 0
tuplet === null
articulations.length === 0
ornaments.length === 0
no cross-staff placement
```

Compute:
- exact removal when rest end equals proposed group end;
- exact forward shrink otherwise;
- no mutation and no new event creation.

Set `balancePolicy='CONSUME_EXACT_ADJACENT_NEUTRAL_REST'` only on admitted results.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
npm run build
node --test test/p10-2b-generalized-tuplet-admission-v4.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/editor-generalized-tuplet-admission-v4/src/index.ts test/p10-2b-generalized-tuplet-admission-v4.test.mjs
git commit -m "feat(P10-2B): plan exact adjacent rest capacity"
```

---

### Task 6: Prove imported MusicXML identity survives read-only admission

**Files:**
- Modify: `test/p10-2b-generalized-tuplet-admission-v4.test.mjs`
- Production package should not need a change unless the RED test exposes a real identity bug.

**Interfaces:**
- Consumes: `openMusicXmlScoreEditorAppDocument`, imported V3/V4 canonical pair, Task 5 analyzer.
- Produces: regression proof that imported identity/topology is observed, never replaced or reordered.

- [ ] **Step 1: Add a MusicXML fixture with exact 4:3 timing**

Use `divisions=32`, four notes of `duration=3`, then one rest of `duration=4`. Put `<time-modification><actual-notes>4</actual-notes><normal-notes>3</normal-notes></time-modification>` on all four notes, one tuplet start mark on the first note and the matching stop mark on the fourth.

The fixture must contain one part, one measure, one Voice, and no beams/dots/ties/cross-staff semantics.

- [ ] **Step 2: Open through the real app MusicXML path and write the RED identity assertion**

```js
const imported=await openMusicXmlScoreEditorAppDocument(xml,{
  documentId:'doc:p10-2b:musicxml',
  revisionId:'rev:p10-2b:musicxml',
  sha256Hex:async()=> 'c'.repeat(64)
});
const score=imported.session.history.present.score;
const notation=imported.session.history.present.notation;
const voice=score.parts[0].staves.find(staff=>staff.role==='standard').measures[0].voices[0];
const selected=voice.events.slice(0,4);
const beforeIds=selected.map(event=>event.id);
const beforeNoteIds=selected.map(event=>event.kind==='note'?event.note.id:null);

const result=analyzeGeneralizedTupletToStraightV4(
  score,
  notation,
  selected.map(event=>addressEntityV3(score,event.id)),
  FOUR_TO_THREE_TUPLET_PROFILE_V4
);

assert.equal(result.admitted,true);
assert.deepEqual(result.targetEventIds,beforeIds);
assert.deepEqual(selected.map(event=>event.kind==='note'?event.note.id:null),beforeNoteIds);
assert.equal(score.source.format,'musicxml');
```

Also snapshot the full score/notation before analysis and assert exact equality afterward.

- [ ] **Step 3: Verify RED or GREEN for the right reason**

Run:

```bash
npm run build
node --test --test-name-pattern='P10-2B.*MusicXML' test/p10-2b-generalized-tuplet-admission-v4.test.mjs
```

Expected:
- PASS if the already-built analyzer correctly accepts the real imported representation; or
- FAIL only if the imported canonical/notation representation exposes a contract mismatch.

A PASS here is allowed because this task characterizes compatibility of an already-implemented public seam; if it passes immediately, retain the test as imported-source regression evidence and do not invent a product change.

- [ ] **Step 4: If RED, diagnose before changing production code**

Use the systematic-debugging skill. Determine whether the failure comes from:
- importer canonical duration/onset representation;
- V2→V3 or V3→V4 migration;
- tuplet boundary metadata;
- analyzer assumptions.

Only modify the analyzer if the imported state satisfies the approved spec but the analyzer incorrectly rejects it. Do not broaden the importer or repair malformed MusicXML under P10-2B.

- [ ] **Step 5: Verify all P10-2B tests GREEN**

```bash
npm run build
node --test test/p10-2b-generalized-tuplet-admission-v4.test.mjs
```

- [ ] **Step 6: Commit the regression evidence**

```bash
git add test/p10-2b-generalized-tuplet-admission-v4.test.mjs packages/editor-generalized-tuplet-admission-v4/src/index.ts
git commit -m "test(P10-2B): prove MusicXML tuplet identity admission"
```

If the production file did not change, stage only the test file.

---

### Task 7: Fix only Sonar findings classified TRUE_POSITIVE_FIX

**Files:**
- Modify only files named in `docs/p10-2b-sonar-security-triage.md` rows classified `TRUE_POSITIVE_FIX`.
- Add one focused regression test per true-positive mechanism where technically applicable.
- Modify `docs/p10-2b-sonar-security-triage.md` only to record the tested fix and current service status.

**Interfaces:**
- Consumes: Task 1 live classifications.
- Produces: minimal security fixes with regression evidence; no global suppression.

- [ ] **Step 1: For each TRUE_POSITIVE_FIX, reproduce the unsafe mechanism with a failing test**

Before production code, add the smallest test that proves the exact unsafe behavior.

Examples of acceptable test shape:

```js
test('rejects an unsafe unbounded filename before filesystem use',()=>{
  assert.throws(
    ()=>targetApi('../escape.musicxml'),
    error=>error?.code==='INVALID_FILE_NAME'
  );
});
```

or:

```js
test('escapes untrusted text before emitting HTML',()=>{
  assert.doesNotMatch(renderUntrusted('<img src=x onerror=1>'),/<img/);
});
```

Use the live Sonar finding's actual mechanism; do not copy these examples unless they match the flagged code.

- [ ] **Step 2: Run each focused test and verify RED**

Use `npm run build` followed by the exact `node --test --test-name-pattern=...` command for that test.

Expected: FAIL because the flagged unsafe behavior still exists.

- [ ] **Step 3: Make the smallest root-cause fix**

Preserve:
- current-revision checks;
- bounded filename/file handling;
- fail-closed validation;
- no hidden network authority;
- no weakened schema/notation validation.

Do not add `//NOSONAR`, global rule exclusions, or repository-wide suppression.

- [ ] **Step 4: Verify focused GREEN and full-suite GREEN**

```bash
npm run build
node --test <focused-test-file>
npm test
```

- [ ] **Step 5: Commit each independent security fix separately**

```bash
git add <exact-source-files> <exact-test-files> docs/p10-2b-sonar-security-triage.md
git commit -m "fix(security): <short root-cause description>"
```

The commit message description must name the mechanism, not the Sonar grade.

If Task 1 contains zero `TRUE_POSITIVE_FIX` rows, record that fact in the triage report and make no production security commit.

---

### Task 8: Update verified capability documentation without widening product claims

**Files:**
- Modify: `ARCHITECTURE.md`
- Modify: `ROADMAP.md`
- Modify: `docs/st-score-editor-app-productization.md`
- Modify: `docs/st-score-editor-app-productization.json`
- Create or modify: `docs/p10-2b-generalized-tuplet-admission.md`

**Interfaces:**
- Consumes: verified implementation/test reality only.
- Produces: documentation stating read-only 4:3 admission is present while generalized mutation remains unauthorized.

- [ ] **Step 1: Add one capability document**

It must state all of the following explicitly:

```text
P10-2B generalized tuplet admission is read-only.
Only exact four-event 4:3 is newly admitted.
APP-11J remains the 3:2 admission authority.
P10-2 3:2 mutation remains unchanged.
Generalized tuplet mutation is not implemented or authorized.
No history/browser/renderer-coordinate/topology authority was added.
Imported MusicXML identity is preserved for the admitted regression case.
```

- [ ] **Step 2: Update architecture/roadmap/productization to verified reality**

Do not mark P10-2 rhythm/relations complete merely because 4:3 read-only admission exists.

Keep:
- broader ratios/cardinalities open;
- beam authoring open;
- stronger grace-note work open;
- P10-3 queued until P10-2 is explicitly closed;
- physical iPhone/Safari release gate open unless separately run;
- production/default/public-write/SesliTab cutover unauthorized.

- [ ] **Step 3: Add/extend a documentation reality test**

Follow the existing `test/p10-architecture-reality-refresh.test.mjs` pattern. Assert that current docs contain:
- `P10-2B`;
- `4:3`;
- `read-only`;
- generalized mutation unauthorized wording.

Also assert they do not claim arbitrary/general tuplets are implemented.

- [ ] **Step 4: Verify RED then GREEN**

Run the reality test before doc edits to observe RED, then after doc edits:

```bash
npm run build
node --test test/p10-architecture-reality-refresh.test.mjs
```

Expected final: PASS.

- [ ] **Step 5: Commit**

```bash
git add ARCHITECTURE.md ROADMAP.md docs/st-score-editor-app-productization.md docs/st-score-editor-app-productization.json docs/p10-2b-generalized-tuplet-admission.md test/p10-architecture-reality-refresh.test.mjs
git commit -m "docs(P10-2B): record read-only 4:3 admission reality"
```

---

### Task 9: Exact-head verification and review

**Files:**
- No product changes are expected.
- Update evidence docs only if fresh run ids/statuses need recording.

**Interfaces:**
- Consumes: integrated P10-2B branch.
- Produces: exact-head verification record and review-ready branch; no merge.

- [ ] **Step 1: Run focused P10-2B tests on the exact head**

```bash
npm run build
node --test test/p10-2b-generalized-tuplet-admission-v4.test.mjs
```

Record exact test count and exit status.

- [ ] **Step 2: Run the full repository suite**

```bash
npm test
```

Record exact total/pass/fail counts. Do not reuse the earlier 810/810 baseline as the new result.

- [ ] **Step 3: Run repository validation**

```bash
npm run validate
```

Expected: PASS.

- [ ] **Step 4: Push the exact head and require Node 18/20/22 CI**

Verify the GitHub Actions CI run is tied to the exact branch head SHA and all three Node versions pass.

- [ ] **Step 5: Re-run or dispatch retained WebKit gates on the exact head**

Require fresh success for:
- APP-09B preview WebKit;
- P08-E4 professional artifact WebKit;
- P10-1 professional workstation WebKit;
- P10-1 renderer qualification WebKit;
- P10-2 Triplet Unretiming WebKit.

P10-2B itself has no browser UI, so no new browser authoring workflow is added in this tranche.

- [ ] **Step 6: Re-read SonarQube Cloud Automatic Analysis**

Record:
- exact analysis status;
- exact Quality Gate value;
- remaining open security findings;
- whether any fixed true-positive row disappeared or changed status.

Do not equate CI/WebKit green with Sonar PASS.

- [ ] **Step 7: Verify no mutation/browser/history authority leaked into the new package**

Run:

```bash
git grep -n -E 'commitEditorHistory|execute.*Authoring|querySelector|document\.|window\.|localStorage|fetch\(' -- packages/editor-generalized-tuplet-admission-v4
```

Expected: no matches.

Also compare against main:

```bash
git diff --stat cb82b4c8903a140b85f58fec147c1ee5b2f966a0...HEAD
git diff cb82b4c8903a140b85f58fec147c1ee5b2f966a0...HEAD -- packages/editor-tuplet-unretiming-admission-v4 packages/editor-tuplet-unretiming-authoring-v4
```

Expected second diff: empty, unless a separately justified Sonar true-positive fix touched one of those packages. If non-empty, review it explicitly.

- [ ] **Step 8: Run verification-before-completion and whole-branch review**

Use `superpowers:verification-before-completion`, then `superpowers:requesting-code-review`.

Review focus:
- stale/current-revision enforcement;
- no target sorting;
- exact 4:3-only profile;
- nested/overlap fail-closed semantics;
- exact bigint rational timing;
- adjacent-rest neutrality/capacity;
- MusicXML identity preservation;
- zero generalized mutation/history/browser authority;
- no duplicate Sonar integration;
- no documentation overclaim.

- [ ] **Step 9: Stop before merge**

Report:
- exact head SHA;
- exact focused/full test results;
- CI run ids;
- WebKit run ids;
- Sonar service result;
- remaining security rows;
- any unverified physical-device gate.

Do not merge, release, cut over, or activate generalized mutation without a new explicit human approval.
