# P10-4A Professional Staff Reorder V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose bounded adjacent staff reorder in the optional professional workstation while reusing the existing `REORDER_STAFF` canonical authority and preserving stable semantic identity, unified history, fail-closed interchange, and all previously qualified workstation artifacts.

**Architecture:** Add one typed professional adapter that performs read-only admission and delegates accepted mutation to `commitProfessionalWorkstationTopologyV1`. Add a separate optional P10-4A browser composition over P10-3B with accessible **Move staff up / Move staff down** controls. Do not change `ScoreDocumentV3`, `NotationDocumentV4`, `editor-topology-authoring-v3/v4`, or the default production artifact.

**Tech Stack:** TypeScript, Node.js test runner, EditorSessionV4 / EditorHistoryV4, SemanticAddressV3, existing bounded workstation artifact builder, Playwright WebKit regression scripts.

**Spec:** `docs/superpowers/specs/2026-09-27-p10-4a-score-structure-instrument-management-design.md`

## Global Constraints

- `ScoreDocumentV3 + NotationDocumentV4` remain the canonical score pair.
- `EditorSessionV4 / EditorHistoryV4` remain the sole history authority.
- `SemanticAddressV3` remains exact current-revision semantic identity.
- Renderer DOM/SVG/coordinates/render tokens are not authoring authority.
- MusicXML is exchange/projection data, not canonical editing state.
- One accepted staff reorder creates exactly one unified history revision.
- Rejected and no-op requests create no canonical revision and no history entry.
- Reorder preserves every existing topology/content identity; only staff order/ordinals and revision identity change.
- Cross-part movement is not admitted.
- Drag/drop authoring is not admitted.
- No true instrument assignment, transposition, grouping, percussion-map, measure insert/remove/reorder, polymeter, release/public-write, SesliTab cutover, deploy, or Render work enters this plan.
- Preserve P10-1, P10-2, P10-3A and P10-3B optional artifact contracts.
- P10-4A remains `productionDefault:false`, `productionReleaseAuthorized:false`, `seslitabCutoverAuthorized:false`.

## Review Focus

1. Descendant semantic selections must resolve to their owning current staff without renderer geometry; Task 2 pins this.
2. Linked TAB reorder must preserve `sourceStaffId` and stay fail-closed for unsupported XML; Tasks 1 and 4 pin this.
3. Existing cross-staff placements must survive by stable staff ID, not old ordinal; Task 1 pins this.
4. Repeated adjacent moves must create one history revision per accepted click and never synthesize a drag transaction; Task 2 pins this.
5. Undo/Redo must restore exact canonical pairs while old semantic addresses remain stale; Tasks 1 and 2 pin this.

---

### Task 1: Typed Professional Staff Reorder Adapter

**Files:**
- Create: `packages/score-editor-professional-staff-reorder-v1/src/index.ts`
- Create: `test/p10-4a-professional-staff-reorder-v1.test.mjs`

**Interfaces:**
- Consumes: `ScoreEditorProfessionalWorkstationV1`, `commitProfessionalWorkstationTopologyV1`, `resolveSemanticAddressV3`, `StaffAddressV3`, `TopologyAuthoringV3Options`.
- Produces:
  - `PROFESSIONAL_STAFF_REORDER_V1_VERSION = '1.0.0'`
  - `ProfessionalStaffReorderAdmissionV1`
  - `ProfessionalStaffReorderV1Error`
  - `analyzeProfessionalStaffReorderV1(workstation, target, toIndex)`
  - `commitProfessionalStaffReorderV1(workstation, target, toIndex, options)`

- [ ] **Step 1: Write the failing happy-path identity/order test**

Assert a three-staff fixture admits moving `staff-2` from index 1 to index 0, then after commit:

```js
assert.deepEqual(
  next.document.session.history.present.score.parts[0].staves.map(s => [s.id, s.ordinal]),
  [['staff-2',1],['staff-1',2],['staff-3',3]]
);
assert.equal(next.document.session.history.past.length, beforePast + 1);
assert.equal(next.document.session.selection.kind, 'staff');
assert.equal(next.document.session.selection.staffId, 'staff-2');
assert.equal(next.document.session.selection.revisionId, 'rev:p10-4a:1');
assert.equal(next.professionalSelection, null);
```

