import { addressEntityV2, type MeasureAddressV2 } from '../../addressing-v2/src/index.js';
import {
  NORMALIZED_IMPORT_ENVELOPE_VERSION,
  validateNormalizedImportEnvelopeV1,
  type PreservedMusicXmlSymbolV1
} from '../../musicxml-import-contract/src/index.js';
import {
  createNotationDocumentV2,
  type ArticulationKind,
  type ArticulationSpec,
  type EventNotationV2,
  type MeasureNotationEntryV2,
  type OrnamentSpec,
  type SimpleOrnamentKind
} from '../../notation-structure-v2/src/index.js';
import type {
  ClefSpec,
  KeySignature,
  MeasureNotation,
  NoteNotation,
  TimeSignature,
  TupletSpec
} from '../../notation-structure/src/index.js';
import type { NotationDocumentV4 } from '../../notation-structure-v4/src/index.js';
import { migrateScoreNotationV2ToV3 } from '../../schema-migration-v2-v3/src/index.js';
import { migrateNotationV3ToV4 } from '../../schema-migration-v3-v4/src/index.js';
import {
  createScoreDocumentV2,
  type ScoreDocumentV2
} from '../../score-model-v2/src/index.js';
import type { ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import type { Rational, SourceIdentity } from '../../score-model/src/index.js';

import { compareStrings } from './order.js';
import {
  PartituraMapperValidationError,
  validatePartituraEnvelopeV1,
  type PartituraMapperDiagnosticCodeV1,
  type ValidatedPartituraEnvelopeV1,
  type ValidatedPartituraKeySignatureV1,
  type ValidatedPartituraNoteV1,
  type ValidatedPartituraPartV1,
  type ValidatedPartituraRestV1
} from './validate.js';

export const PARTITURA_CANONICAL_MAPPER_VERSION = '1.0.0' as const;

export interface PartituraPreservationSidecarV1 {
  readonly version: typeof NORMALIZED_IMPORT_ENVELOPE_VERSION;
  readonly sourceIdentity: string;
  readonly symbols: readonly Readonly<PreservedMusicXmlSymbolV1>[];
}

export interface PartituraCanonicalMapperOptionsV1 {
  readonly source: SourceIdentity;
  readonly documentId?: string;
  readonly revisionId?: string;
}

export interface PartituraMapperDiagnosticV1 {
  readonly code: PartituraMapperDiagnosticCodeV1;
  readonly path: string;
  readonly message: string;
  readonly details: Readonly<Record<string, unknown>>;
}

export interface PartituraCanonicalImportSuccessV1 {
  readonly ok: true;
  readonly version: typeof PARTITURA_CANONICAL_MAPPER_VERSION;
  readonly score: Readonly<ScoreDocumentV3>;
  readonly notation: Readonly<NotationDocumentV4>;
  readonly preservedSymbols: readonly Readonly<PreservedMusicXmlSymbolV1>[];
}

export interface PartituraCanonicalImportFailureV1 {
  readonly ok: false;
  readonly version: typeof PARTITURA_CANONICAL_MAPPER_VERSION;
  readonly diagnostics: readonly Readonly<PartituraMapperDiagnosticV1>[];
}

export type PartituraCanonicalImportResultV1 =
  | PartituraCanonicalImportSuccessV1
  | PartituraCanonicalImportFailureV1;

type R = Record<string, unknown>;

type TimedBucket = {
  notes: ValidatedPartituraNoteV1[];
  rests: ValidatedPartituraRestV1[];
};

type EventSource =
  | { readonly kind: 'note'; readonly note: ValidatedPartituraNoteV1 }
  | { readonly kind: 'chord'; readonly notes: readonly ValidatedPartituraNoteV1[] }
  | { readonly kind: 'rest'; readonly rest: ValidatedPartituraRestV1 };

const ARTICULATIONS = new Set<ArticulationKind>([
  'accent','strong-accent','staccato','tenuto','detached-legato','staccatissimo',
  'spiccato','scoop','plop','doit','falloff','breath-mark','caesura','stress',
  'unstress','soft-accent'
]);

const SIMPLE_ORNAMENTS = new Set<SimpleOrnamentKind>([
  'trill-mark','turn','delayed-turn','inverted-turn','delayed-inverted-turn',
  'vertical-turn','inverted-vertical-turn','shake','mordent','inverted-mordent',
  'schleifer','haydn'
]);

const fail = (
  message: string,
  code: PartituraMapperDiagnosticCodeV1,
  path: string,
  details: Record<string, unknown> = {}
): never => {
  throw new PartituraMapperValidationError(message, code, path, details);
};

const plainRecord = (value: unknown, path: string): R => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return fail('Value must be an object.', 'INVALID_ENVELOPE', path);
  }
  return value as R;
};

