# P10-2 — Bounded Triplet Removal / Unretiming Implementation Plan

> **Execution mode after approval:** inline/autonomous in the dedicated P10-2 branch. No merge, production/default rollout, public-write activation or SesliTab cutover is implied by plan approval.

**Goal:** Productize the existing APP-11J read-only exact 3:2 Triplet -> supported straight-three admission as one atomic canonical mutation, one unified history revision, a bounded browser/workstation command, and exact Undo/Redo.

**Spec:** `docs/superpowers/specs/2026-09-21-p10-2-triplet-unretiming-design.md`

**Baseline main:** `8e2a42b6e0473027cf9c08eabb5172133600191d`

**Current design branch:** `p10-2-triplet-unretiming-design`

**Tech stack:** TypeScript 6.0.3, Node.js 18/20/22, `node:test`, esbuild 0.28.2, Playwright 1.62.1 WebKit, existing V3/V4 canonical/session/browser packages.

## Global constraints

- APP-11J is the sole musical admission authority for this inverse operation; do not duplicate or broaden it.
- Always re-run APP-11J against current score, notation and current-revision targets immediately before mutation.
- One canonical pair only: `ScoreDocumentV3 + NotationDocumentV4`.
- One history authority only: `EditorSessionV4 / EditorHistoryV4`.
- Renderer coordinates, DOM geometry, keyboard cursor and audio are noncanonical.
- No automatic target repair/reordering, Voice invention, measure growth or arbitrary rest redistribution.
- Dots, beams, ties, selected cross-staff and unsupported ratios/bases remain fail-closed exactly as APP-11J defines.
- No arbitrary tuplets, nested tuplets, generalized beam work or wider P10-2 rhythm scope in this tranche.
- Existing forward APP-11G/H/I behavior must remain unchanged.
- Production/default/public-write/SesliTab cutover is outside authority.
- Sonar must be reported truthfully; if unavailable, retain `SONAR_INTEGRATION_PENDING` rather than fabricating a pass.
- Use TDD for every behavior change: write the failing test, run it and observe the intended failure, implement the smallest fix, then rerun green.
- Commit after each task or coherent RED/GREEN tranche.

## File map

### New production files

- `packages/editor-tuplet-unretiming-authoring-v4/src/index.ts`
  - Parses the inverse intent, performs fresh APP-11J admission, applies exact event/rest plans, removes owned Triplet metadata, validates and returns one immutable canonical result.
- `packages/editor-session-tuplet-unretiming-v4/src/index.ts`
  - Commits one accepted inverse mutation into `EditorSessionV4`.
- `packages/score-editor-app-tuplet-unretiming/src/index.ts`
  - Preserves app metadata/dirty semantics while delegating to the session wrapper.
- `packages/score-editor-browser-app/src/triplet-unretiming-authoring.ts`
  - Decorates the existing Triplet Retiming controller with current-selection admission state and a bounded **Remove Triplet** browser action.
- `scripts/p10-2-webkit-triplet-unretiming-regression.mjs`
  - WebKit end-to-end regression through the real browser artifact.
- `.github/workflows/p10-2-triplet-unretiming-webkit.yml`
  - Exact PR gate for the P10-2 browser regression.

### Modified production/integration files

- `packages/score-editor-browser-app/src/index.ts`
  - Adds the low-level browser controller commit entry point for app-level unretiming.
- `packages/score-editor-browser-app/src/teacher-workflow.ts`
  - Changes its base decorator from Triplet Retiming to Triplet Unretiming so the capability propagates through mobile teacher, audio-host, P08/P09 and P10-1 workstation composition without a second controller.
- `scripts/build-browser.mjs`
  - Updates browser capability/profile metadata only if required by the existing global bundle manifest pattern.
- `package.json`
  - Adds a dedicated P10-2 WebKit convenience script only if the repository convention requires one; do not add dependencies.

### New tests

- `test/p10-2-tuplet-unretiming-authoring-v4.test.mjs`
- `test/p10-2-triplet-unretiming-roundtrip.test.mjs`
- `test/p10-2-session-triplet-unretiming.test.mjs`
- `test/p10-2-browser-triplet-unretiming.test.mjs`
- `test/p10-2-professional-workstation-unretiming.test.mjs`

### Documentation/reality files to update after runtime is green

