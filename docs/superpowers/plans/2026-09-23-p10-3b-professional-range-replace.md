# P10-3B Professional Range Delete/Replace Implementation Plan

> **For agentic workers:** REQUIRED EXECUTION MODE AFTER HUMAN PLAN APPROVAL: use the existing Superpowers TDD / subagent-driven implementation discipline. Do not begin production-code implementation from this plan until the human explicitly approves both the plan and execution mode.

**Goal:** Add bounded professional `EVENT_SPAN` Copy -> Replace with exact-duration replacement, fresh destination identities, supported local-notation cloning, fail-closed relation safety, one-action/one-`EditorHistoryV4` history semantics, optional P10-3B browser composition, WebKit qualification, and Sonar-gated closeout.

**Architecture:** Reuse `ProfessionalSelectionV1`, `TeacherCopySnapshotV4`, `ScoreDocumentV3 + NotationDocumentV4`, `EditorSessionV4 / EditorHistoryV4`, and the existing optional professional-workstation composition chain. Add a new professional range-replace engine that owns read-only copy adaptation, admission, deterministic identity planning and candidate generation but not history; add a session adapter that commits exactly once; add a narrow workstation adapter; add a separate P10-3B browser composition that owns only transient clipboard/UI state. Existing Teacher Paste remains neutral-REST overwrite and is not widened.

**Tech Stack:** TypeScript 6.0.3, Node.js 18/20/22, `node:test`, esbuild 0.28.2, Playwright 1.62.1 WebKit in existing qualification workflows, GitHub Actions, SonarQube Cloud Automatic Analysis.

**Spec:** `docs/superpowers/specs/2026-09-23-p10-3b-professional-range-replace-design.md`

**Baseline:** main `41a531208953cfb68d5bcc4638fbbe1445778e47`; design branch contains the approved written spec.

---

## Global constraints

- Replace v1 accepts only professional `EVENT_SPAN`; `EVENT_SET` is rejected.
- Source and destination are one-measure, same-measure, same-part, same-staff, same logical Voice.
- Source/destination event sets must not overlap.
- Source and destination each form a contiguous canonical time region.
- Exact rational source and destination extents must match.
- Event counts may differ when extents match.
- Source snapshot must be from the exact current canonical revision.
- Any canonical edit after Copy makes the P10-3B clipboard stale.
- Undo does not reactivate a stale clipboard.
- Source content remains unchanged.
- Destination event/note identities are removed.
- Inserted replacement event/note identities are always fresh and deterministic.
- No later event is shifted.
- No stretch/compress is performed.
- Accidental/dots/articulation/simple ornament/single-note tremolo may be copied.
- Beam/tuplet/tie/slur/grace/cross-staff/spanning tremolo/wavy-line relation coupling fails closed on source or destination.
- Measure/frame notation is preserved and never copied from source.
- One accepted Replace = exactly one `EditorHistoryV4` revision.
- Undo/Redo restore exact score+notation snapshots; Redo does not rerun Replace.
- Professional selection is noncanonical and current-revision-bound.
- Renderer coordinates, SVG/DOM order and geometry have no authoring authority.
- Existing Teacher Paste/Insert, Professional Clear and P10-3A Transpose semantics remain unchanged.
- P10-3B is an optional composition only.
- P10-1/P10-2/P10-3A qualified artifact budgets remain unchanged.
- SonarQube Cloud Automatic Analysis remains the only Sonar integration.
- No release/public-write/SesliTab cutover is authorized.

---

## Review focus

1. **Range timing is exact, not approximate.** All extent/contiguity checks use exact rational arithmetic and must reject gaps or overlaps instead of normalizing them silently.
2. **Identity replacement is complete.** Destination event/note IDs are removed, source IDs remain source-only provenance, and every inserted event/note gets a collision-checked fresh ID.
3. **Destination notation safety is symmetrical with source safety.** Existing `TeacherCopySnapshotV4` protects source relations; P10-3B must separately protect destination relations before deleting anything.
4. **Notation ownership is local and explicit.** Only admitted source event/note-local notation is cloned to fresh IDs. Measure/frame notation is preserved. No destination-local notation is merged into replacement content.
5. **History is atomic.** Candidate generation has no history authority; session integration performs exactly one direct-child `commitEditorHistoryV4`.
6. **Result selection uses fresh IDs.** Old destination addresses cannot be rebound; build a new `ProfessionalSelectionV1` from inserted IDs and preserve FORWARD/BACKWARD direction.
7. **Clipboard stale latch is browser/workstation transient state.** It is not stored in canonical score or history and is not revived by Undo.
8. **Existing Paste remains untouched semantically.** Do not broaden `TeacherPasteAdmissionV4` into range replacement.
9. **Optional artifact isolation.** New browser/build code layers on P10-3A without widening older qualified bundles.
10. **No false qualification claims.** WebKit is automated regression evidence, not physical iPhone evidence; Sonar PASS is claimed only from the service.