const exact = (value: unknown, keys: readonly string[], path: string): R => {
  const item = plainRecord(value, path);
  const observed = Object.keys(item).sort(compareStrings);
  const expected = [...keys].sort(compareStrings);
  if (JSON.stringify(observed) !== JSON.stringify(expected)) {
    return fail('Field set is invalid.', 'INVALID_ENVELOPE', path, { observed, expected });
  }
  return item;
};

const same = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const gcdBig = (left: bigint, right: bigint): bigint => {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
};

const rational = (numerator: number, denominator: number, path: string): Rational => {
  if (
    !Number.isSafeInteger(numerator) ||
    !Number.isSafeInteger(denominator) ||
    numerator < 0 ||
    denominator <= 0
  ) {
    return fail('Canonical rational input is invalid.', 'INVALID_TIMING', path, { numerator, denominator });
  }
  const divisor = gcdBig(BigInt(numerator), BigInt(denominator));
  const n = BigInt(numerator) / divisor;
  const d = BigInt(denominator) / divisor;
  if (n > BigInt(Number.MAX_SAFE_INTEGER) || d > BigInt(Number.MAX_SAFE_INTEGER)) {
    return fail('Canonical rational exceeds safe integer range.', 'INVALID_TIMING', path);
  }
  return Object.freeze({ numerator: Number(n), denominator: Number(d) });
};

const localOnset = (
  onsetDiv: number,
  measureStartDiv: number,
  divsPerQuarter: number,
  path: string
): Rational => rational(onsetDiv - measureStartDiv, divsPerQuarter * 4, path);

const duration = (durationDiv: number, divsPerQuarter: number, path: string): Rational =>
  rational(durationDiv, divsPerQuarter * 4, path);

const displayNumber = (
  measure: ValidatedPartituraPartV1['measures'][number],
  ordinal: number
): string | null => {
  if (measure.number !== null) return String(measure.number);
  if (measure.name !== null) return String(measure.name);
  return String(ordinal);
};

const measureIndexForEvent = (
  part: ValidatedPartituraPartV1,
  onsetDiv: number,
  durationDiv: number,
  path: string
): number => {
  const index = part.measures.findIndex(
    measure => onsetDiv >= measure.startDiv && onsetDiv < measure.endDiv
  );
  if (index < 0) return fail('Timed object does not belong to a Partitura measure.', 'INVALID_TIMING', path, { onsetDiv });
  const measure = part.measures[index];
  if (measure === undefined || onsetDiv + durationDiv > measure.endDiv) {
    return fail('Timed object crosses its normalized measure boundary.', 'INVALID_TIMING', path, { onsetDiv, durationDiv });
  }
  return index;
};

const measureIndexForDeclaration = (
  part: ValidatedPartituraPartV1,
  startDiv: number,
  path: string
): number => {
  const index = part.measures.findIndex(measure => measure.startDiv === startDiv);
  if (index < 0) {
    return fail(
      'Mid-measure or out-of-range notation declarations are not admitted by the current canonical contract.',
      'UNSUPPORTED_SEMANTIC',
      path,
      { startDiv }
    );
  }
  return index;
};

const tiePitch = (left: ValidatedPartituraNoteV1, right: ValidatedPartituraNoteV1): boolean =>
  left.step === right.step && left.alter === right.alter && left.octave === right.octave;

