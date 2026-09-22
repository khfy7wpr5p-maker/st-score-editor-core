# P10-3A Professional Key-Aware Pitch Transpose Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bounded key-aware semitone (`±1..±12`) and diatonic (`±1..±7`) transpose over existing professional `EVENT_SPAN` / `EVENT_SET` selections, with deterministic spelling, atomic accidental metadata, one-history-step Undo/Redo, browser/UI integration, WebKit qualification, and Sonar-gated delivery.

**Architecture:** Reuse P08 `ProfessionalSelectionV1`, `EditorSessionV4`, `EditorHistoryV4`, the professional workstation, and browser adoption boundary. Add a focused pitch-theory helper plus a new professional pitch-transpose engine that owns admission/candidate generation but not history; a session adapter commits the candidate exactly once. UI remains a command surface and never derives target membership from DOM/renderer geometry.

**Tech Stack:** TypeScript 6.0.3, Node.js 18/20/22, `node:test`, esbuild 0.28.2, Playwright 1.62.1 WebKit, GitHub Actions, SonarQube Cloud Automatic Analysis.

**Spec:** `docs/superpowers/specs/2026-09-22-p10-3a-professional-pitch-transpose-design.md`

## Global Constraints

- Semitone delta is exactly `-12..-1 | +1..+12`; zero is invalid.
- Diatonic steps are exactly `-7..-1 | +1..+7`; zero is invalid.
- Effective key signature is staff-local and inherited backward within the same content staff; default is `{ fifths: 0 }`.
- Canonical target `Pitch.alter` must remain an integer in `-2..+2`.
- Canonical octave must remain inside the existing score-model range.
- `ScoreDocumentV3 + NotationDocumentV4` remain canonical.
- Professional selection remains noncanonical and current-revision-bound.
- Renderer coordinates, DOM order, SVG geometry, and browser presentation state have no authoring authority.
- Tied selected notes fail closed.
- Grace-anchored selected events fail closed.
- REST targets remain unchanged.
- One accepted transpose action creates exactly one `EditorHistoryV4` revision.
- Event IDs, note IDs, chord membership, onset, and duration are preserved.
- Canonical pitch and explicit accidental-display metadata are updated atomically.
- No full measure-local accidental carry/engraving engine is introduced.
- No key-signature mutation is introduced.
- No release, production-default cutover, public-write cutover, or SesliTab cutover is authorized.
- SonarQube Cloud Automatic Analysis remains the only Sonar integration; do not add a duplicate scanner, `SONAR_TOKEN`, or `sonar-project.properties`.

## Review Focus

1. **Negative octave arithmetic near C/B:** moving below C0 or across B/C must use floor division, not JavaScript remainder semantics that can mis-spell negative-octave notes. Task 1 tests C→B and B→C plus octave `-1` boundaries.
2. **Key-signature inheritance across measures:** a later measure with `keySignature:null` must inherit the nearest earlier explicit staff-local key and must never borrow another staff's key. Task 1 tests both inheritance and staff isolation.
3. **Existing explicit accidental metadata on selected notes:** transpose must replace only the accidental field while preserving ties/slurs and must create/remove a note-notation entry correctly when accidental becomes non-null/null. Task 2 tests upsert/remove behavior.
4. **Discontiguous EVENT_SET with REST and chord targets:** only explicitly selected pitched notes may change; REST and intervening unselected events must be untouched. Task 2 tests exact changed IDs and unchanged snapshots.
5. **Browser no-save / stale-range behavior after commit:** the toolbar must clear transient teacher range after a successful semitone/diatonic commit and reject an incomplete/stale range without history mutation. Task 5 and Task 6 cover controller and WebKit behavior.

---

## File Map

### New production files

- `packages/editor-professional-pitch-transpose-v1/src/pitch-theory.ts`
  - Pure key-signature, chromatic-pitch, diatonic-shift, spelling ranking, and accidental-display helpers.
- `packages/editor-professional-pitch-transpose-v1/src/index.ts`
  - Current-selection validation, relation safety, read-only admission, candidate execution, notation update/rebind, and selection rebind.
- `packages/editor-session-professional-pitch-transpose-v1/src/index.ts`
  - One-history-step session commit and renderer-request refresh.

### Modified production files

- `packages/score-editor-professional-workstation-v1/src/index.ts`
  - Add semitone/diatonic workstation operations.
- `packages/score-editor-browser-professional-v1/src/index.ts`
  - Add browser bridge methods.
- `packages/score-editor-browser-professional-ui-v1/src/index.ts`
  - Add four bounded range-toolbar controls and controller methods.
- `packages/score-editor-browser-professional-workstation-v1/src/index.ts`
  - Profile capability flags only; no new mutation authority.

### New tests

- `test/p10-3a-professional-pitch-theory-v1.test.mjs`
- `test/p10-3a-professional-pitch-transpose-v1.test.mjs`
- `test/p10-3a-professional-pitch-transpose-session-v1.test.mjs`
- `test/p10-3a-browser-professional-pitch-transpose-v1.test.mjs`
- `test/p10-3a-professional-pitch-transpose-reality.test.mjs`

### Modified tests

- `test/p08d-professional-workstation-controller-v1.test.mjs`
- `test/p08e2-professional-range-toolbar-v1.test.mjs`
- `test/p10-1-professional-workstation-v1.test.mjs`

### New browser qualification

- `scripts/p10-3a-webkit-professional-pitch-transpose-regression.mjs`
- `.github/workflows/p10-3a-professional-pitch-transpose-webkit.yml`

### Documentation updates

- `docs/p08b-professional-bulk-authoring.md`
- `docs/superpowers/specs/2026-09-19-p10-advanced-score-workstation-design.md`
- `ROADMAP.md`
- `docs/st-score-editor-app-productization.md`
- `docs/st-score-editor-app-productization.json`

---

### Task 1: Pure Key / Pitch Theory Kernel

**Files:**
- Create: `packages/editor-professional-pitch-transpose-v1/src/pitch-theory.ts`
- Create: `test/p10-3a-professional-pitch-theory-v1.test.mjs`

**Interfaces:**
- Consumes:
  - `Pitch` from `packages/score-model/src/index.ts`
  - `KeySignature` and `AccidentalDisplay` from `packages/notation-structure/src/index.ts`
- Produces:
  - `signatureAlterForStepV1(step, fifths): -1 | 0 | 1`
  - `pitchChromaticValueV1(pitch): number`
  - `transposeDiatonicPitchV1(source, fifths, steps): Readonly<Pitch>`
  - `transposeSemitonePitchV1(source, fifths, delta): Readonly<Pitch>`
  - `accidentalDisplayForPitchV1(pitch, fifths): AccidentalDisplay | null`

- [ ] **Step 1: Write RED theory tests for key-signature accidental maps**

Create `test/p10-3a-professional-pitch-theory-v1.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PitchTheoryV1Error,
  accidentalDisplayForPitchV1,
  signatureAlterForStepV1,
  transposeDiatonicPitchV1,
  transposeSemitonePitchV1
} from '../dist/packages/editor-professional-pitch-transpose-v1/src/pitch-theory.js';

test('P10-3A resolves canonical circle-of-fifths signature alterations', () => {
  assert.equal(signatureAlterForStepV1('F', 1), 1);
  assert.equal(signatureAlterForStepV1('C', 2), 1);
  assert.equal(signatureAlterForStepV1('G', 2), 0);
  assert.equal(signatureAlterForStepV1('B', -1), -1);
  assert.equal(signatureAlterForStepV1('E', -2), -1);
  assert.equal(signatureAlterForStepV1('A', -2), 0);
  assert.equal(signatureAlterForStepV1('C', 0), 0);
});

test('P10-3A rejects invalid key signature bounds', () => {
  assert.throws(
    () => signatureAlterForStepV1('C', 8),
    error => error instanceof PitchTheoryV1Error && error.code === 'KEY_CONTEXT_INVALID'
  );
});
```

