import { SCORE_DOCUMENT_SCHEMA_VERSION } from './types.js';
import type {
  Rational,
  ScoreDocument,
  ValidationIssue,
  ValidationResult
} from './types.js';

type UnknownRecord = Record<string, unknown>;

type ValidationContext = {
  readonly issues: ValidationIssue[];
  readonly ids: Set<string>;
};

const ENTITY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SOURCE_FORMATS = new Set(['musicxml', 'canonical', 'synthetic']);
const PITCH_STEPS = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G']);

const isPlainRecord = (value: unknown): value is UnknownRecord => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const addIssue = (
  context: ValidationContext,
  code: ValidationIssue['code'],
  path: string,
  message: string
): void => {
  context.issues.push({ code, path, message });
};

const validateKeys = (
  value: UnknownRecord,
  requiredKeys: readonly string[],
  path: string,
  context: ValidationContext
): void => {
  const allowed = new Set(requiredKeys);
  for (const key of requiredKeys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      addIssue(context, 'MISSING_FIELD', `${path}.${key}`, 'required field is missing');
    }
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      addIssue(context, 'UNKNOWN_FIELD', `${path}.${key}`, 'field is not admitted by schema 1.0.0');
    }
  }
};

const validateEntityId = (
  value: unknown,
  path: string,
  context: ValidationContext,
  trackUniqueness = true
): value is string => {
  if (typeof value !== 'string' || !ENTITY_ID_PATTERN.test(value)) {
    addIssue(context, 'INVALID_ID', path, 'must be a 1..128 character stable entity id');
    return false;
  }
  if (trackUniqueness) {
    if (context.ids.has(value)) {
      addIssue(context, 'DUPLICATE_ID', path, `duplicate entity id: ${value}`);
      return false;
    }
    context.ids.add(value);
  }
  return true;
};

const gcd = (left: number, right: number): number => {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a;
};

const validateRational = (
  value: unknown,
  path: string,
  context: ValidationContext,
  mode: 'onset' | 'duration'
): value is Rational => {
  if (!isPlainRecord(value)) {
    addIssue(context, 'TYPE', path, 'must be a rational object');
    return false;
  }
  validateKeys(value, ['numerator', 'denominator'], path, context);
  const numerator = value.numerator;
  const denominator = value.denominator;
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) {
    addIssue(context, 'INVALID_RATIONAL', path, 'numerator and denominator must be safe integers');
    return false;
  }
  if (denominator <= 0) {
    addIssue(context, 'INVALID_RATIONAL', `${path}.denominator`, 'denominator must be positive');
    return false;
  }
  if (mode === 'onset' && numerator < 0) {
    addIssue(context, 'INVALID_RATIONAL', `${path}.numerator`, 'onset must be non-negative');
    return false;
  }
  if (mode === 'duration' && numerator <= 0) {
    addIssue(context, 'INVALID_RATIONAL', `${path}.numerator`, 'duration must be positive');
    return false;
  }
  if (gcd(numerator, denominator) !== 1) {
    addIssue(context, 'NON_CANONICAL_RATIONAL', path, 'rational must be reduced to canonical form');
    return false;
  }
  return true;
};

const canonicalRationalOrNull = (value: unknown, mode: 'onset' | 'duration'): Rational | null => {
  if (!isPlainRecord(value)) return null;
  const numerator = value.numerator;
  const denominator = value.denominator;
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) return null;
  if (denominator <= 0) return null;
  if (mode === 'onset' ? numerator < 0 : numerator <= 0) return null;
  if (gcd(numerator, denominator) !== 1) return null;
  return { numerator, denominator };
};

const compareRational = (left: Rational, right: Rational): number => {
  const lhs = BigInt(left.numerator) * BigInt(right.denominator);
  const rhs = BigInt(right.numerator) * BigInt(left.denominator);
  return lhs < rhs ? -1 : lhs > rhs ? 1 : 0;
};