- `README.md`
- `ARCHITECTURE.md`
- `ROADMAP.md`
- `docs/app-11j-triplet-unretiming-admission.md`
- `docs/st-score-editor-app-productization.md`
- `docs/st-score-editor-app-productization.json`
- `docs/keypad-capability-matrix.json`
- release-gate docs only where their current capability wording becomes stale; do not mark the full release matrix complete.

---

## Task 1 — Atomic canonical inverse authoring package

**Files**
- Create: `test/p10-2-tuplet-unretiming-authoring-v4.test.mjs`
- Create: `packages/editor-tuplet-unretiming-authoring-v4/src/index.ts`

**Consumes**
- `analyzeTripletToStraightThreeUnretimingV4`
- `TupletUnretimingAdmissionV4`
- `ScoreDocumentV3`
- `NotationDocumentV4`
- `SemanticAddressV3 / EventAddressV3`

**Produces**
- `TUPLET_UNRETIMING_AUTHORING_V4_VERSION = '1.0.0'`
- `UnretimingTripletToStraightThreeIntentV4`
- `TupletUnretimingAuthoringV4Options`
- `TupletUnretimingAuthoringV4Result`
- `TupletUnretimingAuthoringV4Error`
- `executeTripletToStraightThreeUnretimingV4(...)`

### Step 1.1 — RED: admitted exact-rest removal

Write a failing test using three exact 3:2 events plus a neutral adjacent rest whose duration equals the required growth.

Expected post-state:

- selected ids unchanged;
- selected onsets/durations exactly equal APP-11J `eventPlans`;
- selected Triplet metadata becomes `null`;
- exact adjacent rest is removed;
- score revision becomes the supplied fresh revision id and parent points to prior revision;
- notation revision matches;
- result selection is the first target rebound to the new revision;
- input score/notation remain immutable.

Run:

`npm run build && node --test test/p10-2-tuplet-unretiming-authoring-v4.test.mjs`

Expected RED: module/export missing.

### Step 1.2 — GREEN: minimal intent/revision/admission/mutation path

Implement exact intent validation:

```ts
{
  version: '1.0.0',
  type: 'UNRETIMING_TRIPLET_TO_STRAIGHT_THREE',
  targets: readonly EventAddressV3[]
}
```

Require exactly three targets and a fresh stable `nextRevisionId`.

Execution must:

1. canonicalize current score/notation;
2. parse intent;
3. call fresh APP-11J analysis;
4. reject non-admitted result as `TIMING_NOT_ADMITTED` with admission reason;
5. locate the exact current Voice;
6. apply the three APP-11J event plans exactly;
7. execute `REMOVE_ADJACENT_REST`;
8. set only the three owned event tuplets to `null`;
9. rebuild score/notation through V3/V4 constructors;
10. return first event selection rebound to the new revision.

Run the focused test and require GREEN.

### Step 1.3 — RED/GREEN: larger-rest shrink

Add a failing test for `SHRINK_ADJACENT_REST_FORWARD`.

Expected:

- same rest id survives;
- rest onset/duration exactly equal APP-11J proposed values;
- neutral notation entry, if present, is rebound and preserved;
- no other event moves.

Implement only the admitted rest-plan branch. Run GREEN.

### Step 1.4 — RED/GREEN: notation preservation and removed-rest cleanup

Add tests proving:

- event articulations/ornaments on selected events survive;
- note accidental/slur semantics survive;
- unrelated notation entries survive;
- neutral event-notation entry for an exactly removed rest is removed rather than left stale;
- no target outside the admitted three/rest plan changes.

Run GREEN.

### Step 1.5 — RED/GREEN: fail-closed behavior

Add table-driven tests for:

- stale target;
- wrong cardinality;
- malformed/non-3:2 Triplet metadata;
- dots;
- beams;
- ties;
- selected cross-staff;
- missing/non-neutral adjacent rest;
- insufficient adjacent rest;
- unsupported restored base;
- invalid next revision id.

Expected:

- typed rejection;
- zero input mutation;
- no partial candidate escapes.

### Step 1.6 — Postcondition guard

Add explicit result checks before return:

- selected three ids and path/topology unchanged;
- selected timing equals admission plans exactly;
- selected Triplet metadata absent;
- rest outcome equals the admitted rest plan exactly;
- removed rest has no surviving event notation/cross-staff reference;
- no unrelated event ids disappeared or appeared;
- final V3/V4 constructors accept the pair.

