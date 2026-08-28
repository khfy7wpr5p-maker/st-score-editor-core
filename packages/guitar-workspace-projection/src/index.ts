import { createSemanticAddressIndex } from '../../addressing/src/index.js';
import type { SemanticAddress } from '../../addressing/src/index.js';
import {
  createGuitarWorkspaceSourceMap,
  type GuitarWorkspaceSourceMap,
  type GuitarWorkspaceSourceMapEntry,
  type GuitarWorkspaceTargetAddress
} from '../../guitar-workspace-contract/src/index.js';
import {
  createNotationDocument,
  notationForMeasure,
  notationForNote,
  type NotationDocument,
  type TimeSignature
} from '../../notation-structure/src/index.js';
import {
  validateScoreDocument,
  type Rational,
  type ScoreDocument,
  type ScoreEvent,
  type Voice
} from '../../score-model/src/index.js';

export const GUITAR_WORKSPACE_PROJECTION_VERSION = '1.0.0' as const;
export const GUITAR_WORKSPACE_ENGINE_PART_ID = 'P1' as const;
export const GUITAR_WORKSPACE_MUSICXML_VERSION = '4.0' as const;

const MAX_DIVISIONS = 16_384;
const MAX_PROJECTED_MEASURES = 2_000;
const MAX_PROJECTED_SOURCE_EVENTS = 50_000;
const MAX_SOURCE_STRING_LENGTH = 256;

export const guitarWorkspaceProjectionProfile = Object.freeze({
  version: GUITAR_WORKSPACE_PROJECTION_VERSION,
  musicXmlVersion: GUITAR_WORKSPACE_MUSICXML_VERSION,
  enginePartId: GUITAR_WORKSPACE_ENGINE_PART_ID,
  exactPartCount: 1,
  maximumStaves: 2,
  maximumMeasures: MAX_PROJECTED_MEASURES,
  maximumSourceEvents: MAX_PROJECTED_SOURCE_EVENTS,
  musicXmlAndSourceMapSameTraversal: true,
  preservesCanonicalPitchAndTiming: true,
  preservesTieStartStopFacts: true,
  omitsNonEngineNotationSemantics: true,
  externalEngineInvocation: false,
  externalResultIngestion: false,
  reverseCanonicalWriteAuthority: false,
  productionAuthority: false
});

export interface GuitarWorkspaceProjection {
  readonly contractVersion: typeof GUITAR_WORKSPACE_PROJECTION_VERSION;
  readonly documentId: string;
  readonly revisionId: string;
  readonly enginePartId: typeof GUITAR_WORKSPACE_ENGINE_PART_ID;
  readonly musicXmlVersion: typeof GUITAR_WORKSPACE_MUSICXML_VERSION;
  readonly musicXml: string;
  readonly sourceEventCount: number;
  readonly sourceMap: Readonly<GuitarWorkspaceSourceMap>;
}

export type GuitarWorkspaceProjectionErrorCode =
  | 'INVALID_SCORE'
  | 'INVALID_NOTATION'
  | 'STALE_NOTATION'
  | 'UNSUPPORTED_PART_COUNT'
  | 'UNSUPPORTED_STAFF_COUNT'
  | 'MISALIGNED_STAVES'
  | 'MISSING_TIME_SIGNATURE'
  | 'INCONSISTENT_TIME_SIGNATURE'
  | 'INVALID_DISPLAY_METADATA'
  | 'EVENT_OUTSIDE_MEASURE'
  | 'OVERLAPPING_VOICE_EVENTS'
  | 'SERIALIZATION_LIMIT'
  | 'SOURCE_MAP_TARGET_MISSING';

