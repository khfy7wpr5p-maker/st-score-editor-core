# SEM-04 Editor Core Read-Only Semantic Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic, CI-only, read-only parity harness that compares Editor Core's canonical MusicXML interpretation with a pinned ST Score Semantic Engine reference snapshot without adding runtime Python, service, mutation, or identity authority.

**Architecture:** Add one focused TypeScript package, `packages/editor-semantic-parity-v1`, that projects `ScoreDocumentV3 + NotationDocumentV4` into comparison-only structural rows and compares them with a checked-in Semantic Engine fixture bundle. The end-to-end test opens the same MusicXML through the existing `openMusicXmlScoreEditorAppDocument(...)` product import path, while the reference JSON remains pinned to Semantic Engine commit `ffc997b242fa862e180e698385cc0afb52de47a1`.

**Tech Stack:** TypeScript 6.0.3, Node.js >=18, `node:test`, existing Editor Core MusicXML V2→V3→V4 import/migration path, exact rational arithmetic, checked-in JSON fixtures, GitHub Actions Node 18/20/22.

**Spec:** `docs/superpowers/specs/2026-09-27-editor-semantic-readonly-comparison-design.md`

## Global Constraints

- Canonical authority remains `ScoreDocumentV3 + NotationDocumentV4`.
- `EditorSessionV4 / EditorHistoryV4` remain the only history authority.
- `SemanticAddressV3` remains Editor Core semantic identity.
- Raw IDs from Editor Core and Semantic Engine are never treated as equivalent identity.
- Partitura stays outside Editor Core dependencies and runtime.
- No Python process, REST endpoint, network call, Render service, browser feature, or user-facing UI is added.
- No MusicXML mutation/write-back or automatic correction is added.
- First profile: one part, pitched normal notes/chords, 2+ measures, multiple staves/voices, fixed divisions-per-quarter, simple ties, time/key/clef.
- Unpitched, grace comparison, cross-staff, polymeter/non-controlling, mid-score divisions changes, arbitrary tuplets, beams/slurs/tremolo, and ambiguous duplicate unison coordinates fail closed as `UNSUPPORTED`.
- Semantic Engine reference is pinned to commit `ffc997b242fa862e180e698385cc0afb52de47a1`, snapshot schema `st-semantic-snapshot-v1`, Partitura `1.9.0`.
- Key-signature parity in SEM-04 compares `fifths` only because Editor Core's canonical `KeySignature` contract does not represent mode.
- Semantic timing converts with `semantic divisions / (4 * divisionsPerQuarter)`; no floating-point timing comparison.

## Review Focus

1. **Ambiguous structural note identity:** duplicate unison tones at the same part/measure/staff/voice/onset/pitch coordinate must return `UNSUPPORTED`, not arbitrary matching. Task 2 owns the test.
2. **Mid-score divisions changes:** fixture profile validation must return `UNSUPPORTED`; the comparator must not apply one global scale to mixed divisions. Task 1 owns the test.
3. **Sparse/inherited notation:** absent explicit time/key/clef entries must not be invented during parity projection; only comparable explicit contexts are evaluated. Task 2 owns the test.
4. **Tie ambiguity:** more than one start or stop boundary on a compared note is outside SEM-04 and must return `UNSUPPORTED`. Task 2 owns the test.
5. **Reference drift:** source SHA, Semantic Engine commit, schema version, Partitura version, or divisions provenance mismatch must prevent `PASS`. Task 1 owns the tests.

---

### Task 1: Pin and validate the independent reference fixture bundle

**Files:**
- Create: `test/fixtures/sem-04-semantic-parity/semantic-baseline.musicxml`
- Create: `test/fixtures/sem-04-semantic-parity/semantic-baseline.semantic-snapshot.json`
- Create: `test/fixtures/sem-04-semantic-parity/provenance.json`
- Create: `packages/editor-semantic-parity-v1/src/types.ts`
- Create: `packages/editor-semantic-parity-v1/src/reference.ts`
- Create: `packages/editor-semantic-parity-v1/src/index.ts`
- Test: `test/sem-04-editor-semantic-parity-reference.test.mjs`

**Interfaces:**
- Consumes: repository-owned MusicXML bytes; checked-in Semantic Engine snapshot JSON.
- Produces:
  - `SEMANTIC_PARITY_REFERENCE_VERSION = '1.0.0'`
  - `SemanticParityReferenceV1`
  - `SemanticParityProvenanceV1`
  - `SemanticParityReferenceError` with code `INVALID_REFERENCE`
  - `EditorSemanticParityDiagnosticV1`
  - `validateSemanticParityReferenceV1(input: { provenance: unknown; semanticSnapshot: unknown; observedSourceSha256: string }): Readonly<SemanticParityReferenceV1>`
  - `analyzeSemanticParityMusicXmlProfileV1(musicXml: string, expectedDivisionsPerQuarter: number): Readonly<SemanticParityProfileResultV1>`

