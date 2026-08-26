import type { ScoreDocument } from '../../score-model/src/index.js';
import { resolveSemanticAddress } from '../../addressing/src/index.js';
import type { EventAddress, MeasureAddress, NoteAddress } from '../../addressing/src/index.js';

export const NOTATION_DOCUMENT_VERSION = '1.0.0' as const;

export type AccidentalDisplay = 'sharp' | 'flat' | 'natural' | 'double-sharp' | 'double-flat';
export type ClefSign = 'G' | 'F' | 'C' | 'percussion' | 'TAB';
export type BeamValue = 'begin' | 'continue' | 'end' | 'forward-hook' | 'backward-hook';
export type BarlineStyle = 'regular' | 'light-light' | 'light-heavy' | 'heavy-light' | 'heavy-heavy' | 'dashed' | 'dotted' | 'none';
export type BoundaryMarkType = 'start' | 'stop';

export interface TimeSignature {
  readonly beats: number;
  readonly beatType: number;
}
export interface KeySignature { readonly fifths: number }
export interface ClefSpec { readonly sign: ClefSign; readonly line: number; readonly octaveChange: number }
export interface BarlineSpec { readonly location: 'left' | 'right'; readonly style: BarlineStyle; readonly repeat: 'forward' | 'backward' | null }
export interface BeamSpec { readonly number: number; readonly value: BeamValue }
export interface BoundaryMark { readonly number: number; readonly type: BoundaryMarkType }
export interface TupletSpec {
  readonly actualNotes: number;
  readonly normalNotes: number;
  readonly marks: readonly BoundaryMark[];
}

export interface MeasureNotation {
  readonly timeSignature: TimeSignature | null;
  readonly keySignature: KeySignature | null;
  readonly clef: ClefSpec | null;
  readonly barlines: readonly BarlineSpec[];
}
export interface EventNotation {
  readonly dots: number;
  readonly beams: readonly BeamSpec[];
  readonly tuplet: TupletSpec | null;
}
export interface NoteNotation {
  readonly accidental: AccidentalDisplay | null;
  readonly ties: readonly BoundaryMark[];
  readonly slurs: readonly BoundaryMark[];
}

export interface MeasureNotationEntry { readonly target: MeasureAddress; readonly notation: MeasureNotation }
export interface EventNotationEntry { readonly target: EventAddress; readonly notation: EventNotation }
export interface NoteNotationEntry { readonly target: NoteAddress; readonly notation: NoteNotation }

export interface NotationDocument {
  readonly contractVersion: typeof NOTATION_DOCUMENT_VERSION;
  readonly documentId: string;
  readonly revisionId: string;
  readonly measures: readonly MeasureNotationEntry[];
  readonly events: readonly EventNotationEntry[];
  readonly notes: readonly NoteNotationEntry[];
}

export type NotationErrorCode = 'INVALID_NOTATION' | 'DUPLICATE_TARGET' | 'STALE_NOTATION' | 'TARGET_KIND_MISMATCH';
export class NotationError extends Error {
  readonly code: NotationErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: NotationErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'NotationError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const exactKeys = (value: unknown, keys: readonly string[], label: string): Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new NotationError(`${label} must be an object.`, 'INVALID_NOTATION');
  const record = value as Record<string, unknown>;
  const observed = Object.keys(record).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(observed) !== JSON.stringify(expected)) throw new NotationError(`${label} field set is invalid.`, 'INVALID_NOTATION', { observed, expected });
  return record;
};
const integerBetween = (value: unknown, min: number, max: number, label: string): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new NotationError(`${label} is outside admitted range.`, 'INVALID_NOTATION', { value, min, max });
  return value;
};
const enumValue = <T extends string>(value: unknown, allowed: readonly T[], label: string): T => {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new NotationError(`${label} is unsupported.`, 'INVALID_NOTATION', { value });
  return value as T;
};

const validateBoundaryMarks = (value: unknown, label: string): readonly BoundaryMark[] => {
  if (!Array.isArray(value)) throw new NotationError(`${label} must be an array.`, 'INVALID_NOTATION');
  const seen = new Set<string>();
  return value.map((item, index) => {
    const record = exactKeys(item, ['number','type'], `${label}[${index}]`);
    const number = integerBetween(record.number, 1, 16, `${label}[${index}].number`);
    const type = enumValue(record.type, ['start','stop'] as const, `${label}[${index}].type`);
    const key = `${number}:${type}`;
    if (seen.has(key)) throw new NotationError(`${label} contains a duplicate boundary mark.`, 'INVALID_NOTATION', { key });
    seen.add(key);
    return Object.freeze({ number, type });
  });
};