export class GuitarWorkspaceProjectionError extends Error {
  readonly code: GuitarWorkspaceProjectionErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(message: string, code: GuitarWorkspaceProjectionErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'GuitarWorkspaceProjectionError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const absBig = (value: bigint): bigint => value < 0n ? -value : value;
const gcd = (left: bigint, right: bigint): bigint => {
  let a = absBig(left);
  let b = absBig(right);
  while (b !== 0n) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a;
};
const lcm = (left: bigint, right: bigint): bigint =>
  left === 0n || right === 0n ? 0n : absBig((left / gcd(left, right)) * right);

const factor = (value: Rational): bigint => BigInt(value.denominator) / gcd(BigInt(value.denominator), 4n);
const timeFactor = (time: TimeSignature): bigint => BigInt(time.beatType) / gcd(BigInt(time.beatType), 4n);

const compare = (left: Rational, right: Rational): number => {
  const l = BigInt(left.numerator) * BigInt(right.denominator);
  const r = BigInt(right.numerator) * BigInt(left.denominator);
  return l < r ? -1 : l > r ? 1 : 0;
};

const add = (left: Rational, right: Rational): Rational => {
  const numerator = BigInt(left.numerator) * BigInt(right.denominator)
    + BigInt(right.numerator) * BigInt(left.denominator);
  const denominator = BigInt(left.denominator) * BigInt(right.denominator);
  const divisor = gcd(numerator, denominator);
  return {
    numerator: Number(numerator / divisor),
    denominator: Number(denominator / divisor)
  };
};

const units = (value: Rational, divisions: number, label: string): number => {
  const numerator = BigInt(value.numerator) * 4n * BigInt(divisions);
  const denominator = BigInt(value.denominator);
  if (numerator % denominator !== 0n) {
    throw new GuitarWorkspaceProjectionError(
      'Canonical timing cannot be represented by the selected engine MusicXML divisions.',
      'SERIALIZATION_LIMIT',
      { label }
    );
  }
  const result = numerator / denominator;
  if (result < 0n || result > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new GuitarWorkspaceProjectionError(
      'Engine MusicXML timing exceeds the safe integer range.',
      'SERIALIZATION_LIMIT',
      { label }
    );
  }
  return Number(result);
};

const escapeText = (value: string): string => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');
const escapeAttribute = (value: string): string => escapeText(value)
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

const sorted = <T extends { readonly ordinal: number }>(items: readonly T[]): readonly T[] =>
  [...items].sort((left, right) => left.ordinal - right.ordinal);

const sameTime = (left: TimeSignature, right: TimeSignature): boolean =>
  left.beats === right.beats && left.beatType === right.beatType;

const boundedDisplayString = (value: string | null, label: string): string => {
  if (value === null || value.length === 0 || value.length > MAX_SOURCE_STRING_LENGTH) {
    throw new GuitarWorkspaceProjectionError(
      `${label} must be a bounded non-empty string for the engine projection.`,
      'INVALID_DISPLAY_METADATA',
      { label, maximumLength: MAX_SOURCE_STRING_LENGTH }
    );
  }
  return value;
};

const resolveTimeSignature = (
  notation: NotationDocument,
  measureIds: readonly string[],
  active: TimeSignature | null,
  measureIndex: number
): TimeSignature => {
  const direct = measureIds.map((measureId) => notationForMeasure(notation, measureId)?.timeSignature ?? null);
  const present = direct.filter((value): value is TimeSignature => value !== null);
  if (present.length === 0) {
    if (active === null) {
      throw new GuitarWorkspaceProjectionError(
        'A time signature must be established before Guitar Workspace timing can be projected.',
        'MISSING_TIME_SIGNATURE',
        { measureIndex }
      );
    }
    return active;
  }
  if (present.length !== direct.length || !present.every((value) => sameTime(value, present[0]!))) {
    throw new GuitarWorkspaceProjectionError(
      'Aligned staves must declare the same time signature or inherit it together.',
      'INCONSISTENT_TIME_SIGNATURE',
      { measureIndex }
    );
  }
  return present[0]!;
};

const chooseMeasureDivisions = (
  staffMeasures: readonly { readonly voices: readonly Voice[] }[],
  time: TimeSignature,
  measureIndex: number
): number => {
  let divisions = timeFactor(time);
  for (const staffMeasure of staffMeasures) {
    for (const voice of staffMeasure.voices) {
      for (const event of voice.events) {
        divisions = lcm(divisions, factor(event.onset));
        divisions = lcm(divisions, factor(event.duration));
        if (divisions > BigInt(MAX_DIVISIONS)) {
          throw new GuitarWorkspaceProjectionError(
            'Guitar Workspace MusicXML requires divisions above the admitted serialization limit.',
            'SERIALIZATION_LIMIT',
            { measureIndex, maximumDivisions: MAX_DIVISIONS }
          );
        }
      }
    }
  }
  return Number(divisions);
};

const pitchLines = (
  pitch: { readonly step: string; readonly alter: number; readonly octave: number },
  indent: string
): string[] => {
  const lines = [`${indent}<pitch>`, `${indent}  <step>${pitch.step}</step>`];
  if (pitch.alter !== 0) lines.push(`${indent}  <alter>${pitch.alter}</alter>`);
  lines.push(`${indent}  <octave>${pitch.octave}</octave>`, `${indent}</pitch>`);
  return lines;
};

const sourceEventId = (measureIndex: number, sourceOrder: number): string =>
  `${GUITAR_WORKSPACE_ENGINE_PART_ID}:measure:${measureIndex}:note:${sourceOrder}`;

const targetFor = (
  addressIndex: ReadonlyMap<string, SemanticAddress>,
  entityId: string
): GuitarWorkspaceTargetAddress => {
  const target = addressIndex.get(entityId);
  if (target === undefined || (target.kind !== 'event' && target.kind !== 'note')) {
    throw new GuitarWorkspaceProjectionError(
      'An emitted engine source note could not be linked to a canonical event/note address.',
      'SOURCE_MAP_TARGET_MISSING',
      { entityId }
    );
  }
  return target;
};

interface EmitContext {
  readonly score: ScoreDocument;
  readonly notation: NotationDocument;
  readonly addressIndex: ReadonlyMap<string, SemanticAddress>;
  readonly measureIndex: number;
  readonly staffNumber: number;
  readonly voiceId: string;
  readonly durationUnits: number;
  readonly sourceMapEntries: GuitarWorkspaceSourceMapEntry[];
  sourceOrder: number;
}

const emitScoreEvent = (event: ScoreEvent, context: EmitContext): string[] => {
  const emit = (
    pitch: { readonly step: string; readonly alter: number; readonly octave: number } | null,
    targetEntityId: string,
    noteId: string | null,
    chordWithPrevious: boolean
  ): string[] => {
    if (context.sourceMapEntries.length >= MAX_PROJECTED_SOURCE_EVENTS) {
      throw new GuitarWorkspaceProjectionError(
        'Guitar Workspace projection exceeds the external source-event ceiling.',
        'SERIALIZATION_LIMIT',
        { maximumSourceEvents: MAX_PROJECTED_SOURCE_EVENTS }
      );
    }

    const sourceId = sourceEventId(context.measureIndex, context.sourceOrder);
    context.sourceOrder += 1;
    context.sourceMapEntries.push({
      sourceEventId: sourceId,
      target: targetFor(context.addressIndex, targetEntityId)
    });

    const lines = ['      <note>'];
    if (chordWithPrevious) lines.push('        <chord/>');
    if (pitch === null) lines.push('        <rest/>');
    else lines.push(...pitchLines(pitch, '        '));
    lines.push(`        <duration>${context.durationUnits}</duration>`);
    if (noteId !== null) {
      for (const tie of notationForNote(context.notation, noteId)?.ties ?? []) {
        lines.push(`        <tie type="${tie.type}"/>`);
      }
    }
    lines.push(`        <voice>${context.voiceId}</voice>`);
    lines.push(`        <staff>${context.staffNumber}</staff>`);
    lines.push('      </note>');
    return lines;
  };

  if (event.kind === 'rest') return emit(null, event.id, null, false);
  if (event.kind === 'note') return emit(event.note.pitch, event.note.id, event.note.id, false);
  return event.notes.flatMap((note, index) => emit(note.pitch, note.id, note.id, index > 0));
};

const streamLines = (
  score: ScoreDocument,
  notation: NotationDocument,
  addressIndex: ReadonlyMap<string, SemanticAddress>,
  voice: Voice,
  staffNumber: number,
  divisions: number,
  measureIndex: number,
  sourceMapEntries: GuitarWorkspaceSourceMapEntry[],
  sourceOrderState: { value: number },
  expectedDuration: Rational
): { readonly lines: readonly string[]; readonly endUnits: number } => {
  const lines: string[] = [];
  let cursor: Rational = { numerator: 0, denominator: 1 };
  let cursorUnits = 0;
  for (const [eventIndex, event] of voice.events.entries()) {
    if (compare(event.onset, cursor) < 0) {
      throw new GuitarWorkspaceProjectionError(
        'Overlapping events in one canonical voice cannot be serialized to the admitted engine source profile.',
        'OVERLAPPING_VOICE_EVENTS',
        { measureIndex, staffNumber, voiceOrdinal: voice.ordinal, eventIndex }
      );
    }
    const end = add(event.onset, event.duration);
    if (compare(end, expectedDuration) > 0) {
      throw new GuitarWorkspaceProjectionError(
        'A canonical event extends beyond the active Guitar Workspace measure duration.',
        'EVENT_OUTSIDE_MEASURE',
        { measureIndex, staffNumber, voiceOrdinal: voice.ordinal, eventIndex }
      );
    }
    const onsetUnits = units(event.onset, divisions, `measure:${measureIndex}:event:${event.id}:onset`);
    if (onsetUnits > cursorUnits) {
      lines.push('      <forward>', `        <duration>${onsetUnits - cursorUnits}</duration>`, '      </forward>');
    }
    const durationUnits = units(event.duration, divisions, `measure:${measureIndex}:event:${event.id}:duration`);
    const context: EmitContext = {
      score,
      notation,
      addressIndex,
      measureIndex,
      staffNumber,
      voiceId: String(voice.ordinal),
      durationUnits,
      sourceMapEntries,
      sourceOrder: sourceOrderState.value
    };
    lines.push(...emitScoreEvent(event, context));
    sourceOrderState.value = context.sourceOrder;
    cursor = end;
    cursorUnits = onsetUnits + durationUnits;
  }
  return { lines, endUnits: cursorUnits };
};

export const createGuitarWorkspaceProjection = (
  score: ScoreDocument,
  notationInput: NotationDocument
): Readonly<GuitarWorkspaceProjection> => {
  const scoreValidation = validateScoreDocument(score);
  if (!scoreValidation.ok) {
    throw new GuitarWorkspaceProjectionError(
      'Guitar Workspace projection requires a valid canonical ScoreDocument.',
      'INVALID_SCORE',
      { issueCount: scoreValidation.issues.length }
    );
  }

  let notation: Readonly<NotationDocument>;
  try {
    notation = createNotationDocument(score, notationInput);
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? String((error as { code?: unknown }).code) : null;
    throw new GuitarWorkspaceProjectionError(
      'Guitar Workspace projection requires a valid notation document bound to the same revision.',
      code === 'STALE_NOTATION' ? 'STALE_NOTATION' : 'INVALID_NOTATION',
      { notationCode: code }
    );
  }

  if (score.parts.length !== 1) {
    throw new GuitarWorkspaceProjectionError(
      'The initial Guitar Workspace projection admits exactly one canonical part.',
      'UNSUPPORTED_PART_COUNT',
      { observed: score.parts.length }
    );
  }
  const part = score.parts[0]!;
  if (part.staves.length < 1 || part.staves.length > 2) {
    throw new GuitarWorkspaceProjectionError(
      'The initial Guitar Workspace projection admits one or two staves only.',
      'UNSUPPORTED_STAFF_COUNT',
      { observed: part.staves.length }
    );
  }
  const partName = boundedDisplayString(part.name, 'part.name');
  const staves = sorted(part.staves);
  const measuresByStaff = staves.map((staff) => sorted(staff.measures));
  const referenceMeasures = measuresByStaff[0]!;
  if (referenceMeasures.length > MAX_PROJECTED_MEASURES) {
    throw new GuitarWorkspaceProjectionError(
      'Guitar Workspace projection exceeds the external measure ceiling.',
      'SERIALIZATION_LIMIT',
      { maximumMeasures: MAX_PROJECTED_MEASURES }
    );
  }
  if (measuresByStaff.some((measures) => measures.length !== referenceMeasures.length)) {
    throw new GuitarWorkspaceProjectionError(
      'Canonical staves must contain the same number of measures for Guitar Workspace projection.',
      'MISALIGNED_STAVES'
    );
  }

  const addressIndex = createSemanticAddressIndex(score).byEntityId;
  const sourceMapEntries: GuitarWorkspaceSourceMapEntry[] = [];
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<score-partwise version="${GUITAR_WORKSPACE_MUSICXML_VERSION}">`,
    '  <part-list>',
    `    <score-part id="${GUITAR_WORKSPACE_ENGINE_PART_ID}">`,
    `      <part-name>${escapeText(partName)}</part-name>`,
    '    </score-part>',
    '  </part-list>',
    `  <part id="${GUITAR_WORKSPACE_ENGINE_PART_ID}">`
  ];

  let activeTime: TimeSignature | null = null;
  for (let measureIndex = 0; measureIndex < referenceMeasures.length; measureIndex += 1) {
    const staffMeasures = measuresByStaff.map((measures) => measures[measureIndex]!);
    const reference = staffMeasures[0]!;
    const displayNumber = boundedDisplayString(reference.displayNumber, `measure[${measureIndex}].displayNumber`);
    if (staffMeasures.some((measure) => measure.ordinal !== reference.ordinal || measure.displayNumber !== reference.displayNumber)) {
      throw new GuitarWorkspaceProjectionError(
        'Canonical staff measures must align by ordinal and display number.',
        'MISALIGNED_STAVES',
        { measureIndex }
      );
    }

    activeTime = resolveTimeSignature(notation, staffMeasures.map((measure) => measure.id), activeTime, measureIndex);
    const divisions = chooseMeasureDivisions(staffMeasures, activeTime, measureIndex);
    const expectedDuration: Rational = { numerator: activeTime.beats, denominator: activeTime.beatType };

    lines.push(`    <measure number="${escapeAttribute(displayNumber)}">`);
    lines.push('      <attributes>');
    lines.push(`        <divisions>${divisions}</divisions>`);
    lines.push('        <time>');
    lines.push(`          <beats>${activeTime.beats}</beats>`);
    lines.push(`          <beat-type>${activeTime.beatType}</beat-type>`);
    lines.push('        </time>');
    lines.push(`        <staves>${staves.length}</staves>`);
    lines.push('      </attributes>');

    const streams: { readonly staffNumber: number; readonly voice: Voice }[] = [];
    for (let staffIndex = 0; staffIndex < staffMeasures.length; staffIndex += 1) {
      const measure = staffMeasures[staffIndex]!;
      for (const voice of sorted(measure.voices)) {
        if (voice.events.length > 0) streams.push({ staffNumber: staffIndex + 1, voice });
      }
    }

    const sourceOrderState = { value: 0 };
    for (let streamIndex = 0; streamIndex < streams.length; streamIndex += 1) {
      const stream = streams[streamIndex]!;
      const output = streamLines(
        score,
        notation,
        addressIndex,
        stream.voice,
        stream.staffNumber,
        divisions,
        measureIndex,
        sourceMapEntries,
        sourceOrderState,
        expectedDuration
      );
      lines.push(...output.lines);
      if (streamIndex < streams.length - 1 && output.endUnits > 0) {
        lines.push('      <backup>', `        <duration>${output.endUnits}</duration>`, '      </backup>');
      }
    }
    lines.push('    </measure>');
  }

  lines.push('  </part>', '</score-partwise>');
  const sourceMap = createGuitarWorkspaceSourceMap(score, sourceMapEntries);
  return Object.freeze({
    contractVersion: GUITAR_WORKSPACE_PROJECTION_VERSION,
    documentId: score.id,
    revisionId: score.revision.id,
    enginePartId: GUITAR_WORKSPACE_ENGINE_PART_ID,
    musicXmlVersion: GUITAR_WORKSPACE_MUSICXML_VERSION,
    musicXml: `${lines.join('\n')}\n`,
    sourceEventCount: sourceMap.entries.length,
    sourceMap
  });
};