const validateTieGraph = (part: ValidatedPartituraPartV1, partIndex: number): void => {
  const bySourceId = new Map<string, ValidatedPartituraNoteV1>();
  for (const note of part.notes) {
    if (note.sourceNoteId === null) continue;
    if (bySourceId.has(note.sourceNoteId)) {
      fail(
        'Partitura source note ids must be unique within a part when tie identity is used.',
        'INVALID_ENVELOPE',
        `$.parts[${partIndex}].notes[${note.sourceIndex}].sourceNoteId`,
        { sourceNoteId: note.sourceNoteId }
      );
    }
    bySourceId.set(note.sourceNoteId, note);
  }

  for (const note of part.notes) {
    const path = `$.parts[${partIndex}].notes[${note.sourceIndex}]`;
    if (note.ties.start !== (note.tieNextSourceNoteId !== null)) {
      fail('Partitura tie-start identity is incomplete.', 'INVALID_ENVELOPE', path);
    }
    if (note.ties.stop !== (note.tiePrevSourceNoteId !== null)) {
      fail('Partitura tie-stop identity is incomplete.', 'INVALID_ENVELOPE', path);
    }
    if ((note.ties.start || note.ties.stop) && note.sourceNoteId === null) {
      fail('Tied Partitura notes require stable source note ids.', 'UNSUPPORTED_SEMANTIC', path);
    }

    if (note.tieNextSourceNoteId !== null) {
      const next = bySourceId.get(note.tieNextSourceNoteId);
      if (
        next === undefined ||
        next.tiePrevSourceNoteId !== note.sourceNoteId ||
        !tiePitch(note, next) ||
        (next.staff ?? 1) !== (note.staff ?? 1) ||
        (next.voice ?? 1) !== (note.voice ?? 1)
      ) {
        fail('Partitura forward tie identity is inconsistent.', 'INVALID_ENVELOPE', path, {
          nextSourceNoteId: note.tieNextSourceNoteId
        });
      }
    }

    if (note.tiePrevSourceNoteId !== null) {
      const previous = bySourceId.get(note.tiePrevSourceNoteId);
      if (
        previous === undefined ||
        previous.tieNextSourceNoteId !== note.sourceNoteId ||
        !tiePitch(note, previous) ||
        (previous.staff ?? 1) !== (note.staff ?? 1) ||
        (previous.voice ?? 1) !== (note.voice ?? 1)
      ) {
        fail('Partitura backward tie identity is inconsistent.', 'INVALID_ENVELOPE', path, {
          previousSourceNoteId: note.tiePrevSourceNoteId
        });
      }
    }
  }
};

const validateUnsupportedNoteSemantics = (part: ValidatedPartituraPartV1, partIndex: number): void => {
  for (const note of part.notes) {
    const path = `$.parts[${partIndex}].notes[${note.sourceIndex}]`;
    if (note.isGrace) {
      fail(
        'Grace-note anchor and placement are not present in NormalizedImportEnvelopeV1.',
        'UNSUPPORTED_SEMANTIC',
        `${path}.isGrace`
      );
    }
    if (note.fingerings.length > 0) {
      fail(
        'Partitura fingering has no canonical score/notation owner in SES-87; it must remain a later guitar-workspace concern.',
        'UNSUPPORTED_SEMANTIC',
        `${path}.fingerings`
      );
    }
  }
};

const eventNotationForNote = (
  note: ValidatedPartituraNoteV1,
  path: string
): Readonly<EventNotationV2> => {
  const articulations: ArticulationSpec[] = note.articulations.map((value, index) => {
    if (!ARTICULATIONS.has(value as ArticulationKind)) {
      return fail('Partitura articulation is unsupported by NotationDocumentV4.', 'UNSUPPORTED_SEMANTIC', `${path}.articulations[${index}]`, { value });
    }
    return Object.freeze({
      kind: value as ArticulationKind,
      placement: 'auto' as const,
      direction: null
    });
  });

  const ornaments: OrnamentSpec[] = note.ornaments.map((value, index) => {
    if (!SIMPLE_ORNAMENTS.has(value as SimpleOrnamentKind)) {
      return fail('Partitura ornament is unsupported by the current local ornament contract.', 'UNSUPPORTED_SEMANTIC', `${path}.ornaments[${index}]`, { value });
    }
    return Object.freeze({
      kind: value as SimpleOrnamentKind,
      placement: 'auto' as const,
      accidentalMarks: Object.freeze([])
    });
  });

  const tuplet: TupletSpec | null = note.tuplet === null
    ? null
    : Object.freeze({
        actualNotes: note.tuplet.actualNotes,
        normalNotes: note.tuplet.normalNotes,
        marks: Object.freeze([])
      });

  return Object.freeze({
    dots: 0,
    beams: Object.freeze([]),
    tuplet,
    articulations: Object.freeze(articulations),
    ornaments: Object.freeze(ornaments)
  });
};