const validateMeasureNotation = (value: unknown): MeasureNotation => {
  const record = exactKeys(value, ['timeSignature','keySignature','clef','barlines'], 'MeasureNotation');
  let timeSignature: TimeSignature | null = null;
  if (record.timeSignature !== null) {
    const time = exactKeys(record.timeSignature, ['beats','beatType'], 'TimeSignature');
    const beats = integerBetween(time.beats, 1, 32, 'TimeSignature.beats');
    const beatType = integerBetween(time.beatType, 1, 64, 'TimeSignature.beatType');
    if (![1,2,4,8,16,32,64].includes(beatType)) throw new NotationError('TimeSignature.beatType must be a power-of-two notation denominator.', 'INVALID_NOTATION');
    timeSignature = Object.freeze({ beats, beatType });
  }
  let keySignature: KeySignature | null = null;
  if (record.keySignature !== null) {
    const key = exactKeys(record.keySignature, ['fifths'], 'KeySignature');
    keySignature = Object.freeze({ fifths: integerBetween(key.fifths, -7, 7, 'KeySignature.fifths') });
  }
  let clef: ClefSpec | null = null;
  if (record.clef !== null) {
    const item = exactKeys(record.clef, ['sign','line','octaveChange'], 'ClefSpec');
    clef = Object.freeze({
      sign: enumValue(item.sign, ['G','F','C','percussion','TAB'] as const, 'ClefSpec.sign'),
      line: integerBetween(item.line, 1, 5, 'ClefSpec.line'),
      octaveChange: integerBetween(item.octaveChange, -2, 2, 'ClefSpec.octaveChange')
    });
  }
  if (!Array.isArray(record.barlines) || record.barlines.length > 2) throw new NotationError('MeasureNotation.barlines must contain at most left and right barlines.', 'INVALID_NOTATION');
  const seenLocations = new Set<string>();
  const barlines = record.barlines.map((item, index) => {
    const bar = exactKeys(item, ['location','style','repeat'], `barlines[${index}]`);
    const location = enumValue(bar.location, ['left','right'] as const, 'Barline.location');
    if (seenLocations.has(location)) throw new NotationError('MeasureNotation contains duplicate barline location.', 'INVALID_NOTATION', { location });
    seenLocations.add(location);
    const style = enumValue(bar.style, ['regular','light-light','light-heavy','heavy-light','heavy-heavy','dashed','dotted','none'] as const, 'Barline.style');
    const repeat = bar.repeat === null ? null : enumValue(bar.repeat, ['forward','backward'] as const, 'Barline.repeat');
    return Object.freeze({ location, style, repeat });
  });
  return Object.freeze({ timeSignature, keySignature, clef, barlines: Object.freeze(barlines) });
};

const validateEventNotation = (value: unknown): EventNotation => {
  const record = exactKeys(value, ['dots','beams','tuplet'], 'EventNotation');
  const dots = integerBetween(record.dots, 0, 3, 'EventNotation.dots');
  if (!Array.isArray(record.beams) || record.beams.length > 8) throw new NotationError('EventNotation.beams must be an array of at most 8 beams.', 'INVALID_NOTATION');
  const seenBeams = new Set<number>();
  const beams = record.beams.map((item, index) => {
    const beam = exactKeys(item, ['number','value'], `beams[${index}]`);
    const number = integerBetween(beam.number, 1, 8, `beams[${index}].number`);
    if (seenBeams.has(number)) throw new NotationError('EventNotation contains duplicate beam number.', 'INVALID_NOTATION', { number });
    seenBeams.add(number);
    return Object.freeze({ number, value: enumValue(beam.value, ['begin','continue','end','forward-hook','backward-hook'] as const, `beams[${index}].value`) });
  });
  let tuplet: TupletSpec | null = null;
  if (record.tuplet !== null) {
    const item = exactKeys(record.tuplet, ['actualNotes','normalNotes','marks'], 'TupletSpec');
    tuplet = Object.freeze({
      actualNotes: integerBetween(item.actualNotes, 1, 32, 'TupletSpec.actualNotes'),
      normalNotes: integerBetween(item.normalNotes, 1, 32, 'TupletSpec.normalNotes'),
      marks: Object.freeze([...validateBoundaryMarks(item.marks, 'TupletSpec.marks')])
    });
  }
  return Object.freeze({ dots, beams: Object.freeze(beams), tuplet });
};

