# P-MXML-REF-01 Partitura Reference MusicXML Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the active ST Score Editor browser MusicXML open path accept the proven real-world P-MXML-REF-01 presentation/metadata envelope without weakening fail-closed handling of unsupported musical semantics.

**Architecture:** Keep `importNotationMusicXmlV2()` as the active browser importer and introduce one shared, typed compatibility policy that distinguishes canonical-required semantics from explicitly ignorable noncanonical presentation/metadata and unsupported semantics. The parser keeps all existing XML safety/resource limits, records bounded noncanonical diagnostics, strips only reviewed ignorable data, and leaves `ScoreDocumentV3 + NotationDocumentV4` plus `EditorSessionV4 / EditorHistoryV4` unchanged.

**Tech Stack:** TypeScript 6.0.3, Node.js 18/20/22, `node:test`, `saxes@6.0.0`, esbuild 0.28.2, Playwright/WebKit through the existing verified setup, GitHub Actions, SonarQube Cloud Automatic Analysis.

**Spec:** `docs/superpowers/specs/2026-09-27-partitura-reference-musicxml-compatibility-design.md`

**Baseline:** main `40e84d1fb9af4ad370adf99cb0f2e91df33d6e60`; written design branch `onderozudogru/p-mxml-ref-01-partitura-compatibility-design`.

## Global Constraints

- `ScoreDocumentV3 + NotationDocumentV4` remain canonical.
- `EditorSessionV4 / EditorHistoryV4` remain the sole history authority.
- MusicXML remains exchange/projection data.
- Partitura remains reference/oracle/test evidence only and is not added to the production browser dependency graph.
- No Python/backend/network dependency is added to the production browser path.
- Existing input-size, XML depth/element/attribute/text, timeout/abort, source-identity and canonical-validation gates remain active.
- Unknown or semantically meaningful unsupported MusicXML remains fail closed with `UNSUPPORTED_MUSICXML`.
- No generic “ignore unknown MusicXML” mode is permitted.
- No real/private score fixture is committed unless rights/provenance are explicitly approved.
- The private blocker file `sorf_op35_no13-let.musicxml` is qualification evidence only; use a synthetic reduced surrogate in Git.
- No new Render service/URL, deploy, production/public-write cutover or SesliTab cutover is authorized.
- SonarQube Cloud Automatic Analysis remains the only Sonar integration; do not add `sonar-project.properties`, a duplicate scanner, or a new `SONAR_TOKEN` path.
- Full APP-09 G1–G10 remains open until the required physical-device matrix is explicitly passed.

## Proven Blocker Characterization

The private/reference file `sorf_op35_no13-let.musicxml` is MusicXML 4.0.3 and independently parses in Partitura as 175 notes. Its current ST v2 parser encounters the following out-of-profile families before canonical import:

- root/document metadata: `identification`, `encoding`, `software`, `supports`, `encoding-date`, `source`, `miscellaneous`, `miscellaneous-field`;
- defaults/layout: `defaults`, `scaling`, `millimeters`, `tenths`, `page-layout`, page margins, `lyric-font`;
- part-list metadata not represented canonically: `part-abbreviation`, `score-instrument`, `instrument-name`, `midi-instrument`, `midi-channel`, `midi-program`, `volume`;
- measure layout: `print`, `system-layout`, `system-margins`, `system-distance`, `top-system-distance`, `measure-numbering`, `measure@width`;
- presentation-only note/layout evidence: `note@default-x`, `stem`, `stem@default-y`, supported articulation `@default-y`;
- conditional presentation: `notehead` with the observed neutral text `normal` and `filled="no"`;
- conditional staff presentation: empty `staff-details print-object="yes"`.

The implementation must not generalize these into acceptance of unrelated semantics. In particular `direction`, `sound`, `harmony`, foreign semantic namespaces, staff tuning/line definitions, and non-neutral notehead shapes remain fail closed in this tranche.

## Review Focus

