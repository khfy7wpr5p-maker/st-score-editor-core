import { validateScoreDocument } from '../../score-model/src/index.js';
import type {
  Rational,
  ScoreDocument,
  ScoreEvent,
  Voice
} from '../../score-model/src/index.js';

import { MusicXmlError } from './errors.js';

export const MAX_SERIALIZED_DIVISIONS = 16_384;

const absBig = (value: bigint): bigint => value < 0n ? -value : value;
const gcdBig = (left: bigint, right: bigint): bigint => {
  let a = absBig(left);
  let b = absBig(right);
  while (b !== 0n) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a;
};

const lcmBig = (left: bigint, right: bigint): bigint =>
  left === 0n || right === 0n ? 0n : absBig((left / gcdBig(left, right)) * right);

const compareRational = (left: Rational, right: Rational): number => {
  const lhs = BigInt(left.numerator) * BigInt(right.denominator);
  const rhs = BigInt(right.numerator) * BigInt(left.denominator);
  return lhs < rhs ? -1 : lhs > rhs ? 1 : 0;
};

const addRational = (left: Rational, right: Rational): Rational => {
  const numerator = BigInt(left.numerator) * BigInt(right.denominator) + BigInt(right.numerator) * BigInt(left.denominator);
  const denominator = BigInt(left.denominator) * BigInt(right.denominator);
  const divisor = gcdBig(numerator, denominator);
  const n = numerator / divisor;
  const d = denominator / divisor;
  if (n > BigInt(Number.MAX_SAFE_INTEGER) || d > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new MusicXmlError('Rational exceeds safe serialization range.', 'SERIALIZATION_LIMIT');
  }
  return { numerator: Number(n), denominator: Number(d) };
};

const xmlUnits = (value: Rational, divisions: number, path: string): number => {
  const numerator = BigInt(value.numerator) * 4n * BigInt(divisions);
  const denominator = BigInt(value.denominator);
  if (numerator % denominator !== 0n) {
    throw new MusicXmlError('Rational cannot be represented by selected MusicXML divisions.', 'SERIALIZATION_LIMIT', {
      path,
      value,
      divisions
    });
  }
  const units = numerator / denominator;
  if (units < 0n || units > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new MusicXmlError('MusicXML duration units exceed safe range.', 'SERIALIZATION_LIMIT', { path });
  }
  return Number(units);
};

const requiredDivisionsFactor = (value: Rational): bigint => {
  const denominator = BigInt(value.denominator);
  return denominator / gcdBig(denominator, 4n);
};

const chooseDivisions = (document: ScoreDocument): number => {
  let divisions = 1n;
  for (const part of document.parts) {
    for (const staff of part.staves) {
      for (const measure of staff.measures) {
        for (const voice of measure.voices) {
          for (const event of voice.events) {
            divisions = lcmBig(divisions, requiredDivisionsFactor(event.onset));
            divisions = lcmBig(divisions, requiredDivisionsFactor(event.duration));
            if (divisions > BigInt(MAX_SERIALIZED_DIVISIONS)) {
              throw new MusicXmlError('Required MusicXML divisions exceed serialization limit.', 'SERIALIZATION_LIMIT', {
                limit: MAX_SERIALIZED_DIVISIONS,
                observed: divisions.toString()
              });
            }
          }
        }
      }
    }
  }
  return Number(divisions);
};

const escapeText = (value: string): string => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

const escapeAttribute = (value: string): string => escapeText(value)
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

const pitchXml = (step: string, alter: number, octave: number, indent: string): string[] => {
  const result = [`${indent}<pitch>`, `${indent}  <step>${step}</step>`];
  if (alter !== 0) result.push(`${indent}  <alter>${alter}</alter>`);
  result.push(`${indent}  <octave>${octave}</octave>`, `${indent}</pitch>`);
  return result;
};

const noteXml = (
  event: ScoreEvent,
  durationUnits: number,
  voice: number,
  staff: number,
  multiStaff: boolean,
  indent: string
): string[] => {
  const makeOne = (
    pitch: { step: string; alter: number; octave: number } | null,
    chord: boolean
  ): string[] => {
    const lines = [`${indent}<note>`];
    if (chord) lines.push(`${indent}  <chord/>`);
    if (pitch === null) lines.push(`${indent}  <rest/>`);
    else lines.push(...pitchXml(pitch.step, pitch.alter, pitch.octave, `${indent}  `));
    lines.push(`${indent}  <duration>${durationUnits}</duration>`);
    lines.push(`${indent}  <voice>${voice}</voice>`);
    if (multiStaff) lines.push(`${indent}  <staff>${staff}</staff>`);
    lines.push(`${indent}</note>`);
    return lines;
  };

  if (event.kind === 'rest') return makeOne(null, false);
  if (event.kind === 'note') return makeOne(event.note.pitch, false);
  return event.notes.flatMap((note, index) => makeOne(note.pitch, index > 0));
};

const sortedByOrdinal = <T extends { readonly ordinal: number }>(items: readonly T[]): T[] =>
  [...items].sort((left, right) => left.ordinal - right.ordinal);

