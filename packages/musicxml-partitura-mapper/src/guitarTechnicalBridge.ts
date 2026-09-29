import {
  addressEntityV3,
  type NoteAddressV3
} from '../../addressing-v3/src/index.js';
import {
  createGuitarWorkspaceResult,
  type GuitarWorkspacePosition
} from '../../guitar-workspace-result/src/index.js';
import {
  NORMALIZED_IMPORT_ENVELOPE_VERSION,
  validateNormalizedImportEnvelopeV1,
  type PreservedMusicXmlSymbolV1
} from '../../musicxml-import-contract/src/index.js';
import {
  createNotationDocumentV4,
  type NotationDocumentV4
} from '../../notation-structure-v4/src/index.js';
import { downgradeSchemaPairV2ToV1 } from '../../schema-migration-v1-v2/src/index.js';
import { downgradeScoreNotationV3ToV2 } from '../../schema-migration-v2-v3/src/index.js';
import { downgradeNotationV4ToV3 } from '../../schema-migration-v3-v4/src/index.js';
import {
  createScoreDocumentV3,
  type ScoreDocumentV3
} from '../../score-model-v3/src/index.js';
import type { Pitch, ScoreEvent } from '../../score-model/src/index.js';

import {
  validatePartituraEnvelopeV1,
  type ValidatedPartituraEnvelopeV1,
  type ValidatedPartituraNoteV1,
  type ValidatedPartituraPartV1,
  type ValidatedPartituraRestV1
} from './validate.js';

export const GUITAR_TECHNICAL_BRIDGE_VERSION = '1.0.0' as const;

export type GuitarTechnicalBridgeDiagnosticCodeV1 =
  | 'INVALID_INPUT'
  | 'SOURCE_IDENTITY_MISMATCH'
  | 'CANONICAL_MISMATCH'
  | 'DUPLICATE_SOURCE_NOTE_ID'
  | 'INCOMPLETE_SOURCE_POSITION'
  | 'INVALID_SOURCE_POSITION'
  | 'INVALID_TUNING_EVIDENCE'
  | 'SOURCE_POSITION_PITCH_CONFLICT'
  | 'UNJOINED_SOURCE_SYMBOL'
  | 'ENGINE_EVIDENCE_REJECTED'
  | 'ENGINE_SOURCE_POSITION_DIFFERENCE'
  | 'ENGINE_POSITION_NOT_DIRECT';

export interface GuitarTechnicalBridgeDiagnosticV1 {
  readonly code: GuitarTechnicalBridgeDiagnosticCodeV1;
  readonly path: string;
  readonly message: string;
  readonly details: Readonly<Record<string, unknown>>;
}

export interface GuitarTechnicalBridgePositionV1 {
  readonly string: number;
  readonly fret: number;
}

export interface GuitarTechnicalTuningEvidenceV1 {
  readonly partIndex: number;
  readonly staff: number;
  readonly stringNumber: number;
  readonly openPitch: Readonly<Pitch>;
  readonly sourcePath: string;
}

export interface GuitarTechnicalBridgeEntryV1 {
  readonly sourceNoteId: string | null;
  readonly target: Readonly<NoteAddressV3>;
  readonly sourcePosition: Readonly<GuitarTechnicalBridgePositionV1> | null;
  readonly enginePosition: Readonly<GuitarTechnicalBridgePositionV1> | null;
  readonly effectivePosition: Readonly<GuitarTechnicalBridgePositionV1> | null;
  readonly positionAuthority: 'SOURCE_EXPLICIT' | 'ENGINE_GENERATED' | 'NONE';
  readonly technicalSymbols: readonly Readonly<PreservedMusicXmlSymbolV1>[];
}

export interface GuitarTechnicalBridgeCanonicalPairV1 {
  readonly score: Readonly<ScoreDocumentV3>;
  readonly notation: Readonly<NotationDocumentV4>;
}

export interface GuitarTechnicalBridgeOptionsV1 {
  readonly canonicalTabResultJson?: string;
}

export interface GuitarTechnicalBridgeSuccessV1 {
  readonly ok: true;
  readonly version: typeof GUITAR_TECHNICAL_BRIDGE_VERSION;
  readonly documentId: string;
  readonly revisionId: string;
  readonly sourceIdentity: string;
  readonly tuning: readonly Readonly<GuitarTechnicalTuningEvidenceV1>[];
  readonly entries: readonly Readonly<GuitarTechnicalBridgeEntryV1>[];
  readonly preservedSymbols: readonly Readonly<PreservedMusicXmlSymbolV1>[];
  readonly unjoinedSymbols: readonly Readonly<PreservedMusicXmlSymbolV1>[];
  readonly diagnostics: readonly Readonly<GuitarTechnicalBridgeDiagnosticV1>[];
}