1. **Conditional notehead semantics:** only the observed neutral `<notehead ...>normal</notehead>` profile may be discarded; diamond/x/slash/other notehead values must still fail closed. Task 3 owns this regression.
2. **Staff-details ambiguity:** empty `staff-details` carrying only `print-object` may be ignored, but `staff-lines`, `staff-tuning` or any child must fail closed. Task 3 owns this regression.
3. **Ignored subtree resource abuse:** metadata/layout subtrees must still count toward XML depth/elements/attributes/text limits. Task 3 owns this regression.
4. **Presentation attribute overreach:** only exact reviewed attributes/contexts such as `measure@width`, `note@default-x`, `stem@default-y`, and supported-articulation `@default-y` are ignorable; the same-looking attribute in another context must fail closed. Task 2/3 own this regression.
5. **Browser-path drift:** `openMusicXmlScoreEditorAppDocument()` must use the same policy and produce canonical-equivalent V3/V4 output as the stripped semantic twin; no fallback importer is allowed. Task 5/6 own this regression.

---

### Task 1: Freeze the real blocker as a synthetic, rights-safe RED contract

**Files:**
- Create: `corpus/fixtures/musicxml-compatibility/p-mxml-ref-01-sorf-surrogate.musicxml`
- Create: `corpus/fixtures/musicxml-compatibility/p-mxml-ref-01-sorf-surrogate-semantic-only.musicxml`
- Create: `test/p-mxml-ref-01-real-world-compatibility.test.mjs`
- Create: `docs/musicxml-compatibility-matrix.md`

**Interfaces:**
- Consumes: current `importNotationMusicXmlV2()`, `MusicXmlError`, repository fixture/provenance rules.
- Produces: one reproducible RED fixture pair plus a checked compatibility-matrix row that later tasks must make GREEN without committing the private score.

- [ ] **Step 1: Create the synthetic surrogate and stripped semantic twin**

The surrogate must be first-party synthetic material, not copied melody content. It must contain two measures and two Voices using ordinary C-major pitches while reproducing every blocker family listed in **Proven Blocker Characterization** at least once.

The semantic-only twin must contain the same supported part/measure/Voice/pitch/onset/duration/beam/articulation semantics with all P-MXML-REF-01 ignorable candidates removed.

- [ ] **Step 2: Write the baseline RED test**

Add tests named:

```js
test('P-MXML-REF-01 baseline rejects the real-world presentation envelope before compatibility policy')
test('P-MXML-REF-01 semantic-only twin imports under the current bounded profile')
```

The first test must assert baseline `UNSUPPORTED_MUSICXML` and the second must import successfully.

- [ ] **Step 3: Add the compatibility matrix**

Record at minimum:

```text
P-MXML-REF-01-SYNTHETIC
  provenance = first-party synthetic
  baseline ST = UNSUPPORTED_MUSICXML
  expected post-change = PASS
  canonical comparison = semantic-only twin

P-MXML-REF-01-PRIVATE-SORF
  source = sorf_op35_no13-let.musicxml
  repository inclusion = forbidden / rights not established
  Partitura = PASS / 175 notes
  Smoosic = PASS
  ST physical baseline = Android Chrome G2 FAIL + iPhone Safari open FAIL
  expected post-change = qualification-only PASS
```

Do not copy private score bytes into the repository.

- [ ] **Step 4: Run the focused baseline test**

Run:

```bash
npm run build
node --test test/p-mxml-ref-01-real-world-compatibility.test.mjs
```

Expected: the semantic-only test PASSes and the surrogate compatibility test demonstrates the existing `UNSUPPORTED_MUSICXML` blocker for the intended reason.

- [ ] **Step 5: Commit the characterization slice**

```bash
git add corpus/fixtures/musicxml-compatibility test/p-mxml-ref-01-real-world-compatibility.test.mjs docs/musicxml-compatibility-matrix.md
git commit -m "test: characterize real-world MusicXML compatibility blocker"
```

---