A mismatch must raise `RESULT_INVALID`.

### Step 1.7 — Task verification and commit

Run:

`npm run build && node --test test/p10-2-tuplet-unretiming-authoring-v4.test.mjs`

Expected: all Task 1 tests PASS.

Commit suggestion:

`feat(P10-2): add atomic triplet unretiming authoring`

---

## Task 2 — Forward/inverse round-trip invariants

**Files**
- Create: `test/p10-2-triplet-unretiming-roundtrip.test.mjs`
- Modify only if a real defect is exposed: Task 1 package

**Consumes**
- Task 1 inverse authoring API
- Existing `executeStraightThreeToTripletAuthoringV4`

**Produces**
- Regression proof that the new inverse is the bounded semantic inverse of the already-qualified forward path.

### Step 2.1 — RED: straight eighths → forward Triplet → inverse straight

Build the straight source fixture, snapshot the original canonical musical state, execute APP-11H forward retiming, then execute P10-2 inverse.

Compare:

- selected event ids;
- note ids;
- selected onsets/durations;
- Triplet-owned event notation;
- part/staff/frame/measure/Voice topology;
- unaffected notation.

Do not require revision ids to equal the original; compare musical/canonical content with revision identity normalized separately.

Expected RED before inverse wiring is complete.

### Step 2.2 — RED/GREEN: both forward rest-balance origins

Cover both forward outcomes:

1. APP-11H extends an existing adjacent neutral rest backward;
2. APP-11H creates deterministic `tuplet-rest:<hex>`.

Then inverse only when APP-11J admits the resulting current state.

Expected inverse behavior is determined solely by current APP-11J evidence, never by forward provenance.

### Step 2.3 — Mixed note/chord/rest identity profile

Prove an APP-11J-admitted mixed selected range preserves event/note/chord identities through forward/inverse where the existing forward contract supports it.

### Step 2.4 — Task verification and commit

Run:

`npm run build && node --test test/p10-2-triplet-unretiming-roundtrip.test.mjs test/p10-2-tuplet-unretiming-authoring-v4.test.mjs`

Expected: all focused tests PASS.

Commit suggestion:

`test(P10-2): prove bounded triplet round trip`

---

## Task 3 — Unified session and app-document history

**Files**
- Create: `packages/editor-session-tuplet-unretiming-v4/src/index.ts`
- Create: `packages/score-editor-app-tuplet-unretiming/src/index.ts`
- Create: `test/p10-2-session-triplet-unretiming.test.mjs`

**Consumes**
- Task 1 inverse authoring result
- `commitEditorHistoryV4`
- `createRendererRequestV4WithProfile`
- existing app dirty-state conventions

**Produces**
- `commitSessionTripletToStraightThreeV4(...)`
- `commitScoreEditorAppTripletToStraightThreeV4(...)`

### Step 3.1 — RED: one accepted action = one history revision

Fixture starts in an admitted Triplet state.

Assert before: `past.length === 0`.

After one session commit:

- `past.length === 1`;
- `future.length === 0`;
- status code is `TRIPLET_UNRETIMING_COMMITTED`;
- selection is the first event at the new revision;
- renderer request revision matches the new canonical pair.

Expected RED: wrapper missing.

### Step 3.2 — GREEN: session wrapper

Implement by executing Task 1 mutation once, then calling `commitEditorHistoryV4` exactly once.

No direct history array editing.

### Step 3.3 — RED/GREEN: exact Undo and Redo

Capture exact pre-unretiming Triplet score+notation and exact post-unretiming straight score+notation.

Prove:

- one Undo restores the exact Triplet pair;
- one Redo restores the exact straight pair;
- history navigation does not rerun admission;
- Undo/Redo selection semantics follow existing `navigateSessionHistoryV4` behavior rather than inventing a new rule.

### Step 3.4 — RED/GREEN: rejected action creates zero history

Use a blocked APP-11J fixture and prove history remains byte-for-byte/deep-equal unchanged.

### Step 3.5 — RED/GREEN: app wrapper

Prove title, origin and savedRevisionId are preserved and `dirty` follows the existing app policy.

### Step 3.6 — Task verification and commit

Run:

`npm run build && node --test test/p10-2-session-triplet-unretiming.test.mjs`

Expected: all PASS.

Commit suggestion:

`feat(P10-2): commit triplet unretiming through unified history`

---

## Task 4 — Base browser commit entry point

**Files**
- Modify: `packages/score-editor-browser-app/src/index.ts`
- Extend: `test/p10-2-session-triplet-unretiming.test.mjs` or create a narrowly focused browser-controller test if isolation is clearer

**Consumes**
- Task 3 app wrapper

**Produces**
- `StandaloneScoreEditorController.commitTupletUnretiming(intent, options?)`

### Step 4.1 — RED

Create a controller-level test proving a supplied admitted inverse intent:

- commits through the app wrapper;
- generates a fresh revision when options are omitted;
- exposes typed app error state on rejection;
- never directly mutates session/history.

### Step 4.2 — GREEN

In `score-editor-browser-app/src/index.ts`:

- import `TupletUnretimingAuthoringV4Options`;
- import `commitScoreEditorAppTripletToStraightThreeV4`;
- add `commitTupletUnretiming` to the controller interface;
- implement it through the existing `mutate(() => ...)` path;
- use the existing browser revision-id generator when options are omitted.

Do not add UI here.

### Step 4.3 — Task verification and commit

Run the focused browser/session tests.

Commit suggestion:

`feat(P10-2): expose browser triplet unretiming commit`

---

## Task 5 — Triplet Unretiming browser decorator and workstation propagation

**Files**
- Create: `packages/score-editor-browser-app/src/triplet-unretiming-authoring.ts`
- Modify: `packages/score-editor-browser-app/src/teacher-workflow.ts`
- Create: `test/p10-2-browser-triplet-unretiming.test.mjs`
- Create: `test/p10-2-professional-workstation-unretiming.test.mjs`

**Consumes**
- Existing Triplet Retiming controller/decorator
- APP-11J analyzer
- Task 4 low-level commit entry point

**Produces**
- `tripletUnretimingBrowserAppProfile`
- `TripletUnretimingBrowserState`
- `createTripletUnretimingStandaloneScoreEditorController`
- `createTripletUnretimingStandaloneBrowserAppRuntime`
- downstream teacher/mobile/audio/P08/P09/P10-1 controllers inherit the capability through one controller chain.

### Step 5.1 — RED: state is admission-driven

Use an exact Triplet fixture and explicit captured 3-event selection.

Assert:

- `canRemoveTriplet === true` only when fresh APP-11J admits;
- blocked reasons surface as status data;
- incomplete capture disables the action;
- stale revision capture fails closed.

### Step 5.2 — GREEN: decorator state

Build the decorator over `createTripletRetimingStandaloneScoreEditorController`.

Reuse its exact three-event captured ids; rebind them against the current revision before APP-11J analysis.

Do not infer or sort targets.

### Step 5.3 — RED/GREEN: **Remove Triplet** UI

Decorate the existing Triplet authoring group with exactly one new button:

- text: `Remove Triplet`;
- `data-st-triplet-unretiming="1.0.0"`;
- disabled unless fresh admission passes;
- title/accessible label explains **Restore straight timing**;
- click calls `commitTupletUnretiming`;
- after success, clear the capture using the existing semantic selection presentation path.

Use the same lifecycle pattern as the forward retiming button so APP-11F group rerenders cannot permanently remove or duplicate the control.

### Step 5.4 — RED/GREEN: teacher-workflow chain propagation

Modify `teacher-workflow.ts` to extend/import Triplet Unretiming instead of Triplet Retiming.

Do not change teacher workflow semantics.

Prove existing teacher API remains available and unretiming API is added.

### Step 5.5 — RED/GREEN: professional workstation exposure

Instantiate `createProfessionalWorkstationStandaloneScoreEditorControllerV1` and prove:

- `getTripletUnretimingState` exists;
- `removeTripletFromCapturedEvents` exists;
- P08 professional APIs remain;
- P09 keyboard APIs remain;
- audio host APIs remain;
- profile says unretiming is bundled and still `canonicalAuthority: false`;
- one controller/session/history object is used.

No source edit to the P10-1 workstation package should be made unless this test demonstrates a real type/profile propagation gap.

### Step 5.6 — Remount/duplicate-listener regression

Mount → unmount → mount.

Prove:

- exactly one Remove Triplet control exists;
- one click produces one history revision;
- no duplicate listener produces double Undo depth.

### Step 5.7 — Task verification and commit