const validatePartMeasureAlignment = (document: ScoreDocument): void => {
  for (const [partIndex, part] of document.parts.entries()) {
    const staves = sortedByOrdinal(part.staves);
    const first = staves[0];
    if (first === undefined) continue;
    for (const staff of staves.slice(1)) {
      if (staff.measures.length !== first.measures.length) {
        throw new MusicXmlError('All staves in a part must have aligned measure counts for E2 serialization.', 'UNSUPPORTED_MUSICXML', {
          partIndex,
          staff: staff.ordinal
        });
      }
      for (let index = 0; index < first.measures.length; index += 1) {
        const reference = first.measures[index];
        const candidate = staff.measures[index];
        if (
          reference === undefined ||
          candidate === undefined ||
          reference.ordinal !== candidate.ordinal ||
          reference.displayNumber !== candidate.displayNumber
        ) {
          throw new MusicXmlError('All staves must share measure ordinal and display number.', 'UNSUPPORTED_MUSICXML', {
            partIndex,
            staff: staff.ordinal,
            measureIndex: index
          });
        }
      }
    }
  }
};

type Stream = {
  readonly staff: number;
  readonly voice: Voice;
};

const serializeStream = (
  stream: Stream,
  divisions: number,
  multiStaff: boolean,
  path: string
): { readonly lines: string[]; readonly endUnits: number } => {
  const lines: string[] = [];
  let cursor: Rational = { numerator: 0, denominator: 1 };
  let cursorUnits = 0;

  for (const [eventIndex, event] of stream.voice.events.entries()) {
    const eventPath = `${path}.event[${eventIndex}]`;
    if (compareRational(event.onset, cursor) < 0) {
      throw new MusicXmlError('Overlapping events in one canonical voice require a future structural serializer.', 'OVERLAPPING_EVENTS', {
        path: eventPath
      });
    }
    const onsetUnits = xmlUnits(event.onset, divisions, `${eventPath}.onset`);
    if (onsetUnits > cursorUnits) {
      lines.push('      <forward>', `        <duration>${onsetUnits - cursorUnits}</duration>`, '      </forward>');
      cursorUnits = onsetUnits;
      cursor = event.onset;
    }
    const durationUnits = xmlUnits(event.duration, divisions, `${eventPath}.duration`);
    if (durationUnits <= 0) {
      throw new MusicXmlError('Serialized note duration must be positive.', 'SERIALIZATION_LIMIT', { path: eventPath });
    }
    lines.push(...noteXml(event, durationUnits, stream.voice.ordinal, stream.staff, multiStaff, '      '));
    cursor = addRational(event.onset, event.duration);
    cursorUnits = onsetUnits + durationUnits;
  }

  return { lines, endUnits: cursorUnits };
};

export const serializeMusicXml = (input: ScoreDocument): string => {
  const validation = validateScoreDocument(input);
  if (!validation.ok) {
    throw new MusicXmlError('Cannot serialize an invalid ScoreDocument.', 'INVALID_MUSICXML_SEMANTICS', {
      issueCount: validation.issues.length
    });
  }
  validatePartMeasureAlignment(input);
  const divisions = chooseDivisions(input);

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<score-partwise version="4.0">',
    '  <part-list>'
  ];

  input.parts.forEach((part, index) => {
    const partId = `P${index + 1}`;
    lines.push(`    <score-part id="${partId}">`);
    lines.push(`      <part-name>${escapeText(part.name ?? `Part ${index + 1}`)}</part-name>`);
    lines.push('    </score-part>');
  });
  lines.push('  </part-list>');

  input.parts.forEach((part, partIndex) => {
    const partId = `P${partIndex + 1}`;
    const staves = sortedByOrdinal(part.staves);
    const referenceMeasures = sortedByOrdinal(staves[0]?.measures ?? []);
    const multiStaff = staves.length > 1;
    lines.push(`  <part id="${partId}">`);

    referenceMeasures.forEach((referenceMeasure, measureIndex) => {
      const measureNumber = referenceMeasure.displayNumber ?? String(referenceMeasure.ordinal);
      lines.push(`    <measure number="${escapeAttribute(measureNumber)}">`);
      lines.push('      <attributes>');
      lines.push(`        <divisions>${divisions}</divisions>`);
      if (multiStaff) lines.push(`        <staves>${staves.length}</staves>`);
      lines.push('      </attributes>');

      const streams: Stream[] = [];
      for (const staff of staves) {
        const measure = sortedByOrdinal(staff.measures)[measureIndex];
        if (measure === undefined) {
          throw new MusicXmlError('Aligned measure disappeared during serialization.', 'INVALID_MUSICXML_SEMANTICS');
        }
        for (const voice of sortedByOrdinal(measure.voices)) {
          if (voice.events.length > 0) streams.push({ staff: staff.ordinal, voice });
        }
      }

      streams.forEach((stream, streamIndex) => {
        const serialized = serializeStream(
          stream,
          divisions,
          multiStaff,
          `$.part[${partIndex}].measure[${measureIndex}].staff[${stream.staff}].voice[${stream.voice.ordinal}]`
        );
        lines.push(...serialized.lines);
        if (streamIndex < streams.length - 1 && serialized.endUnits > 0) {
          lines.push('      <backup>', `        <duration>${serialized.endUnits}</duration>`, '      </backup>');
        }
      });

      lines.push('    </measure>');
    });

    lines.push('  </part>');
  });

  lines.push('</score-partwise>');
  return `${lines.join('\n')}\n`;
};