- [ ] **Step 1: Copy only reference artifacts from the pinned Semantic Engine commit**

Use exact artifacts from:
- `st-score-semantic-engine@ffc997b242fa862e180e698385cc0afb52de47a1:tests/fixtures/semantic_baseline.musicxml`
- `st-score-semantic-engine@ffc997b242fa862e180e698385cc0afb52de47a1:tests/fixtures/semantic_baseline.expected.json`

Do not copy Semantic Engine source code.

Create `provenance.json` with:
- `schemaVersion: "st-editor-semantic-parity-fixture-v1"`
- SHA-256 of the exact copied MusicXML bytes
- `semanticEngineCommit: "ffc997b242fa862e180e698385cc0afb52de47a1"`
- `semanticSnapshotSchema: "st-semantic-snapshot-v1"`
- `partituraVersion: "1.9.0"`
- `divisionsPerQuarter: 4`

- [ ] **Step 2: Write RED reference-validation tests**

Tests must prove:
- valid pinned provenance is accepted;
- wrong source SHA is rejected;
- wrong Semantic Engine commit is rejected;
- wrong snapshot schema is rejected;
- wrong Partitura version is rejected;
- `divisionsPerQuarter <= 0` is rejected;
- MusicXML with a second different `<divisions>` value returns profile `UNSUPPORTED`.

Run:
```bash
npm run build
node --test test/sem-04-editor-semantic-parity-reference.test.mjs
```

Expected: FAIL because the package/reference validator does not exist.

- [ ] **Step 3: Implement the immutable reference contract**

`SemanticParityReferenceV1` contains only:
- `provenance`;
- parsed `semanticSnapshot` as an explicitly validated minimal external evidence structure.

Validate only fields SEM-04 consumes. Do not mirror the full Python model. The caller computes the SHA-256 of the MusicXML bytes and supplies it as `observedSourceSha256`; reference validation requires exact equality with provenance before returning a usable reference.

- [ ] **Step 4: Implement fixed-divisions profile analysis**

Use the existing safe MusicXML parser surface rather than regex parsing. Scan explicit MusicXML `<divisions>` declarations:
- no positive divisions declaration → `UNSUPPORTED`;
- every declaration equals provenance `divisionsPerQuarter` → supported;
- any different value → `UNSUPPORTED`.

Also fail closed for first-profile excluded source constructs that are directly visible at XML level, including `unpitched`, `grace`, and non-controlling measures.

- [ ] **Step 5: GREEN verification**

Run:
```bash
npm run build
node --test test/sem-04-editor-semantic-parity-reference.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```text
test: pin semantic parity reference fixture
```

---

### Task 2: Project Editor Core canonical semantics into immutable comparison rows

**Files:**
- Create: `packages/editor-semantic-parity-v1/src/projection.ts`
- Modify: `packages/editor-semantic-parity-v1/src/index.ts`
- Test: `test/sem-04-editor-semantic-parity-projection.test.mjs`

**Interfaces:**
- Consumes:
  - `ScoreDocumentV3`
  - `NotationDocumentV4`
- Produces:
  - `EditorSemanticProjectionV1`
  - `EditorSemanticNoteV1`
  - `EditorSemanticContextV1`
  - `projectEditorSemanticsV1(score: ScoreDocumentV3, notation: NotationDocumentV4): Readonly<EditorSemanticProjectionResultV1>`

`EditorSemanticProjectionResultV1` is:
- `{ status: 'PASS'; projection: EditorSemanticProjectionV1 }`, or
- `{ status: 'UNSUPPORTED'; diagnostics: readonly EditorSemanticParityDiagnosticV1[] }`.

- [ ] **Step 1: Write RED projection tests for pitched notes**

Construct a small canonical V3/V4 pair and assert rows contain:
- part ordinal;
- zero-based measure index;
- staff ordinal;
- voice ordinal;
- canonical rational onset;
- canonical rational duration;
- pitch MIDI;
- deterministic occurrence ordinal;
- `tieStart`;
- `tieStop`.

Use exact MIDI examples:
- C4 → 60
- G3 → 55
- A3 → 57

Run:
```bash
npm run build
node --test test/sem-04-editor-semantic-parity-projection.test.mjs
```

Expected: FAIL because projection API does not exist.

- [ ] **Step 2: Implement pitch and exact-rational projection**

Pitch-to-MIDI mapping:
- C=0, D=2, E=4, F=5, G=7, A=9, B=11
- MIDI = `(octave + 1) * 12 + semitone + alter`

Never use float timing keys. Compare normalized rational numerator/denominator pairs.

- [ ] **Step 3: Project note/chord atoms using structural coordinates**

Flatten note events and chord note atoms. Sort deterministically by:
`partOrdinal, measureIndex, staffOrdinal, voiceOrdinal, onset, pitchMidi, occurrenceOrdinal`.

Rest events are ignored as note rows.

If two note atoms remain indistinguishable before occurrence assignment at the same supported structural coordinate, return `UNSUPPORTED` rather than relying on canonical ID ordering.

- [ ] **Step 4: Project simple tie boundary roles**

Resolve `NotationDocumentV4.notes` by Editor canonical note ID internally, but expose only booleans:
- exactly one `start` → `tieStart=true`;
- exactly one `stop` → `tieStop=true`;
- more than one start or more than one stop → `UNSUPPORTED`.

Do not expose or compare canonical IDs.

- [ ] **Step 5: Project explicit time/key/clef contexts**

- Time signatures: from V4 frame notation, keyed by measure index.
- Key signatures: from V4 staff-measure notation, keyed by measure index + staff ordinal; compare only `fifths`.
- Clefs: from V4 staff-measure notation, keyed by measure index + staff ordinal.
- Do not invent inherited entries that are not explicitly represented in canonical notation.

- [ ] **Step 6: Add Review Focus negative tests**

Tests:
- ambiguous unison coordinate → `UNSUPPORTED`;
- multiple tie starts/stops → `UNSUPPORTED`;
- sparse notation stays sparse and does not fabricate context.

- [ ] **Step 7: GREEN verification**

```bash
npm run build
node --test test/sem-04-editor-semantic-parity-projection.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit**