export interface GuitarTechnicalBridgeFailureV1 {
  readonly ok: false;
  readonly version: typeof GUITAR_TECHNICAL_BRIDGE_VERSION;
  readonly preservedSymbols: readonly Readonly<PreservedMusicXmlSymbolV1>[];
  readonly diagnostics: readonly Readonly<GuitarTechnicalBridgeDiagnosticV1>[];
}

export type GuitarTechnicalBridgeResultV1 =
  | GuitarTechnicalBridgeSuccessV1
  | GuitarTechnicalBridgeFailureV1;

type RecordValue = Record<string, unknown>;

class GuitarTechnicalBridgeError extends Error {
  readonly code: GuitarTechnicalBridgeDiagnosticCodeV1;
  readonly path: string;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    code: GuitarTechnicalBridgeDiagnosticCodeV1,
    path: string,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'GuitarTechnicalBridgeError';
    this.code = code;
    this.path = path;
    this.details = Object.freeze({ ...details });
  }
}

interface NormalizedNoteRef {
  readonly partIndex: number;
  readonly staff: number;
  readonly measureIndex: number;
  readonly voice: number;
  readonly note: ValidatedPartituraNoteV1;
  readonly target: Readonly<NoteAddressV3>;
}

interface TimedGroup {
  readonly onsetDiv: number;
  readonly notes: readonly ValidatedPartituraNoteV1[];
  readonly rests: readonly ValidatedPartituraRestV1[];
}

interface EnginePositionEvidence {
  readonly position: Readonly<GuitarWorkspacePosition>;
  readonly direct: boolean;
}

const fail = (
  message: string,
  code: GuitarTechnicalBridgeDiagnosticCodeV1,
  path: string,
  details: Record<string, unknown> = {}
): never => {
  throw new GuitarTechnicalBridgeError(message, code, path, details);
};

const record = (value: unknown, path: string): RecordValue => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return fail('Value must be an object.', 'INVALID_INPUT', path);
  }
  return value as RecordValue;
};

const exact = (value: unknown, keys: readonly string[], path: string): RecordValue => {
  const item = record(value, path);
  const expected = [...keys].sort((left, right) => left.localeCompare(right));
  const observed = Object.keys(item).sort((left, right) => left.localeCompare(right));
  if (JSON.stringify(expected) !== JSON.stringify(observed)) {
    return fail('Field set is invalid.', 'INVALID_INPUT', path, { expected, observed });
  }
  return item;
};

const integerText = (
  value: string | null,
  path: string,
  minimum: number,
  maximum: number
): number => {
  if (value === null || !/^(?:0|[1-9][0-9]*)$/.test(value)) {
    return fail('Expected a non-negative integer text value.', 'INVALID_SOURCE_POSITION', path, { value });
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    return fail('Integer text value is outside the admitted range.', 'INVALID_SOURCE_POSITION', path, {
      value,
      minimum,
      maximum
    });
  }
  return parsed;
};

const signedIntegerText = (
  value: string | null,
  path: string,
  minimum: number,
  maximum: number
): number => {
  if (value === null || !/^-?(?:0|[1-9][0-9]*)$/.test(value)) {
    return fail('Expected an integer text value.', 'INVALID_TUNING_EVIDENCE', path, { value });
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    return fail('Tuning integer value is outside the admitted range.', 'INVALID_TUNING_EVIDENCE', path, {
      value,
      minimum,
      maximum
    });
  }
  return parsed;
};

const sourcePartIndex = (sourcePath: string): number | null => {
  const match = /(?:^|\/)part\[([0-9]+)\](?:\/|$)/.exec(sourcePath);
  if (match === null) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
};

const sourceKey = (partIndex: number, sourceNoteId: string): string =>
  `${partIndex}:${sourceNoteId}`;

const tuningKey = (partIndex: number, staff: number, stringNumber: number): string =>
  `${partIndex}:${staff}:${stringNumber}`;

const staffKey = (partIndex: number, staff: number): string => `${partIndex}:${staff}`;

const pitchMidi = (pitch: Pick<Pitch, 'step' | 'alter' | 'octave'>): number => {
  const offsets: Readonly<Record<Pitch['step'], number>> = Object.freeze({
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11
  });
  return (pitch.octave + 1) * 12 + offsets[pitch.step] + pitch.alter;
};

