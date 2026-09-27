# P10-2C Exact 4:3 Tuplet Mutation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement one bounded canonical exact-4:3-tuplet-to-straight-four mutation plus unified session/history commit, consuming fresh P10-2B admission evidence without widening the existing qualified 3:2 path or adding browser/product authority.

**Architecture:** Add a dedicated `editor-four-to-three-tuplet-unretiming-authoring-v4` package. Its public entry point validates one exact four-target intent, runs P10-2B admission fresh, then applies only the returned event/rest plans through a package-internal apply/validation module. Add a separate `editor-session-four-to-three-tuplet-unretiming-v4` wrapper that commits the pair exactly once through `EditorHistoryV4`, rebinds selection, and rebuilds the renderer request.

**Tech Stack:** TypeScript 6.x, Node.js >=18, `node:test`, `ScoreDocumentV3`, `NotationDocumentV4`, `SemanticAddressV3`, `EditorSessionV4 / EditorHistoryV4`, existing P10-2B generalized admission analyzer, existing MusicXML app import/export paths.

**Spec:** `docs/superpowers/specs/2026-09-27-p10-2c-exact-4-3-tuplet-mutation-design.md`

## Global Constraints

- Only exact `4:3` with exactly four explicit current-revision event targets is admitted.
- `ScoreDocumentV3 + NotationDocumentV4` remain the canonical pair.
- `EditorSessionV4 / EditorHistoryV4` remain the sole history authority.
- `SemanticAddressV3` remains exact current-revision identity.
- P10-2B remains read-only; its authority flags stay false.
- The mutation must call P10-2B admission fresh inside the public mutation call.
- The public mutation API must not accept cached admission evidence.
- No ratio/cardinality/rest-policy parameter is exposed.
- Event/note IDs and existing part/staff/frame/measure/Voice topology are preserved.
- Only admitted event timing, owned 4:3 tuplet metadata, and the one admitted adjacent neutral rest may change.
- Renderer DOM/SVG/coordinates/render tokens are never target or timing authority.
- One accepted action creates exactly one `EditorHistoryV4` revision.
- Rejected actions create no history revision.
- Existing APP-11J/P10-2 exact 3:2 admission/mutation/session/browser/artifact behavior remains unchanged.
- Browser/product/workstation composition is outside this plan.
- Arbitrary ratios/cardinalities, nested tuplets, cross-staff selected timing rewrite, dot/beam/tie-aware unretiming, multi-rest balancing, measure growth, production release, public-write, SesliTab cutover, deploy and Render work are outside this plan.

## Review Focus

1. **Fresh-evidence race/tamper defense:** public execution must never accept precomputed admission; package-internal apply/validate tests must prove mismatched event/rest plans fail rather than silently mutate. Task 1 owns these tests.
2. **Unrelated notation preservation:** selected articulations/ornaments and note accidental/slur metadata must survive while only owned 4:3 tuplet metadata disappears. Task 1 owns these tests.
3. **Imported MusicXML identity:** imported exact 4:3 event/note IDs and `score.source` must survive canonical mutation. Task 3 owns this regression.
4. **History atomicity on failure:** stale/malformed/blocked requests must leave past/present/future and renderer request unchanged. Task 2 owns this.
5. **Qualified 3:2 path isolation:** P10-2 authoring/session/roundtrip/browser/workstation tests must remain green with no API or artifact-budget changes. Tasks 3 and 4 own this regression set.

---

### Task 1: Exact 4:3 Canonical Authoring Package

**Files:**
- Create: `packages/editor-four-to-three-tuplet-unretiming-authoring-v4/src/index.ts`
- Create: `packages/editor-four-to-three-tuplet-unretiming-authoring-v4/src/apply-admission.ts`
- Create: `test/p10-2c-four-to-three-tuplet-unretiming-authoring-v4.test.mjs`

**Interfaces:**

Consumes:
- `analyzeGeneralizedTupletToStraightV4(score, notation, targets, FOUR_TO_THREE_TUPLET_PROFILE_V4)`
- `GeneralizedTupletAdmissionV4`
- `ScoreDocumentV3`
- `NotationDocumentV4`
- `EventAddressV3`
- `createScoreDocumentV3`
- `createNotationDocumentV4`
- `addressEntityV3`
- `resolveSemanticAddressV3`