Deep-compare all measure/Voice/event/note IDs before and after. Only staff order/ordinals and revision-bound envelopes may change.

- [ ] **Step 2: Run the focused test to verify RED**

```bash
npm run build && node --test test/p10-4a-professional-staff-reorder-v1.test.mjs
```

Expected: FAIL because the package does not exist.

- [ ] **Step 3: Implement the adapter public contract**

Use these exact shapes:

```ts
export const PROFESSIONAL_STAFF_REORDER_V1_VERSION = '1.0.0' as const;

export type ProfessionalStaffReorderV1ErrorCode =
  | 'STALE_TARGET'
  | 'TARGET_NOT_STAFF'
  | 'DESTINATION_OUT_OF_RANGE'
  | 'NO_CHANGE'
  | 'TOPOLOGY_REJECTED';

export interface ProfessionalStaffReorderAdmissionV1 {
  readonly version: typeof PROFESSIONAL_STAFF_REORDER_V1_VERSION;
  readonly partId: string;
  readonly staffId: string;
  readonly currentIndex: number;
  readonly toIndex: number;
}

export const analyzeProfessionalStaffReorderV1 = (
  workstation: ScoreEditorProfessionalWorkstationV1,
  target: StaffAddressV3,
  toIndex: number
): Readonly<ProfessionalStaffReorderAdmissionV1>;

export const commitProfessionalStaffReorderV1 = (
  workstation: ScoreEditorProfessionalWorkstationV1,
  target: StaffAddressV3,
  toIndex: number,
  options: TopologyAuthoringV3Options
): Readonly<ScoreEditorProfessionalWorkstationV1>;
```

Rules: resolve against current score; map revision mismatch to `STALE_TARGET`; reject non-staff runtime input; require integer destination in the same part; reject same-index as `NO_CHANGE`; delegate exactly once with existing `REORDER_STAFF`; preserve lower-level cause when mapping canonical rejection. Do not copy the reorder algorithm.

- [ ] **Step 4: Add RED rejection/history tests**

Cover stale target, non-staff target, negative/out-of-range index, same-index no-op, reused revision ID, no-side-effect rejection, old-address staleness after commit, exact Undo and exact Redo.

- [ ] **Step 5: Add cross-staff and linked-TAB preservation tests**

Prove cross-staff `displayStaffId` and source identity survive reorder; linked TAB `sourceStaffId` survives; linked TAB gains no measures; existing XML-pending behavior stays pending.

- [ ] **Step 6: Run focused + retained topology tests GREEN**

```bash
npm run build && node --test   test/p10-4a-professional-staff-reorder-v1.test.mjs   test/editor-topology-authoring-v3.test.mjs   test/editor-topology-authoring-v3-coverage.test.mjs   test/editor-cross-staff-v4.test.mjs   test/p08d-professional-workstation-controller-v1.test.mjs
```

Expected: all PASS.

- [ ] **Step 7: Commit Task 1**

```bash
git add packages/score-editor-professional-staff-reorder-v1/src/index.ts test/p10-4a-professional-staff-reorder-v1.test.mjs
git commit -m "feat: add professional staff reorder adapter"
```

---

### Task 2: Optional P10-4A Browser Composition

**Files:**
- Create: `packages/score-editor-browser-professional-workstation-p10-4a-v1/src/index.ts`
- Create: `packages/score-editor-browser-professional-workstation-p10-4a-v1/src/global-entry.ts`
- Create: `test/p10-4a-professional-staff-reorder-browser-v1.test.mjs`

**Interfaces:**
- Consumes P10-3B browser controller/profile and Task 1 adapter.
- Produces:
  - `P10_4A_PROFESSIONAL_WORKSTATION_V1_VERSION = '1.0.0'`
  - `P10_4A_STAFF_REORDER_CONTROL_MIN_TOUCH_TARGET_PX = 44`
  - `p10_4aProfessionalWorkstationBrowserAppProfile`
  - `P10_4AProfessionalStaffReorderStateV1`
  - `createP10_4AProfessionalWorkstationStandaloneScoreEditorControllerV1(options)`
  - `createP10_4AProfessionalWorkstationStandaloneBrowserAppRuntimeV1()`
  - global `STScoreEditorP10_4AWorkstation`