const samePitch = (
  left: Pick<Pitch, 'step' | 'alter' | 'octave'>,
  right: Pick<Pitch, 'step' | 'alter' | 'octave'>
): boolean =>
  left.step === right.step &&
  left.alter === right.alter &&
  left.octave === right.octave;

const measureIndexFor = (
  part: ValidatedPartituraPartV1,
  onsetDiv: number,
  durationDiv: number,
  path: string
): number => {
  const index = part.measures.findIndex(
    measure => onsetDiv >= measure.startDiv && onsetDiv < measure.endDiv
  );
  if (index < 0) {
    return fail('Normalized timed object does not belong to a measure.', 'CANONICAL_MISMATCH', path, { onsetDiv });
  }
  const measure = part.measures[index];
  if (measure === undefined || onsetDiv + durationDiv > measure.endDiv) {
    return fail('Normalized timed object crosses its measure boundary.', 'CANONICAL_MISMATCH', path, {
      onsetDiv,
      durationDiv
    });
  }
  return index;
};

const groupsFor = (
  part: ValidatedPartituraPartV1,
  partIndex: number,
  staff: number,
  measureIndex: number,
  voice: number
): readonly TimedGroup[] => {
  const byOnset = new Map<number, { notes: ValidatedPartituraNoteV1[]; rests: ValidatedPartituraRestV1[] }>();

  for (const note of part.notes) {
    if ((note.staff ?? 1) !== staff || (note.voice ?? 1) !== voice) continue;
    const index = measureIndexFor(
      part,
      note.onsetDiv,
      note.durationDiv,
      `$.parts[${partIndex}].notes[${note.sourceIndex}]`
    );
    if (index !== measureIndex) continue;
    const bucket = byOnset.get(note.onsetDiv) ?? { notes: [], rests: [] };
    bucket.notes.push(note);
    byOnset.set(note.onsetDiv, bucket);
  }

  for (const rest of part.rests) {
    if ((rest.staff ?? 1) !== staff || (rest.voice ?? 1) !== voice) continue;
    const index = measureIndexFor(
      part,
      rest.onsetDiv,
      rest.durationDiv,
      `$.parts[${partIndex}].rests[${rest.sourceIndex}]`
    );
    if (index !== measureIndex) continue;
    const bucket = byOnset.get(rest.onsetDiv) ?? { notes: [], rests: [] };
    bucket.rests.push(rest);
    byOnset.set(rest.onsetDiv, bucket);
  }

  return Object.freeze(
    [...byOnset.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([onsetDiv, bucket]) => Object.freeze({
        onsetDiv,
        notes: Object.freeze([...bucket.notes].sort((left, right) => left.sourceIndex - right.sourceIndex)),
        rests: Object.freeze([...bucket.rests].sort((left, right) => left.sourceIndex - right.sourceIndex))
      }))
  );
};

const notesOf = (event: ScoreEvent): readonly { readonly id: string; readonly pitch: Pitch }[] =>
  event.kind === 'note' ? [event.note] : event.kind === 'chord' ? event.notes : [];