const eventNotationForRest = (
  rest: ValidatedPartituraRestV1,
  path: string
): Readonly<EventNotationV2> => {
  let dots = 0;
  let tuplet: TupletSpec | null = null;
  if (rest.symbolicDuration !== null) {
    const symbolic = plainRecord(rest.symbolicDuration, `${path}.symbolicDuration`);
    const allowed = new Set(['type','dots','actual_notes','normal_notes']);
    const unknown = Object.keys(symbolic).filter(key => !allowed.has(key));
    if (unknown.length > 0) {
      fail(
        'Partitura rest symbolic duration contains unreviewed semantics.',
        'UNSUPPORTED_SEMANTIC',
        `${path}.symbolicDuration`,
        { unknown }
      );
    }
    const symbolicDots = symbolic.dots;
    if (symbolicDots !== undefined) {
      if (
        typeof symbolicDots !== 'number' ||
        !Number.isSafeInteger(symbolicDots) ||
        symbolicDots < 0 ||
        symbolicDots > 3
      ) {
        fail('Partitura rest dot count is invalid.', 'INVALID_ENVELOPE', `${path}.symbolicDuration.dots`);
      }
      dots = symbolicDots as number;
    }
    const actualRaw = symbolic.actual_notes;
    const normalRaw = symbolic.normal_notes;
    if (actualRaw !== undefined || normalRaw !== undefined) {
      if (
        typeof actualRaw !== 'number' ||
        typeof normalRaw !== 'number' ||
        !Number.isSafeInteger(actualRaw) ||
        !Number.isSafeInteger(normalRaw) ||
        actualRaw < 1 || actualRaw > 32 ||
        normalRaw < 1 || normalRaw > 32
      ) {
        fail('Partitura rest tuplet ratio is invalid.', 'INVALID_ENVELOPE', `${path}.symbolicDuration`);
      }
      const actualNotes = actualRaw as number;
      const normalNotes = normalRaw as number;
      tuplet = Object.freeze({ actualNotes, normalNotes, marks: Object.freeze([]) });
    }
  }
  return Object.freeze({
    dots,
    beams: Object.freeze([]),
    tuplet,
    articulations: Object.freeze([]),
    ornaments: Object.freeze([])
  });
};

const noteNotation = (note: ValidatedPartituraNoteV1): Readonly<NoteNotation> => {
  const ties = [];
  if (note.ties.start) ties.push(Object.freeze({ number: 1, type: 'start' as const }));
  if (note.ties.stop) ties.push(Object.freeze({ number: 1, type: 'stop' as const }));
  return Object.freeze({
    accidental: null,
    ties: Object.freeze(ties),
    slurs: Object.freeze([])
  });
};

const defaultEventNotation = (notation: EventNotationV2): boolean =>
  notation.dots === 0 &&
  notation.beams.length === 0 &&
  notation.tuplet === null &&
  notation.articulations.length === 0 &&
  notation.ornaments.length === 0;

const defaultNoteNotation = (notation: NoteNotation): boolean =>
  notation.accidental === null && notation.ties.length === 0 && notation.slurs.length === 0;

const buildBuckets = (
  part: ValidatedPartituraPartV1,
  partIndex: number
): ReadonlyMap<string, TimedBucket> => {
  const buckets = new Map<string, TimedBucket>();
  const bucket = (measureIndex: number, staff: number, voice: number): TimedBucket => {
    const key = `${measureIndex}:${staff}:${voice}`;
    const existing = buckets.get(key);
    if (existing !== undefined) return existing;
    const created = { notes: [], rests: [] };
    buckets.set(key, created);
    return created;
  };

  for (const note of part.notes) {
    const measureIndex = measureIndexForEvent(
      part,
      note.onsetDiv,
      note.durationDiv,
      `$.parts[${partIndex}].notes[${note.sourceIndex}]`
    );
    bucket(measureIndex, note.staff ?? 1, note.voice ?? 1).notes.push(note);
  }
  for (const rest of part.rests) {
    const measureIndex = measureIndexForEvent(
      part,
      rest.onsetDiv,
      rest.durationDiv,
      `$.parts[${partIndex}].rests[${rest.sourceIndex}]`
    );
    bucket(measureIndex, rest.staff ?? 1, rest.voice ?? 1).rests.push(rest);
  }
  return buckets;
};