const validateNoteNotation = (value: unknown): NoteNotation => {
  const record = exactKeys(value, ['accidental','ties','slurs'], 'NoteNotation');
  const accidental = record.accidental === null ? null : enumValue(record.accidental, ['sharp','flat','natural','double-sharp','double-flat'] as const, 'NoteNotation.accidental');
  return Object.freeze({
    accidental,
    ties: Object.freeze([...validateBoundaryMarks(record.ties, 'NoteNotation.ties')]),
    slurs: Object.freeze([...validateBoundaryMarks(record.slurs, 'NoteNotation.slurs')])
  });
};

export interface NotationDocumentInput {
  readonly contractVersion: typeof NOTATION_DOCUMENT_VERSION;
  readonly documentId: string;
  readonly revisionId: string;
  readonly measures: readonly MeasureNotationEntry[];
  readonly events: readonly EventNotationEntry[];
  readonly notes: readonly NoteNotationEntry[];
}

export const createNotationDocument = (score: ScoreDocument, input: NotationDocumentInput): Readonly<NotationDocument> => {
  exactKeys(input, ['contractVersion','documentId','revisionId','measures','events','notes'], 'NotationDocument');
  if (input.contractVersion !== NOTATION_DOCUMENT_VERSION) throw new NotationError('NotationDocument version is unsupported.', 'INVALID_NOTATION');
  if (input.documentId !== score.id || input.revisionId !== score.revision.id) throw new NotationError('NotationDocument is bound to another score revision.', 'STALE_NOTATION', { expectedDocumentId: score.id, expectedRevisionId: score.revision.id });
  const validateEntries = <T extends { readonly target: MeasureAddress | EventAddress | NoteAddress; readonly notation: unknown }>(
    entries: readonly T[], expectedKind: 'measure' | 'event' | 'note', notationValidator: (value: unknown) => unknown
  ): readonly T[] => {
    if (!Array.isArray(entries)) throw new NotationError('Notation entries must be arrays.', 'INVALID_NOTATION');
    const seen = new Set<string>();
    return entries.map((entry) => {
      exactKeys(entry, ['target','notation'], `${expectedKind} notation entry`);
      const resolved = resolveSemanticAddress(score, entry.target);
      if (resolved.kind !== expectedKind) throw new NotationError('Notation target kind is invalid.', 'TARGET_KIND_MISMATCH', { expectedKind, observed: resolved.kind });
      const targetId = expectedKind === 'measure' ? (entry.target as MeasureAddress).measureId : expectedKind === 'event' ? (entry.target as EventAddress).eventId : (entry.target as NoteAddress).noteId;
      if (seen.has(targetId)) throw new NotationError('NotationDocument contains duplicate target.', 'DUPLICATE_TARGET', { targetId });
      seen.add(targetId);
      const notation = notationValidator(entry.notation) as T['notation'];
      return Object.freeze({ target: entry.target, notation }) as T;
    });
  };
  const measures = validateEntries(input.measures, 'measure', validateMeasureNotation) as readonly MeasureNotationEntry[];
  const events = validateEntries(input.events, 'event', validateEventNotation) as readonly EventNotationEntry[];
  const notes = validateEntries(input.notes, 'note', validateNoteNotation) as readonly NoteNotationEntry[];
  return Object.freeze({ contractVersion: NOTATION_DOCUMENT_VERSION, documentId: score.id, revisionId: score.revision.id, measures: Object.freeze([...measures]), events: Object.freeze([...events]), notes: Object.freeze([...notes]) });
};

export const emptyNotationDocument = (score: ScoreDocument): Readonly<NotationDocument> => createNotationDocument(score, {
  contractVersion: NOTATION_DOCUMENT_VERSION, documentId: score.id, revisionId: score.revision.id, measures: [], events: [], notes: []
});

export const notationForMeasure = (document: NotationDocument, measureId: string): MeasureNotation | null => document.measures.find((entry) => entry.target.measureId === measureId)?.notation ?? null;
export const notationForEvent = (document: NotationDocument, eventId: string): EventNotation | null => document.events.find((entry) => entry.target.eventId === eventId)?.notation ?? null;
export const notationForNote = (document: NotationDocument, noteId: string): NoteNotation | null => document.notes.find((entry) => entry.target.noteId === noteId)?.notation ?? null;