Run:

`npm run build && node --test test/p10-2-browser-triplet-unretiming.test.mjs test/p10-2-professional-workstation-unretiming.test.mjs`

Expected: all PASS.

Commit suggestion:

`feat(P10-2): add bounded Remove Triplet browser action`

---

## Task 6 — Real browser/WebKit regression

**Files**
- Create: `scripts/p10-2-webkit-triplet-unretiming-regression.mjs`
- Create: `.github/workflows/p10-2-triplet-unretiming-webkit.yml`
- Modify: `package.json` only if adding a repository-conventional convenience script is useful

**Consumes**
- Task 5 browser/workstation surface
- Existing P10-1 professional workstation artifact build

**Produces**
- automated mobile-WebKit evidence for the real composed workstation.

### Step 6.1 — RED: browser script against the current artifact

Build `st-score-editor-professional-workstation.html`.

In WebKit at a mobile viewport:

1. boot the real P10-1 global controller;
2. create/adopt a deterministic fixture that is already an exact admitted Triplet plus adjacent neutral rest, or create it through the existing forward retiming path if that is simpler without bypassing public controller contracts;
3. capture exactly three Triplet events;
4. verify Remove Triplet becomes enabled;
5. click Remove Triplet;
6. verify canonical straight onsets/durations and no selected Triplet metadata;
7. verify history increased by exactly one;
8. Undo and compare exact Triplet score+notation snapshot;
9. Redo and compare exact straight snapshot;
10. verify renderer/request revision follows canonical state;
11. unmount/remount and prove one control/one action;
12. assert zero console/page errors.

Before Task 5, this script must fail because the command is absent.

### Step 6.2 — GREEN: workflow

Create `p10-2-triplet-unretiming-webkit.yml`:

- trigger on PR to main + workflow_dispatch;
- Node 22;
- pinned Playwright 1.62.1;
- WebKit install;
- `npm run build:browser:professional-workstation`;
- execute the P10-2 script.

Do not change existing P10-1/APP-09B workflows.

### Step 6.3 — Local focused verification and commit

Run, where WebKit is available:

`node scripts/p10-2-webkit-triplet-unretiming-regression.mjs`

If local WebKit is unavailable, record that constraint and require the GitHub Actions run before any PASS claim.

Commit suggestion:

`ci(P10-2): gate triplet unretiming in WebKit`

---

## Task 7 — Capability and architecture reality updates