### Task 2: Add one typed compatibility policy and bounded diagnostic recorder

**Files:**
- Create: `packages/musicxml/src/compatibilityPolicy.ts`
- Create: `packages/musicxml/src/compatibilityDiagnostics.ts`
- Modify: `packages/musicxml/src/index.ts`
- Create: `test/p-mxml-ref-01-compatibility-policy.test.mjs`

**Interfaces:**
- Consumes: element/attribute local name, namespace URI and bounded parent-path context.
- Produces:
  - `MusicXmlCompatibilityClass`
  - `MusicXmlCompatibilityDecision`
  - `MusicXmlCompatibilityDiagnostic`
  - `MusicXmlCompatibilityEvidence`
  - `classifyMusicXmlCompatibilityElement(...)`
  - `classifyMusicXmlCompatibilityAttribute(...)`
  - `createMusicXmlCompatibilityRecorder(...)`

- [ ] **Step 1: Write direct policy tests before implementation**

Tests must pin these exact rules:

```text
SUPPORTED CURRENT V2 ELEMENT/ATTRIBUTE
  -> SEMANTIC_REQUIRED

identification/defaults subtree at score-partwise root
  -> IGNORABLE_PRESENTATION_METADATA

print subtree under measure
  -> IGNORABLE_PRESENTATION_METADATA

part-abbreviation / score-instrument / midi-instrument under score-part
  -> IGNORABLE_PRESENTATION_METADATA

measure@width
note@default-x
stem@default-y
supported articulation@default-y
  -> IGNORABLE_PRESENTATION_METADATA

direction / sound / harmony
foreign namespace element/attribute
unknown child under note
  -> UNSUPPORTED_SEMANTIC_FAIL_CLOSED
```

The same attribute name outside its admitted path must not inherit an ignorable classification.

- [ ] **Step 2: Implement the policy types and functions**

Use these public contracts:

```ts
export const MUSICXML_COMPATIBILITY_POLICY_VERSION = '1.0.0' as const;
export const MUSICXML_COMPATIBILITY_DIAGNOSTIC_LIMIT = 64 as const;

export type MusicXmlCompatibilityClass =
  | 'SEMANTIC_REQUIRED'
  | 'IGNORABLE_PRESENTATION_METADATA'
  | 'UNSUPPORTED_SEMANTIC_FAIL_CLOSED';

export interface MusicXmlCompatibilityDecision {
  readonly classification: MusicXmlCompatibilityClass;
  readonly pathClass: string;
  readonly reason: string;
}

export const classifyMusicXmlCompatibilityElement = (
  path: readonly string[],
  name: string,
  uri: string
): Readonly<MusicXmlCompatibilityDecision>;

export const classifyMusicXmlCompatibilityAttribute = (
  path: readonly string[],
  element: string,
  attribute: string,
  uri: string
): Readonly<MusicXmlCompatibilityDecision>;
```

Do not use substring heuristics such as “all default-* attributes are safe”. Rules are exact element/path/attribute allowlists.

- [ ] **Step 3: Implement bounded aggregated diagnostics**

Use:

```ts
export interface MusicXmlCompatibilityDiagnostic {
  readonly classification: 'IGNORABLE_PRESENTATION_METADATA';
  readonly element: string;
  readonly attribute: string | null;
  readonly pathClass: string;
  readonly reason: string;
  readonly count: number;
}

export interface MusicXmlCompatibilityEvidence {
  readonly diagnostics: readonly Readonly<MusicXmlCompatibilityDiagnostic>[];
  readonly truncated: boolean;
}

export interface MusicXmlCompatibilityRecorder {
  readonly record: (diagnostic: Omit<MusicXmlCompatibilityDiagnostic, 'count'>) => void;
  readonly snapshot: () => Readonly<MusicXmlCompatibilityEvidence>;
}

export const createMusicXmlCompatibilityRecorder = (
  limit?: number
): MusicXmlCompatibilityRecorder;
```

