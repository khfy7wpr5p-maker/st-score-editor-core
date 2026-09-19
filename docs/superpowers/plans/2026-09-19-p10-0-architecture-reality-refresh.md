# P10-0 Architecture Reality Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the repository's architecture, roadmap, productization, release-gate, P08, P09 and APP-11J documentation into exact agreement with the post-PR #191 mainline reality while preserving all release/cutover safety gates.

**Architecture:** This tranche is documentation-first and adds one repository-level reality-contract test so stale architectural claims fail CI instead of silently drifting. It does not change production/editor behavior. The authoritative runtime remains ScoreDocumentV3 + NotationDocumentV4 through EditorSessionV4 / EditorHistoryV4; this plan only makes written sources describe that reality accurately.

**Tech Stack:** Node.js 18+ `node:test`, Markdown, JSON, existing `npm run validate` / `npm test` repository validation.

**Spec:** `docs/superpowers/specs/2026-09-19-p10-advanced-score-workstation-design.md`

## Global Constraints

- Baseline main merge commit is exactly `9dfa253a55982a66b01b5eaa2f8df614b1e58e9b`.
- PR #191 / P09-A through P09-D is merged; qualified P09-D head is `636c17dc27b657d273cf2e4f630a2e7c11ffa8f6`.
- ScoreDocumentV3 + NotationDocumentV4 remains the canonical musical pair.
- EditorSessionV4 / EditorHistoryV4 remains the sole history authority.
- SemanticAddressV3 remains revision-bound semantic identity.
- Renderer coordinates, DOM/SVG identity, keyboard state and professional range state remain noncanonical.
- APP-11J read-only unretiming admission is already present on current main; do not implement a duplicate analyzer.
- APP-11J canonical unretiming mutation remains unimplemented / not exposed by this tranche.
- P08/P09 physical iPhone/Safari qualification is PASS for the tested professional/keyboard/renderer lifecycle scope.
- The full standalone APP-09 G1–G10 multi-platform release matrix remains incomplete.
- `manualDeviceValidationRequired = true` and `standaloneReleaseGatePassed = false` must remain true/false respectively.
- Android Chrome, Windows Edge, Windows Chrome and Windows Firefox remain pending physical release targets.
- Production/public-write activation is not authorized.
- SesliTab cutover remains unauthorized.
- No production TypeScript/JavaScript package or browser runtime behavior may change in P10-0.
- PR #192 remains draft/unmerged until a separate integration decision.

## Review Focus

1. **Device-evidence overclaim:** iPhone P08/P09 device PASS must not be rewritten as full APP-09 G1–G10 release PASS; a reasonable reader must see both facts together.
2. **APP-11J lineage ambiguity:** current main contains the APP-11J analyzer even though historical PR #142 is still open; docs must describe code presence and stale stacked PR metadata separately.
3. **Historical admission documents:** P09 inventory/admission sections are useful history; update them with a closeout/current-state section rather than erasing the original admission rationale.
4. **Release/cutover safety:** all updated sources must keep standalone release, public-write and SesliTab cutover unauthorized.
5. **P10 scope creep:** P10-0 must not quietly implement P10-1 composition, APP-11J mutation, new UI, persistence, deployment or release behavior.

---

### Task 1: Lock Core Architecture Reality With a Failing Contract Test

**Files:**
- Create: `test/p10-architecture-reality-refresh.test.mjs`
- Modify: `ARCHITECTURE.md`
- Modify: `ROADMAP.md`

**Interfaces:**
- Consumes: P10 spec; main baseline `9dfa253a55982a66b01b5eaa2f8df614b1e58e9b`; existing APP-11J package on main.
- Produces: CI-visible assertions that P09 is merged, P10-0 is current, APP-11J admission is present on main, and the release gate remains closed.

- [ ] **Step 1: Create the failing architecture reality test**

Create `test/p10-architecture-reality-refresh.test.mjs` with:

~~~js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readRoot = relative =>
  readFile(new URL('../' + relative, import.meta.url), 'utf8');

test('P10-0 core architecture docs describe the current P09 and APP-11J mainline reality', async () => {
  const [architecture, roadmap] = await Promise.all([
    readRoot('ARCHITECTURE.md'),
    readRoot('ROADMAP.md')
  ]);

  for (const source of [architecture, roadmap]) {
    assert.match(source, /P09-A\/B\/C\/D|P09.*merged/i);
    assert.match(source, /9dfa253a55982a66b01b5eaa2f8df614b1e58e9b/);
    assert.match(source, /P10-0.*Architecture Reality Refresh/i);
    assert.match(source, /APP-11J.*(?:present|exists|main)/is);
    assert.match(source, /manualDeviceValidationRequired\s*=\s*true/);
    assert.match(source, /standaloneReleaseGatePassed\s*=\s*false/);
  }

  assert.doesNotMatch(
    architecture,
    /## Next architecture step\s+\*\*APP-11J\s+—\s+Triplet Removal \/ Unretiming Admission Foundation\.\*\*/
  );
  assert.doesNotMatch(
    roadmap,
    /## Next development action\s+\*\*APP-11J\s+—\s+Triplet Removal \/ Unretiming Admission Foundation\.\*\*/
  );
});
~~~

- [ ] **Step 2: Run the new test and verify RED**

Run:

~~~bash
node --test test/p10-architecture-reality-refresh.test.mjs
~~~

Expected: FAIL because current `ARCHITECTURE.md` / `ROADMAP.md` do not yet record P09/P10 reality and still present APP-11J foundation as the next action.

- [ ] **Step 3: Update ARCHITECTURE.md**

Make these exact semantic changes:

- top status includes `P09-A–D COMPLETE / MERGED / QUALIFIED`;
- add a dedicated `P09 — Fast Entry / Keyboard Workstation` section;
- record PR #191 and merge commit `9dfa253a55982a66b01b5eaa2f8df614b1e58e9b`;
- record qualified P09-D head `636c17dc27b657d273cf2e4f630a2e7c11ffa8f6`;
- replace “physical iPhone evidence is partial” with a scoped statement:
  `P08/P09 professional/keyboard/renderer physical iPhone Safari gate PASS; full APP-09 G1–G10 multi-platform release matrix remains open.`
- add `APP-11J mainline reality`:
  - commit `674187b920434d6d7d72330baba44c2692a64596` is already an ancestor of the P10 baseline main;
  - `editor-tuplet-unretiming-admission-v4` is analysis-only;
  - canonical unretiming mutation remains outside authority;
  - historical PR #142 remaining open does not mean the analyzer is absent.
- replace “Next architecture step = APP-11J foundation” with `P10-0 Architecture Reality Refresh` and a forward pointer that P10-2 consumes existing APP-11J evidence rather than duplicating it.
- keep:
  `manualDeviceValidationRequired = true`
  `standaloneReleaseGatePassed = false`

- [ ] **Step 4: Update ROADMAP.md**

Make these exact semantic changes:

- add P09-A/B/C/D under completed/merged workstation capability;
- add PR #191 / merge SHA evidence;
- add current P10 program phase and `P10-0` as the immediate documentation action;
- state APP-11J read-only admission is already on main;
- state next rhythm mutation work is bounded canonical Triplet removal/unretiming consuming APP-11J evidence, not another admission foundation;
- preserve all fail-closed tuplets/topology/import boundaries;
- preserve full physical release matrix as open.

- [ ] **Step 5: Re-run targeted test and verify GREEN**

Run:

~~~bash
node --test test/p10-architecture-reality-refresh.test.mjs
~~~

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

Commit message:

~~~text
docs(P10-0): align architecture and roadmap with mainline reality
~~~

---

### Task 2: Align Productization Sources and README