```text
feat: add read-only editor semantic projection
```

---

### Task 3: Compare Editor projection with Semantic Engine evidence

**Files:**
- Create: `packages/editor-semantic-parity-v1/src/comparison.ts`
- Modify: `packages/editor-semantic-parity-v1/src/index.ts`
- Test: `test/sem-04-editor-semantic-parity-comparison.test.mjs`

**Interfaces:**
- Consumes:
  - `EditorSemanticProjectionV1`
  - validated `SemanticParityReferenceV1`
- Produces:
  - `EditorSemanticComparisonStatusV1 = 'PASS' | 'MISMATCH' | 'UNSUPPORTED'`
  - `EditorSemanticParityDiagnosticCodeV1`
  - `EditorSemanticComparisonReportV1`
  - `compareEditorSemanticsV1(editor: EditorSemanticProjectionV1, reference: SemanticParityReferenceV1): Readonly<EditorSemanticComparisonReportV1>`

- [ ] **Step 1: Write RED baseline comparison test**

For matching handcrafted Editor projection and pinned semantic evidence:
- status = `PASS`;
- diagnostics = empty.

Run focused test and verify RED.

- [ ] **Step 2: Implement semantic timing conversion**

Convert:
```text
semantic onset_div / (4 * divisionsPerQuarter)
semantic duration_div / (4 * divisionsPerQuarter)
```

Reduce to canonical rational pairs using integer arithmetic.

Never convert through JavaScript floating point.

- [ ] **Step 3: Implement structural note matching**

Use two deterministic passes:
1. exact-match pass on the approved full key: part ordinal, measure index, staff ordinal, voice ordinal, rational onset, pitch MIDI, occurrence ordinal;
2. mismatch-classification fallback on the same structural slot without pitch, but only when exactly one unmatched candidate exists on each side.

This preserves the approved exact key while allowing a changed pitch to be reported as `PITCH_MISMATCH` rather than collapsing into an unexplained missing row. Ambiguous fallback candidates return `UNSUPPORTED`.

After pairing, compare:
- pitch;
- duration;
- tie-start role;
- tie-stop role.

Raw `source_id`, Editor event IDs, note IDs, measure IDs, and `SemanticAddressV3` are excluded from equality.

- [ ] **Step 4: Implement context comparison**

Compare:
- part count;
- measure count;
- time signatures;
- key-signature fifths;
- clef sign/line/octave change.

Semantic key `mode` is ignored in SEM-04 because Editor Core does not represent it canonically.

- [ ] **Step 5: Add mismatch tests**

Independently alter only one field per case and assert deterministic diagnostics:
- `PART_COUNT_MISMATCH`
- `MEASURE_COUNT_MISMATCH`
- `NOTE_COUNT_MISMATCH`
- `PITCH_MISMATCH`
- `ONSET_MISMATCH`
- `DURATION_MISMATCH`
- `VOICE_MISMATCH`
- `STAFF_MISMATCH`
- `TIE_ROLE_MISMATCH`
- `TIME_SIGNATURE_MISMATCH`
- `KEY_SIGNATURE_MISMATCH`
- `CLEF_MISMATCH`

