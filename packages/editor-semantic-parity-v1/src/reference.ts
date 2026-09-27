import { parseMusicXmlV2Tree } from '../../musicxml-v2/src/index.js';
import {
  SEMANTIC_PARITY_REFERENCE_VERSION,
  type EditorSemanticParityDiagnosticV1,
  type SemanticParityProfileResultV1,
  type SemanticParityProvenanceV1,
  type SemanticParityReferenceV1,
  type SemanticParitySnapshotV1,
  type SemanticReferenceClefV1,
  type SemanticReferenceKeySignatureV1,
  type SemanticReferenceNoteV1,
  type SemanticReferenceTimeSignatureV1
} from './types.js';

export { SEMANTIC_PARITY_REFERENCE_VERSION };

export class SemanticParityReferenceError extends Error {
  readonly code = 'INVALID_REFERENCE' as const;

  constructor(message: string) {
    super(message);
    this.name = 'SemanticParityReferenceError';
    Object.freeze(this);
  }
}

type RecordValue = Record<string, unknown>;
type XmlNode = ReturnType<typeof parseMusicXmlV2Tree>['root'];

const record = (value: unknown, label: string): RecordValue => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new SemanticParityReferenceError(`${label} must be an object.`);
  }
  return value as RecordValue;
};

const stringValue = (value: unknown, label: string): string => {
  if (typeof value !== 'string') throw new SemanticParityReferenceError(`${label} must be a string.`);
  return value;
};

const integerValue = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new SemanticParityReferenceError(`${label} must be a safe integer.`);
  }
  return value;
};

const nullableString = (value: unknown, label: string): string | null =>
  value === null ? null : stringValue(value, label);

const nullableInteger = (value: unknown, label: string): number | null =>
  value === null ? null : integerValue(value, label);

const arrayValue = (value: unknown, label: string): readonly unknown[] => {
  if (!Array.isArray(value)) throw new SemanticParityReferenceError(`${label} must be an array.`);
  return value;
};

const parseProvenance = (value: unknown): Readonly<SemanticParityProvenanceV1> => {
  const input = record(value, 'provenance');
  const schemaVersion = stringValue(input.schemaVersion, 'provenance.schemaVersion');
  const sourceSha256 = stringValue(input.sourceSha256, 'provenance.sourceSha256');
  const semanticEngineCommit = stringValue(input.semanticEngineCommit, 'provenance.semanticEngineCommit');
  const semanticSnapshotSchema = stringValue(input.semanticSnapshotSchema, 'provenance.semanticSnapshotSchema');
  const partituraVersion = stringValue(input.partituraVersion, 'provenance.partituraVersion');
  const divisionsPerQuarter = integerValue(input.divisionsPerQuarter, 'provenance.divisionsPerQuarter');

  if (schemaVersion !== 'st-editor-semantic-parity-fixture-v1') {
    throw new SemanticParityReferenceError('Reference provenance schema version is unsupported.');
  }
  if (!/^[0-9a-f]{64}$/.test(sourceSha256)) {
    throw new SemanticParityReferenceError('Reference source SHA-256 is invalid.');
  }
  if (semanticEngineCommit !== 'ffc997b242fa862e180e698385cc0afb52de47a1') {
    throw new SemanticParityReferenceError('Reference Semantic Engine commit is not the qualified pin.');
  }
  if (semanticSnapshotSchema !== 'st-semantic-snapshot-v1') {
    throw new SemanticParityReferenceError('Reference semantic snapshot schema is unsupported.');
  }
  if (partituraVersion !== '1.9.0') {
    throw new SemanticParityReferenceError('Reference Partitura version is unsupported.');
  }
  if (divisionsPerQuarter <= 0) {
    throw new SemanticParityReferenceError('Reference divisionsPerQuarter must be positive.');
  }

  return Object.freeze({
    schemaVersion,
    sourceSha256,
    semanticEngineCommit,
    semanticSnapshotSchema,
    partituraVersion,
    divisionsPerQuarter
  }) as Readonly<SemanticParityProvenanceV1>;
};