const groupEvents = (
  part: ValidatedPartituraPartV1,
  partIndex: number,
  measureIndex: number,
  staff: number,
  voice: number,
  bucket: TimedBucket
): readonly EventSource[] => {
  const onsets = new Map<number, TimedBucket>();
  for (const note of bucket.notes) {
    const value = onsets.get(note.onsetDiv) ?? { notes: [], rests: [] };
    value.notes.push(note);
    onsets.set(note.onsetDiv, value);
  }
  for (const rest of bucket.rests) {
    const value = onsets.get(rest.onsetDiv) ?? { notes: [], rests: [] };
    value.rests.push(rest);
    onsets.set(rest.onsetDiv, value);
  }

  const result: EventSource[] = [];
  let previousEndDiv = part.measures[measureIndex]?.startDiv ?? 0;
  for (const [onsetDiv, value] of [...onsets].sort((a, b) => a[0] - b[0])) {
    const path = `$.parts[${partIndex}].staff[${staff}].measure[${measureIndex}].voice[${voice}]`;
    if (onsetDiv < previousEndDiv) {
      fail('Partitura voice events overlap.', 'INVALID_TIMING', path, { onsetDiv, previousEndDiv });
    }
    if (value.rests.length > 1 || (value.rests.length > 0 && value.notes.length > 0)) {
      fail('Partitura voice onset is ambiguous between rest and pitched events.', 'INVALID_TIMING', path, { onsetDiv });
    }

    if (value.rests.length === 1) {
      const rest = value.rests[0];
      if (rest === undefined) return fail('Partitura rest grouping failed.', 'INVALID_TIMING', path);
      result.push(Object.freeze({ kind: 'rest', rest }));
      previousEndDiv = onsetDiv + rest.durationDiv;
      continue;
    }

    const notes = [...value.notes].sort((left, right) => left.sourceIndex - right.sourceIndex);
    if (notes.length === 0) continue;
    const first = notes[0];
    if (first === undefined) return fail('Partitura note grouping failed.', 'INVALID_TIMING', path);
    if (notes.some(note => note.durationDiv !== first.durationDiv || note.divsPerQuarter !== first.divsPerQuarter)) {
      fail('Simultaneous Partitura chord tones disagree on duration or division scale.', 'INVALID_TIMING', path, { onsetDiv });
    }
    result.push(notes.length === 1
      ? Object.freeze({ kind: 'note', note: first })
      : Object.freeze({ kind: 'chord', notes: Object.freeze(notes) }));
    previousEndDiv = onsetDiv + first.durationDiv;
  }
  return Object.freeze(result);
};