**Files:**
- Modify: `test/p10-architecture-reality-refresh.test.mjs`
- Modify: `README.md`
- Modify: `docs/st-score-editor-app-productization.md`
- Modify: `docs/st-score-editor-app-productization.json`

**Interfaces:**
- Consumes: Task 1 terminology for P09/P10/APP-11J and release state.
- Produces: a consistent user-facing overview plus machine-readable productization status that distinguishes mainline code presence from stale PR metadata.

- [ ] **Step 1: Extend the reality test before changing docs**

Append:

~~~js
test('P10-0 productization sources distinguish scoped iPhone PASS from the still-open release matrix', async () => {
  const [readme, productizationMd, productizationJsonText] = await Promise.all([
    readRoot('README.md'),
    readRoot('docs/st-score-editor-app-productization.md'),
    readRoot('docs/st-score-editor-app-productization.json')
  ]);
  const productization = JSON.parse(productizationJsonText);

  for (const source of [readme, productizationMd]) {
    assert.match(source, /P09.*(?:complete|merged|qualified)/is);
    assert.match(source, /iPhone Safari.*P08\/P09.*PASS/is);
    assert.match(source, /full.*release matrix.*(?:open|incomplete)/is);
    assert.match(source, /APP-11J.*(?:present|main)/is);
  }

  assert.equal(productization.release_gate.manualDeviceValidationRequired, true);
  assert.equal(productization.release_gate.standaloneReleaseGatePassed, false);
  assert.equal(
    productization.release_gate.target_status['iPhone Safari'],
    'P08_P09_DEVICE_GATE_PASS_FULL_G1_G10_INCOMPLETE'
  );
  assert.equal(productization.release_gate.target_status['Android Chrome'], 'PENDING');
  assert.equal(productization.release_gate.target_status['Windows Edge'], 'PENDING');
  assert.equal(productization.release_gate.target_status['Windows Chrome'], 'PENDING');
  assert.equal(productization.release_gate.target_status['Windows Firefox'], 'PENDING');

  assert.equal(productization.app_11.app_11j.status, 'ANALYSIS_PRESENT_MAIN');
  assert.equal(
    productization.app_11.app_11j.foundation_commit,
    '674187b920434d6d7d72330baba44c2692a64596'
  );
  assert.equal(productization.app_11.app_11j.canonical_mutation_exposed, false);
  assert.equal(productization.seslitab_cutover_authorized, false);
});
~~~

If `seslitab_cutover_authorized` does not yet exist at top level, Task 2 must add it explicitly as `false` rather than omitting the safety state.

- [ ] **Step 2: Run targeted test and verify RED**

Run:

~~~bash
node --test test/p10-architecture-reality-refresh.test.mjs
~~~

Expected: FAIL on stale README/productization wording and missing machine-readable target/status fields.

- [ ] **Step 3: Update README.md**

Replace stale “APP-11J is next bounded action” messaging with:

- P09 merged/qualified summary;
- P10-0 as current architecture-reality action;
- APP-11J analysis foundation already present on main;
- canonical mutation/removal still future bounded work;
- scoped iPhone P08/P09 PASS plus explicit full release-matrix incompleteness.

Do not advertise release readiness.

- [ ] **Step 4: Update docs/st-score-editor-app-productization.md**

Add/update sections for:

- P09-A/B/C/D complete/merged/qualified;
- PR #191 and exact SHAs;
- physical iPhone/Safari P08/P09 device gate PASS scope;
- APP-11J analysis foundation present on main;
- APP-11J canonical mutation not exposed;
- P10-0 as current next action;
- Android/Windows physical release targets pending;
- SesliTab cutover false.

- [ ] **Step 5: Update docs/st-score-editor-app-productization.json**

Bump `schema_version` from `2.3.0` to `2.4.0` because status semantics are being corrected.

Use these exact structural changes:

~~~json
{
  "status": "P09_COMPLETE_MERGED_APP_11J_ANALYSIS_PRESENT_MAIN_P10_0_ACTIVE_FULL_DEVICE_MATRIX_OPEN",
  "completed_programs": {
    "p09_a_d": "COMPLETE_MERGED_QUALIFIED"
  },
  "app_11": {
    "status": "APP_11A_TO_APP_11I_COMPLETE_MERGED_APP_11J_ANALYSIS_PRESENT_MAIN",
    "app_11j": {
      "status": "ANALYSIS_PRESENT_MAIN",
      "foundation_commit": "674187b920434d6d7d72330baba44c2692a64596",
      "historical_pr": 142,
      "historical_pr_state": "OPEN_STACKED_METADATA",
      "canonical_mutation_exposed": false,
      "history_authority": false,
      "renderer_coordinate_authority": false
    }
  },
  "release_gate": {
    "manualDeviceValidationRequired": true,
    "standaloneReleaseGatePassed": false,
    "target_status": {
      "iPhone Safari": "P08_P09_DEVICE_GATE_PASS_FULL_G1_G10_INCOMPLETE",
      "Android Chrome": "PENDING",
      "Windows Edge": "PENDING",
      "Windows Chrome": "PENDING",
      "Windows Firefox": "PENDING",
      "iPad Safari": "SECONDARY_PENDING"
    }
  },
  "next_development_action": {
    "id": "P10-0",
    "title": "Architecture Reality Refresh",
    "mode": "documentation_reality_alignment",
    "production_code_change": false
  },
  "seslitab_cutover_authorized": false
}
~~~

Preserve existing APP-11J validation/evidence fields that remain factually useful; rename only fields whose semantics would otherwise remain misleading.

- [ ] **Step 6: Re-run targeted test and verify GREEN**

Run:

~~~bash
node --test test/p10-architecture-reality-refresh.test.mjs
~~~

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

Commit message:

~~~text
docs(P10-0): synchronize productization status
~~~

---

### Task 3: Close Historical P08/P09/APP-11J Documentation Drift Without Overclaiming Release

**Files:**
- Modify: `test/p10-architecture-reality-refresh.test.mjs`
- Modify: `docs/app-09-standalone-release-gate.md`
- Modify: `docs/p08e-browser-professional-integration.md`
- Modify: `docs/p09-fast-entry-keyboard-inventory.md`
- Modify: `docs/app-11j-triplet-unretiming-admission.md`

**Interfaces:**
- Consumes: machine-readable status and terminology from Task 2.
- Produces: historical stage documents that preserve their original rationale but contain an explicit current-state closeout/qualification section.

- [ ] **Step 1: Extend the reality test**

Append:

~~~js
test('P10-0 stage docs preserve history while exposing the current scoped device and APP-11J state', async () => {
  const [releaseGate, p08e, p09, app11j] = await Promise.all([
    readRoot('docs/app-09-standalone-release-gate.md'),
    readRoot('docs/p08e-browser-professional-integration.md'),
    readRoot('docs/p09-fast-entry-keyboard-inventory.md'),
    readRoot('docs/app-11j-triplet-unretiming-admission.md')
  ]);

  assert.match(
    releaseGate,
    /iPhone Safari.*P08\/P09 DEVICE GATE PASS.*FULL G1–G10 INCOMPLETE/is
  );
  assert.match(releaseGate, /Android Chrome.*PENDING/is);
  assert.match(releaseGate, /Windows Edge.*PENDING/is);
  assert.match(releaseGate, /standaloneReleaseGatePassed\s*=\s*false/);

  assert.match(p08e, /Physical iPhone\/Safari.*PASS/is);
  assert.doesNotMatch(
    p08e,
    /Physical iPhone\/Safari validation remains a separate manual gate before any production exposure decision\./
  );

  assert.match(p09, /P09-D.*MERGED.*QUALIFIED/is);
  assert.match(p09, /PR #191/);
  assert.match(p09, /636c17dc27b657d273cf2e4f630a2e7c11ffa8f6/);

  assert.match(app11j, /ANALYSIS FOUNDATION PRESENT ON MAIN/i);
  assert.match(app11j, /674187b920434d6d7d72330baba44c2692a64596/);
  assert.match(app11j, /canonical.*mutation.*(?:not exposed|false)/is);
});
~~~

- [ ] **Step 2: Run targeted test and verify RED**

Run:

~~~bash
node --test test/p10-architecture-reality-refresh.test.mjs
~~~

Expected: FAIL because stage docs still contain pending/work-branch language.

- [ ] **Step 3: Update docs/app-09-standalone-release-gate.md**

Keep the overall release gate open.

Change the iPhone row to exactly communicate scoped evidence:

~~~text
| Real iPhone Safari | P08/P09 DEVICE GATE PASS / FULL G1–G10 INCOMPLETE | physical P08/P09 renderer-selection-edit-history-orientation-lifecycle evidence exists; remaining applicable G1–G10 release scenarios still require closeout |
~~~

Preserve Android/Windows targets as PENDING.

Add a short evidence note referencing:

- P09 qualified head `636c17dc27b657d273cf2e4f630a2e7c11ffa8f6`;
- PR #191 merge `9dfa253a55982a66b01b5eaa2f8df614b1e58e9b`;
- physical iPhone/Safari P08/P09 scope;
- explicit statement that this does not satisfy all G1–G10 release evidence.

- [ ] **Step 4: Update docs/p08e-browser-professional-integration.md**

Preserve original P08-E4 qualification design.

Replace the outdated final physical-device statement with a closeout paragraph:

~~~text
Physical iPhone/Safari qualification for the P08/P09 professional-renderer interaction scope is now PASS on the P09-qualified baseline. This closes the former P08-E4 device blocker for that scope only. It does not authorize production exposure and it does not close the wider APP-09 G1–G10 multi-platform release matrix.
~~~

- [ ] **Step 5: Update docs/p09-fast-entry-keyboard-inventory.md**

Do not delete the original admission-condition sections.

Append a `P09 closeout / current state` section that records:

- P09-B/C/D conditions were satisfied;
- PR #191 merged;
- exact qualified head `636c17dc27b657d273cf2e4f630a2e7c11ffa8f6`;
- Node 18/20/22 and retained WebKit qualification passed;
- physical iPhone/Safari P08/P09 device gate passed;
- keyboard layer remains noncanonical and touch UI remains independent;
- production/SesliTab cutover remains separate.

- [ ] **Step 6: Update docs/app-11j-triplet-unretiming-admission.md**

Change stage status from work-branch wording to:

~~~text
Status: **ANALYSIS FOUNDATION PRESENT ON MAIN / CANONICAL MUTATION NOT EXPOSED**
~~~

Record:

- foundation commit `674187b920434d6d7d72330baba44c2692a64596`;
- current main contains the package and regression tests;
- historical PR #142 remains open as stacked metadata and is not the source of current code-presence truth;
- mutation/history/renderer authority remain false.

- [ ] **Step 7: Re-run targeted test and verify GREEN**

Run:

~~~bash
node --test test/p10-architecture-reality-refresh.test.mjs
~~~

Expected: PASS.

- [ ] **Step 8: Commit Task 3**

Commit message:

~~~text
docs(P10-0): close stage documentation drift
~~~

---

### Task 4: Full Verification, Diff Audit and Notion/PR Evidence Sync

**Files:**
- Verify all files changed in Tasks 1–3.
- Update: PR #192 description/commentary evidence only after verification.
- Update: existing Notion P10 architecture page and ST Score Editor Core project page after verification.

**Interfaces:**
- Consumes: all P10-0 doc/test changes.
- Produces: evidence-backed P10-0 branch state ready for human integration review; no merge.

- [ ] **Step 1: Run targeted reality contract**

Run:

~~~bash
node --test test/p10-architecture-reality-refresh.test.mjs
~~~

Expected: all P10-0 tests PASS.

- [ ] **Step 2: Run repository validation**

Run:

~~~bash
npm run validate
~~~

Expected: exit 0.

- [ ] **Step 3: Run the full project suite**

Run:

~~~bash
npm test
~~~

Expected: exit 0, zero failing tests.

If the environment exposes the existing Node 18/20/22 CI matrix only through GitHub Actions, push/commit the branch changes, then require all three matrix jobs to complete successfully before calling P10-0 verified.

- [ ] **Step 4: Audit the diff for scope**

The changed-file set must be limited to:

~~~text
ARCHITECTURE.md
ROADMAP.md
README.md
docs/st-score-editor-app-productization.md
docs/st-score-editor-app-productization.json
docs/app-09-standalone-release-gate.md
docs/p08e-browser-professional-integration.md
docs/p09-fast-entry-keyboard-inventory.md
docs/app-11j-triplet-unretiming-admission.md
docs/superpowers/specs/2026-09-19-p10-advanced-score-workstation-design.md
docs/superpowers/plans/2026-09-19-p10-0-architecture-reality-refresh.md
test/p10-architecture-reality-refresh.test.mjs
~~~

If any production `packages/**`, browser runtime script, build script or deployment file changed, stop and treat it as scope violation.

- [ ] **Step 5: Verify safety strings directly**

Run repository searches equivalent to:

~~~bash
grep -R "standaloneReleaseGatePassed = false" ARCHITECTURE.md README.md docs/app-09-standalone-release-gate.md
grep -R "seslitab.*false\|SesliTab.*unauthorized\|SesliTab.*not authorized" ARCHITECTURE.md ROADMAP.md README.md docs/st-score-editor-app-productization.*
grep -R "P08/P09 DEVICE GATE PASS\|P08/P09.*PASS" docs/app-09-standalone-release-gate.md docs/st-score-editor-app-productization.md
~~~

Expected: release/cutover remains closed and scoped iPhone evidence is present.

- [ ] **Step 6: Update PR #192 evidence**

Keep PR #192 draft.

Record:

- exact branch HEAD;
- targeted reality-contract result;
- `npm run validate` result;
- full `npm test` result;
- Node 18/20/22 workflow results;
- changed-file scope;
- explicit “no production code / no deployment / no SesliTab cutover” statement.

Do not merge.

- [ ] **Step 7: Update Notion**

Update the existing P10 architecture page and parent ST Score Editor Core page with:

- P10-0 exact branch HEAD;
- reality-contract status;
- corrected APP-11J mainline status;
- scoped iPhone P08/P09 PASS / full release matrix incomplete distinction;
- PR #192 state;
- next gate: P10-0 review/integration, then a separate P10-1 architectural design cycle.

- [ ] **Step 8: Final branch verification**

Fetch PR #192 and branch HEAD again and verify:

- PR state = open;
- draft = true;
- merged = false;
- no production/cutover action occurred.

Expected: P10-0 is reviewable but unmerged.

## Self-Review Results

- **Spec coverage:** All P10-0 acceptance criteria are mapped to Tasks 1–4.
- **Placeholder scan:** No TBD/TODO/“implement later” steps remain.
- **Interface consistency:** Task 1 establishes terminology; Task 2 consumes it in productization; Task 3 consumes Task 2 status semantics; Task 4 verifies all three.
- **Review Focus coverage:** Each of the five review-focus risks has an explicit automated assertion or diff/safety audit step.
- **Scope split:** P10-1 through P10-10 are intentionally excluded. Each requires its own design/spec and implementation plan.

## Execution Handoff

The user has already requested autonomous execution. Preserve that preference as **Native / superpowers:executing-plans** after this plan is reviewed.

Implementation must not start until the human confirms this written plan captures the intended P10-0 work.