const parseNote = (value: unknown, index: number): Readonly<SemanticReferenceNoteV1> => {
  const input = record(value, `semanticSnapshot.notes[${index}]`);
  const isGrace = input.is_grace;
  if (typeof isGrace !== 'boolean') {
    throw new SemanticParityReferenceError(`semanticSnapshot.notes[${index}].is_grace must be boolean.`);
  }
  return Object.freeze({
    source_id: nullableString(input.source_id, `semanticSnapshot.notes[${index}].source_id`),
    part_id: stringValue(input.part_id, `semanticSnapshot.notes[${index}].part_id`),
    measure_index: integerValue(input.measure_index, `semanticSnapshot.notes[${index}].measure_index`),
    pitch_midi: integerValue(input.pitch_midi, `semanticSnapshot.notes[${index}].pitch_midi`),
    onset_div: integerValue(input.onset_div, `semanticSnapshot.notes[${index}].onset_div`),
    duration_div: integerValue(input.duration_div, `semanticSnapshot.notes[${index}].duration_div`),
    voice: nullableInteger(input.voice, `semanticSnapshot.notes[${index}].voice`),
    staff: nullableInteger(input.staff, `semanticSnapshot.notes[${index}].staff`),
    tie_prev: nullableString(input.tie_prev, `semanticSnapshot.notes[${index}].tie_prev`),
    tie_next: nullableString(input.tie_next, `semanticSnapshot.notes[${index}].tie_next`),
    is_grace: isGrace
  });
};

const parseTimeSignature = (value: unknown, index: number): Readonly<SemanticReferenceTimeSignatureV1> => {
  const input = record(value, `semanticSnapshot.time_signatures[${index}]`);
  return Object.freeze({
    part_id: stringValue(input.part_id, 'time signature part_id'),
    onset_div: integerValue(input.onset_div, 'time signature onset_div'),
    beats: integerValue(input.beats, 'time signature beats'),
    beat_type: integerValue(input.beat_type, 'time signature beat_type')
  });
};

const parseKeySignature = (value: unknown, index: number): Readonly<SemanticReferenceKeySignatureV1> => {
  const input = record(value, `semanticSnapshot.key_signatures[${index}]`);
  return Object.freeze({
    part_id: stringValue(input.part_id, 'key signature part_id'),
    onset_div: integerValue(input.onset_div, 'key signature onset_div'),
    fifths: integerValue(input.fifths, 'key signature fifths'),
    mode: nullableString(input.mode, 'key signature mode')
  });
};

const parseClef = (value: unknown, index: number): Readonly<SemanticReferenceClefV1> => {
  const input = record(value, `semanticSnapshot.clefs[${index}]`);
  return Object.freeze({
    part_id: stringValue(input.part_id, 'clef part_id'),
    onset_div: integerValue(input.onset_div, 'clef onset_div'),
    staff: integerValue(input.staff, 'clef staff'),
    sign: stringValue(input.sign, 'clef sign'),
    line: nullableInteger(input.line, 'clef line'),
    octave_change: integerValue(input.octave_change, 'clef octave_change')
  });
};

const parseSnapshot = (value: unknown): Readonly<SemanticParitySnapshotV1> => {
  const input = record(value, 'semanticSnapshot');
  if (input.schema_version !== 'st-semantic-snapshot-v1' || input.source_kind !== 'musicxml') {
    throw new SemanticParityReferenceError('Semantic snapshot header is unsupported.');
  }
  return Object.freeze({
    schema_version: 'st-semantic-snapshot-v1',
    source_kind: 'musicxml',
    part_count: integerValue(input.part_count, 'semanticSnapshot.part_count'),
    measure_count: integerValue(input.measure_count, 'semanticSnapshot.measure_count'),
    notes: Object.freeze(arrayValue(input.notes, 'semanticSnapshot.notes').map(parseNote)),
    time_signatures: Object.freeze(
      arrayValue(input.time_signatures, 'semanticSnapshot.time_signatures').map(parseTimeSignature)
    ),
    key_signatures: Object.freeze(
      arrayValue(input.key_signatures, 'semanticSnapshot.key_signatures').map(parseKeySignature)
    ),
    clefs: Object.freeze(arrayValue(input.clefs, 'semanticSnapshot.clefs').map(parseClef))
  });
};