const validatePitch = (value: unknown, path: string, context: ValidationContext): void => {
  if (!isPlainRecord(value)) {
    addIssue(context, 'TYPE', path, 'pitch must be an object');
    return;
  }
  validateKeys(value, ['step', 'alter', 'octave'], path, context);
  if (typeof value.step !== 'string' || !PITCH_STEPS.has(value.step)) {
    addIssue(context, 'INVALID_PITCH', `${path}.step`, 'step must be A..G');
  }
  if (!Number.isInteger(value.alter) || typeof value.alter !== 'number' || value.alter < -2 || value.alter > 2) {
    addIssue(context, 'INVALID_PITCH', `${path}.alter`, 'alter must be an integer from -2 to 2');
  }
  if (!Number.isInteger(value.octave) || typeof value.octave !== 'number' || value.octave < -1 || value.octave > 9) {
    addIssue(context, 'INVALID_PITCH', `${path}.octave`, 'octave must be an integer from -1 to 9');
  }
};

const validateNoteAtom = (value: unknown, path: string, context: ValidationContext): void => {
  if (!isPlainRecord(value)) {
    addIssue(context, 'TYPE', path, 'note must be an object');
    return;
  }
  validateKeys(value, ['id', 'pitch'], path, context);
  validateEntityId(value.id, `${path}.id`, context);
  validatePitch(value.pitch, `${path}.pitch`, context);
};

const validateEvent = (value: unknown, path: string, context: ValidationContext): void => {
  if (!isPlainRecord(value)) {
    addIssue(context, 'TYPE', path, 'event must be an object');
    return;
  }

  const kind = value.kind;
  if (kind === 'note') {
    validateKeys(value, ['kind', 'id', 'onset', 'duration', 'note'], path, context);
  } else if (kind === 'rest') {
    validateKeys(value, ['kind', 'id', 'onset', 'duration'], path, context);
  } else if (kind === 'chord') {
    validateKeys(value, ['kind', 'id', 'onset', 'duration', 'notes'], path, context);
  } else {
    addIssue(context, 'TYPE', `${path}.kind`, 'kind must be note, rest or chord');
    return;
  }

  validateEntityId(value.id, `${path}.id`, context);
  validateRational(value.onset, `${path}.onset`, context, 'onset');
  validateRational(value.duration, `${path}.duration`, context, 'duration');

  if (kind === 'note') {
    validateNoteAtom(value.note, `${path}.note`, context);
  }

  if (kind === 'chord') {
    if (!Array.isArray(value.notes)) {
      addIssue(context, 'TYPE', `${path}.notes`, 'chord notes must be an array');
    } else {
      if (value.notes.length < 2) {
        addIssue(context, 'INVALID_CHORD', `${path}.notes`, 'chord must contain at least two notes');
      }
      value.notes.forEach((note, index) => validateNoteAtom(note, `${path}.notes[${index}]`, context));
    }
  }
};

const validateOrdinal = (value: unknown, path: string, context: ValidationContext): value is number => {
  if (!Number.isSafeInteger(value) || typeof value !== 'number' || value <= 0) {
    addIssue(context, 'INVALID_ORDINAL', path, 'ordinal must be a positive safe integer');
    return false;
  }
  return true;
};

const validateVoice = (value: unknown, path: string, context: ValidationContext): void => {
  if (!isPlainRecord(value)) {
    addIssue(context, 'TYPE', path, 'voice must be an object');
    return;
  }
  validateKeys(value, ['id', 'ordinal', 'events'], path, context);
  validateEntityId(value.id, `${path}.id`, context);
  validateOrdinal(value.ordinal, `${path}.ordinal`, context);
  if (!Array.isArray(value.events)) {
    addIssue(context, 'TYPE', `${path}.events`, 'events must be an array');
    return;
  }
  value.events.forEach((event, index) => validateEvent(event, `${path}.events[${index}]`, context));

  let previous: Rational | null = null;
  value.events.forEach((event, index) => {
    if (!isPlainRecord(event)) return;
    const onset = canonicalRationalOrNull(event.onset, 'onset');
    if (onset !== null && previous !== null && compareRational(onset, previous) < 0) {
      addIssue(context, 'EVENT_ORDER', `${path}.events[${index}].onset`, 'events must be ordered by non-decreasing onset');
    }
    if (onset !== null) previous = onset;
  });
};