- [ ] **Step 2: Run the focused test and prove RED**

Run:

```bash
npm run build
node --test test/p10-3a-professional-pitch-theory-v1.test.mjs
```

Expected: build/test fails because `pitch-theory.ts` and exports do not exist.

- [ ] **Step 3: Implement exact key-signature helpers and safe pitch arithmetic**

Create `packages/editor-professional-pitch-transpose-v1/src/pitch-theory.ts` with these constants and public types:

```ts
import type { Pitch, PitchStep } from '../../score-model/src/index.js';
import type { AccidentalDisplay } from '../../notation-structure/src/index.js';

const STEPS = ['C','D','E','F','G','A','B'] as const;
const NATURAL = Object.freeze({ C:0, D:2, E:4, F:5, G:7, A:9, B:11 });
const SHARP_ORDER = ['F','C','G','D','A','E','B'] as const;
const FLAT_ORDER = ['B','E','A','D','G','C','F'] as const;
const MIN_OCTAVE = -1;
const MAX_OCTAVE = 9;

export type PitchTheoryV1ErrorCode =
  | 'KEY_CONTEXT_INVALID'
  | 'INVALID_SEMITONE_DELTA'
  | 'INVALID_DIATONIC_STEPS'
  | 'PITCH_RANGE_EXCEEDED'
  | 'SPELLING_UNREPRESENTABLE';

export class PitchTheoryV1Error extends Error {
  readonly code: PitchTheoryV1ErrorCode;
  constructor(message: string, code: PitchTheoryV1ErrorCode) {
    super(message);
    this.name = 'PitchTheoryV1Error';
    this.code = code;
    Object.freeze(this);
  }
}

export const signatureAlterForStepV1 = (
  step: PitchStep,
  fifths: number
): -1 | 0 | 1 => {
  if (!Number.isInteger(fifths) || fifths < -7 || fifths > 7) {
    throw new PitchTheoryV1Error('Key signature fifths is outside -7..+7.', 'KEY_CONTEXT_INVALID');
  }
  if (fifths > 0 && SHARP_ORDER.slice(0, fifths).includes(step as never)) return 1;
  if (fifths < 0 && FLAT_ORDER.slice(0, -fifths).includes(step as never)) return -1;
  return 0;
};

export const pitchChromaticValueV1 = (pitch: Pitch): number =>
  pitch.octave * 12 + NATURAL[pitch.step] + pitch.alter;
```

Use explicit mathematical floor/mod helpers so negative octave arithmetic is deterministic:

```ts
const floorDiv = (value: number, divisor: number): number => Math.floor(value / divisor);
const mod = (value: number, divisor: number): number =>
  ((value % divisor) + divisor) % divisor;
```

- [ ] **Step 4: Add RED tests for diatonic behavior, B/C boundaries, and negative octaves**

Append:

```js
test('P10-3A diatonic transpose preserves key-relative chromatic deviation', () => {
  assert.deepEqual(
    transposeDiatonicPitchV1({ step:'F', alter:1, octave:4 }, 1, 1),
    { step:'G', alter:0, octave:4 }
  );
  assert.deepEqual(
    transposeDiatonicPitchV1({ step:'F', alter:0, octave:4 }, 1, 1),
    { step:'G', alter:-1, octave:4 }
  );
  assert.deepEqual(
    transposeDiatonicPitchV1({ step:'B', alter:0, octave:4 }, 0, 1),
    { step:'C', alter:0, octave:5 }
  );
  assert.deepEqual(
    transposeDiatonicPitchV1({ step:'C', alter:0, octave:0 }, 0, -1),
    { step:'B', alter:0, octave:-1 }
  );
});

test('P10-3A enforces diatonic interval and spelling bounds', () => {
  assert.throws(
    () => transposeDiatonicPitchV1({ step:'C', alter:0, octave:4 }, 0, 0),
    error => error.code === 'INVALID_DIATONIC_STEPS'
  );
  assert.throws(
    () => transposeDiatonicPitchV1({ step:'F', alter:2, octave:4 }, 7, 1),
    error => error.code === 'SPELLING_UNREPRESENTABLE'
  );
});
```

- [ ] **Step 5: Implement diatonic transpose exactly as the spec states**

Use absolute diatonic index:

```ts
export const transposeDiatonicPitchV1 = (
  source: Pitch,
  fifths: number,
  steps: number
): Readonly<Pitch> => {
  if (!Number.isInteger(steps) || steps === 0 || Math.abs(steps) > 7) {
    throw new PitchTheoryV1Error('Diatonic steps must be -7..-1 or +1..+7.', 'INVALID_DIATONIC_STEPS');
  }

  const sourceStepIndex = STEPS.indexOf(source.step);
  const sourceSignatureAlter = signatureAlterForStepV1(source.step, fifths);
  const deviation = source.alter - sourceSignatureAlter;
  const targetAbsoluteStep = source.octave * 7 + sourceStepIndex + steps;
  const targetOctave = floorDiv(targetAbsoluteStep, 7);
  const targetStep = STEPS[mod(targetAbsoluteStep, 7)]!;
  const targetAlter = signatureAlterForStepV1(targetStep, fifths) + deviation;

  if (targetOctave < MIN_OCTAVE || targetOctave > MAX_OCTAVE) {
    throw new PitchTheoryV1Error('Target octave is outside canonical range.', 'PITCH_RANGE_EXCEEDED');
  }
  if (!Number.isInteger(targetAlter) || targetAlter < -2 || targetAlter > 2) {
    throw new PitchTheoryV1Error('Target spelling requires unsupported accidental.', 'SPELLING_UNREPRESENTABLE');
  }
  return Object.freeze({ step: targetStep, alter: targetAlter, octave: targetOctave });
};
```

- [ ] **Step 6: Add RED tests for semitone deterministic spelling in neutral/sharp/flat keys**

Append:

```js
test('P10-3A semitone transpose uses deterministic key-aware spelling', () => {
  assert.deepEqual(
    transposeSemitonePitchV1({ step:'C', alter:0, octave:4 }, 0, 1),
    { step:'C', alter:1, octave:4 }
  );
  assert.deepEqual(
    transposeSemitonePitchV1({ step:'D', alter:0, octave:4 }, 0, -1),
    { step:'D', alter:-1, octave:4 }
  );
  assert.deepEqual(
    transposeSemitonePitchV1({ step:'E', alter:0, octave:4 }, 1, 1),
    { step:'F', alter:1, octave:4 }
  );
  assert.deepEqual(
    transposeSemitonePitchV1({ step:'A', alter:0, octave:4 }, -1, 1),
    { step:'B', alter:-1, octave:4 }
  );
  assert.deepEqual(
    transposeSemitonePitchV1({ step:'B', alter:0, octave:4 }, 0, 1),
    { step:'C', alter:0, octave:5 }
  );
});

test('P10-3A semitone transpose rejects zero, out-of-range and pitch overflow', () => {
  assert.throws(
    () => transposeSemitonePitchV1({ step:'C', alter:0, octave:4 }, 0, 0),
    error => error.code === 'INVALID_SEMITONE_DELTA'
  );
  assert.throws(
    () => transposeSemitonePitchV1({ step:'C', alter:0, octave:4 }, 0, 13),
    error => error.code === 'INVALID_SEMITONE_DELTA'
  );
  assert.throws(
    () => transposeSemitonePitchV1({ step:'B', alter:2, octave:9 }, 0, 12),
    error => error.code === 'PITCH_RANGE_EXCEEDED'
  );
});
```

- [ ] **Step 7: Implement semitone candidate enumeration and ranking**