---

# File map

## New production packages

- `packages/editor-professional-range-replace-v1/src/index.ts`
  - professional Copy adapter;
  - exact rational range helpers;
  - destination relation-safety analyzer;
  - `ProfessionalRangeReplaceAdmissionV1`;
  - `ProfessionalRangeReplaceIdentityPlanV1`;
  - deterministic identity allocation;
  - atomic score+notation candidate execution;
  - fresh replacement `ProfessionalSelectionV1`.

- `packages/editor-session-professional-range-replace-v1/src/index.ts`
  - exact one-history-commit integration;
  - renderer request refresh;
  - semantic active-target update.

- `packages/score-editor-professional-range-replace-workstation-v1/src/index.ts`
  - thin adapter over `ScoreEditorProfessionalWorkstationV1`;
  - Copy snapshot creation from current professional span;
  - Replace admission/identity/session orchestration.

- `packages/score-editor-browser-professional-workstation-p10-3b-v1/src/index.ts`
  - optional P10-3B composition over P10-3A;
  - transient `EMPTY | CURRENT | STALE` Replace clipboard state;
  - desktop/mobile Copy Range + Replace controls;
  - short user-facing error/status mapping;
  - profile/capability flags.

- `packages/score-editor-browser-professional-workstation-p10-3b-v1/src/global-entry.ts`
  - optional global runtime/controller export following P10-3A pattern.

## New focused tests

- `test/p10-3b-professional-range-copy-admission-v1.test.mjs`
- `test/p10-3b-professional-range-replace-identity-v1.test.mjs`
- `test/p10-3b-professional-range-replace-authoring-v1.test.mjs`
- `test/p10-3b-professional-range-replace-session-v1.test.mjs`
- `test/p10-3b-professional-range-replace-workstation-v1.test.mjs`
- `test/p10-3b-browser-professional-range-replace-v1.test.mjs`
- `test/p10-3b-professional-range-replace-reality.test.mjs`

## New browser qualification/build files

- `scripts/build-p10-3b-professional-workstation-browser.mjs`
- `scripts/p10-3b-webkit-professional-range-replace-regression.mjs`
- `.github/workflows/p10-3b-professional-range-replace-webkit.yml`

## Expected modified files

Only where required by real implementation evidence:

- `package.json`
  - add bounded build/qualification script entry if repository convention requires it.
- `ROADMAP.md`
- `docs/st-score-editor-app-productization.md`
- `docs/st-score-editor-app-productization.json`
- `ARCHITECTURE.md` only if repository reality requires a new explicit P10-3B composition reference.
- possibly retained-reality tests if existing source-of-truth assertions enumerate P10 stages.

Do not modify older P10-1/P10-2/P10-3A production packages solely to make P10-3B convenient unless a compile-time integration requirement is proven. Prefer the new composition layer.

---

# Task 1 — Professional Copy adapter and Replace admission

**Files:**
- Create: `packages/editor-professional-range-replace-v1/src/index.ts`
- Create: `test/p10-3b-professional-range-copy-admission-v1.test.mjs`

## Step 1.1 — Write RED tests for Copy adapter bounds

Create fixtures containing:

- one standard staff;
- one measure with one Voice;
- NOTE / CHORD / REST events;
- at least two contiguous event spans;
- a second measure;
- a second staff or Voice for scope rejection;
- notation fixtures with safe local notation and relation-coupled variants.

Tests must prove:

- current `EVENT_SPAN` converts to `TeacherCopySnapshotV4`;
- copied event/note counts match;
- source revision/document/part/staff/Voice are exact;
- source snapshot has `destinationIdentityAssigned=false`;
- `EVENT_SET` fails;
- cross-measure source fails;
- stale selection fails;
- relation-coupled source failure propagates fail-closed from `TeacherCopySnapshotV4`.

Suggested public function:

```ts
createProfessionalRangeCopySnapshotV1(
  score: ScoreDocumentV3,
  notation: NotationDocumentV4,
  selection: ProfessionalSelectionV1
): Readonly<TeacherCopySnapshotV4>
```

Run:

```bash
npm run build
node --test test/p10-3b-professional-range-copy-admission-v1.test.mjs
```

Expected: RED because the package/API does not exist.

## Step 1.2 — Implement minimal Copy adapter

Implementation rules:

- validate canonical score + notation first;
- require `selection.kind === 'EVENT_SPAN'`;
- reconstruct/validate the selection against current score;
- require all selected addresses to share one measure;
- convert exact endpoints into `TeacherEventSpanSelectionV4`;
- call existing `createTeacherCopySnapshotV4`;
- do not create a second snapshot schema.

Re-run focused test: GREEN.

## Step 1.3 — Add RED Replace-admission tests

Add tests for `analyzeProfessionalRangeReplaceV1(...)` proving:

- exact same revision accepted;
- destination must be `EVENT_SPAN`;
- source/destination same measure required;
- same part/staff/Voice required;
- source/destination shared event IDs rejected;
- exact equal rational extent admitted;
- equal extent with different event counts admitted;
- source gap rejected;
- destination gap rejected;
- source/destination duration mismatch rejected;
- stale snapshot rejected;
- destination tie rejected;
- destination slur rejected;
- destination beam rejected;
- destination tuplet rejected;
- destination grace-coupled event rejected;
- destination cross-staff placement rejected;
- destination spanning ornament rejected;
- safe destination local notation remains admissible.

Suggested admission:

```ts
interface ProfessionalRangeReplaceAdmissionV1 {
  version: '1.0.0';
  kind: 'PROFESSIONAL_RANGE_REPLACE_ADMISSION';
  admitted: true;
  sourceRevisionId: string;
  sourceEventIds: readonly string[];
  destinationEventIds: readonly string[];
  destinationRemovedNoteIds: readonly string[];
  measureId: string;
  partId: string;
  staffId: string;
  voiceOrdinal: number;
  sourceExtent: Rational;
  destinationExtent: Rational;
  destinationStart: Rational;
  destinationDirection: 'FORWARD' | 'BACKWARD';
  identityAllocationRequired: true;
  identityAllocationPerformed: false;
  relationRemappingRequired: false;
  canonicalMutationAuthority: false;
  historyMutationAuthority: false;
}
```

Run focused test and prove RED.

## Step 1.4 — Implement exact rational/contiguity helpers and destination safety

Implement private exact rational operations using safe-integer / bigint reduction, following repository patterns.

For each source snapshot event and resolved destination event:

- derive onset relative to range start;
- prove nonnegative exact onset;
- prove exact adjacency:
  `next.onset === previous.onset + previous.duration`;
- calculate extent as exact end minus start;
- reject any gap or overlap.

Destination relation safety must inspect current `NotationDocumentV4` and score grace groups/cross-staff placements symmetrically with source rules.

Do not mutate.

Re-run focused test: GREEN.

## Step 1.5 — Commit Task 1

Suggested commit:

```text
feat: add P10-3B range replace admission
```

---

# Task 2 — Deterministic replacement identity plan

**Files:**
- Modify: `packages/editor-professional-range-replace-v1/src/index.ts`
- Create: `test/p10-3b-professional-range-replace-identity-v1.test.mjs`

## Step 2.1 — Write RED identity-plan tests

Prove:

- fresh direct-child revision ID required;
- current/immediate-parent revision ID reuse rejected;
- one destination event may be replaced by multiple source events;
- multiple destination events may be replaced by fewer source events;
- every source event receives a fresh destination event ID;
- every source note/chord tone receives a fresh destination note ID;
- no generated ID equals source ID;
- no generated ID equals removed destination ID;
- deterministic same inputs produce identical plan;
- changed destination/nextRevision changes deterministic IDs;
- occupied canonical collision fails;
- planned internal collision fails;
- tampered/stale admission fails;
- identity counts exactly match snapshot counts.

Suggested function:

```ts
planProfessionalRangeReplaceIdentitiesV1(
  score: ScoreDocumentV3,
  notation: NotationDocumentV4,
  snapshot: TeacherCopySnapshotV4,
  destination: EventSpanProfessionalSelectionV1,
  admission: ProfessionalRangeReplaceAdmissionV1,
  nextRevisionId: string
): Readonly<ProfessionalRangeReplaceIdentityPlanV1>
```

Run focused test and prove RED.

## Step 2.2 — Implement deterministic IDs

Follow the existing teacher paste pattern:

- stable hash from document/revision/destination/next-revision/source provenance/index;
- prefixes `replace-event:` and `replace-note:`;
- scan all canonical IDs;
- maintain a planned-ID set;
- fail closed on any collision;
- re-run admission inside planning and compare exact admission facts.

The plan remains read-only and has no history authority.

Re-run focused test: GREEN.

## Step 2.3 — Commit Task 2

Suggested commit:

```text
feat: plan P10-3B replacement identities
```

---

# Task 3 — Atomic score and notation authoring

**Files:**
- Modify: `packages/editor-professional-range-replace-v1/src/index.ts`
- Create: `test/p10-3b-professional-range-replace-authoring-v1.test.mjs`

## Step 3.1 — Write RED score-mutation tests

Prove successful cases:

- 2 quarters replace 4 eighths when exact extent matches;
- 4 eighths replace 2 quarters when exact extent matches;
- NOTE / CHORD / REST source events clone correctly;
- source content/IDs stay byte-for-byte unchanged;
- removed destination event/note IDs are absent;
- inserted IDs exactly equal identity plan;
- inserted onset = destinationStart + source onsetFromSegmentOrigin;
- inserted durations/pitches exactly match snapshot;
- following unselected events retain exact onset/duration/identity;
- measure/Voice topology is unchanged;
- new score revision is direct child.

