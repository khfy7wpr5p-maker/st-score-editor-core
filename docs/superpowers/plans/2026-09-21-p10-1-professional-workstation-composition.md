# P10-1 Professional Workstation Composition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Build a separate combined professional workstation qualification surface that composes P08 professional tools, P09 keyboard input, APP-10/11 authoring, APP-09B renderer interaction, file/recovery/export/print and optional external audio over exactly one ScoreEditorAppDocument / EditorSessionV4 lineage.

**Architecture:** Keep the current default, P08 and P09 artifacts intact. Extract thin attach seams from P09 keyboard and P08 professional UI layers, then compose them over one audio-host-integrated base controller. The combined P10-1 layer owns only coordination/presentation state; ScoreDocumentV3 + NotationDocumentV4, EditorSessionV4 / EditorHistoryV4 and SemanticAddressV3 remain authoritative.

**Tech Stack:** TypeScript, Node.js 18/20/22, node:test, esbuild 0.28.2, Playwright 1.62.1 WebKit, existing browser/runtime packages, SonarQube/SonarCloud quality gate when integration is available.

**Spec:** \`docs/superpowers/specs/2026-09-20-p10-1-professional-workstation-composition-design.md\`

## Global Constraints

- Design baseline: \`main@525c0caedf0ed44f6ff06dc92ad8f304acc3d3bf\`.
- Combined global: \`STScoreEditorProfessionalWorkstation\`.
- Combined bundle: \`st-score-editor-professional-workstation.js\`.
- Combined HTML: \`st-score-editor-professional-workstation.html\`.
- Combined manifest: \`st-score-editor-professional-workstation.manifest.json\`.
- ScoreDocumentV3 + NotationDocumentV4 remains the only canonical musical pair.
- EditorSessionV4 / EditorHistoryV4 remains the only history authority.
- SemanticAddressV3 current-revision identity remains the semantic targeting authority.
- P08 professional range selection remains noncanonical and revision-bound.
- P09 keyboard remains intent translation only; no canonical cursor.
- Renderer coordinates / DOM / SVG never become mutation authority.
- Audio engine remains external: \`audioEngineBundled=false\`, \`externalAudioRuntimeRequired=true\`.
- GRAND_PIANO and VIOLIN remain qualified audition instruments; CLASSICAL_GUITAR remains suspended.
- Default \`STScoreEditorApp\`, P08 \`STScoreEditorProfessionalApp\`, and P09 \`STScoreEditorKeyboardWorkstation\` stay buildable and behavior-compatible.
- Existing default/P08/P09 byte ceilings must not be raised.
- P10-1 gets its own measured bundle budget revision after the first deterministic build.
- Production default/cutover is false.
- Production release is unauthorized.
- SesliTab cutover is unauthorized.
- P10-1 combined physical iPhone/Safari qualification is a separate human gate; prior P08/P09 device evidence does not auto-pass it.
- No APP-11J mutation, general tuplets, staff/part management, Guitar/TAB expansion, engraving, MIDI, .mxl or cloud work is included.

## SonarQube Preflight Constraint

This session currently has neither SonarQube MCP tools nor the \`sonar\` CLI available. Do not fabricate Sonar results.

Before the final SonarQube task:
1. run \`which sonar\`;
2. if absent, stop that task and obtain explicit user approval before installing \`sonarqube-cli\` via the sonar-integrate workflow;
3. after integration, discover the exact project key with \`sonar list projects --query st-score-editor-core\`;
4. if no project exists, report that fact and do not claim a quality-gate PASS;
5. if a project exists, require its configured quality gate to PASS and inspect new issues/coverage/duplication for the P10-1 branch or PR context.

## Review Focus

1. **Duplicate lifecycle listeners:** mount → unmount → remount must leave exactly one keyboard listener set and one professional UI subscription path.
2. **Mixed-history ordering:** P09 edit then P08 edit must yield exactly two unified history revisions, with Undo/Redo restoring canonical score+notation in order.
3. **Stale professional selection after keyboard mutation:** a revision-changing keyboard edit must clear stale P08 professional range selection under existing P08 rules.
4. **Audio failure isolation:** attached/detached/throwing audio runtime must create zero history revisions and must not prevent a later canonical edit.
5. **Focus/touch non-interference:** keyboard adapter must ignore editable controls and the combined UI must preserve 44px professional touch targets / mobile controls.

---

### Task 1: Extract a Reusable P09 Keyboard Attachment Seam

**Files:**
- Modify: \`packages/score-editor-browser-app/src/keyboard-workstation.ts\`
- Test: \`test/p10-1-keyboard-attachment-v1.test.mjs\`
- Retain regression: \`test/p09d-keyboard-workstation-v1.test.mjs\`

**Interfaces:**
- Consumes: \`AudioHostIntegratedStandaloneScoreEditorController\`, \`EditorKeyboardBindingV1\`.
- Produces:
  - \`attachKeyboardWorkstationToBrowserControllerV1(base, bindings?)\`
  - existing \`createKeyboardWorkstationStandaloneScoreEditorController(options)\` remains public and delegates to the attach seam.

- [ ] **Step 1: Write the failing attachment test**

Create \`test/p10-1-keyboard-attachment-v1.test.mjs\`:

~~~js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAudioHostIntegratedStandaloneScoreEditorController
} from '../dist/packages/score-editor-browser-app/src/audio-host-integrated.js';
import {
  attachKeyboardWorkstationToBrowserControllerV1
} from '../dist/packages/score-editor-browser-app/src/keyboard-workstation.js';

test('P10-1 keyboard attachment decorates an existing audio-host controller without creating another document lineage', () => {
  const base = createAudioHostIntegratedStandaloneScoreEditorController();
  const combined = attachKeyboardWorkstationToBrowserControllerV1(base);

  combined.newDocument({ preset: 'GUITAR_TREBLE' });
  const first = combined.getDocument();
  assert.ok(first);
  assert.equal(base.getDocument(), first);

  const event = first.session.history.present.score.parts[0].staves
    .find(staff => staff.role === 'standard').measures[0].voices[0].events[0];

  combined.select(first.session.renderRequest.manifest.entries
    .find(entry => entry.address.kind === 'event' && entry.address.eventId === event.id).address);

  combined.dispatchKeyboardIntent({
    version: '1.0.0',
    type: 'KEYPAD_ACTION',
    actionId: 'duration.eighth'
  });

  assert.equal(base.getDocument(), combined.getDocument());
  assert.equal(
    base.getDocument().session.history.present.score.revision.id,
    combined.getDocument().session.history.present.score.revision.id
  );
});
~~~

- [ ] **Step 2: Run RED**

Run:

~~~bash
npm run build
node --test test/p10-1-keyboard-attachment-v1.test.mjs
~~~

Expected: FAIL because \`attachKeyboardWorkstationToBrowserControllerV1\` does not exist.

- [ ] **Step 3: Extract the attach seam**

Refactor \`keyboard-workstation.ts\` so the current sink/adapter creation is reusable:

~~~ts
export const attachKeyboardWorkstationToBrowserControllerV1 = (
  base: AudioHostIntegratedStandaloneScoreEditorController,
  bindings: readonly Readonly<EditorKeyboardBindingV1>[] = DEFAULT_EDITOR_KEYBOARD_BINDINGS_V1
): Readonly<KeyboardWorkstationStandaloneScoreEditorController> => {
  const sink = createKeyboardIntentSinkForController(base);
  const keyboard = createEditorKeyboardBrowserAdapterV1(sink, bindings);

  return Object.freeze({
    ...base,
    profile: keyboardWorkstationBrowserAppProfile,
    getKeyboardWorkstationState: () => Object.freeze({
      version: KEYBOARD_WORKSTATION_VERSION,
      mounted: keyboard.getMounted(),
      intentVersion: EDITOR_KEYBOARD_INTENT_VERSION,
      bindingCount: bindings.length
    }),
    dispatchKeyboardIntent: intent => dispatchEditorKeyboardIntent(intent, sink),
    mount: root => {
      base.mount(root);
      keyboard.mount(root);
    },
    unmount: () => {
      keyboard.unmount();
      base.unmount();
    }
  });
};
~~~

Extract the current sink body into a private \`createKeyboardIntentSinkForController(base)\` helper; do not alter routing semantics.

Change the convenience constructor to:

~~~ts
export const createKeyboardWorkstationStandaloneScoreEditorController = (
  options: KeyboardWorkstationControllerOptions = {}
) => attachKeyboardWorkstationToBrowserControllerV1(
  createAudioHostIntegratedStandaloneScoreEditorController(options),
  options.keyboardBindings
);
~~~

- [ ] **Step 4: Run GREEN + retained P09**

Run:

~~~bash
npm run build
node --test test/p10-1-keyboard-attachment-v1.test.mjs test/p09d-keyboard-workstation-v1.test.mjs
~~~

Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add packages/score-editor-browser-app/src/keyboard-workstation.ts test/p10-1-keyboard-attachment-v1.test.mjs
git commit -m "refactor(P10-1): expose reusable keyboard attachment"
~~~

---

### Task 2: Extract P08 Range and Structure Attach Seams

**Files:**
- Modify: \`packages/score-editor-browser-professional-ui-v1/src/index.ts\`
- Modify: \`packages/score-editor-browser-professional-structure-ui-v1/src/index.ts\`
- Test: \`test/p10-1-professional-ui-attachment-v1.test.mjs\`
- Retain P08 tests for range/structure/browser integration.

**Interfaces:**
- Consumes: an existing controller that structurally includes the Mobile Teacher / Standalone document API.
- Produces:
  - \`attachProfessionalRangeToolbarToBrowserControllerV1(base, options?)\`
  - \`attachProfessionalStructureInspectorToRangeControllerV1(base, options?)\`
  - existing \`createProfessionalRangeToolbarStandaloneScoreEditorControllerV1\` and \`createProfessionalStructureInspectorStandaloneScoreEditorControllerV1\` remain compatibility constructors.

- [ ] **Step 1: Write RED attachment tests**

Create:

~~~js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAudioHostIntegratedStandaloneScoreEditorController
} from '../dist/packages/score-editor-browser-app/src/audio-host-integrated.js';
import {
  attachProfessionalRangeToolbarToBrowserControllerV1
} from '../dist/packages/score-editor-browser-professional-ui-v1/src/index.js';
import {
  attachProfessionalStructureInspectorToRangeControllerV1
} from '../dist/packages/score-editor-browser-professional-structure-ui-v1/src/index.js';

test('P10-1 P08 UI decorators reuse an injected browser controller lineage', () => {
  const base = createAudioHostIntegratedStandaloneScoreEditorController();
  const range = attachProfessionalRangeToolbarToBrowserControllerV1(base);
  const structure = attachProfessionalStructureInspectorToRangeControllerV1(range);

  structure.newDocument({ preset: 'GUITAR_TREBLE' });

  assert.equal(base.getDocument(), range.getDocument());
  assert.equal(base.getDocument(), structure.getDocument());
  assert.equal(range.professional.base.getDocument(), base.getDocument());
});
~~~

- [ ] **Step 2: Run RED**

~~~bash
npm run build
node --test test/p10-1-professional-ui-attachment-v1.test.mjs
~~~

Expected: FAIL because both attach exports are absent.

- [ ] **Step 3: Refactor professional range toolbar**

Move all existing range-toolbar state/decorate logic into:

~~~ts
export const attachProfessionalRangeToolbarToBrowserControllerV1 = (
  base: MobileTeacherViewportStandaloneScoreEditorController,
  options: ProfessionalRangeToolbarOptions = {}
): Readonly<ProfessionalRangeToolbarStandaloneScoreEditorControllerV1> => {
  const professional = attachProfessionalWorkstationToBrowserControllerV1(
    base as unknown as StandaloneScoreEditorController
  );
  // existing state/range/decorate/subscription implementation remains here
};
~~~

Then make the existing constructor delegate:

~~~ts
export const createProfessionalRangeToolbarStandaloneScoreEditorControllerV1 = (
  options: ProfessionalRangeToolbarOptions = {}
) => attachProfessionalRangeToolbarToBrowserControllerV1(
  createMobileTeacherViewportStandaloneScoreEditorController(options),
  options
);
~~~

Do not change P08 mutation/adoption logic.

- [ ] **Step 4: Refactor structure inspector**

Move existing inspector logic into:

~~~ts
export const attachProfessionalStructureInspectorToRangeControllerV1 = (
  base: ProfessionalRangeToolbarStandaloneScoreEditorControllerV1,
  options: ProfessionalStructureInspectorOptionsV1 = {}
): Readonly<ProfessionalStructureInspectorStandaloneScoreEditorControllerV1> => {
  // existing state/target/decorate logic
};
~~~

The compatibility constructor becomes:

~~~ts
export const createProfessionalStructureInspectorStandaloneScoreEditorControllerV1 = (
  options: ProfessionalStructureInspectorOptionsV1 = {}
) => attachProfessionalStructureInspectorToRangeControllerV1(
  createProfessionalRangeToolbarStandaloneScoreEditorControllerV1(options),
  options
);
~~~

- [ ] **Step 5: GREEN + retained P08**

Run:

~~~bash
npm run build
node --test test/p10-1-professional-ui-attachment-v1.test.mjs
node --test test/p08*.test.mjs
~~~

Expected: PASS.

- [ ] **Step 6: Commit**

~~~bash
git add packages/score-editor-browser-professional-ui-v1/src/index.ts packages/score-editor-browser-professional-structure-ui-v1/src/index.ts test/p10-1-professional-ui-attachment-v1.test.mjs
git commit -m "refactor(P10-1): expose professional UI attachment seams"
~~~

---

### Task 3: Add the P10-1 Combined Professional Workstation Controller

**Files:**
- Create: \`packages/score-editor-browser-professional-workstation-v1/src/index.ts\`
- Create: \`packages/score-editor-browser-professional-workstation-v1/src/global-entry.ts\`
- Test: \`test/p10-1-professional-workstation-v1.test.mjs\`

**Interfaces:**
- Produces:
  - \`PROFESSIONAL_WORKSTATION_V1_VERSION = '1.0.0'\`
  - \`professionalWorkstationBrowserAppProfile\`
  - \`createProfessionalWorkstationStandaloneScoreEditorControllerV1(options?)\`
  - \`createProfessionalWorkstationStandaloneBrowserAppRuntimeV1()\`
  - global \`STScoreEditorProfessionalWorkstation\`.

- [ ] **Step 1: Write RED controller test**

~~~js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProfessionalWorkstationStandaloneScoreEditorControllerV1
} from '../dist/packages/score-editor-browser-professional-workstation-v1/src/index.js';

test('P10-1 combined controller exposes P08, P09 and audio-host capabilities over one document', () => {
  const controller = createProfessionalWorkstationStandaloneScoreEditorControllerV1();

  controller.newDocument({ preset: 'GUITAR_TREBLE' });

  assert.ok(controller.getDocument());
  assert.equal(controller.profile.professionalWorkstationComposition, true);
  assert.equal(controller.profile.keyboardWorkstationBundled, true);
  assert.equal(controller.profile.professionalRangeToolbarAvailable, true);
  assert.equal(controller.profile.professionalStructureInspectorAvailable, true);
  assert.equal(controller.profile.noteAuditionAdapterAvailable, true);
  assert.equal(controller.profile.audioEngineBundled, false);
  assert.equal(controller.profile.canonicalAuthority, false);
});
~~~

- [ ] **Step 2: Run RED**

~~~bash
npm run build
node --test test/p10-1-professional-workstation-v1.test.mjs
~~~

Expected: FAIL because the package does not exist.

- [ ] **Step 3: Implement one composition chain**

Create \`index.ts\` with this composition order:

~~~ts
const audio = createAudioHostIntegratedStandaloneScoreEditorController(options);
const keyboard = attachKeyboardWorkstationToBrowserControllerV1(
  audio,
  options.keyboardBindings
);
const range = attachProfessionalRangeToolbarToBrowserControllerV1(
  keyboard,
  options
);
const structure = attachProfessionalStructureInspectorToRangeControllerV1(
  range,
  options
);
~~~

Return one frozen controller based on \`structure\` and override only the combined profile:

~~~ts
export const PROFESSIONAL_WORKSTATION_V1_VERSION = '1.0.0' as const;

export const professionalWorkstationBrowserAppProfile = Object.freeze({
  ...professionalStructureInspectorBrowserAppProfile,
  ...keyboardWorkstationBrowserAppProfile,
  professionalWorkstationComposition: true,
  professionalWorkstationVersion: PROFESSIONAL_WORKSTATION_V1_VERSION,
  canonicalAuthority: false,
  historyAuthority: 'EditorHistoryV4' as const,
  semanticTargetAuthority: 'SemanticAddressV3-current-revision' as const,
  keyboardCursorAuthority: false,
  professionalSelectionCanonicalAuthority: false,
  rendererCoordinateAuthority: false,
  domAuthoringAuthority: false,
  audioHostIntegrated: true,
  audioEngineBundled: false,
  externalAudioRuntimeRequired: true,
  productionDefault: false,
  productionReleaseAuthorized: false,
  seslitabCutoverAuthorized: false
});
~~~

The controller must not construct any second browser document controller.

- [ ] **Step 4: Add global entry**

\`global-entry.ts\`:

~~~ts
import {
  createProfessionalWorkstationStandaloneBrowserAppRuntimeV1
} from './index.js';

export const PROFESSIONAL_WORKSTATION_GLOBAL =
  'STScoreEditorProfessionalWorkstation' as const;

const target = globalThis as typeof globalThis & {
  STScoreEditorProfessionalWorkstation?: ReturnType<
    typeof createProfessionalWorkstationStandaloneBrowserAppRuntimeV1
  >;
};

if (Object.prototype.hasOwnProperty.call(target, PROFESSIONAL_WORKSTATION_GLOBAL)) {
  throw new Error('ST_SCORE_EDITOR_PROFESSIONAL_WORKSTATION_ALREADY_DEFINED');
}

Object.defineProperty(target, PROFESSIONAL_WORKSTATION_GLOBAL, {
  value: createProfessionalWorkstationStandaloneBrowserAppRuntimeV1(),
  writable: false,
  configurable: false,
  enumerable: true
});
~~~

- [ ] **Step 5: Run GREEN**

~~~bash
npm run build
node --test test/p10-1-professional-workstation-v1.test.mjs
~~~

Expected: PASS.

- [ ] **Step 6: Commit**

~~~bash
git add packages/score-editor-browser-professional-workstation-v1 test/p10-1-professional-workstation-v1.test.mjs
git commit -m "feat(P10-1): compose professional workstation controller"
~~~

---

### Task 4: Prove Mixed P09 + P08 History, Selection Invalidation and Audio Isolation

**Files:**
- Create: \`test/p10-1-professional-workstation-integration.test.mjs\`
- Modify production code only if the RED test reveals a real composition defect.

**Interfaces:**
- Consumes: Task 3 combined controller.
- Produces: contract evidence for one history chain and capability-local noncanonical state.

- [ ] **Step 1: Add mixed-history RED test**

The test must:
1. create a Guitar score;
2. resolve a current event address;
3. select it;
4. perform one P09 keyboard edit;
5. capture a P08 EVENT_SPAN/SET over current-revision events;
6. perform one P08 admitted edit;
7. assert exactly two history steps;
8. Undo twice and compare canonical score+notation to stored snapshots;
9. Redo twice and compare canonical score+notation again.

Use canonical content comparison:

~~~js
const canonical = document => JSON.stringify({
  score: document.session.history.present.score,
  notation: document.session.history.present.notation
});
~~~

Store \`R0\`, \`R1\`, \`R2\` canonical strings rather than only revision ids.

- [ ] **Step 2: Add stale professional-selection test**

After creating a professional selection, dispatch a revision-changing keyboard action through the same controller and assert:

~~~js
assert.equal(controller.professional.getProfessionalSelection(), null);
~~~

Do not re-anchor or synthesize a replacement selection.

- [ ] **Step 3: Add audio no-history / failure-local tests**

Use a minimal admitted runtime stub matching \`ScoreAudioRuntimeV010\`.

Prove:
- \`attachAudioPort\` → history +0;
- successful audition → history +0;
- failing audition reports/throws audio-local failure only;
- a later keyboard or P08 canonical edit still succeeds and creates exactly one history revision.

- [ ] **Step 4: Add lifecycle duplicate-listener test**

Mount → unmount → mount the combined controller with the existing DOM harness pattern used by P09/P08 tests.

Dispatch one keyboard event and prove only one canonical action occurs.

Also verify editable targets are ignored by the keyboard adapter.

- [ ] **Step 5: Run integration tests**

~~~bash
npm run build
node --test test/p10-1-professional-workstation-integration.test.mjs
~~~

Expected: PASS.

- [ ] **Step 6: Run retained related suites**

~~~bash
node --test test/p09*.test.mjs
node --test test/p08*.test.mjs
node --test test/production-audio-mobile-composition.test.mjs
~~~

Expected: PASS.

- [ ] **Step 7: Commit**

~~~bash
git add test/p10-1-professional-workstation-integration.test.mjs packages
git commit -m "test(P10-1): prove unified workstation history and lifecycle"
~~~

Only include production files in this commit if a test-driven composition fix was actually required.

---

### Task 5: Build the Separate Combined Qualification Artifact and Lock Its Budget

**Files:**
- Create: \`scripts/build-p10-1-professional-workstation-browser.mjs\`
- Modify: \`package.json\`
- Create: \`test/p10-1-professional-workstation-artifact.test.mjs\`

**Interfaces:**
- Produces:
  - \`dist/browser/st-score-editor-professional-workstation.js\`
  - \`dist/browser/st-score-editor-professional-workstation.html\`
  - \`dist/browser/st-score-editor-professional-workstation.manifest.json\`
  - npm script \`build:browser:professional-workstation\`.

- [ ] **Step 1: Write RED artifact test**

The test runs the builder and asserts:
- exact global name;
- exact artifact/HTML/manifest names;
- \`externalImports === 0\`;
- \`canonicalAuthority === false\`;
- \`historyAuthority === 'EditorHistoryV4'\`;
- \`semanticTargetAuthority === 'SemanticAddressV3-current-revision'\`;
- P08/P09 bundled flags true;
- \`audioHostIntegrated === true\`;
- \`audioEngineBundled === false\`;
- \`productionDefault === false\`;
- \`productionReleaseAuthorized === false\`;
- \`seslitabCutoverAuthorized === false\`;
- default/P08/P09 existing budget revisions unchanged.

- [ ] **Step 2: Run RED**

~~~bash
node --test test/p10-1-professional-workstation-artifact.test.mjs
~~~

Expected: FAIL because the builder/artifact is absent.

- [ ] **Step 3: Implement the builder**

Follow the P08-E4 and P09-D build scripts.

Builder constants:

~~~js
const OUT_DIR = 'dist/browser';
const ARTIFACT = 'st-score-editor-professional-workstation.js';
const MANIFEST_FILE = 'st-score-editor-professional-workstation.manifest.json';
const ENTRY_HTML = 'st-score-editor-professional-workstation.html';
const GLOBAL_NAME = 'STScoreEditorProfessionalWorkstation';
const BUDGET_REVISION = 'P10-1-COMPOSITION-1';
~~~

Before setting the final \`MAX_BYTES\`:
1. build once with a temporary local measurement ceiling that is not committed;
2. record exact minified byte count;
3. choose the smallest deterministic rounded ceiling that leaves bounded build-tool variance, following the P08-E4 pattern;
4. commit only the final ceiling.

Use the existing forbidden token list:
- \`node:\`
- \`XMLHttpRequest\`
- \`WebSocket\`
- \`EventSource\`
- \`navigator.sendBeacon\`
- \`localStorage\`
- \`sessionStorage\`
- \`document.cookie\`

The builder must read existing default/P08/P09 manifests and reject silent changes to their budget revision/max-byte pairs.

- [ ] **Step 4: Add npm script**

Add:

~~~json
"build:browser:professional-workstation": "npm run build:browser && node scripts/build-professional-browser.mjs && node scripts/build-p09d-keyboard-workstation-browser.mjs && node scripts/build-p10-1-professional-workstation-browser.mjs"
~~~

Do not replace existing scripts.

- [ ] **Step 5: Run GREEN**

~~~bash
npm run build:browser:professional-workstation
node --test test/p10-1-professional-workstation-artifact.test.mjs
~~~

Expected: PASS with printed exact bytes + SHA256.

- [ ] **Step 6: Commit**

~~~bash
git add scripts/build-p10-1-professional-workstation-browser.mjs package.json test/p10-1-professional-workstation-artifact.test.mjs
git commit -m "build(P10-1): add bounded combined workstation artifact"
~~~

---

### Task 6: Add Dedicated Combined WebKit Qualification

**Files:**
- Create: \`scripts/p10-1-webkit-professional-workstation-regression.mjs\`
- Create: \`.github/workflows/p10-1-professional-workstation-webkit.yml\`

**Interfaces:**
- Consumes: Task 5 artifact.
- Produces: dedicated exact-head WebKit evidence.

- [ ] **Step 1: Implement WebKit regression script**

Reuse the server/browser patterns from:
- \`scripts/p08e4-webkit-professional-artifact-regression.mjs\`
- \`scripts/p09d-webkit-keyboard-workstation-regression.mjs\`.

The script must assert:
1. global \`STScoreEditorProfessionalWorkstation\` exists;
2. controller bootstrap succeeds;
3. renderer surface is mounted;
4. semantic event can be selected;
5. one P09 keyboard edit creates one history step;
6. one P08 professional edit creates one additional history step;
7. Undo/Undo and Redo/Redo restore canonical order;
8. editable input focus does not trigger keyboard mutation;
9. 44px professional touch targets are retained;
10. unmount/remount leaves one keyboard action per physical key event;
11. no browser console errors.

- [ ] **Step 2: Run locally**

~~~bash
npm install --ignore-scripts --no-audit --no-fund --no-package-lock --no-save playwright@1.62.1
npx playwright install webkit
npm run build:browser:professional-workstation
node scripts/p10-1-webkit-professional-workstation-regression.mjs
~~~

Expected: \`P10-1 professional workstation WebKit regression: PASS\`.

- [ ] **Step 3: Add GitHub workflow**

Workflow:
- PRs to \`main\`;
- Node 22;
- \`npm ci\`;
- install pinned Playwright 1.62.1 + WebKit;
- run \`npm run build:browser:professional-workstation\`;
- run the new regression script.

Do not weaken existing P08/P09 workflows.

- [ ] **Step 4: Commit**

~~~bash
git add scripts/p10-1-webkit-professional-workstation-regression.mjs .github/workflows/p10-1-professional-workstation-webkit.yml
git commit -m "test(P10-1): add combined workstation WebKit gate"
~~~

---

### Task 7: SonarQube Quality/Security Gate for the Composition Change

**Files:**
- No code change by default.
- Fix only concrete Sonar findings attributable to P10-1, using separate RED/GREEN commits.
- Update PR #193 evidence and Notion plan status after analysis.

**Interfaces:**
- Consumes: exact P10-1 branch head after Tasks 1–6.
- Produces: a real SonarQube project/PR quality-gate result, or an explicit blocker stating that no Sonar project/integration is available.

- [ ] **Step 1: Check CLI integration**

Run:

~~~bash
which sonar
sonar auth status
~~~

If \`sonar\` is absent, stop this task and request explicit installation approval per the sonar-integrate skill. Do not install silently.

- [ ] **Step 2: Discover project key**

After CLI/auth is available:

~~~bash
sonar list projects --query st-score-editor-core
~~~

Record the exact returned project key.

If zero projects are returned, report \`SONAR_PROJECT_NOT_FOUND\` and do not claim PASS.

- [ ] **Step 3: Check quality gate**

Prefer the SonarQube MCP \`get_project_quality_gate_status\` tool if it is available after integration. Otherwise use:

~~~bash
sonar api get "/api/qualitygates/project_status?projectKey=<exact-returned-key>&pullRequest=193"
~~~

If PR analysis is not available, use the implementation branch context supported by the server. Report every returned gate condition.

- [ ] **Step 4: Inspect open new issues**

Use:

~~~bash
sonar list issues -p <exact-returned-key> --statuses OPEN,CONFIRMED --branch p10-1-professional-workstation-composition-design --format toon
~~~

If the server analyzes PRs rather than branches, use \`--pull-request 193\`.

No new Critical/Blocker/High security or reliability finding attributable to P10-1 may remain unresolved. Medium findings must be reviewed individually; do not bulk suppress or mark false-positive without evidence.

- [ ] **Step 5: Coverage / duplication / dependency risk**

When MCP tools become available, run the plugin skills:
- \`sonar-coverage\`
- \`sonar-duplication\`
- \`sonar-dependency-risks\`

Focus on files created/modified by P10-1. Do not invent thresholds beyond the configured quality gate.

- [ ] **Step 6: Fix real findings test-first**

For every accepted Sonar issue:
1. reproduce with a focused unit/integration test when behaviorally testable;
2. make the smallest fix;
3. run focused tests;
4. rerun Sonar;
5. commit separately.

Do not change working behavior merely to reduce a metric.

- [ ] **Step 7: Record final result**

PR #193 and Notion must record one of:
- \`SONAR_QUALITY_GATE_PASS\` with exact project/branch-or-PR context;
- or a precise blocker such as \`SONAR_PROJECT_NOT_FOUND\` / \`SONAR_INTEGRATION_PENDING\`.

Never report Sonar PASS without an actual analysis result.

---

### Task 8: Full Exact-Head Verification and Qualification Handoff

**Files:**
- Verify all P10-1 changes.
- Update: PR #193 evidence.
- Update: Notion P10-1 architecture page and implementation-plan page.
- No merge.

**Interfaces:**
- Produces: automated qualification-ready branch plus a physical-device checklist.

- [ ] **Step 1: Run repository validation**

~~~bash
npm run validate
~~~

Expected: PASS.

- [ ] **Step 2: Run full suite**

~~~bash
npm test
~~~

Expected: zero failures.

- [ ] **Step 3: Build all retained + P10-1 artifacts**

~~~bash
npm run build:browser
npm run build:browser:professional
node scripts/build-p09d-keyboard-workstation-browser.mjs
npm run build:browser:professional-workstation
~~~

Expected: all budgets/forbidden-capability checks PASS.

- [ ] **Step 4: Require exact-head workflows**

Require:
- CI Node 18/20/22 success;
- APP-09B preview WebKit success;
- P08-E4 professional WebKit success;
- existing P09-D retained WebKit success;
- new P10-1 professional workstation WebKit success.

- [ ] **Step 5: Diff-scope audit**

Expected changed surface:
- keyboard attachment refactor;
- P08 range/structure attachment refactor;
- new P10-1 composition package;
- new tests;
- P10-1 build script;
- package.json script;
- P10-1 WebKit script/workflow;
- P10-1 spec/plan docs.

Unexpected network/storage/deployment/public-write changes are scope violations.

- [ ] **Step 6: Create physical iPhone/Safari combined-artifact checklist**

Checklist:
1. bootstrap, no white screen;
2. renderer visible;
3. rendered-note selection;
4. touch authoring remains operable;
5. keyboard layer does not interfere with touch UI;
6. professional range/structure controls usable;
7. one P09 edit + one P08 edit;
8. Undo/Undo + Redo/Redo canonical order;
9. portrait → landscape → portrait;
10. Safari background → foreground;
11. post-lifecycle rendered-note selection;
12. no duplicate controls/listeners/actions.

Physical gate must record exact commit, device model, iOS version and human PASS/FAIL.

- [ ] **Step 7: Update PR #193 + Notion**

Record:
- exact head;
- Node 18/20/22 results;
- total tests/pass count;
- artifact bytes/SHA256/budget revision;
- WebKit runs;
- Sonar result/blocker;
- production/cutover safety state;
- physical-device gate status.

Keep PR #193 draft/open/unmerged until the physical combined-artifact gate and human integration decision are complete.

## Self-Review Results

- **Spec coverage:** All architecture, behavior, compatibility, qualification and release-boundary requirements map to Tasks 1–8.
- **Placeholder scan:** No TBD/TODO/“implement later” steps remain.
- **Type consistency:** The attachment seam names introduced in Tasks 1–2 are consumed unchanged by Task 3.
- **Review Focus:** duplicate lifecycle listeners, mixed history, stale professional selection, audio failure isolation and focus/touch non-interference each have explicit tests.
- **Scope split:** APP-11J mutation and P10-2+ capabilities remain excluded.
- **SonarQube:** No quality result is fabricated; missing CLI/MCP is explicitly treated as an integration precondition/blocker.

## Execution Handoff

The user has previously requested autonomous execution. Preserve execution preference as **Native / superpowers:executing-plans** after this written plan is reviewed.

Implementation must not begin until the human confirms this plan captures the intended P10-1 work.