Generate candidates by exact chromatic value, not ad-hoc name tables:

```ts
interface Candidate {
  readonly pitch: Readonly<Pitch>;
  readonly signatureMatch: boolean;
  readonly accidentalMagnitude: number;
  readonly directionRank: number;
  readonly letterRank: number;
}

export const transposeSemitonePitchV1 = (
  source: Pitch,
  fifths: number,
  delta: number
): Readonly<Pitch> => {
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 12) {
    throw new PitchTheoryV1Error('Semitone delta must be -12..-1 or +1..+12.', 'INVALID_SEMITONE_DELTA');
  }
  signatureAlterForStepV1(source.step, fifths);
  const targetValue = pitchChromaticValueV1(source) + delta;
  const candidates: Candidate[] = [];

  for (const [letterRank, step] of STEPS.entries()) {
    for (let octave = MIN_OCTAVE; octave <= MAX_OCTAVE; octave += 1) {
      for (let alter = -2; alter <= 2; alter += 1) {
        const pitch = { step, alter, octave } as const;
        if (pitchChromaticValueV1(pitch) !== targetValue) continue;
        const sig = signatureAlterForStepV1(step, fifths);
        candidates.push({
          pitch: Object.freeze({ ...pitch }),
          signatureMatch: alter === sig,
          accidentalMagnitude: Math.abs(alter),
          directionRank: delta > 0
            ? (alter > 0 ? 0 : alter === 0 ? 1 : 2)
            : (alter < 0 ? 0 : alter === 0 ? 1 : 2),
          letterRank
        });
      }
    }
  }

  if (candidates.length === 0) {
    throw new PitchTheoryV1Error('Target pitch is outside canonical range.', 'PITCH_RANGE_EXCEEDED');
  }

  candidates.sort((a, b) =>
    Number(b.signatureMatch) - Number(a.signatureMatch) ||
    a.accidentalMagnitude - b.accidentalMagnitude ||
    a.directionRank - b.directionRank ||
    a.letterRank - b.letterRank
  );
  return candidates[0]!.pitch;
};
```

- [ ] **Step 8: Add RED tests for key-relative accidental display**

Append:

```js
test('P10-3A accidental display is key-relative but represents absolute canonical alter', () => {
  assert.equal(accidentalDisplayForPitchV1({ step:'F', alter:1, octave:4 }, 1), null);
  assert.equal(accidentalDisplayForPitchV1({ step:'F', alter:0, octave:4 }, 1), 'natural');
  assert.equal(accidentalDisplayForPitchV1({ step:'C', alter:1, octave:4 }, 0), 'sharp');
  assert.equal(accidentalDisplayForPitchV1({ step:'D', alter:-1, octave:4 }, 0), 'flat');
  assert.equal(accidentalDisplayForPitchV1({ step:'C', alter:2, octave:4 }, 0), 'double-sharp');
  assert.equal(accidentalDisplayForPitchV1({ step:'D', alter:-2, octave:4 }, 0), 'double-flat');
});
```

- [ ] **Step 9: Implement accidental display mapping**

```ts
export const accidentalDisplayForPitchV1 = (
  pitch: Pitch,
  fifths: number
): AccidentalDisplay | null => {
  const signatureAlter = signatureAlterForStepV1(pitch.step, fifths);
  if (pitch.alter === signatureAlter) return null;
  if (pitch.alter === 0) return 'natural';
  if (pitch.alter === 1) return 'sharp';
  if (pitch.alter === -1) return 'flat';
  if (pitch.alter === 2) return 'double-sharp';
  if (pitch.alter === -2) return 'double-flat';
  throw new PitchTheoryV1Error('Pitch alteration is outside notation profile.', 'SPELLING_UNREPRESENTABLE');
};
```

- [ ] **Step 10: Run focused theory suite GREEN**

Run:

```bash
npm run build
node --test test/p10-3a-professional-pitch-theory-v1.test.mjs
```

Expected: PASS.

- [ ] **Step 11: Commit Task 1**

```bash
git add packages/editor-professional-pitch-transpose-v1/src/pitch-theory.ts   test/p10-3a-professional-pitch-theory-v1.test.mjs
git commit -m "feat(P10-3A): add key-aware pitch theory kernel"
```

---

### Task 2: Professional Admission + Atomic Score/Notation Candidate

**Files:**
- Create: `packages/editor-professional-pitch-transpose-v1/src/index.ts`
- Create: `test/p10-3a-professional-pitch-transpose-v1.test.mjs`

**Interfaces:**
- Consumes:
  - `ProfessionalSelectionV1`
  - `ScoreDocumentV3`
  - `NotationDocumentV4`
  - Task 1 theory helpers
- Produces:
  - `ProfessionalPitchTransposeAdmissionV1`
  - `analyzeProfessionalSemitoneTransposeV1(...)`
  - `analyzeProfessionalDiatonicTransposeV1(...)`
  - `executeProfessionalPitchTransposeV1(...)`
  - `ProfessionalPitchTransposeV1Error`

Define the stable public admission shape:

```ts
export type ProfessionalPitchTransposeModeV1 = 'SEMITONE' | 'DIATONIC';

export interface ProfessionalPitchTransposeNotePlanV1 {
  readonly eventId: string;
  readonly noteId: string;
  readonly sourcePitch: Readonly<Pitch>;
  readonly targetPitch: Readonly<Pitch>;
  readonly effectiveKeyFifths: number;
  readonly sourceAccidental: AccidentalDisplay | null;
  readonly targetAccidental: AccidentalDisplay | null;
}

export interface ProfessionalPitchTransposeAdmissionV1 {
  readonly version: '1.0.0';
  readonly kind: 'PROFESSIONAL_PITCH_TRANSPOSE_ADMISSION';
  readonly admitted: true;
  readonly sourceRevisionId: string;
  readonly selectionKind: 'EVENT_SPAN' | 'EVENT_SET';
  readonly mode: ProfessionalPitchTransposeModeV1;
  readonly interval: number;
  readonly targetEventIds: readonly string[];
  readonly targetNotePlans: readonly ProfessionalPitchTransposeNotePlanV1[];
  readonly selectedEventCount: number;
  readonly pitchedEventCount: number;
  readonly restEventCount: number;
  readonly noteCount: number;
  readonly canonicalMutationAuthority: false;
  readonly historyMutationAuthority: false;
  readonly rendererCoordinateAuthority: false;
  readonly domAuthoringAuthority: false;
}
```

- [ ] **Step 1: Write RED fixture tests for effective key inheritance and staff isolation**

Create a two-measure, two-staff fixture where:

- staff 1 measure 1 declares `fifths: 2`;
- staff 1 measure 2 has `keySignature:null`;
- staff 2 measure 1 declares `fifths: -2`;
- staff 2 measure 2 has `keySignature:null`.

Test only staff 1 selection:

```js
test('P10-3A resolves nearest prior key signature only within the selected content staff', () => {
  const { score, notation } = multiMeasureKeyFixture();
  const selection = createEventSpanProfessionalSelectionV1(
    score,
    eventAddress(score, 's1-m2-e1'),
    eventAddress(score, 's1-m2-e2')
  );

  const admission = analyzeProfessionalDiatonicTransposeV1(
    score, notation, selection, 1
  );

  assert.equal(admission.mode, 'DIATONIC');
  assert.equal(admission.targetNotePlans.every(plan => plan.effectiveKeyFifths === 2), true);
});
```

Add a fixture with no key declaration and assert `effectiveKeyFifths === 0`.

- [ ] **Step 2: Run focused test and prove RED**

```bash
npm run build
node --test test/p10-3a-professional-pitch-transpose-v1.test.mjs
```

Expected: FAIL because analyzers do not exist.

- [ ] **Step 3: Implement current-selection revalidation and effective key resolver**