- [ ] **Step 1: Write RED profile/state tests**

Require profile flags: P10-4A composition true, P10-3B base preserved, staff reorder available, canonical authority false, history `EditorHistoryV4`, renderer-coordinate/DOM/drag-drop authority false, production/release/cutover false.

Use this exact state shape:

```ts
export interface P10_4AProfessionalStaffReorderStateV1 {
  readonly version: typeof P10_4A_PROFESSIONAL_WORKSTATION_V1_VERSION;
  readonly staffTargetId: string | null;
  readonly currentIndex: number | null;
  readonly staffCount: number;
  readonly canMoveUp: boolean;
  readonly canMoveDown: boolean;
  readonly lastError: Readonly<{ readonly code: string; readonly message: string }> | null;
}
```

- [ ] **Step 2: Run browser test to verify RED**

```bash
npm run build && node --test test/p10-4a-professional-staff-reorder-browser-v1.test.mjs
```

- [ ] **Step 3: Implement semantic current-staff derivation**

Use current canonical session selection only:

- `staff` → itself;
- `measure | voice | event | note | grace-group | grace-event | grace-note` → re-address its `staffId`;
- `document | measure-frame | part | null` → no staff context.

No DOM/renderer/pointer/coordinate inference.

- [ ] **Step 4: Implement adjacent controller actions**

Expose:

```ts
readonly getP10_4AProfessionalStaffReorderState:
  () => Readonly<P10_4AProfessionalStaffReorderStateV1>;
readonly moveProfessionalStaffUp:
  () => Readonly<ScoreEditorBrowserAppSnapshot>;
readonly moveProfessionalStaffDown:
  () => Readonly<ScoreEditorBrowserAppSnapshot>;
```

Up derives `currentIndex - 1`; Down derives `currentIndex + 1`. Default revision IDs are `p10-4a:${crypto.randomUUID()}`. Run Task 1 admission before commit, commit once, adopt the returned validated app document, preserve the session selection on the moved staff, and expose errors without canonical mutation.

- [ ] **Step 5: Add accessible controls**

Render two real buttons only:

- `Move staff up`
- `Move staff down`

Minimum target `44px`; disable at boundaries/no staff context; no draggable attributes; no pointer-coordinate reorder listener; do not replace existing P10-3B controls.

- [ ] **Step 6: Add descendant-selection/repeated-move tests**

Cover all descendant selection kinds, no-staff kinds, one click = one history revision, two valid clicks = two revisions, P10-3B methods retained, boundary disables, rejected calls preserve snapshot, accepted selection rebounds to moved staff.

- [ ] **Step 7: Run retained composition tests GREEN**

```bash
npm run build && node --test   test/p10-4a-professional-staff-reorder-browser-v1.test.mjs   test/p10-3a-professional-pitch-toolbar-v1.test.mjs   test/p10-1-professional-ui-attachment-v1.test.mjs
```

Also discover and run the existing P10-3B browser/workstation tests by repository filename rather than creating duplicates if names have changed.

- [ ] **Step 8: Commit Task 2**

```bash
git add packages/score-editor-browser-professional-workstation-p10-4a-v1/src/index.ts packages/score-editor-browser-professional-workstation-p10-4a-v1/src/global-entry.ts test/p10-4a-professional-staff-reorder-browser-v1.test.mjs
git commit -m "feat: expose professional staff reorder controls"
```

---

### Task 3: Independent Bounded P10-4A Artifact

**Files:**
- Modify: `scripts/lib/professional-workstation-stage-config.mjs`
- Modify: `test/helpers/professional-workstation-artifact-fixture.mjs`
- Create: `scripts/build-p10-4a-professional-workstation-browser.mjs`
- Create: `test/p10-4a-professional-workstation-artifact.test.mjs`

- [ ] **Step 1: Write RED retained-budget/artifact test**

Add retained P10-3B values exactly:

```text
file: st-score-editor-p10-3b-workstation.manifest.json
maxBytes: 675840
revision: P10-3B-RANGE-REPLACE-1
```