Aggregate repeated occurrences by classification/element/attribute/pathClass/reason and cap at 64 unique diagnostic keys. After the cap, set `truncated=true`; never accumulate unbounded evidence.

- [ ] **Step 4: Run policy tests**

Run:

```bash
npm run build
node --test test/p-mxml-ref-01-compatibility-policy.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/musicxml/src/compatibilityPolicy.ts packages/musicxml/src/compatibilityDiagnostics.ts packages/musicxml/src/index.ts test/p-mxml-ref-01-compatibility-policy.test.mjs
git commit -m "feat: add bounded MusicXML compatibility policy"
```

---

### Task 3: Apply the policy to the active v2 parser without weakening XML safety

**Files:**
- Modify: `packages/musicxml-v2/src/parser.ts`
- Modify: `packages/musicxml-v2/src/index.ts`
- Modify: `test/p-mxml-ref-01-real-world-compatibility.test.mjs`
- Modify: `test/musicxml-hardening.test.mjs`
- Modify: `test/musicxml-v2-roundtrip.test.mjs`

**Interfaces:**
- Consumes: Task 2 policy/recorder, existing `createMusicXmlProcessingRuntime()`, `normalizeMusicXmlInput()`.
- Produces:
  - existing parsed root;
  - unchanged `inputByteLength`;
  - new noncanonical `compatibility: MusicXmlCompatibilityEvidence` on `ParsedMusicXmlV2Result`.

- [ ] **Step 1: Extend the parser result contract**

```ts
export interface ParsedMusicXmlV2Result {
  readonly inputByteLength: number;
  readonly root: ParsedXmlNode;
  readonly compatibility: Readonly<MusicXmlCompatibilityEvidence>;
}
```

No canonical object receives this evidence.

- [ ] **Step 2: Add RED tests for unconditional ignorable subtrees and exact attributes**

Add tests that require the parser to tolerate and remove from the returned semantic tree:

- root `identification`;
- root `defaults`;
- measure `print`;
- score-part `part-abbreviation`;
- score-part `score-instrument`;
- score-part `midi-instrument`;
- `measure@width`;
- `note@default-x`;
- `stem` plus `stem@default-y`;
- supported articulation `@default-y`.

Assertions must also confirm corresponding aggregated diagnostics exist.

- [ ] **Step 3: Implement bounded skip handling for unconditional ignorable subtrees**

While SAX streaming:

1. count depth/elements/attributes/text exactly as today;
2. classify before constructing canonical parse nodes;
3. when a whole subtree is unconditionally ignorable, enter a skip depth;
4. continue resource-limit accounting and checkpoints inside the skipped subtree;
5. do not append skipped nodes/text to the semantic tree;
6. record one aggregated diagnostic key;
7. leave skip mode only on the matching close depth.

Do not skip an unclassified subtree.

- [ ] **Step 4: Strip exact reviewed presentation attributes**

For an otherwise supported node, omit only Task 2 attributes classified `IGNORABLE_PRESENTATION_METADATA` from the stored `ParsedXmlNode.attributes`, recording diagnostics. Any unsupported attribute still throws `UNSUPPORTED_MUSICXML` with `compatibilityClass: 'UNSUPPORTED_SEMANTIC_FAIL_CLOSED'`.

- [ ] **Step 5: Implement conditional `staff-details` behavior**

Admit only:

```xml
<staff-details print-object="yes"></staff-details>
```

or the equivalent empty form with no semantic child/text.

Any `staff-lines`, `staff-tuning`, tuning pitch/octave, or other child must fail closed. Add a negative regression named:

```js
test('P-MXML-REF-01 rejects semantic staff-details while tolerating empty print-only staff-details')
```

- [ ] **Step 6: Implement conditional neutral notehead behavior**

Admit and drop only `notehead` whose trimmed text is exactly `normal` and whose attributes are within the explicitly reviewed presentation subset used by the blocker (`filled` in v1).

Add a negative regression that `diamond`, `x`, `slash`, empty/unknown text, or unreviewed attributes fail closed.

