import { createScoreDocumentV3, type ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import type { Rational, ScoreEvent } from '../../score-model/src/index.js';
import { addressEntityV3, resolveSemanticAddressV3, type EventAddressV3, type SemanticAddressV3 } from '../../addressing-v3/src/index.js';
import { createNotationDocumentV4, type NotationDocumentV4 } from '../../notation-structure-v4/src/index.js';
import { parseEditorKeypadAction, type EditorKeypadActionId } from '../../editor-keypad/src/index.js';
import {
  executeEditorKeypadActionV4,
  type EditorKeypadExecutionV4Result,
  type EditorKeypadV4Options
} from '../../editor-keypad-execution-v4/src/index.js';
import { executeRhythmAuthoringV4, RhythmAuthoringV4Error } from '../../editor-rhythm-authoring-v4/src/index.js';

export const EDITOR_KEYPAD_RHYTHM_SAFE_V4_VERSION = '1.0.0' as const;

export type SafeEditorKeypadExecutionV4ErrorCode =
  | 'NO_SELECTION'
  | 'STALE_SELECTION'
  | 'SELECTION_KIND'
  | 'DURATION_DOT_INCONSISTENCY'
  | 'RHYTHM_TIMING_REJECTED';

export class SafeEditorKeypadExecutionV4Error extends Error {
  readonly code: SafeEditorKeypadExecutionV4ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: SafeEditorKeypadExecutionV4ErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'SafeEditorKeypadExecutionV4Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const SIMPLE: Readonly<Record<string, Readonly<Rational>>> = Object.freeze({
  whole: Object.freeze({ numerator: 1, denominator: 1 }),
  half: Object.freeze({ numerator: 1, denominator: 2 }),
  quarter: Object.freeze({ numerator: 1, denominator: 4 }),
  eighth: Object.freeze({ numerator: 1, denominator: 8 }),
  '16th': Object.freeze({ numerator: 1, denominator: 16 }),
  '32nd': Object.freeze({ numerator: 1, denominator: 32 })
});
const DOT_FACTORS = Object.freeze([
  { numerator: 1, denominator: 1 },
  { numerator: 3, denominator: 2 },
  { numerator: 7, denominator: 4 },
  { numerator: 15, denominator: 8 }
] as const);

const gcd = (left: bigint, right: bigint): bigint => {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
};
const rational = (numerator: bigint, denominator: bigint): Readonly<Rational> => {
  if (numerator <= 0n || denominator <= 0n) {
    throw new SafeEditorKeypadExecutionV4Error('Computed keypad duration is invalid.', 'DURATION_DOT_INCONSISTENCY');
  }
  const divisor = gcd(numerator, denominator);
  const n = numerator / divisor;
  const d = denominator / divisor;
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (n > max || d > max) {
    throw new SafeEditorKeypadExecutionV4Error('Computed keypad duration exceeds safe integer bounds.', 'DURATION_DOT_INCONSISTENCY');
  }
  return Object.freeze({ numerator: Number(n), denominator: Number(d) });
};
const multiply = (value: Rational, numerator: number, denominator: number): Readonly<Rational> =>
  rational(BigInt(value.numerator) * BigInt(numerator), BigInt(value.denominator) * BigInt(denominator));
const sameRational = (left: Rational, right: Rational): boolean =>
  BigInt(left.numerator) * BigInt(right.denominator) === BigInt(right.numerator) * BigInt(left.denominator);

const simpleFor = (actionId: EditorKeypadActionId): Readonly<Rational> | null => {
  const match = /^(?:duration|rest)\.(whole|half|quarter|eighth|16th|32nd)$/.exec(actionId);
  return match?.[1] === undefined ? null : SIMPLE[match[1]] ?? null;
};
const dotFor = (actionId: EditorKeypadActionId): 0 | 1 | 2 | 3 | null => {
  const match = /^dot\.set\.([0-3])$/.exec(actionId);
  if (match === null) return null;
  const value = Number(match[1]);
  return value === 0 || value === 1 || value === 2 || value === 3 ? value : null;
};