Produces public API:
- `FOUR_TO_THREE_TUPLET_UNRETIMING_AUTHORING_V4_VERSION = '1.0.0'`
- `UnretimingFourToThreeToStraightFourIntentV4`
- `FourToThreeTupletUnretimingAuthoringV4Options`
- `FourToThreeTupletUnretimingAuthoringV4Result`
- `FourToThreeTupletUnretimingAuthoringV4Error`
- `executeFourToThreeTupletToStraightFourUnretimingV4(...)`

Produces package-internal API from `apply-admission.ts`:
- `applyFreshFourToThreeTupletAdmissionV4(score, notation, admission, nextRevisionId)`
- This helper is **not re-exported from `index.ts`**. Tests may import the compiled internal module directly only to pin tamper/result-validation behavior.

- [ ] **Step 1: Write RED public-contract and happy-path tests**

Create a four-note exact-4:3 fixture matching P10-2B reality:

- `e1`: onset `0`, duration `3/32`;
- `e2`: onset `3/32`, duration `3/32`;
- `e3`: onset `3/16`, duration `3/32`;
- `e4`: onset `9/32`, duration `3/32`;
- `r1`: onset `3/8`, duration `1/8`;
- notation: exact 4:3 start/middle/middle/stop.

Assert module exports the exact public function and that:

```js
const result = executeFourToThreeTupletToStraightFourUnretimingV4(
  score,
  notation,
  {
    version:'1.0.0',
    type:'UNRETIMING_FOUR_TO_THREE_TO_STRAIGHT_FOUR',
    targets:['e1','e2','e3','e4'].map(id=>addressEntityV3(score,id))
  },
  {nextRevisionId:'p10-2c-straight'}
);

assert.equal(result.score.revision.id,'p10-2c-straight');
assert.equal(result.score.revision.parentId,score.revision.id);
assert.deepEqual(
  result.score.parts[0].staves[0].measures[0].voices[0].events.map(e=>e.id),
  ['e1','e2','e3']
);
assert.deepEqual(
  result.score.parts[0].staves[0].measures[0].voices[0].events.map(e=>e.duration),
  Array(4).fill({numerator:1,denominator:8})
);
```

Correct the event-ID assertion for the exact fixture: after consuming `r1`, the Voice contains `e1,e2,e3,e4`; no selected event disappears. Assert exact straight onsets `0,1/8,1/4,3/8`.

Also assert:

- all four event IDs unchanged;
- all note IDs unchanged;
- part/staff/frame/measure/Voice IDs unchanged;
- all four target tuplets become `null`;
- original score/notation remain deep-equal to pre-call snapshots;
- result selection is `e1` rebound to the new revision;
- returned `admission.admitted === true`;
- returned admission reason is `ADMITTED_4_TO_3_TO_STRAIGHT_FOUR`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm run build && node --test test/p10-2c-four-to-three-tuplet-unretiming-authoring-v4.test.mjs
```

Expected: FAIL because the P10-2C authoring package does not exist.

- [ ] **Step 3: Implement exact intent parsing and revision validation in `index.ts`**

Use these exact public shapes:

```ts
export const FOUR_TO_THREE_TUPLET_UNRETIMING_AUTHORING_V4_VERSION = '1.0.0' as const;

export interface UnretimingFourToThreeToStraightFourIntentV4 {
  readonly version: typeof FOUR_TO_THREE_TUPLET_UNRETIMING_AUTHORING_V4_VERSION;
  readonly type: 'UNRETIMING_FOUR_TO_THREE_TO_STRAIGHT_FOUR';
  readonly targets: readonly EventAddressV3[];
}

export interface FourToThreeTupletUnretimingAuthoringV4Options {
  readonly nextRevisionId: string;
}