**Files**
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`
- Modify: `ROADMAP.md`
- Modify: `docs/app-11j-triplet-unretiming-admission.md`
- Modify: `docs/st-score-editor-app-productization.md`
- Modify: `docs/st-score-editor-app-productization.json`
- Modify: `docs/keypad-capability-matrix.json`
- Add/modify a documentation reality test if existing P10 reality tests require machine enforcement.

**Consumes**
- Verified runtime behavior from Tasks 1–6

**Produces**
- repository docs that distinguish:
  - APP-11J analysis foundation;
  - P10-2 bounded canonical inverse mutation/productization;
  - still-open general tuplet/rhythm/release gates.

### Step 7.1 — RED documentation-reality test

Add assertions that the machine-readable productization state reports:

- bounded exact 3:2 Triplet unretiming mutation exposed;
- history authority remains EditorSessionV4;
- exact Undo/Redo qualified in automation;
- arbitrary tuplets remain unsupported;
- renderer coordinate authority false;
- release/cutover flags false.

### Step 7.2 — GREEN docs

Update docs only to verified reality.

Do **not** say:

- “P10-2 all rhythm complete”;
- “general tuplets supported”;
- “production ready”;
- “release gate passed”;
- “SesliTab cutover authorized”;
- “Sonar PASS” without evidence.

For `keypad-capability-matrix.json`, keep `tuplet.triplet` as the metadata/forward keypad contract if removal is a separate bounded browser action; describe the new inverse surface separately rather than pretending the old keypad action now owns generalized removal.

### Step 7.3 — Verification and commit

Run documentation-reality tests plus affected focused suites.

Commit suggestion:

`docs(P10-2): record bounded triplet unretiming reality`

---

## Task 8 — Full exact-head qualification and final review

**Files**
- No new product behavior unless a verified finding requires one.
- PR description/status and Notion are updated after evidence exists.

**Consumes**
- all previous tasks

**Produces**
- one reviewable exact head with complete evidence ledger.

### Step 8.1 — Full local repository verification

Run:

`npm test`

Required: build succeeds and full Node test suite has zero failures.

Record exact test count from output; never reuse a historical count.

### Step 8.2 — Create/update draft PR

Open a draft PR from the P10-2 implementation branch to `main` only after local full verification.

PR body must state:

- exact base/head SHAs;
- bounded supported musical profile;
- fail-closed boundaries;
- no release/cutover authority;
- Sonar state;
- physical device gate status.

Do not merge.

### Step 8.3 — Exact-head GitHub Actions gates

Require fresh success on the exact PR head for:

- CI Node 18/20/22;
- P10-2 Triplet Unretiming WebKit;
- APP-09B preview WebKit;
- P08-E4 professional artifact WebKit;
- P10-1 professional workstation WebKit;
- P10-1 renderer qualification WebKit.

If an existing workflow is not triggered by the P10-2 branch due a branch filter, fix only the workflow trigger if that is the root cause; do not treat “not run” as PASS.

### Step 8.4 — Final whole-branch review

Use a fresh reviewer if a subagent/reviewer tool is available. If unavailable, perform and explicitly record a self-review as weaker evidence.

Review focus:

- stale/cross-revision target handling;
- exact rest removal/shrink semantics;
- stale notation refs after rest deletion;
- selected event/note identity preservation;
- no unrelated topology mutation;
- one-action/one-history invariant;
- Undo/Redo exactness;
- decorator remount/listener duplication;
- downstream teacher/mobile/audio/P08/P09/P10-1 capability preservation;
- no hidden renderer/DOM authority;
- docs do not overstate release/general tuplet support.

Any Critical/Important finding gets one TDD fix pass before qualification is considered complete.

### Step 8.5 — Sonar truth check

Attempt the already-authorized Sonar route only if integration/CLI is now actually available.

Outcomes:

- real analysis succeeds → record exact evidence;
- integration remains unavailable → record `SONAR_INTEGRATION_PENDING`.

Do not block truthful reporting behind fabricated output.

### Step 8.6 — Optional physical qualification preview

After exact-head automated gates are green, a qualification-only preview may be deployed only under the existing non-production rules and only if human physical iPhone/Safari evidence is requested/approved for this P10-2 feature.

Physical proof target:

- create/adopt admitted Triplet;
- explicit 3-event capture;
- Remove Triplet;
- visible straight timing/render refresh;
- one Undo restores Triplet;
- one Redo restores straight;
- orientation/lifecycle return if this feature changes lifecycle-sensitive UI;
- no duplicate action after return.

This does not authorize production/default/SesliTab cutover.

### Step 8.7 — Completion report

Report:

- exact qualified head;
- test count;
- workflow run numbers;
- review findings/rulings;
- Sonar state;
- physical gate state;
- remaining scope: arbitrary tuplets, beam authoring and later P10-2 relations.

Merge remains a separate explicit human decision.

---

## Shared-interface pre-flight for execution

Before Task 1 implementation, the executor must record these interface checks in the plan ledger:

1. **Task 1 → Task 3:** Task 1 result exposes immutable score, notation, selection and admission; Task 3 consumes exactly those without reconstructing musical timing.
2. **Task 3 → Task 4:** app wrapper accepts the same intent/options as session mutation; browser base only supplies revision id and app mutation orchestration.
3. **Task 4 → Task 5:** browser decorator calls only `commitTupletUnretiming`; it does not import session/history mutation authority.
4. **Task 5 → downstream composition:** `teacher-workflow.ts` becomes the insertion point so mobile teacher → audio host → professional workstation inherits the capability; no second controller/session is introduced.
5. **Task 5 → Task 6:** stable DOM selector `data-st-triplet-unretiming` and controller methods are the WebKit contract.
6. **Task 6 → Task 7:** docs may claim only behavior proven by the runtime/tests, not workflow intent.
7. **All tasks → Task 8:** exact-head qualification is authoritative; historical run numbers are context only.

## Expected branch outcome

At the end of this plan, the branch should contain a bounded P10-2 feature that can remove one exact APP-11J-admitted 3:2 Triplet through the actual composed workstation, with deterministic adjacent-rest handling and exact unified-history Undo/Redo, while leaving generalized tuplets, beams, wider rhythm semantics and all release/cutover decisions explicitly open.