Prove failure cases:

- tampered admission;
- tampered identity plan;
- stale score/notation;
- target membership changed;
- target order changed;
- target Voice/measure changed;
- invalid candidate canonical occupancy;
- invalid revision ID.

Run focused test and prove RED.

## Step 3.2 — Implement score splice on clone

Mutation rules:

- validate score/notation;
- revalidate admission;
- revalidate identity plan;
- clone score;
- resolve exact target part/staff/measure/Voice;
- prove admitted destination IDs occur exactly once and in admitted canonical order;
- replace exactly that contiguous event slice with new source-derived events;
- never change events outside target slice;
- set fresh revision;
- validate through `createScoreDocumentV3`.

Do not expose any partially-mutated object.

## Step 3.3 — Write RED notation-ownership tests

Prove:

- source accidental copied to fresh note ID;
- source dots copied to fresh event ID;
- source articulation copied;
- source simple ornament copied;
- source single-note tremolo copied;
- removed destination event/note notation entries disappear;
- destination local notation is not merged into replacement content;
- measure notation remains unchanged;
- frame notation remains unchanged;
- unrelated event/note/grace notation rebinds to new revision unchanged;
- unsupported source/destination relations never reach authoring;
- no notation target points to removed IDs;
- final `NotationDocumentV4` validates.

Run focused test and prove RED.

## Step 3.4 — Implement notation rebuild

Build a new notation candidate from:

1. existing measure/frame/grace entries that remain valid;
2. unrelated surviving event/note entries rebound to result score;
3. admitted source event/note-local notation cloned onto fresh planned IDs.

Do not clone source relation-coupled notation because admission forbids it.

Do not copy source measure/frame notation.

Do not retain removed destination local notation.

Validate through `createNotationDocumentV4`.

## Step 3.5 — Write RED result-selection tests

Prove:

- fresh inserted IDs resolve to new `SemanticAddressV3`;
- result selection covers every inserted event;
- 2 -> 4 and 4 -> 2 cardinality are handled;
- destination FORWARD selection produces first->last inserted selection;
- destination BACKWARD selection preserves reverse direction;
- scope remains same part/staff/Voice/measure;
- inability to create valid selection rejects candidate before commit.

## Step 3.6 — Implement result selection

After validated score+notation:

- resolve first/last inserted IDs from the result score;
- call existing `createEventSpanProfessionalSelectionV1`;
- preserve destination direction by endpoint order;
- return full result containing score, notation, selection, admission, identityPlan, inserted/removed IDs;
- keep `historyMutationAuthority=false`.

Re-run full authoring test: GREEN.

## Step 3.7 — Commit Task 3

Suggested commit:

```text
feat: author P10-3B range replacement atomically
```

---

# Task 4 — Session integration and exact Undo/Redo

**Files:**
- Create: `packages/editor-session-professional-range-replace-v1/src/index.ts`
- Create: `test/p10-3b-professional-range-replace-session-v1.test.mjs`

## Step 4.1 — Write RED session tests

Prove:

- accepted Replace adds exactly one history snapshot;
- `historyCommitCount === 1`;
- `historyAuthority === 'EditorHistoryV4'`;
- result history present is exact authored score+notation;
- session semantic selection is result professional active target;
- renderer request points to result score+notation revision;
- status code is `PROFESSIONAL_RANGE_REPLACE_EDIT_COMMITTED`;
- one Undo restores exact pre-Replace score+notation JSON;
- one Redo restores exact post-Replace score+notation JSON;
- Redo restores identical generated IDs;
- failed authoring leaves history unchanged;
- invalid next revision does not commit.

Run focused test and prove RED.

## Step 4.2 — Implement session adapter

Suggested API:

```ts
commitSessionProfessionalRangeReplaceV1(
  session: EditorSessionStateV4,
  destination: EventSpanProfessionalSelectionV1,
  snapshot: TeacherCopySnapshotV4,
  admission: ProfessionalRangeReplaceAdmissionV1,
  identityPlan: ProfessionalRangeReplaceIdentityPlanV1
): Readonly<ProfessionalRangeReplaceSessionResultV1>
```

Implementation:

1. execute authoring against `session.history.present`;
2. call `commitEditorHistoryV4` exactly once;
3. set semantic selection via `professionalSelectionActiveTargetV1(result.selection)`;
4. rebuild renderer request with existing renderer profile;
5. return result professional selection and changed ID lists.

Do not modify generic `EditorHistoryV4` semantics.

Re-run session test: GREEN.

## Step 4.3 — Commit Task 4

Suggested commit:

```text
feat: commit P10-3B replacement through unified history
```

---

# Task 5 — Professional workstation adapter

**Files:**
- Create: `packages/score-editor-professional-range-replace-workstation-v1/src/index.ts`
- Create: `test/p10-3b-professional-range-replace-workstation-v1.test.mjs`

## Step 5.1 — Write RED workstation tests