- [ ] **Step 7: Prove resource limits still apply while skipping**

Create focused tests with oversized/deep `identification/defaults/print` content and assert the existing exact codes still occur:

```text
XML_DEPTH_LIMIT_EXCEEDED
XML_ELEMENT_LIMIT_EXCEEDED
XML_ATTRIBUTE_LIMIT_EXCEEDED
XML_TEXT_LIMIT_EXCEEDED
```

The tests must not pass merely because the subtree is ignored.

- [ ] **Step 8: Run affected parser/hardening tests**

Run:

```bash
npm run build
node --test \
  test/p-mxml-ref-01-compatibility-policy.test.mjs \
  test/p-mxml-ref-01-real-world-compatibility.test.mjs \
  test/musicxml-hardening.test.mjs \
  test/musicxml-v2-roundtrip.test.mjs
```

Expected: PASS, including existing fail-closed cases.

- [ ] **Step 9: Commit**

```bash
git add packages/musicxml-v2/src/parser.ts packages/musicxml-v2/src/index.ts test/p-mxml-ref-01-real-world-compatibility.test.mjs test/musicxml-hardening.test.mjs test/musicxml-v2-roundtrip.test.mjs
git commit -m "feat: tolerate bounded MusicXML presentation metadata"
```

---

### Task 4: Keep legacy/current MusicXML parser policy consistent

**Files:**
- Modify: `packages/musicxml/src/parsedXml.ts`
- Modify: `test/musicxml.test.mjs`
- Modify: `test/musicxml-measure-semantics-hardening.test.mjs`

**Interfaces:**
- Consumes: Task 2 shared compatibility policy.
- Produces: no second tolerance table; legacy APIs remain fail closed for musical semantics while applying the same exact noncanonical metadata/presentation decisions.

- [ ] **Step 1: Add a parity regression**

For the same synthetic metadata/layout envelope, assert the shared classifier gives the same ignore/fail decision whether invoked through the v2 parser path or the legacy parsed-tree path.

Do not require legacy importer feature parity with v2 notation semantics.

- [ ] **Step 2: Replace duplicated blanket envelope decisions with the shared policy where applicable**

Keep legacy semantic/profile restrictions intact. The purpose is only to avoid a second contradictory definition of what is safe to ignore.

- [ ] **Step 3: Retain legacy fail-closed tests**

Explicitly verify that v2-only/unsupported musical semantics still fail in the legacy importer and that no existing semantic rejection is converted to silent loss.

- [ ] **Step 4: Run focused legacy tests**

```bash
npm run build
node --test \
  test/musicxml.test.mjs \
  test/musicxml-measure-semantics-hardening.test.mjs \
  test/p-mxml-ref-01-real-world-compatibility.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/musicxml/src/parsedXml.ts test/musicxml.test.mjs test/musicxml-measure-semantics-hardening.test.mjs
git commit -m "refactor: share MusicXML compatibility classification"
```

---

### Task 5: Carry compatibility evidence through the v2 importer and prove canonical equivalence

**Files:**
- Modify: `packages/musicxml-v2/src/importer.ts`
- Modify: `packages/musicxml-v2/src/index.ts`
- Create: `test/p-mxml-ref-01-app-document-compatibility.test.mjs`
- Modify: `test/score-editor-app-document.test.mjs`

**Interfaces:**
- Consumes: `ParsedMusicXmlV2Result.compatibility`, existing v2 importer, `openMusicXmlScoreEditorAppDocument()`.
- Produces: additive noncanonical `compatibility` evidence on `NotationMusicXmlV2ImportResult`; browser app canonical state remains unchanged in shape/authority.

- [ ] **Step 1: Extend the importer result additively**

```ts
export interface NotationMusicXmlV2ImportResult {
  readonly score: Readonly<ScoreDocumentV2>;
  readonly notation: Readonly<NotationDocumentV2>;
  readonly compatibility: Readonly<MusicXmlCompatibilityEvidence>;
}
```