Follow P08 octave-transpose selection fact comparison. Implement:

```ts
const effectiveKeyFifthsForEvent = (
  score: ScoreDocumentV3,
  notation: NotationDocumentV4,
  target: EventAddressV3
): number => {
  const part = score.parts.find(item => item.id === target.partId);
  const staff = part?.staves.find(item => item.id === target.staffId);
  if (staff === undefined || staff.role === 'tablature-linked') {
    throw new ProfessionalPitchTransposeV1Error(
      'Pitch transpose requires a content staff target.',
      'KEY_CONTEXT_INVALID'
    );
  }

  const measureIndex = staff.measures.findIndex(item => item.id === target.measureId);
  if (measureIndex < 0) {
    throw new ProfessionalPitchTransposeV1Error('Target measure is missing.', 'KEY_CONTEXT_INVALID');
  }

  const byMeasure = new Map(
    notation.measures.map(entry => [entry.target.measureId, entry.notation.keySignature])
  );

  for (let index = measureIndex; index >= 0; index -= 1) {
    const explicit = byMeasure.get(staff.measures[index]!.id);
    if (explicit !== undefined && explicit !== null) return explicit.fifths;
  }
  return 0;
};
```

Important: do not use another staff's notation and do not infer from MusicXML source text.

- [ ] **Step 4: Add RED tests for NOTE, CHORD, REST, EVENT_SPAN and EVENT_SET**

Include assertions like:

```js
test('P10-3A semitone EVENT_SPAN plans NOTE and all CHORD tones while REST remains unchanged', () => {
  const { score, notation } = mixedContentFixture();
  const selection = createEventSpanProfessionalSelectionV1(
    score,
    eventAddress(score, 'event-1'),
    eventAddress(score, 'event-4')
  );

  const admission = analyzeProfessionalSemitoneTransposeV1(score, notation, selection, 1);

  assert.equal(admission.selectedEventCount, 4);
  assert.equal(admission.pitchedEventCount, 3);
  assert.equal(admission.restEventCount, 1);
  assert.deepEqual(admission.targetEventIds, ['event-1','event-2','event-3','event-4']);
  assert.deepEqual(
    admission.targetNotePlans.map(plan => plan.noteId),
    ['note-1','note-3a','note-3b','note-4']
  );
});

test('P10-3A EVENT_SET mutates only explicit targets', () => {
  const selection = createEventSetProfessionalSelectionV1(score, [
    eventAddress(score, 'event-1'),
    eventAddress(score, 'event-3')
  ]);
  const admission = analyzeProfessionalDiatonicTransposeV1(score, notation, selection, -1);
  assert.deepEqual(admission.targetEventIds, ['event-1','event-3']);
});
```

- [ ] **Step 5: Implement admission plan generation**

Use one internal analyzer:

```ts
const analyzeProfessionalPitchTransposeV1 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  selectionInput: ProfessionalSelectionV1,
  mode: ProfessionalPitchTransposeModeV1,
  interval: number
): Readonly<ProfessionalPitchTransposeAdmissionV1> => {
  const score = createScoreDocumentV3(scoreInput);
  const notation = createNotationDocumentV4(score, notationInput);
  const selection = requireCurrentSelection(score, selectionInput);
  const noteNotation = new Map(notation.notes.map(entry => [entry.target.noteId, entry.notation]));
  const graceAnchors = graceAnchoredEventIds(score);
  const plans: ProfessionalPitchTransposeNotePlanV1[] = [];

  // Iterate exact selection.targets only.
  // REST: count only.
  // NOTE/CHORD: reject grace anchor, reject ties, resolve key, call Task 1 theory,
  // compute source/target accidental display, freeze exact plan.
};
```

Public wrappers:

```ts
export const analyzeProfessionalSemitoneTransposeV1 = (
  score: ScoreDocumentV3,
  notation: NotationDocumentV4,
  selection: ProfessionalSelectionV1,
  delta: number
) => analyzeProfessionalPitchTransposeV1(score, notation, selection, 'SEMITONE', delta);

export const analyzeProfessionalDiatonicTransposeV1 = (
  score: ScoreDocumentV3,
  notation: NotationDocumentV4,
  selection: ProfessionalSelectionV1,
  steps: number
) => analyzeProfessionalPitchTransposeV1(score, notation, selection, 'DIATONIC', steps);
```

- [ ] **Step 6: Add RED relation-safety tests**

```js
test('P10-3A rejects tied selected notes before mutation', () => {
  const { score, notation, selection } = tiedFixture();
  assert.throws(
    () => analyzeProfessionalSemitoneTransposeV1(score, notation, selection, 1),
    error => error instanceof ProfessionalPitchTransposeV1Error &&
      error.code === 'TIE_RELATION_UNSUPPORTED'
  );
});

test('P10-3A rejects selected grace-anchor events before mutation', () => {
  const { score, notation, selection } = graceAnchorFixture();
  assert.throws(
    () => analyzeProfessionalDiatonicTransposeV1(score, notation, selection, 1),
    error => error.code === 'GRACE_RELATION_UNSUPPORTED'
  );
});
```

Also test all-REST selection -> `NO_PITCHED_TARGETS`.

- [ ] **Step 7: Add RED atomic accidental-notation tests**

Cover all three notation cases:

1. existing note notation must preserve ties/slurs and replace only `accidental`;
2. no existing note notation + non-null target accidental -> create entry with empty ties/slurs;
3. existing entry whose only meaningful field becomes `accidental:null` may remain as a valid explicit default entry; do not delete unrelated notation.

Use:

```js
test('P10-3A updates canonical pitch and accidental metadata atomically', () => {
  const admission = analyzeProfessionalSemitoneTransposeV1(score, notation, selection, 1);
  const result = executeProfessionalPitchTransposeV1(
    score, notation, selection, admission, { nextRevisionId:'rev:p10-3a-2' }
  );

  assert.deepEqual(noteById(result.score, 'note-1').pitch, { step:'F', alter:0, octave:4 });
  assert.equal(noteNotationById(result.notation, 'note-1').accidental, 'natural');
  assert.deepEqual(noteNotationById(result.notation, 'note-1').slurs, originalSlurs);
});
```

- [ ] **Step 8: Implement exact score mutation, notation accidental upsert, and rebind**

Required implementation shape:

```ts
export interface ProfessionalPitchTransposeOptionsV1 {
  readonly nextRevisionId: string;
}

export const executeProfessionalPitchTransposeV1 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  selectionInput: ProfessionalSelectionV1,
  admissionInput: ProfessionalPitchTransposeAdmissionV1,
  options: ProfessionalPitchTransposeOptionsV1
): Readonly<ProfessionalPitchTransposeResultV1> => {
  // 1. re-run the matching analyzer from current score/notation/selection;
  // 2. deep-compare regenerated admission to admissionInput;
  // 3. require a fresh stable nextRevisionId;
  // 4. apply every note plan exactly once;
  // 5. create direct-child ScoreDocumentV3;
  // 6. rebind all existing notation targets;
  // 7. replace/upsert only changed-note accidental metadata;
  // 8. preserve frames/measures/events/grace/cross-staff entries;
  // 9. createNotationDocumentV4 on the candidate;
  // 10. re-create the professional selection against the new revision;
  // 11. return immutable result with changed event/note IDs.
};
```

When creating a new normal-note notation entry, use the valid current shape:

```ts
{
  target: reboundNoteAddress,
  notation: {
    accidental: targetAccidental,
    ties: [],
    slurs: []
  }
}
```

Never write grace-note notation for normal notes.

- [ ] **Step 9: Add tampered-admission and exact-apply tests**