const materializeV2 = (
  envelope: ValidatedPartituraEnvelopeV1,
  options: PartituraCanonicalMapperOptionsV1
): Readonly<{
  score: Readonly<ScoreDocumentV2>;
  eventNotationById: ReadonlyMap<string, Readonly<EventNotationV2>>;
  noteNotationById: ReadonlyMap<string, Readonly<NoteNotation>>;
}> => {
  const eventNotationById = new Map<string, Readonly<EventNotationV2>>();
  const noteNotationById = new Map<string, Readonly<NoteNotation>>();

  const parts = envelope.parts.map((part, partIndex) => {
    validateTieGraph(part, partIndex);
    validateUnsupportedNoteSemantics(part, partIndex);
    const buckets = buildBuckets(part, partIndex);
    const p = partIndex + 1;

    return {
      id: `part-${p}`,
      name: part.name,
      staves: Array.from({ length: part.staffCount }, (_, staffOffset) => {
        const staff = staffOffset + 1;
        return {
          id: `staff-${p}-${staff}`,
          ordinal: staff,
          measures: part.measures.map((measure, measureIndex) => {
            const m = measureIndex + 1;
            const voices = new Set<number>();
            for (const note of part.notes) {
              if (
                (note.staff ?? 1) === staff &&
                measureIndexForEvent(part, note.onsetDiv, note.durationDiv, `$.parts[${partIndex}].notes[${note.sourceIndex}]`) === measureIndex
              ) voices.add(note.voice ?? 1);
            }
            for (const rest of part.rests) {
              if (
                (rest.staff ?? 1) === staff &&
                measureIndexForEvent(part, rest.onsetDiv, rest.durationDiv, `$.parts[${partIndex}].rests[${rest.sourceIndex}]`) === measureIndex
              ) voices.add(rest.voice ?? 1);
            }
            if (voices.size === 0) voices.add(1);

            return {
              id: `measure-${p}-${staff}-${m}`,
              ordinal: m,
              displayNumber: displayNumber(measure, m),
              voices: [...voices].sort((a, b) => a - b).map(voice => {
                const source = buckets.get(`${measureIndex}:${staff}:${voice}`) ?? { notes: [], rests: [] };
                const groups = groupEvents(part, partIndex, measureIndex, staff, voice, source);
                return {
                  id: `voice-${p}-${staff}-${m}-${voice}`,
                  ordinal: voice,
                  events: groups.map((group, eventOffset) => {
                    const eventIndex = eventOffset + 1;
                    const eventId = `event-${p}-${staff}-${m}-${voice}-${eventIndex}`;
                    if (group.kind === 'rest') {
                      const eventNotation = eventNotationForRest(
                        group.rest,
                        `$.parts[${partIndex}].rests[${group.rest.sourceIndex}]`
                      );
                      if (!defaultEventNotation(eventNotation)) eventNotationById.set(eventId, eventNotation);
                      return {
                        id: eventId,
                        kind: 'rest' as const,
                        onset: localOnset(group.rest.onsetDiv, measure.startDiv, group.rest.divsPerQuarter, eventId),
                        duration: duration(group.rest.durationDiv, group.rest.divsPerQuarter, eventId)
                      };
                    }

                    const notes = group.kind === 'note' ? [group.note] : [...group.notes];
                    const first = notes[0];
                    if (first === undefined) return fail('Partitura pitched event has no notes.', 'INVALID_ENVELOPE', eventId);
                    const eventNotations = notes.map(note => eventNotationForNote(
                      note,
                      `$.parts[${partIndex}].notes[${note.sourceIndex}]`
                    ));
                    if (eventNotations.some(item => !same(item, eventNotations[0]))) {
                      fail('Partitura chord tones disagree on event-level notation.', 'UNSUPPORTED_SEMANTIC', eventId);
                    }
                    const eventNotation = eventNotations[0];
                    if (eventNotation !== undefined && !defaultEventNotation(eventNotation)) {
                      eventNotationById.set(eventId, eventNotation);
                    }

                    const atoms = notes.map((note, noteOffset) => {
                      const noteId = `note-${p}-${staff}-${m}-${voice}-${eventIndex}-${noteOffset + 1}`;
                      const notation = noteNotation(note);
                      if (!defaultNoteNotation(notation)) noteNotationById.set(noteId, notation);
                      return {
                        id: noteId,
                        pitch: { step: note.step, alter: note.alter, octave: note.octave }
                      };
                    });

                    const base = {
                      id: eventId,
                      onset: localOnset(first.onsetDiv, measure.startDiv, first.divsPerQuarter, eventId),
                      duration: duration(first.durationDiv, first.divsPerQuarter, eventId)
                    };
                    return atoms.length === 1
                      ? { ...base, kind: 'note' as const, note: atoms[0] }
                      : { ...base, kind: 'chord' as const, notes: atoms };
                  }),
                  graceGroups: Object.freeze([])
                };
              })
            };
          })
        };
      })
    };
  });

  const suffix = options.source.sha256.slice(0, 16);
  const score = createScoreDocumentV2({
    schemaVersion: '2.0.0',
    id: options.documentId ?? `doc-${suffix}`,
    revision: { id: options.revisionId ?? `rev-${suffix}-0`, parentId: null },
    source: options.source,
    parts
  });

  return Object.freeze({ score, eventNotationById, noteNotationById });
};