export const validateSemanticParityReferenceV1 = (inputValue: {
  readonly provenance: unknown;
  readonly semanticSnapshot: unknown;
  readonly observedSourceSha256: string;
}): Readonly<SemanticParityReferenceV1> => {
  const provenance = parseProvenance(inputValue.provenance);
  if (inputValue.observedSourceSha256 !== provenance.sourceSha256) {
    throw new SemanticParityReferenceError('Observed MusicXML SHA-256 does not match reference provenance.');
  }
  const semanticSnapshot = parseSnapshot(inputValue.semanticSnapshot);
  if (semanticSnapshot.schema_version !== provenance.semanticSnapshotSchema) {
    throw new SemanticParityReferenceError('Semantic snapshot schema does not match provenance.');
  }
  return Object.freeze({ provenance, semanticSnapshot });
};

const childrenNamed = (node: XmlNode, name: string): readonly XmlNode[] =>
  node.children.filter((child) => child.name === name);

const descendants = (node: XmlNode, name: string, output: XmlNode[] = []): readonly XmlNode[] => {
  if (node.name === name) output.push(node);
  for (const child of node.children) descendants(child, name, output);
  return output;
};

const attr = (node: XmlNode, name: string): string | undefined =>
  node.attributes.find((item) => item.name === name)?.value;

const unsupported = (message: string): SemanticParityProfileResultV1 => {
  const diagnostic: EditorSemanticParityDiagnosticV1 = Object.freeze({
    code: 'PROFILE_UNSUPPORTED',
    message
  });
  return Object.freeze({ status: 'UNSUPPORTED', diagnostics: Object.freeze([diagnostic]) });
};

export const analyzeSemanticParityMusicXmlProfileV1 = (
  musicXml: string,
  expectedDivisionsPerQuarter: number
): Readonly<SemanticParityProfileResultV1> => {
  if (!Number.isSafeInteger(expectedDivisionsPerQuarter) || expectedDivisionsPerQuarter <= 0) {
    return unsupported('Expected divisions-per-quarter must be a positive safe integer.');
  }

  let root: XmlNode;
  try {
    root = parseMusicXmlV2Tree(musicXml).root;
  } catch (error) {
    return unsupported(`MusicXML is outside the admitted semantic parity parser profile: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (childrenNamed(root, 'part').length !== 1) return unsupported('SEM-04 admits exactly one MusicXML part.');
  if (descendants(root, 'grace').length > 0) return unsupported('Grace notes are outside the SEM-04 comparison profile.');
  if (descendants(root, 'tuplet').length > 0 || descendants(root, 'beam').length > 0 || descendants(root, 'slur').length > 0 || descendants(root, 'tremolo').length > 0) {
    return unsupported('Tuplet, beam, slur and tremolo semantics are outside the SEM-04 comparison profile.');
  }
  for (const measure of descendants(root, 'measure')) {
    if (attr(measure, 'non-controlling') !== undefined) {
      return unsupported('Non-controlling measures are outside the SEM-04 comparison profile.');
    }
  }

  const divisionsNodes = descendants(root, 'divisions');
  if (divisionsNodes.length === 0) return unsupported('SEM-04 requires an explicit divisions value.');
  for (const node of divisionsNodes) {
    const value = Number(node.text.trim());
    if (!Number.isSafeInteger(value) || value !== expectedDivisionsPerQuarter) {
      return unsupported('MusicXML divisions do not match the fixed SEM-04 fixture profile.');
    }
  }

  return Object.freeze({ status: 'PASS' });
};