```js
test('P10-3A rejects a tampered admission before candidate mutation', () => {
  const admission = analyzeProfessionalSemitoneTransposeV1(score, notation, selection, 1);
  const tampered = structuredClone(admission);
  tampered.targetNotePlans[0].targetPitch.octave += 1;

  assert.throws(
    () => executeProfessionalPitchTransposeV1(
      score, notation, selection, tampered, { nextRevisionId:'rev:tampered' }
    ),
    error => error.code === 'ADMISSION_STALE_OR_TAMPERED'
  );
});

test('P10-3A preserves unselected canonical content exactly', () => {
  const before = snapshotUnselected(score, notation, ['event-2','event-4']);
  const result = executeProfessionalPitchTransposeV1(...);
  assert.deepEqual(snapshotUnselected(result.score, result.notation, ['event-2','event-4']), before);
});
```

- [ ] **Step 10: Run Task 1 + Task 2 focused suites GREEN**

```bash
npm run build
node --test   test/p10-3a-professional-pitch-theory-v1.test.mjs   test/p10-3a-professional-pitch-transpose-v1.test.mjs
```

Expected: PASS.

- [ ] **Step 11: Commit Task 2**

```bash
git add packages/editor-professional-pitch-transpose-v1/src/index.ts   test/p10-3a-professional-pitch-transpose-v1.test.mjs
git commit -m "feat(P10-3A): add professional pitch transpose engine"
```

---

### Task 3: Session / History Adapter

**Files:**
- Create: `packages/editor-session-professional-pitch-transpose-v1/src/index.ts`
- Create: `test/p10-3a-professional-pitch-transpose-session-v1.test.mjs`

**Interfaces:**
- Consumes:
  - `executeProfessionalPitchTransposeV1`
  - `ProfessionalPitchTransposeAdmissionV1`
  - `ProfessionalPitchTransposeOptionsV1`
  - `EditorSessionStateV4`
- Produces:
  - `commitSessionProfessionalPitchTransposeV1(...)`
  - `ProfessionalPitchTransposeSessionResultV1`

- [ ] **Step 1: Write RED one-history-step Undo/Redo test**

```js
test('P10-3A session commit creates exactly one unified V4 history revision', () => {
  const session = createEditorSessionV4(score, notation);
  const admission = analyzeProfessionalSemitoneTransposeV1(score, notation, selection, 1);

  const result = commitSessionProfessionalPitchTransposeV1(
    session,
    selection,
    admission,
    { nextRevisionId:'rev:p10-3a-session-2' }
  );

  assert.equal(result.historyCommitCount, 1);
  assert.equal(result.historyAuthority, 'EditorHistoryV4');
  assert.equal(result.session.history.past.length, 1);
  assert.equal(result.session.history.present.score.revision.parentId, score.revision.id);
  assert.equal(result.session.status.code, 'PROFESSIONAL_PITCH_TRANSPOSE_EDIT_COMMITTED');

  const undone = navigateSessionHistoryV4(result.session, 'UNDO');
  assert.deepEqual(undone.history.present.score, score);
  assert.deepEqual(undone.history.present.notation, notation);

  const redone = navigateSessionHistoryV4(undone, 'REDO');
  assert.deepEqual(redone.history.present.score, result.session.history.present.score);
  assert.deepEqual(redone.history.present.notation, result.session.history.present.notation);
});
```

- [ ] **Step 2: Run and prove RED**

```bash
npm run build
node --test test/p10-3a-professional-pitch-transpose-session-v1.test.mjs
```

Expected: FAIL because session adapter does not exist.

- [ ] **Step 3: Implement the session adapter by mirroring proven P08 authority flow**

Create:

```ts
import {
  professionalSelectionActiveTargetV1,
  type ProfessionalSelectionV1
} from '../../editor-professional-selection-v1/src/index.js';
import {
  executeProfessionalPitchTransposeV1,
  type ProfessionalPitchTransposeAdmissionV1,
  type ProfessionalPitchTransposeOptionsV1
} from '../../editor-professional-pitch-transpose-v1/src/index.js';
import { commitEditorHistoryV4 } from '../../editor-history-v4/src/index.js';
import {
  EDITOR_SESSION_V4_VERSION,
  type EditorSessionStateV4
} from '../../editor-session-controller-v4/src/index.js';
import { createRendererRequestV4WithProfile } from '../../renderer-contract-v4/src/index.js';

export const EDITOR_SESSION_PROFESSIONAL_PITCH_TRANSPOSE_V1_VERSION = '1.0.0' as const;

export const commitSessionProfessionalPitchTransposeV1 = (
  session: EditorSessionStateV4,
  selection: ProfessionalSelectionV1,
  admission: ProfessionalPitchTransposeAdmissionV1,
  options: ProfessionalPitchTransposeOptionsV1
): Readonly<ProfessionalPitchTransposeSessionResultV1> => {
  const current = session.history.present;
  const result = executeProfessionalPitchTransposeV1(
    current.score, current.notation, selection, admission, options
  );
  const history = commitEditorHistoryV4(session.history, result.score, result.notation);
  const activeSelection = professionalSelectionActiveTargetV1(result.selection);

  return Object.freeze({
    version: EDITOR_SESSION_PROFESSIONAL_PITCH_TRANSPOSE_V1_VERSION,
    session: Object.freeze({
      version: EDITOR_SESSION_V4_VERSION,
      history,
      selection: activeSelection,
      renderRequest: createRendererRequestV4WithProfile(
        history.present.score,
        history.present.notation,
        session.renderRequest.renderer
      ),
      status: Object.freeze({
        code: 'PROFESSIONAL_PITCH_TRANSPOSE_EDIT_COMMITTED',
        message: 'Professional pitch transpose committed atomically in unified V4 history.'
      })
    }),
    professionalSelection: result.selection,
    changedEventIds: result.changedEventIds,
    changedNoteIds: result.changedNoteIds,
    historyCommitCount: 1,
    historyAuthority: 'EditorHistoryV4'
  });
};
```

- [ ] **Step 4: Add stale/tampered session-boundary test**

Create admission on revision A, advance session to revision B through an independent edit or candidate fixture, then assert old admission fails with `ADMISSION_STALE_OR_TAMPERED` and the session snapshot is unchanged.

- [ ] **Step 5: Run focused session suite GREEN**

```bash
npm run build
node --test   test/p10-3a-professional-pitch-transpose-v1.test.mjs   test/p10-3a-professional-pitch-transpose-session-v1.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add packages/editor-session-professional-pitch-transpose-v1/src/index.ts   test/p10-3a-professional-pitch-transpose-session-v1.test.mjs
git commit -m "feat(P10-3A): commit pitch transpose through unified history"
```

---

### Task 4: Professional Workstation + Browser Bridge APIs

**Files:**
- Modify: `packages/score-editor-professional-workstation-v1/src/index.ts`
- Modify: `packages/score-editor-browser-professional-v1/src/index.ts`
- Modify: `test/p08d-professional-workstation-controller-v1.test.mjs`
- Create: `test/p10-3a-browser-professional-pitch-transpose-v1.test.mjs`

**Interfaces:**
- Consumes:
  - Task 2 analyzers
  - Task 3 session commit
- Produces:
  - `commitProfessionalWorkstationSemitoneTransposeV1(...)`
  - `commitProfessionalWorkstationDiatonicTransposeV1(...)`
  - Browser controller methods `transposeSemitones(...)` and `transposeDiatonically(...)`

- [ ] **Step 1: Add RED workstation tests**

Extend `test/p08d-professional-workstation-controller-v1.test.mjs`:

```js
test('P10-3A workstation exposes semitone and diatonic edits over the same professional selection', () => {
  let workstation = createScoreEditorProfessionalWorkstationV1(appDocument());
  workstation = selectProfessionalEventSpanV1(
    workstation,
    eventAddress(workstation, 'event-1'),
    eventAddress(workstation, 'event-2')
  );

  workstation = commitProfessionalWorkstationSemitoneTransposeV1(
    workstation, 1, { nextRevisionId:'p10-3a-workstation-2' }
  );
  assert.equal(workstation.professionalSelection.kind, 'EVENT_SPAN');
  assert.equal(workstation.professionalSelection.anchor.revisionId, 'p10-3a-workstation-2');
  assert.equal(workstation.document.session.history.past.length, 1);

  workstation = commitProfessionalWorkstationDiatonicTransposeV1(
    workstation, 1, { nextRevisionId:'p10-3a-workstation-3' }
  );
  assert.equal(workstation.document.session.history.past.length, 2);
});
```

Add missing-selection assertions for both new methods and require `SELECTION_REQUIRED`.

- [ ] **Step 2: Run workstation test and prove RED**

```bash
npm run build
node --test test/p08d-professional-workstation-controller-v1.test.mjs
```

Expected: FAIL because new exports do not exist.

- [ ] **Step 3: Implement workstation wrappers without duplicating theory**

Add imports and exactly these wrappers:

```ts
export const commitProfessionalWorkstationSemitoneTransposeV1 = (
  workstation: ScoreEditorProfessionalWorkstationV1,
  semitoneDelta: number,
  options: ProfessionalPitchTransposeOptionsV1
): Readonly<ScoreEditorProfessionalWorkstationV1> => {
  const selection = selected(workstation);
  const current = workstation.document.session.history.present;
  const admission = analyzeProfessionalSemitoneTransposeV1(
    current.score, current.notation, selection, semitoneDelta
  );
  const result = commitSessionProfessionalPitchTransposeV1(
    workstation.document.session, selection, admission, options
  );
  return state(appWithSession(workstation.document, result.session), result.professionalSelection);
};

export const commitProfessionalWorkstationDiatonicTransposeV1 = (
  workstation: ScoreEditorProfessionalWorkstationV1,
  diatonicSteps: number,
  options: ProfessionalPitchTransposeOptionsV1
): Readonly<ScoreEditorProfessionalWorkstationV1> => {
  const selection = selected(workstation);
  const current = workstation.document.session.history.present;
  const admission = analyzeProfessionalDiatonicTransposeV1(
    current.score, current.notation, selection, diatonicSteps
  );
  const result = commitSessionProfessionalPitchTransposeV1(
    workstation.document.session, selection, admission, options
  );
  return state(appWithSession(workstation.document, result.session), result.professionalSelection);
};
```

- [ ] **Step 4: Write RED browser-bridge tests**

Create `test/p10-3a-browser-professional-pitch-transpose-v1.test.mjs` using the existing standalone browser controller fixture pattern.

Required assertions:

```js
test('P10-3A browser bridge adopts semitone transpose through validated snapshot boundary', async () => {
  const controller = await createController();
  selectSpan(controller, 0, 1);

  const result = controller.professional.transposeSemitones(
    1,
    { nextRevisionId:'rev:p10-3a-browser-2' }
  );

  assert.equal(result.error, null);
  assert.equal(controller.getDocument().session.history.past.length, 1);
  assert.equal(controller.professional.getProfessionalSelection().anchor.revisionId, 'rev:p10-3a-browser-2');
});

test('P10-3A browser bridge rejects out-of-range diatonic request without adoption', async () => {
  const controller = await createController();
  selectSpan(controller, 0, 1);
  const before = structuredClone(controller.getDocument());

  const result = controller.professional.transposeDiatonically(
    8,
    { nextRevisionId:'rev:should-not-commit' }
  );

  assert.equal(result.error?.code, 'INVALID_DIATONIC_STEPS');
  assert.deepEqual(controller.getDocument(), before);
});
```

- [ ] **Step 5: Implement browser bridge methods**

Add parameter aliases:

```ts
export type ProfessionalPitchTransposeOptionsV1 =
  Parameters<typeof commitProfessionalWorkstationSemitoneTransposeV1>[2];
```

Extend interface:

```ts
readonly transposeSemitones: (
  delta: number,
  options: ProfessionalPitchTransposeOptionsV1
) => Readonly<ScoreEditorBrowserProfessionalSnapshotV1>;

readonly transposeDiatonically: (
  steps: number,
  options: ProfessionalPitchTransposeOptionsV1
) => Readonly<ScoreEditorBrowserProfessionalSnapshotV1>;
```

Implement both through `runCommit(...)`; do not add local pitch logic.

- [ ] **Step 6: Run workstation + browser suites GREEN**

```bash
npm run build
node --test   test/p08d-professional-workstation-controller-v1.test.mjs   test/p10-3a-browser-professional-pitch-transpose-v1.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```bash
git add packages/score-editor-professional-workstation-v1/src/index.ts   packages/score-editor-browser-professional-v1/src/index.ts   test/p08d-professional-workstation-controller-v1.test.mjs   test/p10-3a-browser-professional-pitch-transpose-v1.test.mjs
git commit -m "feat(P10-3A): expose pitch transpose through professional APIs"
```

---

### Task 5: Professional Range Toolbar Controls

**Files:**
- Modify: `packages/score-editor-browser-professional-ui-v1/src/index.ts`
- Modify: `packages/score-editor-browser-professional-workstation-v1/src/index.ts`
- Modify: `test/p08e2-professional-range-toolbar-v1.test.mjs`
- Modify: `test/p10-1-professional-workstation-v1.test.mjs`

**Interfaces:**
- Consumes browser bridge methods from Task 4.
- Produces controller methods:
  - `transposeProfessionalRangeBySemitones(delta)`
  - `transposeProfessionalRangeDiatonically(steps)`
- Adds profile flags:
  - `professionalSemitoneTransposeAvailable: true`
  - `professionalDiatonicTransposeAvailable: true`

- [ ] **Step 1: Write RED toolbar state/API tests**

Extend `test/p08e2-professional-range-toolbar-v1.test.mjs`:

```js
test('P10-3A range toolbar exposes semantic semitone and diatonic actions only when range is ready', async () => {
  const controller = await createController();

  let state = controller.getProfessionalRangeToolbarState();
  assert.equal(state.canTransposeRange, false);

  controller.select(eventAddress(controller, 0));
  controller.captureTeacherRangeStartAtSelection();
  controller.select(eventAddress(controller, 1));

  state = controller.getProfessionalRangeToolbarState();
  assert.equal(state.canTransposeRange, true);

  const result = controller.transposeProfessionalRangeBySemitones(1);
  assert.equal(result.error, null);
  assert.equal(controller.getDocument().session.history.past.length, 1);
  assert.equal(controller.getProfessionalRangeToolbarState().rangeReady, false);
  assert.equal(controller.getProfessionalRangeToolbarState().professionalSelectionKind, null);
});
```

Add analogous diatonic test.

- [ ] **Step 2: Add RED presentation tests for four controls and authority flags**

```js
test('P10-3A toolbar exposes four bounded pitch actions without new authority', () => {
  assert.equal(professionalRangeToolbarBrowserAppProfile.professionalSemitoneTransposeAvailable, true);
  assert.equal(professionalRangeToolbarBrowserAppProfile.professionalDiatonicTransposeAvailable, true);
  assert.equal(professionalRangeToolbarBrowserAppProfile.professionalRangeToolbarCanonicalAuthority, false);
  assert.equal(professionalRangeToolbarBrowserAppProfile.professionalRangeToolbarRendererCoordinateAuthority, false);

  assert.match(PROFESSIONAL_RANGE_TOOLBAR_STYLE, /min-height:44px/);
});
```

The DOM test/mount fixture must find actions:

- `transpose-down-semitone`
- `transpose-up-semitone`
- `transpose-down-step`
- `transpose-up-step`

- [ ] **Step 3: Run and prove RED**

```bash
npm run build
node --test test/p08e2-professional-range-toolbar-v1.test.mjs
```

Expected: FAIL because methods/buttons/profile flags do not exist.

- [ ] **Step 4: Implement toolbar controller methods using existing semantic range preparation**

Inside `attachProfessionalRangeToolbarToBrowserControllerV1`:

```ts
const transposeSemitones = (delta: number): Readonly<ScoreEditorBrowserAppSnapshot> => perform(() => {
  prepareProfessionalRange();
  const result = professional.transposeSemitones(
    delta,
    { nextRevisionId: revisionIdFactory() }
  );
  if (result.error !== null) {
    lastError = Object.freeze({ ...result.error });
    return result.base;
  }
  professional.clearProfessionalSelection();
  base.clearTeacherRange();
  return result.base;
});