The app-document layer may ignore this field; do not persist it into score, notation or history.

- [ ] **Step 2: Write the canonical-equivalence test**

Open both synthetic fixtures through the real production seam:

```js
await openMusicXmlScoreEditorAppDocument(...)
```

Normalize only source-hash/title differences and assert the imported canonical V3/V4 score+notation meaning is deeply equal between:

- full surrogate with admitted ignorable presentation/metadata;
- semantic-only twin.

Also assert two Voices remain separate and exact onsets/durations/pitches are unchanged.

- [ ] **Step 3: Add nearby negative app-level cases**

Through `openMusicXmlScoreEditorAppDocument()`, assert `UNSUPPORTED_MUSICXML` remains for:

- `direction`;
- `sound`;
- semantic `staff-details` with tuning/lines;
- non-neutral `notehead`;
- foreign namespace semantic element.

- [ ] **Step 4: Verify source identity still uses original bytes**

The accepted full surrogate must preserve the original input `source.byteLength` and supplied SHA-256 identity. Compatibility stripping must not silently replace source identity with stripped/projection bytes.

- [ ] **Step 5: Run app/import tests**

```bash
npm run build
node --test \
  test/p-mxml-ref-01-app-document-compatibility.test.mjs \
  test/score-editor-app-document.test.mjs \
  test/p-mxml-ref-01-real-world-compatibility.test.mjs \
  test/musicxml-v2-roundtrip.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/musicxml-v2/src/importer.ts packages/musicxml-v2/src/index.ts test/p-mxml-ref-01-app-document-compatibility.test.mjs test/score-editor-app-document.test.mjs
git commit -m "test: prove canonical equivalence for compatible MusicXML"
```

---

### Task 6: Add a dedicated mobile-WebKit open regression

**Files:**
- Create: `scripts/p-mxml-ref-01-webkit-musicxml-compatibility-regression.mjs`
- Create: `.github/workflows/p-mxml-ref-01-musicxml-compatibility-webkit.yml`

**Interfaces:**
- Consumes: existing `npm run build:browser` standalone artifact `dist/browser/st-score-editor-app.js`, `STScoreEditorApp.createController()`, synthetic fixtures from Task 1.
- Produces: automated iPhone-like WebKit evidence for the exact browser open path; no renderer or production URL is required.

- [ ] **Step 1: Write the WebKit regression script**

Use the existing verified Playwright installation and this browser context:

```text
browser = WebKit
viewport = 390 x 844
deviceScaleFactor = 3
hasTouch = true
isMobile = true
```

Serve only local `dist/browser` content on `127.0.0.1`.

The script must:

1. load `st-score-editor-app.js`;
2. create a controller with `STScoreEditorApp.createController()`;
3. open the full synthetic surrogate;
4. assert controller error is null;
5. assert the document origin is MusicXML and the expected two-Voice canonical material exists;
6. open the semantic-only twin and assert canonical equivalence;
7. attempt the unsupported semantic fixture and assert `UNSUPPORTED_MUSICXML`;
8. fail on console/page errors.

- [ ] **Step 2: Add the dedicated workflow**

Use Node 22 and existing setup:

```bash
bash scripts/setup-editor-webkit-ci.sh
npm run build:browser
node scripts/p-mxml-ref-01-webkit-musicxml-compatibility-regression.mjs
```

Trigger on pull requests and `workflow_dispatch`. Do not alter Render or deployment workflows.

- [ ] **Step 3: Run locally where WebKit is available**

Expected: PASS. If Playwright/WebKit is unavailable in the implementation environment, do not claim PASS; rely on the GitHub Actions job as the required automated browser evidence.

- [ ] **Step 4: Commit**

```bash
git add scripts/p-mxml-ref-01-webkit-musicxml-compatibility-regression.mjs .github/workflows/p-mxml-ref-01-musicxml-compatibility-webkit.yml
git commit -m "test: add MusicXML compatibility WebKit gate"
```