const buildNormalizedNoteRefs = (
  envelope: ValidatedPartituraEnvelopeV1,
  score: ScoreDocumentV3
): readonly NormalizedNoteRef[] => {
  const refs: NormalizedNoteRef[] = [];
  const sourceIds = new Set<string>();

  for (const [partIndex, part] of envelope.parts.entries()) {
    const p = partIndex + 1;
    const canonicalPart = score.parts.find(item => item.id === `part-${p}`);
    if (canonicalPart === undefined) {
      fail('Canonical Partitura-mapped part identity is missing.', 'CANONICAL_MISMATCH', `$.score.parts[${partIndex}]`);
    }

    for (let staff = 1; staff <= part.staffCount; staff += 1) {
      const canonicalStaff = canonicalPart!.staves.find(item => item.id === `staff-${p}-${staff}`);
      if (canonicalStaff === undefined || canonicalStaff.role === 'tablature-linked') {
        fail('Canonical Partitura-mapped content staff identity is missing.', 'CANONICAL_MISMATCH', `$.score.parts[${partIndex}].staves[${staff - 1}]`);
      }

      for (let measureIndex = 0; measureIndex < part.measures.length; measureIndex += 1) {
        const m = measureIndex + 1;
        const canonicalMeasure = canonicalStaff!.measures.find(item => item.id === `measure-${p}-${staff}-${m}`);
        if (canonicalMeasure === undefined) {
          fail('Canonical Partitura-mapped measure identity is missing.', 'CANONICAL_MISMATCH', `$.score.parts[${partIndex}].staves[${staff - 1}].measures[${measureIndex}]`);
        }

        const voices = new Set<number>();
        for (const note of part.notes) {
          if ((note.staff ?? 1) !== staff) continue;
          if (measureIndexFor(part, note.onsetDiv, note.durationDiv, `$.parts[${partIndex}].notes[${note.sourceIndex}]`) === measureIndex) {
            voices.add(note.voice ?? 1);
          }
        }
        for (const rest of part.rests) {
          if ((rest.staff ?? 1) !== staff) continue;
          if (measureIndexFor(part, rest.onsetDiv, rest.durationDiv, `$.parts[${partIndex}].rests[${rest.sourceIndex}]`) === measureIndex) {
            voices.add(rest.voice ?? 1);
          }
        }
        if (voices.size === 0) voices.add(1);

        for (const voice of [...voices].sort((left, right) => left - right)) {
          const canonicalVoice = canonicalMeasure!.voices.find(
            item => item.id === `voice-${p}-${staff}-${m}-${voice}`
          );
          if (canonicalVoice === undefined) {
            fail('Canonical Partitura-mapped voice identity is missing.', 'CANONICAL_MISMATCH', `voice-${p}-${staff}-${m}-${voice}`);
          }

          const groups = groupsFor(part, partIndex, staff, measureIndex, voice);
          if (canonicalVoice!.events.length !== groups.length) {
            fail('Canonical event count disagrees with normalized Partitura event grouping.', 'CANONICAL_MISMATCH', canonicalVoice!.id, {
              canonicalEvents: canonicalVoice!.events.length,
              normalizedGroups: groups.length
            });
          }

          groups.forEach((group, eventOffset) => {
            const event = canonicalVoice!.events[eventOffset];
            if (event === undefined) {
              fail('Canonical event traversal ended early.', 'CANONICAL_MISMATCH', canonicalVoice!.id);
            }
            const currentEvent = event as ScoreEvent;
            if (group.rests.length > 0) {
              if (group.rests.length !== 1 || group.notes.length !== 0 || currentEvent.kind !== 'rest') {
                fail('Canonical rest grouping disagrees with normalized Partitura data.', 'CANONICAL_MISMATCH', currentEvent.id);
              }
              return;
            }

            const atoms = notesOf(currentEvent);
            if (atoms.length !== group.notes.length || atoms.length === 0) {
              fail('Canonical pitched event cardinality disagrees with normalized Partitura chord grouping.', 'CANONICAL_MISMATCH', currentEvent.id, {
                canonicalNotes: atoms.length,
                normalizedNotes: group.notes.length
              });
            }

            group.notes.forEach((note, noteOffset) => {
              const atom = atoms[noteOffset];
              if (atom === undefined || !samePitch(atom.pitch, note)) {
                fail('Canonical note pitch/order disagrees with normalized Partitura data.', 'CANONICAL_MISMATCH', currentEvent.id, {
                  sourceIndex: note.sourceIndex
                });
              }
              const currentAtom = atom as { readonly id: string; readonly pitch: Pitch };
              const address = addressEntityV3(score, currentAtom.id);
              if (address.kind !== 'note') {
                fail('Canonical Partitura-mapped note identity did not resolve as a normal note.', 'CANONICAL_MISMATCH', currentAtom.id);
              }
              const noteAddress = address as NoteAddressV3;

              if (note.sourceNoteId !== null) {
                const key = sourceKey(partIndex, note.sourceNoteId);
                if (sourceIds.has(key)) {
                  fail('Source note identity is duplicated within one Partitura part.', 'DUPLICATE_SOURCE_NOTE_ID', `$.parts[${partIndex}].notes[${note.sourceIndex}].sourceNoteId`, {
                    sourceNoteId: note.sourceNoteId
                  });
                }
                sourceIds.add(key);
              }

              refs.push(Object.freeze({
                partIndex,
                staff,
                measureIndex,
                voice,
                note,
                target: noteAddress
              }));
            });
          });
        }
      }
    }
  }

  return Object.freeze(refs);
};