Require new artifact:

```text
artifact: st-score-editor-p10-4a-workstation.js
manifest: st-score-editor-p10-4a-workstation.manifest.json
html: st-score-editor-p10-4a-workstation.html
global: STScoreEditorP10_4AWorkstation
contract: ST_SCORE_EDITOR_P10_4A_PROFESSIONAL_WORKSTATION_BUNDLE
artifactClass: optional-p10-4a-professional-staff-reorder-composition
maxBytes: 696320
budgetRevision: P10-4A-STAFF-REORDER-1
```

Require retained P10-1/P10-2/P10-3A/P10-3B budgets unchanged and all replacement/release/cutover flags false.

- [ ] **Step 2: Run artifact test to verify RED**

```bash
npm run build && node --test test/p10-4a-professional-workstation-artifact.test.mjs
```

- [ ] **Step 3: Extend retained-budget helpers**

Add `p10_3bWorkstation` to both retained-budget sources. Do not change existing retained values.

- [ ] **Step 4: Implement build script**

Use existing `buildBoundedWorkstationArtifact` with `ST_SCORE_EDITOR_P10_4A_OUT_DIR`, the exact names above, retained predecessor budgets, `professionalStaffReorderBundled:true`, `professionalStaffReorderDragDropAuthority:false`.

- [ ] **Step 5: Run artifact test GREEN**

Expected bundle `<= 696320` and existing headroom rule satisfied. If it exceeds the budget, stop and report; do not silently raise the budget.

- [ ] **Step 6: Commit Task 3**

```bash
git add scripts/lib/professional-workstation-stage-config.mjs test/helpers/professional-workstation-artifact-fixture.mjs scripts/build-p10-4a-professional-workstation-browser.mjs test/p10-4a-professional-workstation-artifact.test.mjs
git commit -m "build: add bounded P10-4A workstation artifact"
```

---

### Task 4: Renderer/MusicXML Regression and Dedicated WebKit Gate

**Files:**
- Extend: `test/p10-4a-professional-staff-reorder-v1.test.mjs`
- Create: `scripts/p10-4a-webkit-professional-staff-reorder-regression.mjs`
- Create: `.github/workflows/p10-4a-professional-staff-reorder-webkit.yml`

- [ ] **Step 1: Add renderer/MusicXML assertions**

For a standard lossless fixture after reorder, prove new render revision, current manifest address for moved staff, stale old render evidence rejection, exported staff order, and admitted export→import order preservation.

For linked TAB, prove reorder leaves projection fail-closed with no forced XML flattening.

- [ ] **Step 2: Run focused renderer regressions**

```bash
npm run build && node --test test/p10-4a-professional-staff-reorder-v1.test.mjs test/editor-cross-staff-v4.test.mjs test/score-editor-browser-renderer-hit-bridge.test.mjs
```

- [ ] **Step 3: Write WebKit regression**

Load P10-4A artifact, create at least three staffs, select a descendant on the middle staff, verify Up/Down state, click Up, prove canonical order + one history increment + rebound selection, Undo, Redo, click Down, prove another single revision, verify boundary disables, no draggable surface, and release/cutover/coordinate-authority flags false.

DOM may locate buttons only; canonical order assertions must come from controller/session state.

- [ ] **Step 4: Add workflow**

Workflow name exactly: `P10-4A Professional Staff Reorder WebKit`.

Follow existing Playwright/WebKit setup and invoke the new regression script.

- [ ] **Step 5: Run available WebKit regression**

If local WebKit is unavailable, record the environment limitation and require GitHub workflow PASS before qualification.

- [ ] **Step 6: Commit Task 4**

```bash
git add test/p10-4a-professional-staff-reorder-v1.test.mjs scripts/p10-4a-webkit-professional-staff-reorder-regression.mjs .github/workflows/p10-4a-professional-staff-reorder-webkit.yml
git commit -m "test: qualify P10-4A staff reorder"
```

---

### Task 5: Reality Documentation and Full Verification