---

### Task 7: Documentation, repository reality and dependency proof

**Files:**
- Modify: `docs/musicxml-roundtrip-policy.md`
- Modify: `DEPENDENCIES.md`
- Modify: `ARCHITECTURE.md`
- Modify: `ROADMAP.md`
- Modify: `docs/st-score-editor-app-productization.md`
- Modify: `docs/app-09-standalone-release-gate.md`
- Modify: `docs/musicxml-compatibility-matrix.md`
- Create: `test/p-mxml-ref-01-reality.test.mjs`

**Interfaces:**
- Consumes: completed implementation/test evidence.
- Produces: truthful repository documentation and machine-checked authority/dependency statements.

- [ ] **Step 1: Update the MusicXML policy docs**

Document:

- three compatibility classes;
- exact initial ignorable profile;
- exact unsupported semantic examples;
- diagnostics are noncanonical;
- Partitura is reference-only;
- no Python/backend/network dependency in browser runtime;
- private blocker file is not committed.

- [ ] **Step 2: Update dependency and architecture truth**

`DEPENDENCIES.md` must still show no Partitura/Python dependency in this repository's production browser graph.

`ARCHITECTURE.md` must show:

```text
MusicXML bytes
 -> xmlSafety/resource limits
 -> bounded compatibility classification
 -> importNotationMusicXmlV2
 -> migrate V2 -> V3/V4
 -> EditorSessionV4
```

No fallback importer or second canonical parser authority.

- [ ] **Step 3: Update release reality without overclaiming**

Record P-MXML-REF-01 as compatibility hardening only.

Keep:

```text
manualDeviceValidationRequired = true
standaloneReleaseGatePassed = false
seslitabCutoverAuthorized = false
```

until physical evidence closes the applicable APP-09 matrix.

- [ ] **Step 4: Add a repository-reality test**

Assert at minimum:

- the compatibility spec and plan exist;
- policy version and diagnostic cap are exported;
- browser app still imports through `importNotationMusicXmlV2`;
- no `partitura`, Python runtime, HTTP client, subprocess or new network dependency appears in `package.json` / production browser build path;
- no new Render/deploy configuration was added by P-MXML-REF-01;
- docs retain fail-closed and release-gate statements.

- [ ] **Step 5: Run documentation/reality checks**

```bash
npm run build
node --test test/p-mxml-ref-01-reality.test.mjs
npm run validate
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add docs/musicxml-roundtrip-policy.md DEPENDENCIES.md ARCHITECTURE.md ROADMAP.md docs/st-score-editor-app-productization.md docs/app-09-standalone-release-gate.md docs/musicxml-compatibility-matrix.md test/p-mxml-ref-01-reality.test.mjs
git commit -m "docs: record MusicXML compatibility policy and release boundary"
```

---

### Task 8: Integrated verification and private/physical blocker qualification

**Files:**
- No production source changes unless a failing approved acceptance criterion exposes a defect; any repair must return to the owning RED/GREEN task.
- Update only closeout/evidence sections in `docs/musicxml-compatibility-matrix.md` after evidence exists.

**Interfaces:**
- Consumes: integrated branch from Tasks 1–7.
- Produces: exact-head evidence package for human merge/release review.

- [ ] **Step 1: Run focused compatibility suite**