const validateSidecar = (
  input: unknown,
  envelope: ValidatedPartituraEnvelopeV1
): readonly Readonly<PreservedMusicXmlSymbolV1>[] => {
  const sidecar = exact(input, ['version', 'sourceIdentity', 'symbols'], '$.preservationSidecar');
  if (
    sidecar.version !== NORMALIZED_IMPORT_ENVELOPE_VERSION ||
    sidecar.sourceIdentity !== envelope.sourceIdentity ||
    !Array.isArray(sidecar.symbols)
  ) {
    return fail(
      'Preservation sidecar version/source identity does not match the Partitura envelope.',
      'SOURCE_IDENTITY_MISMATCH',
      '$.preservationSidecar'
    );
  }

  try {
    const checked = validateNormalizedImportEnvelopeV1({
      version: NORMALIZED_IMPORT_ENVELOPE_VERSION,
      sourceIdentity: envelope.sourceIdentity,
      parts: [],
      preservedSymbols: sidecar.symbols,
      diagnostics: []
    });
    return checked.preservedSymbols;
  } catch (error) {
    return fail(
      `Preservation sidecar validation failed: ${error instanceof Error ? error.message : String(error)}`,
      'INVALID_INPUT',
      '$.preservationSidecar.symbols'
    );
  }
};

const parentStaffDetails = (
  symbol: PreservedMusicXmlSymbolV1,
  symbols: readonly Readonly<PreservedMusicXmlSymbolV1>[]
): Readonly<PreservedMusicXmlSymbolV1> | null => {
  const candidates = symbols
    .filter(item => item.element === 'staff-details' && symbol.sourcePath.startsWith(`${item.sourcePath}/`))
    .sort((left, right) => right.sourcePath.length - left.sourcePath.length);
  return candidates[0] ?? null;
};

const parseStaffNumber = (
  symbol: PreservedMusicXmlSymbolV1,
  symbols: readonly Readonly<PreservedMusicXmlSymbolV1>[]
): number => {
  const parent = symbol.element === 'staff-details' ? symbol : parentStaffDetails(symbol, symbols);
  const raw = parent?.attributes.number;
  if (raw === undefined) return 1;
  return integerText(raw, `${parent?.sourcePath ?? symbol.sourcePath}.@number`, 1, 128);
};

const descendant = (
  parent: PreservedMusicXmlSymbolV1,
  symbols: readonly Readonly<PreservedMusicXmlSymbolV1>[],
  element: string
): Readonly<PreservedMusicXmlSymbolV1> | null => {
  const found = symbols.filter(
    item => item.element === element && item.sourcePath.startsWith(`${parent.sourcePath}/`)
  );
  if (found.length > 1) {
    fail('Tuning evidence contains duplicate descendant fields.', 'INVALID_TUNING_EVIDENCE', parent.sourcePath, {
      element,
      count: found.length
    });
  }
  return found[0] ?? null;
};

const parseTuning = (
  symbols: readonly Readonly<PreservedMusicXmlSymbolV1>[]
): Readonly<{
  tuning: readonly Readonly<GuitarTechnicalTuningEvidenceV1>[];
  byKey: ReadonlyMap<string, Readonly<GuitarTechnicalTuningEvidenceV1>>;
  staffLines: ReadonlyMap<string, number>;
}> => {
  const tuning: Readonly<GuitarTechnicalTuningEvidenceV1>[] = [];
  const byKey = new Map<string, Readonly<GuitarTechnicalTuningEvidenceV1>>();
  const staffLines = new Map<string, number>();

  for (const symbol of symbols.filter(item => item.element === 'staff-lines')) {
    const partIndex = sourcePartIndex(symbol.sourcePath);
    if (partIndex === null) {
      fail('staff-lines evidence has no deterministic Part path.', 'INVALID_TUNING_EVIDENCE', symbol.sourcePath);
    }
    const staff = parseStaffNumber(symbol, symbols);
    const count = integerText(symbol.text, symbol.sourcePath, 1, 16);
    const key = staffKey(partIndex as number, staff);
    const existing = staffLines.get(key);
    if (existing !== undefined && existing !== count) {
      fail('Conflicting staff-lines evidence exists for one Guitar staff.', 'INVALID_TUNING_EVIDENCE', symbol.sourcePath, {
        existing,
        observed: count
      });
    }
    staffLines.set(key, count);
  }

  for (const symbol of symbols.filter(item => item.element === 'staff-tuning')) {
    const partIndex = sourcePartIndex(symbol.sourcePath);
    if (partIndex === null) {
      fail('staff-tuning evidence has no deterministic Part path.', 'INVALID_TUNING_EVIDENCE', symbol.sourcePath);
    }
    const rawLine = symbol.attributes.line;
    if (rawLine === undefined) {
      fail('staff-tuning evidence requires a line attribute.', 'INVALID_TUNING_EVIDENCE', symbol.sourcePath);
    }
    const stringNumber = integerText(rawLine as string, `${symbol.sourcePath}.@line`, 1, 16);
    const staff = parseStaffNumber(symbol, symbols);
    const stepSymbol = descendant(symbol, symbols, 'tuning-step');
    const octaveSymbol = descendant(symbol, symbols, 'tuning-octave');
    const alterSymbol = descendant(symbol, symbols, 'tuning-alter');
    if (stepSymbol === null || octaveSymbol === null) {
      fail('staff-tuning requires tuning-step and tuning-octave evidence.', 'INVALID_TUNING_EVIDENCE', symbol.sourcePath);
    }
    const step = stepSymbol!.text;
    if (step === null || !/^[A-G]$/.test(step)) {
      fail('Tuning pitch step is invalid.', 'INVALID_TUNING_EVIDENCE', stepSymbol!.sourcePath, { step });
    }
    const octave = signedIntegerText(octaveSymbol!.text, octaveSymbol!.sourcePath, -1, 9);
    const alter = alterSymbol === null ? 0 : signedIntegerText(alterSymbol.text, alterSymbol.sourcePath, -2, 2);
    const evidence = Object.freeze({
      partIndex: partIndex as number,
      staff,
      stringNumber,
      openPitch: Object.freeze({
        step: step as Pitch['step'],
        alter,
        octave
      }),
      sourcePath: symbol.sourcePath
    });
    const key = tuningKey(partIndex as number, staff, stringNumber);
    if (byKey.has(key)) {
      fail('Duplicate tuning evidence exists for one Guitar string.', 'INVALID_TUNING_EVIDENCE', symbol.sourcePath, {
        partIndex: partIndex as number,
        staff,
        stringNumber
      });
    }
    byKey.set(key, evidence);
    tuning.push(evidence);
  }

  tuning.sort((left, right) =>
    left.partIndex - right.partIndex ||
    left.staff - right.staff ||
    left.stringNumber - right.stringNumber
  );
  return Object.freeze({
    tuning: Object.freeze(tuning),
    byKey,
    staffLines
  });
};