const transposeDiatonically = (steps: number): Readonly<ScoreEditorBrowserAppSnapshot> => perform(() => {
  prepareProfessionalRange();
  const result = professional.transposeDiatonically(
    steps,
    { nextRevisionId: revisionIdFactory() }
  );
  if (result.error !== null) {
    lastError = Object.freeze({ ...result.error });
    return result.base;
  }
  professional.clearProfessionalSelection();
  base.clearTeacherRange();
  return result.base;
});
```

If the base controller does not expose `clearTeacherRange()` under that exact name, reuse the same proven post-commit range-clear mechanism already used by `clearToRest` / octave transpose; do not invent a second transient range store.

- [ ] **Step 5: Add the four buttons through existing `addButton` helper**

Desktop range toolbar:

```ts
addButton(owner, toolbar, '−½', 'Transpose professional range down one semitone',
  'transpose-down-semitone', !current.canTransposeRange,
  () => { controller.transposeProfessionalRangeBySemitones(-1); });

addButton(owner, toolbar, '+½', 'Transpose professional range up one semitone',
  'transpose-up-semitone', !current.canTransposeRange,
  () => { controller.transposeProfessionalRangeBySemitones(1); });

addButton(owner, toolbar, '−Step', 'Transpose professional range down one diatonic step',
  'transpose-down-step', !current.canTransposeRange,
  () => { controller.transposeProfessionalRangeDiatonically(-1); });

addButton(owner, toolbar, '+Step', 'Transpose professional range up one diatonic step',
  'transpose-up-step', !current.canTransposeRange,
  () => { controller.transposeProfessionalRangeDiatonically(1); });
```

Keep existing `Clear`, `−8`, `+8`.

On mobile, add the same four actions to the existing safe-area-aware mobile toolbar; do not create a second bottom bar.

- [ ] **Step 6: Extend combined P10-1 capability test**

In `test/p10-1-professional-workstation-v1.test.mjs` assert:

```js
assert.equal(controller.profile.professionalSemitoneTransposeAvailable, true);
assert.equal(controller.profile.professionalDiatonicTransposeAvailable, true);
assert.equal(controller.profile.canonicalAuthority, false);
assert.equal(controller.profile.professionalSelectionCanonicalAuthority, false);
```

- [ ] **Step 7: Run toolbar + combined controller suites GREEN**

```bash
npm run build:browser
node --test   test/p08e2-professional-range-toolbar-v1.test.mjs   test/p10-1-professional-workstation-v1.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit Task 5**

```bash
git add packages/score-editor-browser-professional-ui-v1/src/index.ts   packages/score-editor-browser-professional-workstation-v1/src/index.ts   test/p08e2-professional-range-toolbar-v1.test.mjs   test/p10-1-professional-workstation-v1.test.mjs
git commit -m "feat(P10-3A): add professional range pitch controls"
```

---

### Task 6: Browser/WebKit Qualification

**Files:**
- Create: `scripts/p10-3a-webkit-professional-pitch-transpose-regression.mjs`
- Create: `.github/workflows/p10-3a-professional-pitch-transpose-webkit.yml`

**Interfaces:**
- Consumes the existing P10-1 professional workstation artifact.
- Produces a dedicated P10-3A WebKit qualification gate.

- [ ] **Step 1: Write the WebKit regression before wiring CI**

Create `scripts/p10-3a-webkit-professional-pitch-transpose-regression.mjs` by using the proven bounded static-server pattern from `scripts/p10-1-webkit-professional-workstation-regression.mjs`.

The script must:

1. serve `dist/browser/st-score-editor-professional-workstation.html`;
2. launch headless WebKit at mobile viewport `390x844`;
3. open a MusicXML fixture with:
   - explicit `<key><fifths>1</fifths></key>`;
   - at least C4, E4, F#4 and a REST;
4. use semantic manifest event/note addresses to establish a professional range;
5. execute one semitone action through the exposed controller;
6. assert canonical pitch and accidental metadata;
7. Undo and verify exact canonical snapshot restoration;
8. establish a new range;
9. execute one diatonic action;
10. assert one new history revision;
11. verify all four toolbar controls are at least 44px high and enabled only for ready range;
12. assert zero browser console/page errors.

Core page assertion skeleton:

```js
const result = await page.evaluate(() => {
  const controller = globalThis.STScoreEditorProfessionalWorkstationController;
  const before = controller.getDocument();
  const score = before.session.history.present.score;
  const events = score.parts[0].staves.find(staff => staff.role === 'standard')
    .measures[0].voices[0].events;

  const addresses = events.slice(0, 3).map(event =>
    before.session.renderRequest.manifest.entries
      .find(entry => entry.address.kind === 'event' && entry.address.eventId === event.id)?.address
  );
  if (!addresses[0] || !addresses[2]) throw new Error('P10_3A_RANGE_ADDRESS_MISSING');

  controller.select(addresses[0]);
  controller.captureTeacherRangeStartAtSelection();
  controller.select(addresses[2]);

  const beforePast = controller.getDocument().session.history.past.length;
  const edit = controller.transposeProfessionalRangeBySemitones(1);
  const after = controller.getDocument();

  return {
    error: edit.error,
    beforePast,
    afterPast: after.session.history.past.length,
    rangeReadyAfter: controller.getProfessionalRangeToolbarState().rangeReady
  };
});

if (
  result.error !== null ||
  result.afterPast !== result.beforePast + 1 ||
  result.rangeReadyAfter !== false
) {
  throw new Error(`P10-3A semitone browser mismatch: ${JSON.stringify(result)}`);
}
```

- [ ] **Step 2: Run locally/CI-compatible and observe initial failure if artifact lacks the APIs**

Run:

```bash
npm run build:browser:professional-workstation
node scripts/p10-3a-webkit-professional-pitch-transpose-regression.mjs
```

Expected before Tasks 4/5 are complete: FAIL due missing methods/controls.
Expected after Tasks 4/5: PASS.

- [ ] **Step 3: Create a Sonar-clean pinned GitHub Actions workflow**

Create `.github/workflows/p10-3a-professional-pitch-transpose-webkit.yml`:

```yaml
name: P10-3A Professional Pitch Transpose WebKit

on:
  pull_request:
    branches:
      - main
  workflow_dispatch:

jobs:
  p10-3a-professional-pitch-transpose-webkit:
    permissions:
      contents: read
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    steps:
      - name: Checkout Editor Core
        uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262
      - name: Setup Node
        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020
        with:
          node-version: "22"
      - name: Install Editor Core dependencies and verified audio with pinned Playwright
        run: |
          npm install --ignore-scripts --no-audit --no-fund --no-package-lock
          npm run install:verified-audio -- --with-playwright
      - name: Install pinned WebKit browser
        run: npx playwright install --with-deps webkit
      - name: Build professional workstation artifact
        run: npm run build:browser:professional-workstation
      - name: Run P10-3A professional pitch transpose WebKit regression
        run: node scripts/p10-3a-webkit-professional-pitch-transpose-regression.mjs
```