**Files:**
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`
- Modify: `ROADMAP.md`
- Modify: `docs/st-score-editor-app-productization.md`
- Modify: `docs/st-score-editor-app-productization.json`
- Create: `test/p10-4a-professional-staff-reorder-reality.test.mjs`

- [ ] **Step 1: Write RED reality test**

Require `p10_4a` JSON fields:

```json
{
  "status": "PROFESSIONAL_STAFF_REORDER_IMPLEMENTED_QUALIFICATION_PENDING",
  "operation": "REORDER_STAFF",
  "adapter": "score-editor-professional-staff-reorder-v1",
  "browser_composition": "score-editor-browser-professional-workstation-p10-4a-v1",
  "optional_artifact": "ST_SCORE_EDITOR_P10_4A_PROFESSIONAL_WORKSTATION_BUNDLE",
  "history_authority": "EditorHistoryV4",
  "semantic_target_authority": "SemanticAddressV3-current-revision",
  "adjacent_controls_only": true,
  "drag_drop_authority": false,
  "renderer_coordinate_authority": false,
  "production_default": false,
  "production_release_authorized": false,
  "seslitab_cutover_authorized": false
}
```

Docs must state existing topology reuse, stable-ID reorder, one accepted action = one V4 history revision, and continued deferral of true instrument assignment/transposition.

- [ ] **Step 2: Verify reality test RED**

```bash
npm run build && node --test test/p10-4a-professional-staff-reorder-reality.test.mjs
```

- [ ] **Step 3: Update docs/JSON only to proven implementation reality**

Do not claim qualification PASS before exact-head checks. Do not change release/public-write/SesliTab/Render authority.

- [ ] **Step 4: Run complete Node verification**

```bash
npm run validate
npm test
```

Then require exact-head GitHub CI on Node 18/20/22 with zero failures.

- [ ] **Step 5: Require browser gates**

Exact final head must pass:

- P10-4A Professional Staff Reorder WebKit
- P10-3B Professional Range Replace WebKit
- P10-3A Professional Pitch Transpose WebKit
- P10-2 Triplet Unretiming WebKit
- P10-1 professional workstation WebKit
- P10-1 renderer qualification WebKit
- P08-E4 professional artifact WebKit
- APP-09B preview WebKit regression

WebKit does not imply physical-device qualification.

- [ ] **Step 6: Require Sonar evidence**

Record Quality Gate, new issues, security hotspots, and new-code duplication. Do not claim PASS without a produced result.

- [ ] **Step 7: Diff review**

Reject accidental changes to score/notation schemas, generic topology algorithm semantics, Render/deploy config, release/cutover flags, or deferred P10-4 contracts.

- [ ] **Step 8: Commit Task 5**

```bash
git add README.md ARCHITECTURE.md ROADMAP.md docs/st-score-editor-app-productization.md docs/st-score-editor-app-productization.json test/p10-4a-professional-staff-reorder-reality.test.mjs
git commit -m "docs: record P10-4A staff reorder reality"
```

---

## Execution Order

1. Typed adapter
2. Optional browser composition
3. Independent bounded artifact
4. Renderer/MusicXML + WebKit gate
5. Reality docs + full verification

Do not proceed past an unexplained RED state.

## Definition of Done

P10-4A Staff Reorder V1 is implementation-complete only when the typed adapter delegates to existing `REORDER_STAFF`, no-op/invalid moves leave history unchanged, identities/cross-staff/TAB relations survive, only adjacent accessible controls are exposed, one accepted click equals one `EditorHistoryV4` revision, exact Undo/Redo works, predecessor artifacts remain preserved, admitted renderer/MusicXML regression passes, unsupported XML stays fail-closed, exact-head Node/WebKit/Sonar evidence is recorded, and production/release/SesliTab/Render authority remains unchanged.

## Post-Implementation Handoff

```text
COMPLETED: P10-4A — Professional Staff Reorder V1
RESULT: <exact implementation result>
VERIFICATION: <fresh exact-head Node/WebKit/Sonar evidence>
NOTION: <updated record>
LINEAR: <updated task>
RENDER: UNCHANGED
BLOCKERS: <none or exact blocker>
NEXT: <next approved execution-order item>
NEXT START CONDITION: <condition>
```

No merge or deploy is implied by implementation completion.