const parseSourcePosition = (
  symbols: readonly Readonly<PreservedMusicXmlSymbolV1>[],
  ref: NormalizedNoteRef,
  tuning: ReturnType<typeof parseTuning>
): Readonly<GuitarTechnicalBridgePositionV1> | null => {
  const stringSymbols = symbols.filter(item => item.element === 'string');
  const fretSymbols = symbols.filter(item => item.element === 'fret');
  if (stringSymbols.length === 0 && fretSymbols.length === 0) return null;
  if (stringSymbols.length !== 1 || fretSymbols.length !== 1) {
    fail(
      'Explicit MusicXML Guitar position must contain exactly one string and one fret.',
      'INCOMPLETE_SOURCE_POSITION',
      `sourceNote:${ref.note.sourceNoteId ?? 'unidentified'}`,
      { stringCount: stringSymbols.length, fretCount: fretSymbols.length }
    );
  }

  const stringSymbol = stringSymbols[0]!;
  const fretSymbol = fretSymbols[0]!;
  const stringNumber = integerText(stringSymbol.text, stringSymbol.sourcePath, 1, 16);
  const fret = integerText(fretSymbol.text, fretSymbol.sourcePath, 0, 36);
  const lineCount = tuning.staffLines.get(staffKey(ref.partIndex, ref.staff));
  if (lineCount !== undefined && stringNumber > lineCount) {
    fail('Explicit MusicXML string exceeds preserved staff-lines count.', 'INVALID_SOURCE_POSITION', stringSymbol.sourcePath, {
      stringNumber,
      staffLines: lineCount
    });
  }

  const tuningEvidence = tuning.byKey.get(tuningKey(ref.partIndex, ref.staff, stringNumber));
  if (tuningEvidence !== undefined) {
    const expectedMidi = pitchMidi(tuningEvidence.openPitch) + fret;
    if (expectedMidi !== ref.note.pitch) {
      fail(
        'Explicit MusicXML string/fret contradicts preserved source tuning and canonical pitch.',
        'SOURCE_POSITION_PITCH_CONFLICT',
        `sourceNote:${ref.note.sourceNoteId ?? 'unidentified'}`,
        {
          string: stringNumber,
          fret,
          openPitch: tuningEvidence.openPitch,
          expectedMidi,
          canonicalMidi: ref.note.pitch
        }
      );
    }
  }

  return Object.freeze({ string: stringNumber, fret });
};

const diagnosticFromError = (error: unknown): Readonly<GuitarTechnicalBridgeDiagnosticV1> => {
  if (error instanceof GuitarTechnicalBridgeError) {
    return Object.freeze({
      code: error.code,
      path: error.path,
      message: error.message,
      details: error.details
    });
  }
  return Object.freeze({
    code: 'INVALID_INPUT',
    path: '$',
    message: error instanceof Error ? error.message : String(error),
    details: Object.freeze({})
  });
};