Do not put `permissions: contents: read` at workflow scope and do not use `ubuntu-latest`.

- [ ] **Step 4: Commit Task 6**

```bash
git add scripts/p10-3a-webkit-professional-pitch-transpose-regression.mjs   .github/workflows/p10-3a-professional-pitch-transpose-webkit.yml
git commit -m "test(P10-3A): add WebKit pitch transpose qualification"
```

---

### Task 7: Reality / Documentation Contract

**Files:**
- Create: `test/p10-3a-professional-pitch-transpose-reality.test.mjs`
- Modify: `docs/p08b-professional-bulk-authoring.md`
- Modify: `docs/superpowers/specs/2026-09-19-p10-advanced-score-workstation-design.md`
- Modify: `ROADMAP.md`
- Modify: `docs/st-score-editor-app-productization.md`
- Modify: `docs/st-score-editor-app-productization.json`

**Interfaces:**
- Consumes final public profiles and package names.
- Produces repository-truth documentation and a test that prevents capability overclaim.

- [ ] **Step 1: Write RED reality test before docs**

Create:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('P10-3A repository reality reports bounded pitch transpose without overclaiming relation closure', async () => {
  const roadmap = await readFile('ROADMAP.md', 'utf8');
  const productization = await readFile('docs/st-score-editor-app-productization.json', 'utf8');
  const p08 = await readFile('docs/p08b-professional-bulk-authoring.md', 'utf8');

  assert.match(roadmap, /P10-3A/);
  assert.match(roadmap, /semitone.*±1.*±12/i);
  assert.match(roadmap, /diatonic.*±1.*±7/i);
  assert.match(p08, /key-aware/i);
  assert.match(p08, /tie.*fail.closed/i);

  const json = JSON.parse(productization);
  assert.equal(json.p10_3a.status, 'PROFESSIONAL_PITCH_TRANSPOSE_IMPLEMENTED_QUALIFICATION_PENDING');
  assert.equal(json.p10_3a.semitone_max_abs, 12);
  assert.equal(json.p10_3a.diatonic_max_abs, 7);
  assert.equal(json.p10_3a.tie_relation_closure, false);
  assert.equal(json.p10_3a.grace_relation_closure, false);
  assert.equal(json.p10_3a.renderer_coordinate_authority, false);
  assert.equal(json.p10_3a.production_release_authorized, false);
  assert.equal(json.p10_3a.seslitab_cutover_authorized, false);
});
```

- [ ] **Step 2: Run and prove RED**

```bash
node --test test/p10-3a-professional-pitch-transpose-reality.test.mjs
```

Expected: FAIL because `p10_3a` reality fields are absent.

- [ ] **Step 3: Update docs with exact capability boundary**

Required truths:

```json
{
  "status": "PROFESSIONAL_PITCH_TRANSPOSE_IMPLEMENTED_QUALIFICATION_PENDING",
  "package": "editor-professional-pitch-transpose-v1",
  "session_package": "editor-session-professional-pitch-transpose-v1",
  "selection_profiles": ["EVENT_SPAN", "EVENT_SET"],
  "semitone_max_abs": 12,
  "diatonic_max_abs": 7,
  "key_aware_spelling": true,
  "atomic_pitch_accidental_metadata": true,
  "tie_relation_closure": false,
  "grace_relation_closure": false,
  "history_authority": "EditorHistoryV4",
  "renderer_coordinate_authority": false,
  "dom_authoring_authority": false,
  "production_release_authorized": false,
  "seslitab_cutover_authorized": false
}
```

Do not mark production qualification PASS until Task 8 exact-head verification succeeds.

- [ ] **Step 4: Run reality test GREEN**

```bash
node --test test/p10-3a-professional-pitch-transpose-reality.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit Task 7**

```bash
git add test/p10-3a-professional-pitch-transpose-reality.test.mjs   docs/p08b-professional-bulk-authoring.md   docs/superpowers/specs/2026-09-19-p10-advanced-score-workstation-design.md   ROADMAP.md   docs/st-score-editor-app-productization.md   docs/st-score-editor-app-productization.json
git commit -m "docs(P10-3A): record bounded professional pitch transpose reality"
```

---

### Task 8: Full Qualification, PR, Sonar, and Merge-Ready Handoff

**Files:**
- No production changes unless verification exposes a root cause.
- Update documentation status only if exact-head results justify it.
- Create PR from `feat/p10-3a-professional-pitch-transpose` to `main`.

**Interfaces:**
- Consumes all prior tasks.
- Produces a verified, unmerged P10-3A PR.

- [ ] **Step 1: Read Superpowers verification-before-completion before claiming success**

Required sub-skill:

```text
skills://plugins/superpowers/verification-before-completion
```

- [ ] **Step 2: Run full repository CI locally when the environment permits**

```bash
npm run ci
```

Expected: all repository tests PASS.

If local network/runtime limitations prevent full execution, do not substitute a claim; use exact-head GitHub Actions as the authoritative execution evidence and state that local qualification was unavailable.

- [ ] **Step 3: Push exact head and require Node 18/20/22 core CI**

GitHub CI must report PASS for all three Node versions.

Verify the Node 22 log includes:

```text
# fail 0
```

and the final current total test count.

- [ ] **Step 4: Require retained WebKit gates**

The exact same head must pass:

- APP-09B preview WebKit;
- P08-E4 professional artifact WebKit;
- P10-1 professional workstation WebKit;
- P10-1 renderer qualification WebKit;
- P10-2 Triplet Unretiming WebKit;
- P10-3A Professional Pitch Transpose WebKit.

Do not accept a retained gate from an older SHA as exact-head evidence.

- [ ] **Step 5: Require SonarCloud GitHub check**

The PR must show:

```text
SonarCloud Code Analysis — SUCCESS
```

Because `main-quality-gate` requires this check, do not bypass the ruleset.

Do not suppress findings merely to improve the grade.

- [ ] **Step 6: Inspect diff for authority leakage**

Confirm no production path introduced:

- renderer-coordinate target selection;
- DOM-derived target membership;
- direct history-array mutation;
- second canonical score model;
- key-signature mutation;
- tie/grace silent repair;
- production-default or SesliTab cutover.

- [ ] **Step 7: Update productization status only to qualified implementation state**

After exact-head gates are green, change:

```json
"status": "PROFESSIONAL_PITCH_TRANSPOSE_IMPLEMENTED_QUALIFIED"
```

Keep:

```json
"production_release_authorized": false,
"seslitab_cutover_authorized": false
```

Run full tests again because this creates a new exact head.

- [ ] **Step 8: Create or update the PR with exact evidence**

PR body must list:

- exact head SHA;
- Node 18/20/22 results;
- total tests/pass/fail;
- all six WebKit gate run IDs/results;
- SonarCloud Code Analysis result;
- bounded capability summary;
- explicit deferred items:
  - tie relation closure;
  - grace relation closure;
  - larger interval picker UI;
  - P10-3B delete/replace;
  - release/cutover.

- [ ] **Step 9: Stop before merge**

Do not merge, release, enable a production default, or perform SesliTab cutover.

Present the verified PR and ask for separate human merge approval.

---

## Execution Order Summary

```text
Task 1  pure pitch theory
   ↓
Task 2  admission + atomic score/notation candidate
   ↓
Task 3  EditorHistoryV4 session commit
   ↓
Task 4  workstation + browser APIs
   ↓
Task 5  visible range-toolbar controls
   ↓
Task 6  WebKit qualification
   ↓
Task 7  repository reality/docs
   ↓
Task 8  exact-head CI + WebKit + Sonar + PR handoff
```

Each task is independently reviewable and must end in a commit. Production code does not begin until Task 1's RED test is observed.