```bash
npm run build
node --test \
  test/p-mxml-ref-01-compatibility-policy.test.mjs \
  test/p-mxml-ref-01-real-world-compatibility.test.mjs \
  test/p-mxml-ref-01-app-document-compatibility.test.mjs \
  test/p-mxml-ref-01-reality.test.mjs \
  test/musicxml-hardening.test.mjs \
  test/musicxml-v2-roundtrip.test.mjs \
  test/musicxml.test.mjs \
  test/musicxml-measure-semantics-hardening.test.mjs \
  test/score-editor-app-document.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run full repository verification**

```bash
npm run validate
npm test
npm run ci
```

Then require GitHub CI Node 18/20/22 to be green on the exact implementation head.

- [ ] **Step 3: Run dedicated WebKit gate**

Require the P-MXML-REF-01 WebKit workflow to PASS on the exact implementation head. Retain existing APP-09B and other required branch checks; do not reinterpret this one new job as full release evidence.

- [ ] **Step 4: Qualify the private real-world file without committing it**

Using the exact private/reference `sorf_op35_no13-let.musicxml` outside Git history:

1. open through the built/current ST app importer;
2. confirm no `UNSUPPORTED_MUSICXML` is raised for the reviewed presentation/metadata families;
3. confirm imported note/Voice/timing sample matches the independent Partitura evidence, including the known Voice 1/Voice 2 overlap pattern;
4. record any remaining rejection family if one exists;
5. if a remaining item is semantic/unclassified, **do not broaden the allowlist automatically**; stop and return to architecture review.

The Partitura 175-note result is comparison evidence, not canonical authority.

- [ ] **Step 5: Run physical browser reruns**

At minimum rerun the previously failing G2 open path on:

- Android Chrome;
- iPhone Safari.

Record device/browser versions and exact result. A WebKit CI PASS is not a substitute.

- [ ] **Step 6: Review SonarQube Cloud**

Use the live Automatic Analysis result for the exact branch/PR head. Report PASS only if the service itself reports PASS; otherwise record the actual pending/failing/unavailable state.

- [ ] **Step 7: Whole-branch review**

Review the exact diff for:

- generic unknown-tag tolerance;
- semantic items accidentally classified ignorable;
- resource-limit bypass;
- namespace confusion;
- unbounded diagnostics;
- private score content accidentally committed;
- new runtime/network/Python dependency;
- Render/deployment changes;
- canonical/history authority drift.

- [ ] **Step 8: Record closeout evidence**

Update `docs/musicxml-compatibility-matrix.md` with:

```text
base SHA
implementation head SHA
focused suite
Node 18/20/22 CI
dedicated WebKit
private blocker result
Android Chrome physical result
iPhone Safari physical result
Sonar live status
known unsupported semantics
dependency state
release gate state
```

Do not mark APP-09 released unless its separate full gate conditions are met.

---

## Self-Review

### 1. Spec coverage

All approved design requirements map to tasks:

- real-world blocker and compatibility matrix -> Tasks 1/8;
- three-way policy -> Task 2;
- bounded tolerance and resource limits -> Task 3;
- shared policy/no contradictory importer tolerance -> Task 4;
- canonical equivalence and real browser seam -> Task 5;
- mobile WebKit evidence -> Task 6;
- dependency/authority/release documentation -> Task 7;
- fresh CI/Sonar/private/physical evidence -> Task 8.

### 2. Step scan

Every implementation task begins with an observable RED/test contract, identifies exact files/interfaces, then requires focused GREEN verification before commit. No task authorizes unrelated schema/editor/rendering work.

### 3. Type consistency

`MusicXmlCompatibilityEvidence` is created by the recorder, returned by `ParsedMusicXmlV2Result.compatibility`, then carried additively by `NotationMusicXmlV2ImportResult.compatibility`. It never enters canonical score/notation/history state.

### 4. Review Focus coverage

All five review-focus risks have explicit tests in Tasks 2, 3, 5 and 6.

### 5. Proportion and scope

The plan intentionally avoids adding Partitura to Editor Core, avoids a second lenient importer, and avoids widening MusicXML musical semantics beyond the exact P-MXML-REF-01 compatibility envelope.

## Execution Gate

This plan does **not** authorize implementation.

After human approval, execute task-by-task with Superpowers TDD/verification and Codex Engineering Guardrails. Because parser compatibility is security-sensitive and one accidental fail-open rule could silently discard musical semantics, **Subagent-driven execution is recommended**: each task should receive an independent review gate before the next task proceeds.

No merge, deploy, Render change, release, production/public-write cutover or SesliTab cutover is implied by approving this plan.