Prove:

- Copy requires non-null professional selection;
- Copy requires `EVENT_SPAN`;
- Copy returns exact `TeacherCopySnapshotV4`;
- Replace requires current destination `EVENT_SPAN`;
- Replace internally creates fresh admission + identity plan from current document;
- accepted Replace returns workstation with updated document and fresh professional selection;
- source snapshot is never canonicalized into document/history;
- Clear-to-REST remains available through existing workstation and unchanged;
- no Teacher Paste behavior is altered.

Suggested APIs:

```ts
copyProfessionalRangeForReplaceV1(
  workstation: ScoreEditorProfessionalWorkstationV1
): Readonly<TeacherCopySnapshotV4>

commitProfessionalRangeReplaceWorkstationV1(
  workstation: ScoreEditorProfessionalWorkstationV1,
  snapshot: TeacherCopySnapshotV4,
  options: { readonly nextRevisionId: string }
): Readonly<ScoreEditorProfessionalWorkstationV1>
```

Run focused test and prove RED.

## Step 5.2 — Implement thin orchestration only

The workstation package should:

- read current document/session pair;
- consume existing professional selection;
- call engine/session packages;
- update `ScoreEditorAppDocument` with committed session using same dirty-state logic as existing workstation adapters;
- return fresh result professional selection.

It should not duplicate admission, identity, mutation or history logic.

Re-run test: GREEN.

## Step 5.3 — Commit Task 5

Suggested commit:

```text
feat: add P10-3B professional workstation adapter
```

---

# Task 6 — Optional browser composition and transient clipboard state

**Files:**
- Create: `packages/score-editor-browser-professional-workstation-p10-3b-v1/src/index.ts`
- Create: `test/p10-3b-browser-professional-range-replace-v1.test.mjs`

## Step 6.1 — Write RED controller-state tests

Build the new controller over `createP10_3AProfessionalWorkstationStandaloneScoreEditorControllerV1`.

Tests must prove initial state:

```text
clipboardState = EMPTY
clipboardAvailable = false
clipboardCurrent = false
clipboardStale = false
canCopyForReplace = false without EVENT_SPAN
canAttemptReplace = false
```

Then prove:

- current `EVENT_SPAN` enables Copy;
- `EVENT_SET` disables/rejects Copy-for-Replace;
- successful Copy -> CURRENT;
- copied event/note counts exposed;
- selection changes alone do not stale clipboard;
- canonical edit -> STALE;
- Undo after canonical edit keeps STALE;
- new successful Copy -> CURRENT;
- document replacement/unmount/dispose -> EMPTY where required by lifecycle;
- failed new Copy clears prior clipboard rather than silently retaining old content.

Run focused test and prove RED.

## Step 6.2 — Implement transient clipboard state machine

Use an explicit discriminated state internally or equivalent exact booleans:

```text
EMPTY
CURRENT(snapshot)
STALE(metadata only or stale snapshot not executable)
```

Rules:

- only CURRENT snapshot is executable;
- subscribe to base revision changes;
- any canonical revision change after Copy latches CURRENT -> STALE;
- revision equality after Undo does not unlatch STALE;
- Copy success replaces state with CURRENT;
- Copy failure clears to EMPTY;
- no clipboard object enters canonical document/history.

## Step 6.3 — Write RED Replace controller tests

Prove:

- CURRENT clipboard + destination `EVENT_SPAN` enables Replace attempt;
- Replace success adopts validated document;
- result professional selection remains replacement span;
- Replace success latches clipboard STALE;
- extent mismatch returns error and leaves document/history unchanged;
- failed Replace preserves CURRENT clipboard when not stale;
- source/destination overlap returns bounded error;
- user-facing error mapping is concise;
- existing P10-3A transpose functions still work;
- existing Clear still works;
- existing Teacher Paste/Insert remain present beneath composition and semantics unchanged.

## Step 6.4 — Implement browser controller commands

Expose:

```ts
getP10_3BRangeReplaceState()
copyProfessionalRangeForReplace()
replaceProfessionalRange(options?)
```

Use `professionalRevisionIdFactory ?? revisionIdFactory ?? crypto.randomUUID` with P10-3B-specific prefix if no options are supplied.

Do not calculate music semantics in the UI/controller; call the engine/workstation and map errors only.

## Step 6.5 — Write RED UI control tests

Prove desktop and mobile:

- `Copy Range` control exists exactly once per appropriate surface;
- `Replace` control exists exactly once;
- minimum 44x44 bounding-box contract;
- controls disable/enable from semantic controller state;
- DOM order never determines target membership;
- duplicate mount/subscription does not produce duplicate history commits or duplicate controls.

## Step 6.6 — Implement presentation controls

Follow P10-3A decorator pattern:

- decorate existing professional toolbar;
- decorate existing mobile teacher toolbar;
- data attributes dedicated to P10-3B;
- remove/recreate only P10-3B controls on refresh;
- safe dispose/unsubscribe path;
- no modal requirement;
- errors remain short status/state messages.