const enginePositions = (
  score: ScoreDocumentV3,
  notation: NotationDocumentV4,
  canonicalTabResultJson: string | undefined,
  knownNoteIds: ReadonlySet<string>,
  diagnostics: GuitarTechnicalBridgeDiagnosticV1[]
): ReadonlyMap<string, EnginePositionEvidence> => {
  if (canonicalTabResultJson === undefined) return new Map<string, EnginePositionEvidence>();
  if (typeof canonicalTabResultJson !== 'string' || canonicalTabResultJson.length === 0) {
    fail('CanonicalTabResult evidence must be a non-empty JSON string.', 'ENGINE_EVIDENCE_REJECTED', '$.options.canonicalTabResultJson');
  }

  try {
    const notationV3 = downgradeNotationV4ToV3(score, notation);
    const v2 = downgradeScoreNotationV3ToV2(score, notationV3);
    const v1 = downgradeSchemaPairV2ToV1(v2.score, v2.notation);
    const result = createGuitarWorkspaceResult(v1.score, v1.notation, canonicalTabResultJson);
    const positions = new Map<string, EnginePositionEvidence>();

    for (const entry of result.entries) {
      const current = addressEntityV3(score, entry.target.noteId);
      if (current.kind !== 'note') {
        fail(
          'Validated Guitar Workspace evidence did not resolve as a current V3 note.',
          'ENGINE_EVIDENCE_REJECTED',
          entry.target.noteId
        );
      }
      const currentNote = current as NoteAddressV3;
      if (!knownNoteIds.has(currentNote.noteId)) {
        fail(
          'Validated Guitar Workspace evidence points outside the Partitura-normalized note set.',
          'ENGINE_EVIDENCE_REJECTED',
          entry.target.noteId
        );
      }
      const direct =
        entry.disposition === 'KEEP' &&
        entry.octaveShiftSemitones === 0 &&
        entry.selectedPosition !== null;
      if (entry.selectedPosition !== null) {
        positions.set(
          currentNote.noteId,
          Object.freeze({
            position: Object.freeze({ ...entry.selectedPosition }),
            direct
          })
        );
      }
      if (!direct && entry.selectedPosition !== null) {
        diagnostics.push(Object.freeze({
          code: 'ENGINE_POSITION_NOT_DIRECT',
          path: currentNote.noteId,
          message: 'Guitar Workspace position belongs to a non-direct arrangement decision and was not used as imported TAB.',
          details: Object.freeze({
            disposition: entry.disposition,
            octaveShiftSemitones: entry.octaveShiftSemitones
          })
        }));
      }
    }

    return positions;
  } catch (error) {
    if (error instanceof GuitarTechnicalBridgeError) throw error;
    return fail(
      `Guitar Workspace result evidence was rejected: ${error instanceof Error ? error.message : String(error)}`,
      'ENGINE_EVIDENCE_REJECTED',
      '$.options.canonicalTabResultJson'
    );
  }
};

const validateTechnicalSymbolTargets = (
  symbols: readonly Readonly<PreservedMusicXmlSymbolV1>[],
  refs: readonly NormalizedNoteRef[]
): Readonly<{
  symbolsByRef: ReadonlyMap<NormalizedNoteRef, readonly Readonly<PreservedMusicXmlSymbolV1>[]>;
  unjoined: readonly Readonly<PreservedMusicXmlSymbolV1>[];
}> => {
  const bySource = new Map<string, NormalizedNoteRef>();
  for (const ref of refs) {
    if (ref.note.sourceNoteId !== null) {
      bySource.set(sourceKey(ref.partIndex, ref.note.sourceNoteId), ref);
    }
  }

  const grouped = new Map<NormalizedNoteRef, PreservedMusicXmlSymbolV1[]>();
  const unjoined: Readonly<PreservedMusicXmlSymbolV1>[] = [];

  for (const symbol of symbols) {
    if (symbol.sourceNoteId === null) {
      if (/(?:^|\/)note\[[0-9]+\](?:\/|$)/.test(symbol.sourcePath)) {
        unjoined.push(symbol);
      }
      continue;
    }

    const partIndex = sourcePartIndex(symbol.sourcePath);
    if (partIndex === null) {
      fail('Note-local preserved symbol has no deterministic Part path.', 'INVALID_INPUT', symbol.sourcePath);
    }
    const ref = bySource.get(sourceKey(partIndex as number, symbol.sourceNoteId));
    if (ref === undefined) {
      fail(
        'Preserved technical symbol sourceNoteId does not resolve to normalized Partitura note identity.',
        'INVALID_INPUT',
        symbol.sourcePath,
        { sourceNoteId: symbol.sourceNoteId, partIndex }
      );
    }
    const resolvedRef = ref as NormalizedNoteRef;
    const list = grouped.get(resolvedRef) ?? [];
    list.push(symbol);
    grouped.set(resolvedRef, list);
  }

  const frozen = new Map<NormalizedNoteRef, readonly Readonly<PreservedMusicXmlSymbolV1>[]>();
  for (const [ref, list] of grouped) frozen.set(ref, Object.freeze([...list]));
  return Object.freeze({ symbolsByRef: frozen, unjoined: Object.freeze(unjoined) });
};