The tests must mutate independent test data, not derive expected mismatches from comparator output. `PITCH_MISMATCH` must specifically exercise the unique structural-slot fallback described above.

- [ ] **Step 6: Ensure deterministic diagnostic ordering**

Sort diagnostics by fixed category order, then structural location. Repeated comparison of the same inputs must produce byte-stable JSON-stringifiable output.

- [ ] **Step 7: GREEN verification**

```bash
npm run build
node --test test/sem-04-editor-semantic-parity-comparison.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit**

```text
feat: compare editor and semantic reference projections
```

---

### Task 4: Prove parity through the real Editor Core MusicXML app-import path

**Files:**
- Create: `test/sem-04-editor-semantic-parity-e2e.test.mjs`
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`

**Interfaces:**
- Consumes:
  - `openMusicXmlScoreEditorAppDocument(musicXml, options)`
  - Task 1 reference bundle
  - Task 2 projection
  - Task 3 comparator
- Produces: no new product API; qualification evidence only.

- [ ] **Step 1: Write RED end-to-end test**

Test flow:
1. read the checked-in MusicXML fixture;
2. read/validate provenance + semantic snapshot;
3. verify fixture source SHA;
4. verify fixed-divisions profile;
5. open MusicXML using `openMusicXmlScoreEditorAppDocument(...)` with deterministic SHA provider;
6. capture the exact V4 score + notation from `document.session.history.present`;
7. record revision/history state before comparison;
8. project Editor semantics;
9. compare with Semantic reference;
10. assert `PASS`;
11. assert revision/history state is byte-equivalent after comparison.

Expected RED before all interfaces are wired.

- [ ] **Step 2: Add unsupported end-to-end fixture case**

Use a small test-local MusicXML containing a mid-score divisions change and assert `UNSUPPORTED` before semantic equality is attempted.

No new checked-in reference snapshot is needed for this negative case.

- [ ] **Step 3: Add authority regression assertions**

Assert SEM-04 package imports do not reference:
- browser package;
- renderer package;
- Editor session mutation packages;
- network libraries;
- Python/Partitura.

Assert `package.json` dependencies remain unchanged.

- [ ] **Step 4: Update docs truthfully**

README/ARCHITECTURE should state:
- SEM-04 is CI/reference evidence only;
- Editor canonical/history/identity authorities are unchanged;
- no runtime Semantic Engine/Partitura integration exists;
- no automatic correction is authorized.

- [ ] **Step 5: Focused verification**

```bash
npm run build
node --test   test/sem-04-editor-semantic-parity-reference.test.mjs   test/sem-04-editor-semantic-parity-projection.test.mjs   test/sem-04-editor-semantic-parity-comparison.test.mjs   test/sem-04-editor-semantic-parity-e2e.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Full repository verification**

```bash
npm run validate
npm test
```

Require fresh exact-head GitHub Actions PASS for Node 18 / 20 / 22 before qualification.

Do not claim physical-device evidence; SEM-04 has no user-facing runtime surface.

- [ ] **Step 7: Whole-branch Guardrails review**

Verify:
- only approved SEM-04 files changed;
- no consumer/runtime dependency on Semantic Engine;
- no package dependency added for Partitura/Python/network;
- no mutation/history path added;
- no Render/deploy configuration changed;
- all expected parity values originate from the pinned independent reference artifact;
- diagnostics are deterministic and fail closed.

Important/Critical findings require test-first correction before closeout.

- [ ] **Step 8: Commit**

```text
test: qualify Editor Core semantic parity harness
```

---

## Completion report

Use:

```text
COMPLETED: SEM-04 — Editor Core read-only semantic parity
RESULT: <observable parity result>
VERIFICATION: <focused tests + full Node matrix + exact head>
NOTION: <updated spec/plan>
LINEAR: <updated issues>
RENDER: UNCHANGED
BLOCKERS: <none or exact blocker>
NEXT: OMR Correction read-only semantic evidence architecture gate
NEXT START CONDITION: separate explicit user approval
```

## Merge boundary

Implementation-plan approval authorizes branch execution only.

It does **not** authorize:
- merging PR #208 or a later implementation PR to `main`;
- deployment;
- Render changes;
- browser/product cutover;
- runtime Semantic Engine connection;
- automatic correction;
- starting OMR integration.

## Execution recommendation

**Native execution is recommended** because Tasks 1–4 are sequentially coupled through one small public parity contract, and no independent Codex environment was available during the previous Semantic Engine implementation. A whole-branch Guardrails review remains mandatory before merge.