Re-run browser test: GREEN.

## Step 6.7 — Commit Task 6

Suggested commit:

```text
feat: add optional P10-3B browser range replace
```

---

# Task 7 — Optional global artifact and bounded bundle build

**Files:**
- Create: `packages/score-editor-browser-professional-workstation-p10-3b-v1/src/global-entry.ts`
- Create: `scripts/build-p10-3b-professional-workstation-browser.mjs`
- Modify: `package.json` only if needed for a named build command
- Extend/adjust focused build tests if existing bounded-artifact tests require stage registration.

## Step 7.1 — Write RED artifact/profile tests

In the browser test or a dedicated small artifact test, require profile evidence:

- `p10_3bWorkstationComposition === true`;
- `p10_3aQualifiedBasePreserved === true`;
- Copy/Replace availability true;
- canonical authority false;
- history authority `EditorHistoryV4`;
- renderer-coordinate authority false;
- DOM authoring authority false;
- `productionDefault === false`;
- `productionReleaseAuthorized === false`;
- `seslitabCutoverAuthorized === false`;
- physical device validation required and initially false in manifest capability evidence.

## Step 7.2 — Implement global entry

Follow P10-3A global export convention, with distinct globals such as:

```text
STScoreEditorP10_3BWorkstation
STScoreEditorP10_3BWorkstationController
```

No replacement of P10-1/P10-2/P10-3A global artifacts.

## Step 7.3 — Implement bounded build script

Use `buildBoundedWorkstationArtifact`.

Proposed artifact:

```text
st-score-editor-p10-3b-workstation.js
st-score-editor-p10-3b-workstation.manifest.json
st-score-editor-p10-3b-workstation.html
```

Contract:

```text
ST_SCORE_EDITOR_P10_3B_PROFESSIONAL_WORKSTATION_BUNDLE
```

Artifact class:

```text
optional-p10-3b-professional-range-replace-composition
```

Retain prior budgets unchanged:

- P10-1 manifest/limit;
- P10-2 manifest/limit;
- P10-3A manifest/limit.

### Important budget gate

Do **not** invent the P10-3B `maxBytes` before measuring the first real production artifact.

Implementation sequence:

1. build P10-3B with a temporary measurement-only ceiling that cannot be mistaken for the final qualification budget, or use the build helper's supported measurement path if available;
2. record actual byte size;
3. choose bounded headroom consistent with prior artifact policy;
4. freeze a named budget revision, e.g. `P10-3B-RANGE-REPLACE-1`;
5. add a regression assertion;
6. record actual/frozen values in closeout docs.

If the helper cannot support measurement without a ceiling, inspect its contract and use the smallest mechanically safe temporary ceiling explicitly marked `MEASUREMENT_ONLY_NOT_QUALIFIED`, then replace it before qualification.

## Step 7.4 — Build and verify old artifacts are untouched

Run:

```bash
npm run build:browser
node scripts/build-p10-1-professional-workstation-browser.mjs
node scripts/build-p10-2-professional-workstation-browser.mjs
node scripts/build-p10-3a-professional-workstation-browser.mjs
node scripts/build-p10-3b-professional-workstation-browser.mjs
```

Verify P10-1/P10-2/P10-3A manifest budgets/revisions have not changed.

## Step 7.5 — Commit Task 7

Suggested commit:

```text
build: add bounded P10-3B workstation artifact
```

---

# Task 8 — Dedicated mobile WebKit regression

**Files:**
- Create: `scripts/p10-3b-webkit-professional-range-replace-regression.mjs`
- Create: `.github/workflows/p10-3b-professional-range-replace-webkit.yml`

## Step 8.1 — Write browser regression script

Follow P10-3A local HTTP + Playwright WebKit style.

Use:

```text
viewport 390x844
deviceScaleFactor 3
hasTouch true
isMobile true
```

Fixture MusicXML should contain within one measure:

- one source region of two quarter events;
- one destination region of four eighth events with equal total extent;
- safe local notation on source and destination where import support allows;
- enough additional content to prove following event positions remain unchanged.

## Step 8.2 — Assert bootstrap/profile truth

Verify:

- P10-3B composition true;
- P10-3A preserved;
- Copy/Replace available;
- no canonical/renderer/DOM authority;
- production/release/SesliTab false.

## Step 8.3 — Assert visible controls

Before semantic range:

- Copy disabled;
- Replace disabled;
- mobile controls exactly one each;
- each touch target >= 44x44.

## Step 8.4 — Exercise Copy -> Replace

Browser sequence:

1. open local MusicXML;
2. resolve semantic addresses from renderer manifest, not DOM geometry;
3. capture source range;
4. invoke Copy Range;
5. verify clipboard CURRENT;
6. capture destination range;
7. invoke Replace;
8. verify no controller error;
9. verify source canonical content unchanged;
10. verify destination old IDs removed;
11. verify fresh inserted IDs/content/timing;
12. verify following event unchanged;
13. verify history past incremented exactly by 1;
14. verify replacement professional selection count/direction.