const currentSelection = (score: ScoreDocumentV3, selection: SemanticAddressV3 | null): SemanticAddressV3 => {
  if (selection === null) throw new SafeEditorKeypadExecutionV4Error('Timing keypad action requires semantic selection.', 'NO_SELECTION');
  try {
    resolveSemanticAddressV3(score, selection);
    return selection;
  } catch (error) {
    throw new SafeEditorKeypadExecutionV4Error('Timing keypad selection is stale or invalid.', 'STALE_SELECTION', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
};
const eventTarget = (score: ScoreDocumentV3, selection: SemanticAddressV3): EventAddressV3 => {
  if (selection.kind === 'event') return selection;
  if (selection.kind === 'note') {
    const parent = addressEntityV3(score, selection.eventId);
    if (parent.kind === 'event') return parent;
  }
  throw new SafeEditorKeypadExecutionV4Error('Timing keypad action requires event or note selection.', 'SELECTION_KIND', {
    kind: selection.kind
  });
};
const eventValue = (score: ScoreDocumentV3, target: EventAddressV3): ScoreEvent => {
  const resolved = resolveSemanticAddressV3(score, target);
  if (resolved.kind !== 'event') throw new SafeEditorKeypadExecutionV4Error('Timing target changed kind.', 'SELECTION_KIND');
  return resolved.value;
};
const targetId = (address: SemanticAddressV3): string => {
  switch (address.kind) {
    case 'document': return address.documentId;
    case 'measure-frame': return address.frameId;
    case 'part': return address.partId;
    case 'staff': return address.staffId;
    case 'measure': return address.measureId;
    case 'voice': return address.voiceId;
    case 'event': return address.eventId;
    case 'note': return address.noteId;
    case 'grace-group': return address.graceGroupId;
    case 'grace-event': return address.graceEventId;
    case 'grace-note': return address.graceNoteId;
  }
};
const rebindSelection = (score: ScoreDocumentV3, selection: SemanticAddressV3): SemanticAddressV3 | null => {
  try {
    const rebound = addressEntityV3(score, targetId(selection));
    return rebound.kind === selection.kind ? rebound : null;
  } catch {
    return null;
  }
};

const dottedDuration = (
  event: ScoreEvent,
  currentDots: number,
  requestedDots: 0 | 1 | 2 | 3
): Readonly<Rational> => {
  if (!Number.isSafeInteger(currentDots) || currentDots < 0 || currentDots > 3) {
    throw new SafeEditorKeypadExecutionV4Error('Current dot state is invalid.', 'DURATION_DOT_INCONSISTENCY', { currentDots });
  }
  const currentFactor = DOT_FACTORS[currentDots]!;
  const requestedFactor = DOT_FACTORS[requestedDots]!;
  const base = multiply(event.duration, currentFactor.denominator, currentFactor.numerator);
  const admittedBase = Object.values(SIMPLE).find(value => sameRational(value, base));
  if (admittedBase === undefined) {
    throw new SafeEditorKeypadExecutionV4Error(
      'Current duration/dot state is not an admitted simple keypad value.',
      'DURATION_DOT_INCONSISTENCY',
      { duration: event.duration, currentDots }
    );
  }
  return multiply(admittedBase, requestedFactor.numerator, requestedFactor.denominator);
};

export const executeSafeEditorKeypadActionV4 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  selectionInput: SemanticAddressV3 | null,
  rawAction: unknown,
  rawAdvancedTarget: unknown,
  options: EditorKeypadV4Options
): Readonly<EditorKeypadExecutionV4Result> => {
  const score = createScoreDocumentV3(scoreInput);
  const notation = createNotationDocumentV4(score, notationInput);
  const action = parseEditorKeypadAction(rawAction);
  const simple = simpleFor(action.actionId);
  const requestedDots = dotFor(action.actionId);

  if (simple === null && requestedDots === null) {
    return executeEditorKeypadActionV4(score, notation, selectionInput, action, rawAdvancedTarget, options);
  }

  const primary = currentSelection(score, selectionInput);
  const target = eventTarget(score, primary);
  const event = eventValue(score, target);
  const currentDots = notation.events.find(entry => entry.target.eventId === event.id)?.notation.dots ?? 0;
  const requestedDuration = simple ?? dottedDuration(event, currentDots, requestedDots!);

  if (sameRational(event.duration, requestedDuration)) {
    return executeEditorKeypadActionV4(score, notation, primary, action, rawAdvancedTarget, options);
  }

  const replaceWithRest = simple !== null && action.actionId.startsWith('rest.');
  const writtenDots: 0 | 1 | 2 | 3 = requestedDots ?? 0;

  try {
    const result = executeRhythmAuthoringV4(
      score,
      notation,
      replaceWithRest
        ? { version: '1.0.0', type: 'REPLACE_EVENT_WITH_REST_DURATION', target, duration: requestedDuration, dots: writtenDots }
        : { version: '1.0.0', type: 'SET_WRITTEN_DURATION', target, duration: requestedDuration, dots: writtenDots },
      { nextRevisionId: options.nextRevisionId }
    );
    const selection = replaceWithRest && event.kind !== 'rest' && primary.kind === 'note'
      ? null
      : rebindSelection(result.score, primary);
    return Object.freeze({
      version: '1.0.0',
      action,
      score: result.score,
      notation: result.notation,
      selection
    });
  } catch (error) {
    if (error instanceof RhythmAuthoringV4Error) {
      throw new SafeEditorKeypadExecutionV4Error(
        'Timing keypad action was rejected by the shared rhythm authority.',
        'RHYTHM_TIMING_REJECTED',
        { rhythmCode: error.code, ...error.details }
      );
    }
    throw error;
  }
};