export interface FourToThreeTupletUnretimingAuthoringV4Result {
  readonly version: typeof FOUR_TO_THREE_TUPLET_UNRETIMING_AUTHORING_V4_VERSION;
  readonly score: Readonly<ScoreDocumentV3>;
  readonly notation: Readonly<NotationDocumentV4>;
  readonly selection: EventAddressV3;
  readonly admission: Readonly<GeneralizedTupletAdmissionV4>;
}
```

Error codes exactly:

```ts
export type FourToThreeTupletUnretimingAuthoringV4ErrorCode =
  | 'INVALID_INTENT'
  | 'INVALID_REVISION_ID'
  | 'TIMING_NOT_ADMITTED'
  | 'TARGET_PATH_INVALID'
  | 'RESULT_INVALID';
```

Intent parser rules:

- exact keys `version,type,targets`;
- version `1.0.0`;
- exact type string;
- exactly four targets;
- no sorting/reordering;
- no profile/ratio/cardinality/rest parameter.

Revision validation must follow the existing P10-2 stable-ID rule: valid ID, not current revision, not current parent revision.

- [ ] **Step 4: Implement fresh admission orchestration in `index.ts`**

The public execution function must:

1. validate score and notation;
2. parse intent;
3. validate revision ID;
4. call `analyzeGeneralizedTupletToStraightV4` with exactly `FOUR_TO_THREE_TUPLET_PROFILE_V4`;
5. if blocked, throw `TIMING_NOT_ADMITTED` and preserve `reason` + `couplingReasons` in error details;
6. call the internal apply helper once;
7. re-address `admission.targetEventIds[0]` in the result score;
8. require event-kind selection;
9. return a frozen result containing the fresh admission object.

Do not accept an admission object in any public function parameter.

- [ ] **Step 5: Write RED exact rest-removal and rest-shrink tests**

Test `REMOVE_ADJACENT_REST`:

- exactly consumed `r1` is absent after mutation;
- no notation entry remains for `r1`;
- no new residual rest appears;
- selected four event IDs all remain.

Test `SHRINK_ADJACENT_REST_FORWARD` using a larger neutral rest:

- `r1` remains;
- same rest ID;
- new onset exactly `1/2`;
- new duration exactly the P10-2B proposal;
- no other rest/event is created.

- [ ] **Step 6: Implement `applyFreshFourToThreeTupletAdmissionV4`**

In `apply-admission.ts`, require an already-admitted exact P10-2B result and:

- require `admission.admitted === true`;
- require profile exactly 4:3/cardinality 4;
- require `eventPlans.length === 4`;
- require non-null `restPlan`;
- locate the admitted Voice using the first current event target;
- for each event plan:
  - require target event exists;
  - require current onset/duration still equal the plan's `currentOnset/currentDuration`;
  - copy only `proposedOnset/proposedDuration`;
  - preserve event kind/ID/content;
- verify the admitted rest still matches ID/kind/current onset/current duration;
- execute only `REMOVE_ADJACENT_REST` or `SHRINK_ADJACENT_REST_FORWARD`;
- set only selected events' `tuplet` to `null`;
- preserve unrelated event/note notation;
- rebind all surviving notation and cross-staff references to the new revision;
- create the direct-child score revision;
- validate score and notation.

This helper must contain **no rational recomputation of the 4:3 plan**.

- [ ] **Step 7: Write RED unrelated-notation preservation tests**

Include:

- articulation on `e1`;
- ornament on `e2`;
- accidental metadata on `n1`;
- slur start on `n1`, slur stop on `n4`;
- notation on an unrelated event after the admitted rest.

Assert all survive byte/deep-equal except revision-bound semantic addresses and the selected events' `tuplet` field.

- [ ] **Step 8: Write RED fail-closed propagation tests**

Table-drive these public cases and assert `TIMING_NOT_ADMITTED` plus original P10-2B reason:

- stale target;
- reordered target list;
- target from another Voice/staff/measure/part;
- wrong 5:4 tuplet profile in notation;
- mismatched boundary numbers;
- nested/overlapping marks;
- dots;
- beams;
- ties;
- selected cross-staff placement;
- missing adjacent rest;
- insufficient adjacent-rest capacity;
- unsupported restored written base;
- bounded arithmetic failure.

Also test malformed intent and same/current-parent revision IDs with their dedicated error codes.

- [ ] **Step 9: Write RED package-internal tamper/result-validation tests**

Import `apply-admission.js` directly from the compiled package and start from a genuine fresh admitted result. Then clone only the admission for internal testing and prove the helper rejects:

- `eventPlans.length !== 4`;
- missing `restPlan`;
- event plan current timing no longer matches score;
- admitted rest ID missing;
- admitted rest timing changed;
- unsupported fake rest action supplied at runtime;
- proposed result that would retain owned tuplet metadata;
- proposed event timing mismatch after candidate construction.

These are internal defense tests only. Do **not** expose cached admission through `index.ts`.

- [ ] **Step 10: Implement result validation**

Before returning from the internal helper, verify:

- all four planned events resolve;
- onset/duration equal proposed plan exactly;
- selected tuplets are absent;
- stable event/note/topology IDs are preserved;
- removed rest cannot resolve and has no notation entry, or shrunk rest resolves with exact proposed timing;
- no selected event disappeared;
- output validators accept the candidate.

Any mismatch throws `RESULT_INVALID`; missing/admitted path races use `TARGET_PATH_INVALID` where appropriate.

- [ ] **Step 11: Run Task 1 GREEN suite**

Run:

```bash
npm run build && node --test   test/p10-2c-four-to-three-tuplet-unretiming-authoring-v4.test.mjs   test/p10-2b-generalized-tuplet-admission-v4.test.mjs   test/p10-2-tuplet-unretiming-authoring-v4.test.mjs   test/p10-2-triplet-unretiming-roundtrip.test.mjs
```

Expected: all PASS.

- [ ] **Step 12: Commit Task 1**

```bash
git add   packages/editor-four-to-three-tuplet-unretiming-authoring-v4/src/index.ts   packages/editor-four-to-three-tuplet-unretiming-authoring-v4/src/apply-admission.ts   test/p10-2c-four-to-three-tuplet-unretiming-authoring-v4.test.mjs
git commit -m "feat: add exact 4:3 tuplet unretiming authority"
```

---

### Task 2: Unified P10-2C Session / History Wrapper

**Files:**
- Create: `packages/editor-session-four-to-three-tuplet-unretiming-v4/src/index.ts`
- Create: `test/p10-2c-session-four-to-three-tuplet-unretiming-v4.test.mjs`

**Interfaces:**

Consumes:
- Task 1 `executeFourToThreeTupletToStraightFourUnretimingV4`
- `EditorSessionStateV4`
- `commitEditorHistoryV4`
- `createRendererRequestV4WithProfile`
- `navigateSessionHistoryV4`

Produces:
- `commitSessionFourToThreeTupletToStraightFourV4(session, intent, options)`

- [ ] **Step 1: Write RED one-commit + Undo/Redo test**

Build an exact admitted 4:3 canonical pair and create `EditorSessionV4`.

Assert one accepted commit:

```js
session = commitSessionFourToThreeTupletToStraightFourV4(
  session,
  intent,
  {nextRevisionId:'p10-2c-session-straight'}
);