const validateSiblingOrdinals = (
  values: readonly unknown[],
  path: string,
  context: ValidationContext
): void => {
  const seen = new Set<number>();
  values.forEach((value, index) => {
    if (!isPlainRecord(value)) return;
    const ordinal = value.ordinal;
    if (typeof ordinal !== 'number' || !Number.isSafeInteger(ordinal) || ordinal <= 0) return;
    if (seen.has(ordinal)) {
      addIssue(context, 'DUPLICATE_ORDINAL', `${path}[${index}].ordinal`, `duplicate sibling ordinal: ${ordinal}`);
    } else {
      seen.add(ordinal);
    }
  });
};

const validateMeasure = (value: unknown, path: string, context: ValidationContext): void => {
  if (!isPlainRecord(value)) {
    addIssue(context, 'TYPE', path, 'measure must be an object');
    return;
  }
  validateKeys(value, ['id', 'ordinal', 'displayNumber', 'voices'], path, context);
  validateEntityId(value.id, `${path}.id`, context);
  validateOrdinal(value.ordinal, `${path}.ordinal`, context);
  if (value.displayNumber !== null && typeof value.displayNumber !== 'string') {
    addIssue(context, 'TYPE', `${path}.displayNumber`, 'displayNumber must be string or null');
  }
  if (!Array.isArray(value.voices)) {
    addIssue(context, 'TYPE', `${path}.voices`, 'voices must be an array');
    return;
  }
  if (value.voices.length === 0) {
    addIssue(context, 'EMPTY_COLLECTION', `${path}.voices`, 'measure must contain at least one voice');
  }
  validateSiblingOrdinals(value.voices, `${path}.voices`, context);
  value.voices.forEach((voice, index) => validateVoice(voice, `${path}.voices[${index}]`, context));
};

const validateStaff = (value: unknown, path: string, context: ValidationContext): void => {
  if (!isPlainRecord(value)) {
    addIssue(context, 'TYPE', path, 'staff must be an object');
    return;
  }
  validateKeys(value, ['id', 'ordinal', 'measures'], path, context);
  validateEntityId(value.id, `${path}.id`, context);
  validateOrdinal(value.ordinal, `${path}.ordinal`, context);
  if (!Array.isArray(value.measures)) {
    addIssue(context, 'TYPE', `${path}.measures`, 'measures must be an array');
    return;
  }
  if (value.measures.length === 0) {
    addIssue(context, 'EMPTY_COLLECTION', `${path}.measures`, 'staff must contain at least one measure');
  }
  validateSiblingOrdinals(value.measures, `${path}.measures`, context);
  value.measures.forEach((measure, index) => validateMeasure(measure, `${path}.measures[${index}]`, context));
};

const validatePart = (value: unknown, path: string, context: ValidationContext): void => {
  if (!isPlainRecord(value)) {
    addIssue(context, 'TYPE', path, 'part must be an object');
    return;
  }
  validateKeys(value, ['id', 'name', 'staves'], path, context);
  validateEntityId(value.id, `${path}.id`, context);
  if (value.name !== null && typeof value.name !== 'string') {
    addIssue(context, 'TYPE', `${path}.name`, 'name must be string or null');
  }
  if (!Array.isArray(value.staves)) {
    addIssue(context, 'TYPE', `${path}.staves`, 'staves must be an array');
    return;
  }
  if (value.staves.length === 0) {
    addIssue(context, 'EMPTY_COLLECTION', `${path}.staves`, 'part must contain at least one staff');
  }
  validateSiblingOrdinals(value.staves, `${path}.staves`, context);
  value.staves.forEach((staff, index) => validateStaff(staff, `${path}.staves[${index}]`, context));
};