export const joinPartituraGuitarTechnicalV1 = (
  envelopeInput: unknown,
  preservationSidecarInput: unknown,
  canonicalInput: GuitarTechnicalBridgeCanonicalPairV1,
  options: GuitarTechnicalBridgeOptionsV1 = {}
): Readonly<GuitarTechnicalBridgeResultV1> => {
  let preservedSymbols: readonly Readonly<PreservedMusicXmlSymbolV1>[] = Object.freeze([]);
  try {
    const envelope = validatePartituraEnvelopeV1(envelopeInput);
    preservedSymbols = validateSidecar(preservationSidecarInput, envelope);
    const score = createScoreDocumentV3(canonicalInput.score);
    const notation = createNotationDocumentV4(score, canonicalInput.notation);
    const refs = buildNormalizedNoteRefs(envelope, score);
    const knownNoteIds = new Set(refs.map(ref => ref.target.noteId));
    const tuning = parseTuning(preservedSymbols);
    const technical = validateTechnicalSymbolTargets(preservedSymbols, refs);
    const diagnostics: GuitarTechnicalBridgeDiagnosticV1[] = technical.unjoined.map(symbol => Object.freeze({
      code: 'UNJOINED_SOURCE_SYMBOL' as const,
      path: symbol.sourcePath,
      message: 'Preserved note-local Guitar technical evidence has no source note identity and remains unjoined.',
      details: Object.freeze({ element: symbol.element })
    }));
    const engine = enginePositions(
      score,
      notation,
      options.canonicalTabResultJson,
      knownNoteIds,
      diagnostics
    );

    const entries = refs.map(ref => {
      const symbols = technical.symbolsByRef.get(ref) ?? Object.freeze([]);
      const sourcePosition = parseSourcePosition(symbols, ref, tuning);
      const engineEvidence = engine.get(ref.target.noteId);
      const enginePosition = engineEvidence?.direct === true
        ? Object.freeze({ ...engineEvidence.position })
        : null;

      if (
        sourcePosition !== null &&
        enginePosition !== null &&
        (sourcePosition.string !== enginePosition.string || sourcePosition.fret !== enginePosition.fret)
      ) {
        diagnostics.push(Object.freeze({
          code: 'ENGINE_SOURCE_POSITION_DIFFERENCE',
          path: ref.target.noteId,
          message: 'Validated Guitar Workspace position differs from explicit source TAB; explicit source evidence remains authoritative for this derivative import bridge.',
          details: Object.freeze({
            sourcePosition,
            enginePosition
          })
        }));
      }

      const effectivePosition = sourcePosition ?? enginePosition;
      const positionAuthority = sourcePosition !== null
        ? 'SOURCE_EXPLICIT' as const
        : enginePosition !== null
          ? 'ENGINE_GENERATED' as const
          : 'NONE' as const;

      return Object.freeze({
        sourceNoteId: ref.note.sourceNoteId,
        target: ref.target,
        sourcePosition,
        enginePosition,
        effectivePosition,
        positionAuthority,
        technicalSymbols: Object.freeze([...symbols])
      });
    });

    return Object.freeze({
      ok: true,
      version: GUITAR_TECHNICAL_BRIDGE_VERSION,
      documentId: score.id,
      revisionId: score.revision.id,
      sourceIdentity: envelope.sourceIdentity,
      tuning: tuning.tuning,
      entries: Object.freeze(entries),
      preservedSymbols: Object.freeze([...preservedSymbols]),
      unjoinedSymbols: technical.unjoined,
      diagnostics: Object.freeze(diagnostics)
    });
  } catch (error) {
    return Object.freeze({
      ok: false,
      version: GUITAR_TECHNICAL_BRIDGE_VERSION,
      preservedSymbols: Object.freeze([...preservedSymbols]),
      diagnostics: Object.freeze([diagnosticFromError(error)])
    });
  }
};