## Step 8.5 — Exercise exact Undo/Redo

- click Undo;
- compare serialized score+notation with exact pre-Replace canonical pair;
- verify professional selection cleared;
- verify clipboard remains STALE;
- click Redo;
- compare serialized pair with exact first post-Replace pair;
- verify generated IDs are identical to first post-Replace snapshot.

## Step 8.6 — Exercise no-side-effect error

Create/capture a duration-mismatched destination:

- Copy valid source again;
- attempt Replace against unequal extent;
- verify bounded error;
- verify serialized canonical pair unchanged;
- verify history counts unchanged;
- verify clipboard remains CURRENT;
- verify destination selection remains usable.

## Step 8.7 — Console/page error gate

No console error or `pageerror` may occur.

Print a single PASS line on success.

## Step 8.8 — Add workflow

Follow repository workflow hardening:

- job-level `contents: read`;
- pinned `ubuntu-24.04`, not `ubuntu-latest`;
- exact project install conventions;
- build P10-3B artifact;
- install/use repository-approved Playwright path;
- run dedicated script.

Do not add Sonar scanner/token/config.

## Step 8.9 — Commit Task 8

Suggested commit:

```text
test: qualify P10-3B range replace in WebKit
```

---

# Task 9 — Repository reality and documentation

**Files:**
- Create: `test/p10-3b-professional-range-replace-reality.test.mjs`
- Modify: `ROADMAP.md`
- Modify: `docs/st-score-editor-app-productization.md`
- Modify: `docs/st-score-editor-app-productization.json`
- Modify: `ARCHITECTURE.md` only if required for consistent source-of-truth architecture references.

## Step 9.1 — Write RED reality test

Before documentation updates, add assertions requiring P10-3B reality to be documented exactly.

Expected JSON fields should include:

```text
status
package
session_package
workstation_adapter
browser_composition
optional_artifact
selection_profiles = ['EVENT_SPAN']
same_measure_required = true
same_part_staff_voice_required = true
exact_extent_match_required = true
event_cardinality_may_change = true
fresh_destination_identity = true
teacher_copy_snapshot_reused = true
teacher_paste_semantics_unchanged = true
relation_remap = false
history_authority = 'EditorHistoryV4'
renderer_coordinate_authority = false
dom_authoring_authority = false
p10_1_qualified_artifact_preserved = true
p10_2_qualified_artifact_preserved = true
p10_3a_qualified_artifact_preserved = true
production_default = false
production_release_authorized = false
seslitab_cutover_authorized = false
```

Run reality test and prove RED.

## Step 9.2 — Update source-of-truth docs

Document only implemented/qualified truth. Do not overclaim until gates actually pass.

Before full qualification, use wording such as:

```text
IMPLEMENTED ON OPTIONAL P10-3B COMPOSITION / EXACT-HEAD QUALIFICATION PENDING
```

After exact-head qualification passes, update status to the repository's accepted qualified wording in the closeout commit.

Explicitly state:

- Delete remains Clear-to-REST;
- Replace is not Teacher Paste;
- one Replace = one history revision;
- automated WebKit is not physical-device evidence;
- production/SesliTab remain false.

Re-run reality test: GREEN.

## Step 9.3 — Commit Task 9

Suggested commit:

```text
docs: record P10-3B range replace reality
```

---

# Task 10 — Focused and full local qualification

No new production behavior should be added in this task.

## Step 10.1 — Run all P10-3B focused tests

```bash
npm run build:browser
node --test \
  test/p10-3b-professional-range-copy-admission-v1.test.mjs \
  test/p10-3b-professional-range-replace-identity-v1.test.mjs \
  test/p10-3b-professional-range-replace-authoring-v1.test.mjs \
  test/p10-3b-professional-range-replace-session-v1.test.mjs \
  test/p10-3b-professional-range-replace-workstation-v1.test.mjs \
  test/p10-3b-browser-professional-range-replace-v1.test.mjs \
  test/p10-3b-professional-range-replace-reality.test.mjs
```

Expected: PASS.

## Step 10.2 — Run targeted regression neighbors

At minimum rerun relevant existing suites for:

- `TeacherCopySnapshotV4`;
- teacher paste admission/identity/authoring/session;
- teacher insert;
- professional selection;
- professional Clear-to-REST;
- P10-3A pitch transpose;
- professional browser toolbar/workstation.

Use actual repository filenames discovered at implementation time; do not guess missing tests.

## Step 10.3 — Run full repository gate

```bash
npm run validate
npm test
```

Expected: PASS on implementation environment.

## Step 10.4 — Inspect diff for forbidden widening

Explicitly confirm no semantic widening of:

- `TeacherPasteAdmissionV4`;
- `EditorHistoryV4`;
- old qualified artifact budgets;
- renderer authoring authority;
- production/release/SesliTab flags.

Fix only issues supported by failing evidence.

---

# Task 11 — Exact-head CI and retained WebKit qualification

This task is evidence gathering, not new feature design.

## Step 11.1 — Push exact implementation head

Record exact SHA.

## Step 11.2 — Require Node 18/20/22 PASS

CI must pass full repository validation/build/tests for all configured Node versions.

Do not qualify from a stale earlier commit.

## Step 11.3 — Require retained WebKit PASS

Run/check the exact-head gates relevant to:

- APP-09B renderer/layout;
- P08-E4 professional artifact;
- P10-1 workstation;
- P10-2 unretiming;
- P10-3A pitch transpose;
- P10-3B range replace.

A failure in a retained gate blocks qualification until resolved or accurately classified by human-approved scope.

## Step 11.4 — Record bundle bytes

Record:

- P10-3B actual artifact bytes;
- frozen maxBytes;
- budget revision;
- retained P10-1/P10-2/P10-3A budgets unchanged.

---

# Task 12 — Sonar service gate

No duplicate scanner work is allowed.

## Step 12.1 — Wait for/inspect SonarQube Cloud Automatic Analysis on exact head

Record service truth:

- analysis completed or not;
- Quality Gate state;
- new issue/security/hotspot state if accessible.

## Step 12.2 — Triage only evidence-backed findings

If Sonar reports issues:

- reproduce against exact repository lines;
- fix true positives with focused regression;
- document accepted-risk / hotspot reasoning only when service workflow requires human review;
- never add `sonar-project.properties`, duplicate scanner workflow, `SONAR_TOKEN`, `//NOSONAR`, or blanket exclusions merely to force green.

## Step 12.3 — Qualification wording

Only write `Sonar Quality Gate PASS` if the service reports PASS for the exact implementation head.

If unavailable/not-computed, record that exact state and keep qualification incomplete.

---

# Task 13 — Whole-branch self-review and closeout

## Step 13.1 — Compare branch against approved baseline

Review every changed file.

Verify:

- only P10-3B-required production surfaces changed;
- no accidental old-artifact budget edits;
- no duplicate authority;
- no TODO/placeholder in contract paths;
- no hidden widening of relation semantics;
- no dead/unused alternate clipboard model;
- no duplicate listeners causing one click -> multiple commits.

## Step 13.2 — Re-read approved spec against implementation

Create a checklist mapping Sections 1-10 to concrete tests/code/evidence.

Any mismatch requires fixing implementation or explicitly returning to human design review; do not silently reinterpret the approved spec.

## Step 13.3 — Final documentation status

Once exact-head Node/WebKit/Sonar gates are genuinely complete, update reality wording from qualification-pending to qualified.

Keep:

```text
productionDefault = false
productionReleaseAuthorized = false
seslitabCutoverAuthorized = false
physicalDeviceValidationRequired = true
physicalDeviceValidationPassed = false
```

unless separate human/physical evidence later changes those states.

## Step 13.4 — Final evidence record

Closeout report must include:

- exact head SHA;
- changed-file summary;
- focused test counts/results;
- Node 18/20/22 runs;
- retained WebKit run IDs/results;
- dedicated P10-3B WebKit run ID/result;
- P10-3B artifact actual/max byte values;
- retained artifact budgets unchanged;
- Sonar service status;
- physical-device status;
- release/cutover flags;
- remaining fail-closed limitations.

## Step 13.5 — No automatic merge

Even after qualification, do not merge unless the human separately authorizes merge.

---

# Execution order summary

```text
Task 1  Copy adapter + admission
  ->
Task 2  deterministic identities
  ->
Task 3  atomic score/notation authoring + result selection
  ->
Task 4  one-history-step session integration
  ->
Task 5  workstation adapter
  ->
Task 6  optional browser composition + clipboard/UI
  ->
Task 7  optional artifact + measured/frozen bundle budget
  ->
Task 8  dedicated WebKit
  ->
Task 9  reality documentation
  ->
Task 10 focused/full local qualification
  ->
Task 11 exact-head CI + retained WebKit
  ->
Task 12 Sonar service gate
  ->
Task 13 whole-branch closeout
```

---

# Approval gate

This plan does not itself authorize implementation.

After human approval, the human must also choose/approve the execution mode. Recommended mode for this repository is:

```text
AUTONOMOUS TDD EXECUTION ON THE P10-3B BRANCH
```

with the following stop points:

- stop for any required change to the approved spec;
- stop for any proposal to widen relation semantics or selection scope;
- stop before merge;
- stop before release/public-write/SesliTab cutover;
- report blockers truthfully instead of bypassing gates.

Alternative mode:

```text
STEP-BY-STEP HUMAN-GATED EXECUTION
```

where each task above is individually approved before implementation.