const measureNotation = (
  part: ValidatedPartituraPartV1,
  partIndex: number,
  measureIndex: number,
  staff: number
): Readonly<MeasureNotation> => {
  const measure = part.measures[measureIndex];
  if (measure === undefined) return fail('Partitura measure lookup failed.', 'INVALID_TOPOLOGY', `$.parts[${partIndex}].measures[${measureIndex}]`);

  const timeItems = part.timeSignatures.filter((item, index) =>
    measureIndexForDeclaration(part, item.startDiv, `$.parts[${partIndex}].timeSignatures[${index}]`) === measureIndex
  );
  if (timeItems.length > 1) {
    fail('Multiple time-signature declarations target the same measure.', 'INVALID_ENVELOPE', `$.parts[${partIndex}].timeSignatures`);
  }
  const keyItems = part.keySignatures.filter((item, index) =>
    measureIndexForDeclaration(part, item.startDiv, `$.parts[${partIndex}].keySignatures[${index}]`) === measureIndex
  );
  if (keyItems.length > 1) {
    fail('Multiple key-signature declarations target the same measure.', 'INVALID_ENVELOPE', `$.parts[${partIndex}].keySignatures`);
  }
  const clefItems = part.clefs.filter((item, index) =>
    (item.staff ?? 1) === staff &&
    measureIndexForDeclaration(part, item.startDiv, `$.parts[${partIndex}].clefs[${index}]`) === measureIndex
  );
  if (clefItems.length > 1) {
    fail('Multiple clef declarations target the same staff measure.', 'INVALID_ENVELOPE', `$.parts[${partIndex}].clefs`);
  }

  const timeRaw = timeItems[0];
  const keyRaw = keyItems[0];
  const clefRaw = clefItems[0];
  const timeSignature: TimeSignature | null = timeRaw === undefined
    ? null
    : Object.freeze({ beats: timeRaw.beats, beatType: timeRaw.beatType });
  const keySignature: KeySignature | null = keyRaw === undefined
    ? null
    : Object.freeze({ fifths: keyRaw.fifths });
  const clef: ClefSpec | null = clefRaw === undefined
    ? null
    : Object.freeze({ sign: clefRaw.sign, line: clefRaw.line, octaveChange: clefRaw.octaveChange });

  return Object.freeze({
    timeSignature,
    keySignature,
    clef,
    barlines: Object.freeze([])
  });
};

const buildNotationV2 = (
  envelope: ValidatedPartituraEnvelopeV1,
  materialized: ReturnType<typeof materializeV2>
) => {
  const measures: MeasureNotationEntryV2[] = [];
  for (const [partIndex, part] of envelope.parts.entries()) {
    const p = partIndex + 1;
    for (let staff = 1; staff <= part.staffCount; staff += 1) {
      for (let measureIndex = 0; measureIndex < part.measures.length; measureIndex += 1) {
        const m = measureIndex + 1;
        const notation = measureNotation(part, partIndex, measureIndex, staff);
        if (
          notation.timeSignature === null &&
          notation.keySignature === null &&
          notation.clef === null &&
          notation.barlines.length === 0
        ) continue;
        const target = addressEntityV2(materialized.score, `measure-${p}-${staff}-${m}`);
        if (target.kind !== 'measure') {
          fail('Canonical V2 measure target changed kind.', 'CANONICAL_VALIDATION_FAILED', `measure-${p}-${staff}-${m}`);
        }
        measures.push({ target: target as MeasureAddressV2, notation });
      }
    }
  }

  const events = [...materialized.eventNotationById].map(([eventId, notation]) => {
    const target = addressEntityV2(materialized.score, eventId);
    if (target.kind !== 'event') {
      return fail('Canonical V2 event target changed kind.', 'CANONICAL_VALIDATION_FAILED', eventId);
    }
    return { target, notation };
  });
  const notes = [...materialized.noteNotationById].map(([noteId, notation]) => {
    const target = addressEntityV2(materialized.score, noteId);
    if (target.kind !== 'note') {
      return fail('Canonical V2 note target changed kind.', 'CANONICAL_VALIDATION_FAILED', noteId);
    }
    return { target, notation };
  });

  return createNotationDocumentV2(materialized.score, {
    contractVersion: '2.0.0',
    documentId: materialized.score.id,
    revisionId: materialized.score.revision.id,
    measures,
    events,
    notes,
    graceEvents: [],
    graceNotes: []
  });
};

const sourceNoteIds = (envelope: ValidatedPartituraEnvelopeV1): ReadonlySet<string> => {
  const ids = new Set<string>();
  for (const part of envelope.parts) {
    for (const note of part.notes) if (note.sourceNoteId !== null) ids.add(note.sourceNoteId);
  }
  return ids;
};