const validateRevision = (value: unknown, path: string, context: ValidationContext): void => {
  if (!isPlainRecord(value)) {
    addIssue(context, 'TYPE', path, 'revision must be an object');
    return;
  }
  validateKeys(value, ['id', 'parentId'], path, context);
  validateEntityId(value.id, `${path}.id`, context);
  if (value.parentId !== null) {
    validateEntityId(value.parentId, `${path}.parentId`, context, false);
  }
};

const validateSource = (value: unknown, path: string, context: ValidationContext): void => {
  if (!isPlainRecord(value)) {
    addIssue(context, 'TYPE', path, 'source must be an object');
    return;
  }
  validateKeys(value, ['sha256', 'format', 'byteLength'], path, context);
  if (typeof value.sha256 !== 'string' || !SHA256_PATTERN.test(value.sha256)) {
    addIssue(context, 'INVALID_SHA256', `${path}.sha256`, 'sha256 must be 64 lowercase hexadecimal characters');
  }
  if (typeof value.format !== 'string' || !SOURCE_FORMATS.has(value.format)) {
    addIssue(context, 'INVALID_SOURCE_FORMAT', `${path}.format`, 'unsupported source format');
  }
  if (value.byteLength !== null && (!Number.isSafeInteger(value.byteLength) || typeof value.byteLength !== 'number' || value.byteLength < 0)) {
    addIssue(context, 'INVALID_BYTE_LENGTH', `${path}.byteLength`, 'byteLength must be a non-negative safe integer or null');
  }
};

export const validateScoreDocument = (value: unknown): ValidationResult => {
  const context: ValidationContext = { issues: [], ids: new Set<string>() };
  if (!isPlainRecord(value)) {
    return { ok: false, issues: [{ code: 'TYPE', path: '$', message: 'ScoreDocument must be a plain object' }] };
  }

  validateKeys(value, ['schemaVersion', 'id', 'revision', 'source', 'parts'], '$', context);
  if (value.schemaVersion !== SCORE_DOCUMENT_SCHEMA_VERSION) {
    addIssue(context, 'SCHEMA_VERSION', '$.schemaVersion', `must equal ${SCORE_DOCUMENT_SCHEMA_VERSION}`);
  }
  validateEntityId(value.id, '$.id', context);
  validateRevision(value.revision, '$.revision', context);
  validateSource(value.source, '$.source', context);

  if (!Array.isArray(value.parts)) {
    addIssue(context, 'TYPE', '$.parts', 'parts must be an array');
  } else {
    if (value.parts.length === 0) {
      addIssue(context, 'EMPTY_COLLECTION', '$.parts', 'document must contain at least one part');
    }
    value.parts.forEach((part, index) => validatePart(part, `$.parts[${index}]`, context));
  }

  return { ok: context.issues.length === 0, issues: context.issues };
};

const cloneJsonLike = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(cloneJsonLike);
  if (isPlainRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneJsonLike(item)]));
  }
  return value;
};

const deepFreeze = <T>(value: T): Readonly<T> => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const item of Object.values(value as Record<string, unknown>)) {
      deepFreeze(item);
    }
    Object.freeze(value);
  }
  return value;
};

export class ScoreDocumentValidationError extends Error {
  public readonly issues: readonly ValidationIssue[];

  public constructor(issues: readonly ValidationIssue[]) {
    super(`ScoreDocument validation failed with ${issues.length} issue(s)`);
    this.name = 'ScoreDocumentValidationError';
    this.issues = Object.freeze([...issues]);
  }
}

export const createScoreDocument = (value: unknown): Readonly<ScoreDocument> => {
  const result = validateScoreDocument(value);
  if (!result.ok) throw new ScoreDocumentValidationError(result.issues);
  const detached = cloneJsonLike(value) as ScoreDocument;
  return deepFreeze(detached);
};