assert.equal(session.history.past.length,1);
assert.equal(session.history.future.length,0);
assert.equal(session.status.code,'FOUR_TO_THREE_TUPLET_UNRETIMING_COMMITTED');
assert.equal(session.selection.kind,'event');
assert.equal(session.selection.eventId,'e1');
assert.equal(session.selection.revisionId,'p10-2c-session-straight');
assert.equal(session.renderRequest.revisionId,'p10-2c-session-straight');
```

Snapshot the exact pre/post score+notation pair. After `UNDO`, assert exact pre pair. After `REDO`, assert exact post pair.

- [ ] **Step 2: Run the focused session test and verify RED**

```bash
npm run build && node --test test/p10-2c-session-four-to-three-tuplet-unretiming-v4.test.mjs
```

Expected: FAIL because the session package does not exist.

- [ ] **Step 3: Implement the session wrapper**

Exact signature:

```ts
export const commitSessionFourToThreeTupletToStraightFourV4 = (
  session: EditorSessionStateV4,
  intent: unknown,
  options: FourToThreeTupletUnretimingAuthoringV4Options
): Readonly<EditorSessionStateV4>;
```

Implementation sequence:

1. read `session.history.present`;
2. call Task 1 execution exactly once;
3. commit result pair with `commitEditorHistoryV4`;
4. return `EDITOR_SESSION_V4_VERSION`;
5. use Task 1 result selection;
6. rebuild renderer request with the existing renderer profile;
7. set exact status:
   - code: `FOUR_TO_THREE_TUPLET_UNRETIMING_COMMITTED`;
   - message: `Atomic 4:3 tuplet to straight-four unretiming committed in the unified V4 history.`

Do not catch-and-repair Task 1 errors.

- [ ] **Step 4: Write RED rejection atomicity tests**

For at least:

- stale target;
- malformed intent;
- blocked dotted target;
- insufficient adjacent rest;
- invalid next revision ID;

snapshot the complete `history`, `selection`, `renderRequest`, and `status` before calling. Assert the call throws and the input session object remains deep-equal.

Because the API is immutable and throws before `commitEditorHistoryV4`, past/present/future must be unchanged.

- [ ] **Step 5: Write RED repeated-commit history test**

After one successful commit, build a second separately valid exact-4:3 fixture/session rather than trying to reapply to straight content. Prove each accepted call contributes exactly one history entry; no hidden double commit occurs.

Also assert old input addresses become stale after successful revision and returned selection is the rebound first event.

- [ ] **Step 6: Run session + retained history tests GREEN**

```bash
npm run build && node --test   test/p10-2c-session-four-to-three-tuplet-unretiming-v4.test.mjs   test/p10-2-session-triplet-unretiming.test.mjs   test/editor-history-v4.test.mjs
```

If the exact history test filename differs on the implementation head, locate the existing `EditorHistoryV4` unit test by repository search and run it; do not create a duplicate only for naming.

- [ ] **Step 7: Commit Task 2**

```bash
git add   packages/editor-session-four-to-three-tuplet-unretiming-v4/src/index.ts   test/p10-2c-session-four-to-three-tuplet-unretiming-v4.test.mjs
git commit -m "feat: commit exact 4:3 unretiming through unified history"
```

---

### Task 3: Imported MusicXML and 3:2 Isolation Regression

**Files:**
- Create: `test/p10-2c-four-to-three-tuplet-musicxml-regression.test.mjs`
- No production file is expected unless a genuine bounded defect is found.

**Interfaces:**

Consumes:
- Task 1 canonical mutation API
- existing `openMusicXmlScoreEditorAppDocument`
- existing renderer/MusicXML projection APIs used by current tests

Produces:
- imported-source identity regression evidence
- explicit retained 3:2 isolation evidence

- [ ] **Step 1: Write imported MusicXML 4:3 RED regression**

Use a minimal inline MusicXML 4:3 fixture matching the existing P10-2B imported fixture semantics.

Open via `openMusicXmlScoreEditorAppDocument`, then:

- take first four admitted Voice events;
- snapshot event IDs;
- snapshot note IDs;
- snapshot `score.source`;
- run Task 1 mutation with current-revision addresses.

Assert:

- mutation succeeds;
- same event IDs;
- same note IDs;
- `score.source` deep-equal to original source metadata;
- restored straight durations/onsets match P10-2B proposal;
- selected tuplets removed;
- no new parser behavior required.

- [ ] **Step 2: Add representable renderer/export assertion**

Using the repository's existing renderer/export path, verify the resulting pair remains exportable if the fixture is inside the existing representable profile.

Assert the export path reflects straight timing and does not change canonical IDs merely to render.

If current renderer contract reports a pending/fail-closed state for the exact fixture, assert that state instead; do not alter renderer code merely to satisfy this task.

- [ ] **Step 3: Run imported regression GREEN**

```bash
npm run build && node --test   test/p10-2c-four-to-three-tuplet-musicxml-regression.test.mjs   test/p10-2b-generalized-tuplet-admission-v4.test.mjs
```

- [ ] **Step 4: Run mandatory existing 3:2 isolation suite**

Run:

```bash
node --test   test/p10-2-tuplet-unretiming-authoring-v4.test.mjs   test/p10-2-triplet-unretiming-roundtrip.test.mjs   test/p10-2-session-triplet-unretiming.test.mjs   test/p10-2-browser-triplet-unretiming.test.mjs   test/p10-2-professional-workstation-unretiming.test.mjs   test/p10-2-professional-workstation-artifact.test.mjs   test/p10-2-productization-reality.test.mjs
```

Expected: all PASS with no P10-2 API/artifact changes.

- [ ] **Step 5: Diff-check P10-2 isolation**

Before commit, verify Task 1–3 changes do not modify:

- `packages/editor-tuplet-unretiming-admission-v4/**`;
- `packages/editor-tuplet-unretiming-authoring-v4/**`;
- `packages/editor-session-tuplet-unretiming-v4/**`;
- `packages/score-editor-browser-app/src/triplet-unretiming-authoring.ts`;
- `packages/score-editor-browser-professional-workstation-p10-2-v1/**`;
- `scripts/build-p10-2-professional-workstation-browser.mjs`;
- P10-2 artifact budgets.

If any of these require a change, stop and return to design review rather than widening this plan.

- [ ] **Step 6: Commit Task 3**

```bash
git add test/p10-2c-four-to-three-tuplet-musicxml-regression.test.mjs
git commit -m "test: cover imported exact 4:3 unretiming"
```

---

### Task 4: Repository Reality and Exact-Head Qualification

**Files:**
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`
- Modify: `ROADMAP.md`
- Modify: `docs/st-score-editor-app-productization.md`
- Modify: `docs/st-score-editor-app-productization.json`
- Create: `docs/p10-2c-exact-4-3-tuplet-mutation.md`
- Create: `test/p10-2c-exact-4-3-tuplet-mutation-reality.test.mjs`

**Interfaces:**

Consumes:
- verified Tasks 1–3 evidence

Produces:
- truthful repository reality for exact 4:3 core/session mutation only

- [ ] **Step 1: Write RED reality test**

Require a `p10_2c` JSON object with exactly bounded claims such as:

```json
{
  "status": "EXACT_4_3_CORE_SESSION_MUTATION_IMPLEMENTED_QUALIFICATION_PENDING",
  "source_admission": "editor-generalized-tuplet-admission-v4",
  "profile": {
    "actual_notes": 4,
    "normal_notes": 3,
    "target_cardinality": 4
  },
  "canonical_mutation_package": "editor-four-to-three-tuplet-unretiming-authoring-v4",
  "session_package": "editor-session-four-to-three-tuplet-unretiming-v4",
  "history_authority": "EditorHistoryV4",
  "one_user_edit_one_history_revision": true,
  "exact_undo_redo": true,
  "preserve_event_note_identity": true,
  "renderer_coordinate_authority": false,
  "browser_authoring_authority": false,
  "generalized_tuplet_mutation_authorized": false,
  "arbitrary_tuplet_support": false,
  "production_release_authorized": false,
  "seslitab_cutover_authorized": false
}
```

Also assert P10-2B remains:

- `canonical_mutation_authority:false`;
- `history_mutation_authority:false`.

And P10-2 remains the exact 3:2 package/session path unchanged.

- [ ] **Step 2: Run reality test and verify RED**

```bash
npm run build && node --test test/p10-2c-exact-4-3-tuplet-mutation-reality.test.mjs
```

Expected: FAIL until reality docs are updated.

- [ ] **Step 3: Update repository reality docs**

Document only proven core/session behavior:

- fresh P10-2B evidence;
- exact 4:3 only;
- four target events;
- exact event/rest plan application;
- one `EditorHistoryV4` revision;
- exact Undo/Redo;
- identity preservation;
- imported MusicXML regression;
- browser/product authority still false;
- arbitrary/generalized mutation still unauthorized;
- P10-2 exact 3:2 path unchanged.

Do not add browser buttons, workstation artifact, bundle budget, release, cutover or Render claims.

- [ ] **Step 4: Run focused full regression**

```bash
npm run build && node --test   test/p10-2c-four-to-three-tuplet-unretiming-authoring-v4.test.mjs   test/p10-2c-session-four-to-three-tuplet-unretiming-v4.test.mjs   test/p10-2c-four-to-three-tuplet-musicxml-regression.test.mjs   test/p10-2c-exact-4-3-tuplet-mutation-reality.test.mjs   test/p10-2b-generalized-tuplet-admission-v4.test.mjs   test/p10-2-tuplet-unretiming-authoring-v4.test.mjs   test/p10-2-triplet-unretiming-roundtrip.test.mjs   test/p10-2-session-triplet-unretiming.test.mjs   test/p10-2-browser-triplet-unretiming.test.mjs   test/p10-2-professional-workstation-unretiming.test.mjs   test/p10-2-professional-workstation-artifact.test.mjs   test/p10-2-productization-reality.test.mjs
```

Expected: all PASS.

- [ ] **Step 5: Run repository validation**

```bash
npm run validate
npm test
```

Expected: PASS.

- [ ] **Step 6: Require exact-head GitHub CI**

On the final implementation head require:

- CI Node 18: all tests PASS;
- CI Node 20: all tests PASS;
- CI Node 22: all tests PASS.

Record exact run number and exact head SHA.

- [ ] **Step 7: Require retained WebKit gates**

Because this plan has no new browser surface, no new P10-2C WebKit workflow is created here.

Exact final head must still pass the retained browser gates, including at least:

- `P10-2 Triplet Unretiming WebKit`;
- `P10-3A Professional Pitch Transpose WebKit`;
- `P10-3B Professional Range Replace WebKit`;
- `P10-1 professional workstation WebKit`;
- `P10-1 renderer qualification WebKit`;
- `P08-E4 professional artifact WebKit`;
- `APP-09B preview WebKit regression`.

Browser/product P10-2C qualification remains a separate future gate.

- [ ] **Step 8: Require Sonar evidence**

At PR review record:

- Quality Gate;
- new issues;
- security hotspots;
- new-code duplication.

Do not claim PASS without an actual result.

- [ ] **Step 9: Final scope diff review**

The implementation diff must not include:

- browser/workstation P10-2C packages;
- changes to existing P10-2 3:2 mutation code;
- arbitrary profile parameters;
- new renderer-coordinate authority;
- release/public-write/SesliTab authorization;
- Render/deploy changes.

- [ ] **Step 10: Commit Task 4**

```bash
git add   README.md   ARCHITECTURE.md   ROADMAP.md   docs/st-score-editor-app-productization.md   docs/st-score-editor-app-productization.json   docs/p10-2c-exact-4-3-tuplet-mutation.md   test/p10-2c-exact-4-3-tuplet-mutation-reality.test.mjs
git commit -m "docs: record exact 4:3 core session mutation reality"
```

---

## Execution Order

1. Task 1 — exact 4:3 canonical authoring package.
2. Task 2 — unified session/history wrapper.
3. Task 3 — imported MusicXML + retained exact-3:2 isolation.
4. Task 4 — reality docs + exact-head qualification.

Do not proceed past an unexplained RED state.

## Definition of Done

The P10-2C core/session implementation is complete only when:

- public mutation accepts exactly one four-target 4:3 intent;
- public mutation runs P10-2B admission fresh;
- public mutation cannot consume cached admission evidence;
- event timing and adjacent-rest changes copy admission evidence exactly;
- no independent 4:3 timing/rest math exists in mutation code;
- event/note/topology IDs are preserved;
- only owned 4:3 tuplets are removed;
- unrelated notation is preserved;
- result-validation/tamper defenses are tested;
- imported MusicXML exact 4:3 identity survives;
- one accepted session action creates one `EditorHistoryV4` revision;
- rejected action creates none;
- exact Undo and Redo pass;
- renderer request is rebuilt from the committed revision;
- P10-2B remains read-only;
- existing APP-11J/P10-2 exact 3:2 tests and artifact remain green;
- browser/product authority remains false;
- generalized/arbitrary ratio mutation remains unauthorized;
- exact-head Node 18/20/22 + retained WebKit + Sonar evidence is recorded;
- release/SesliTab/Render authority remains unchanged.

## Post-Implementation Handoff

```text
COMPLETED: P10-2C — Exact 4:3 core + session mutation
RESULT: <exact implementation result>
VERIFICATION: <fresh exact-head Node/WebKit/Sonar evidence>
NOTION: <updated record>
LINEAR: <updated task>
RENDER: UNCHANGED
BLOCKERS: <none or exact blocker>
NEXT: <next explicitly authorized item>
NEXT START CONDITION: <condition>
```

No browser/product implementation, merge, deploy or release is implied by completion of this plan.