const validateSidecar = (
  value: unknown,
  envelope: ValidatedPartituraEnvelopeV1
): readonly Readonly<PreservedMusicXmlSymbolV1>[] => {
  const sidecar = exact(value, ['version','sourceIdentity','symbols'], '$.preservationSidecar');
  if (
    sidecar.version !== NORMALIZED_IMPORT_ENVELOPE_VERSION ||
    sidecar.sourceIdentity !== envelope.sourceIdentity ||
    !Array.isArray(sidecar.symbols)
  ) {
    return fail(
      'Preservation sidecar does not match the normalized Partitura source identity/version.',
      'SOURCE_IDENTITY_MISMATCH',
      '$.preservationSidecar'
    );
  }

  let checked;
  try {
    checked = validateNormalizedImportEnvelopeV1({
      version: NORMALIZED_IMPORT_ENVELOPE_VERSION,
      sourceIdentity: envelope.sourceIdentity,
      parts: [],
      preservedSymbols: sidecar.symbols,
      diagnostics: []
    });
  } catch (error) {
    return fail(
      `Preservation sidecar is invalid: ${error instanceof Error ? error.message : String(error)}`,
      'INVALID_ENVELOPE',
      '$.preservationSidecar.symbols'
    );
  }

  const knownSourceNotes = sourceNoteIds(envelope);
  for (const [index, symbol] of checked.preservedSymbols.entries()) {
    if (symbol.provenance.sourceIdentity !== envelope.sourceIdentity) {
      fail(
        'Preserved symbol provenance belongs to another source.',
        'SOURCE_IDENTITY_MISMATCH',
        `$.preservationSidecar.symbols[${index}].provenance.sourceIdentity`
      );
    }
    if (symbol.sourceNoteId !== null && !knownSourceNotes.has(symbol.sourceNoteId)) {
      fail(
        'Preserved symbol sourceNoteId is not present in the normalized Partitura note set.',
        'INVALID_ENVELOPE',
        `$.preservationSidecar.symbols[${index}].sourceNoteId`,
        { sourceNoteId: symbol.sourceNoteId }
      );
    }
  }
  return checked.preservedSymbols;
};

const validateSource = (source: SourceIdentity): void => {
  if (
    source.format !== 'musicxml' ||
    source.byteLength === null ||
    !Number.isSafeInteger(source.byteLength) ||
    source.byteLength <= 0 ||
    typeof source.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(source.sha256)
  ) {
    fail(
      'SES-87 requires a complete original MusicXML SourceIdentity supplied by the caller.',
      'SOURCE_IDENTITY_MISMATCH',
      '$.options.source'
    );
  }
};

const diagnostic = (error: unknown): Readonly<PartituraMapperDiagnosticV1> => {
  if (error instanceof PartituraMapperValidationError) {
    return Object.freeze({
      code: error.code,
      path: error.path,
      message: error.message,
      details: error.details
    });
  }
  return Object.freeze({
    code: 'CANONICAL_VALIDATION_FAILED',
    path: '$',
    message: `Canonical validation rejected the Partitura mapping: ${error instanceof Error ? error.message : String(error)}`,
    details: Object.freeze({})
  });
};

export const mapPartituraImportToCanonicalV1 = (
  envelopeInput: unknown,
  preservationSidecarInput: unknown,
  options: PartituraCanonicalMapperOptionsV1
): Readonly<PartituraCanonicalImportResultV1> => {
  try {
    validateSource(options.source);
    const envelope = validatePartituraEnvelopeV1(envelopeInput);
    const preservedSymbols = validateSidecar(preservationSidecarInput, envelope);
    const materialized = materializeV2(envelope, options);
    const notationV2 = buildNotationV2(envelope, materialized);
    const canonicalV3 = migrateScoreNotationV2ToV3(materialized.score, notationV2);
    const notationV4 = migrateNotationV3ToV4(canonicalV3.score, canonicalV3.notation);
    return Object.freeze({
      ok: true,
      version: PARTITURA_CANONICAL_MAPPER_VERSION,
      score: canonicalV3.score,
      notation: notationV4,
      preservedSymbols: Object.freeze([...preservedSymbols])
    });
  } catch (error) {
    return Object.freeze({
      ok: false,
      version: PARTITURA_CANONICAL_MAPPER_VERSION,
      diagnostics: Object.freeze([diagnostic(error)])
    });
  }
};

export type {
  PartituraMapperDiagnosticCodeV1,
  ValidatedPartituraEnvelopeV1,
  ValidatedPartituraKeySignatureV1
} from './validate.js';
