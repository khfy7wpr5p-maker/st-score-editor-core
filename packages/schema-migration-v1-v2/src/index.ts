import { createScoreDocument, type ScoreDocument } from '../../score-model/src/index.js';
import { createNotationDocument, type NotationDocument } from '../../notation-structure/src/index.js';
import { createScoreDocumentV2, type ScoreDocumentV2 } from '../../score-model-v2/src/index.js';
import { createNotationDocumentV2, type NotationDocumentV2 } from '../../notation-structure-v2/src/index.js';
import type { SemanticAddress } from '../../addressing/src/index.js';
import type { SemanticAddressV2 } from '../../addressing-v2/src/index.js';

export const SCHEMA_MIGRATION_V1_V2_VERSION = '1.0.0' as const;
export type SchemaMigrationErrorCode = 'MIGRATION_INVALID' | 'SCHEMA_PAIR_MISMATCH' | 'DOWNGRADE_UNREPRESENTABLE';

export class SchemaMigrationError extends Error {
  readonly code: SchemaMigrationErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: SchemaMigrationErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'SchemaMigrationError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const v1ToV2Address = (address: SemanticAddress): SemanticAddressV2 =>
  Object.freeze({ ...address, contractVersion: '2.0.0' }) as SemanticAddressV2;

const v2ToV1Address = (address: SemanticAddressV2): SemanticAddress => {
  if (address.kind === 'grace-group' || address.kind === 'grace-event' || address.kind === 'grace-note') {
    throw new SchemaMigrationError(
      'Grace semantic addresses cannot be represented by v1.',
      'DOWNGRADE_UNREPRESENTABLE',
      { kind: address.kind }
    );
  }
  return Object.freeze({ ...address, contractVersion: '1.0.0' }) as SemanticAddress;
};

export const migrateScoreDocumentV1ToV2 = (scoreInput: ScoreDocument): Readonly<ScoreDocumentV2> => {
  const score = createScoreDocument(scoreInput);
  return createScoreDocumentV2({
    schemaVersion: '2.0.0',
    id: score.id,
    revision: score.revision,
    source: score.source,
    parts: score.parts.map((part) => ({
      ...part,
      staves: part.staves.map((staff) => ({
        ...staff,
        measures: staff.measures.map((measure) => ({
          ...measure,
          voices: measure.voices.map((voice) => ({ ...voice, graceGroups: [] }))
        }))
      }))
    }))
  });
};

export const migrateNotationDocumentV1ToV2 = (
  scoreV1Input: ScoreDocument,
  notationInput: NotationDocument,
  scoreV2Input?: ScoreDocumentV2
): Readonly<NotationDocumentV2> => {
  const scoreV1 = createScoreDocument(scoreV1Input);
  const notation = createNotationDocument(scoreV1, notationInput);
  const scoreV2 = scoreV2Input === undefined ? migrateScoreDocumentV1ToV2(scoreV1) : createScoreDocumentV2(scoreV2Input);

  if (scoreV2.id !== scoreV1.id || scoreV2.revision.id !== scoreV1.revision.id) {
    throw new SchemaMigrationError(
      'v1 and v2 score identities must match for pure schema conversion.',
      'SCHEMA_PAIR_MISMATCH',
      {
        v1DocumentId: scoreV1.id,
        v2DocumentId: scoreV2.id,
        v1RevisionId: scoreV1.revision.id,
        v2RevisionId: scoreV2.revision.id
      }
    );
  }

  return createNotationDocumentV2(scoreV2, {
    contractVersion: '2.0.0',
    documentId: scoreV2.id,
    revisionId: scoreV2.revision.id,
    measures: notation.measures.map((entry) => ({
      target: v1ToV2Address(entry.target) as never,
      notation: entry.notation
    })),
    events: notation.events.map((entry) => ({
      target: v1ToV2Address(entry.target) as never,
      notation: { ...entry.notation, articulations: [], ornaments: [] }
    })),
    notes: notation.notes.map((entry) => ({
      target: v1ToV2Address(entry.target) as never,
      notation: entry.notation
    })),
    graceEvents: [],
    graceNotes: []
  });
};

export interface MigratedSchemaPairV2 {
  readonly score: Readonly<ScoreDocumentV2>;
  readonly notation: Readonly<NotationDocumentV2>;
}

export const migrateSchemaPairV1ToV2 = (
  scoreInput: ScoreDocument,
  notationInput: NotationDocument
): Readonly<MigratedSchemaPairV2> => {
  const score = migrateScoreDocumentV1ToV2(scoreInput);
  const notation = migrateNotationDocumentV1ToV2(scoreInput, notationInput, score);
  return Object.freeze({ score, notation });
};

const scoreLossPaths = (score: ScoreDocumentV2): string[] => {
  const paths: string[] = [];
  score.parts.forEach((part, partIndex) => {
    part.staves.forEach((staff, staffIndex) => {
      staff.measures.forEach((measure, measureIndex) => {
        measure.voices.forEach((voice, voiceIndex) => {
          if (voice.graceGroups.length > 0) {
            paths.push(
              `$.parts[${partIndex}].staves[${staffIndex}].measures[${measureIndex}].voices[${voiceIndex}].graceGroups`
            );
          }
        });
      });
    });
  });
  return paths;
};

export const downgradeScoreDocumentV2ToV1 = (scoreInput: ScoreDocumentV2): Readonly<ScoreDocument> => {
  const score = createScoreDocumentV2(scoreInput);
  const paths = scoreLossPaths(score);
  if (paths.length > 0) {
    throw new SchemaMigrationError(
      'ScoreDocumentV2 contains semantics that v1 cannot represent.',
      'DOWNGRADE_UNREPRESENTABLE',
      { paths: Object.freeze(paths) }
    );
  }

  return createScoreDocument({
    schemaVersion: '1.0.0',
    id: score.id,
    revision: score.revision,
    source: score.source,
    parts: score.parts.map((part) => ({
      ...part,
      staves: part.staves.map((staff) => ({
        ...staff,
        measures: staff.measures.map((measure) => ({
          ...measure,
          voices: measure.voices.map(({ graceGroups: _graceGroups, ...voice }) => voice)
        }))
      }))
    }))
  });
};

const notationLossPaths = (notation: NotationDocumentV2): string[] => {
  const paths: string[] = [];
  notation.events.forEach((entry, index) => {
    if (entry.notation.articulations.length > 0) paths.push(`$.events[${index}].notation.articulations`);
    if (entry.notation.ornaments.length > 0) paths.push(`$.events[${index}].notation.ornaments`);
  });
  if (notation.graceEvents.length > 0) paths.push('$.graceEvents');
  if (notation.graceNotes.length > 0) paths.push('$.graceNotes');
  return paths;
};

export const downgradeNotationDocumentV2ToV1 = (
  scoreV2Input: ScoreDocumentV2,
  notationInput: NotationDocumentV2,
  scoreV1Input?: ScoreDocument
): Readonly<NotationDocument> => {
  const scoreV2 = createScoreDocumentV2(scoreV2Input);
  const notation = createNotationDocumentV2(scoreV2, notationInput);
  const paths = [...scoreLossPaths(scoreV2), ...notationLossPaths(notation)];

  if (paths.length > 0) {
    throw new SchemaMigrationError(
      'Schema pair contains v2-only semantics that cannot be downgraded.',
      'DOWNGRADE_UNREPRESENTABLE',
      { paths: Object.freeze(paths) }
    );
  }

  const scoreV1 = scoreV1Input === undefined ? downgradeScoreDocumentV2ToV1(scoreV2) : createScoreDocument(scoreV1Input);
  if (scoreV1.id !== scoreV2.id || scoreV1.revision.id !== scoreV2.revision.id) {
    throw new SchemaMigrationError(
      'v1 and v2 score identities must match for pure downgrade.',
      'SCHEMA_PAIR_MISMATCH'
    );
  }

  return createNotationDocument(scoreV1, {
    contractVersion: '1.0.0',
    documentId: scoreV1.id,
    revisionId: scoreV1.revision.id,
    measures: notation.measures.map((entry) => ({
      target: v2ToV1Address(entry.target) as never,
      notation: entry.notation
    })),
    events: notation.events.map((entry) => ({
      target: v2ToV1Address(entry.target) as never,
      notation: {
        dots: entry.notation.dots,
        beams: entry.notation.beams,
        tuplet: entry.notation.tuplet
      }
    })),
    notes: notation.notes.map((entry) => ({
      target: v2ToV1Address(entry.target) as never,
      notation: entry.notation
    }))
  });
};

export interface DowngradedSchemaPairV1 {
  readonly score: Readonly<ScoreDocument>;
  readonly notation: Readonly<NotationDocument>;
}

export const downgradeSchemaPairV2ToV1 = (
  scoreInput: ScoreDocumentV2,
  notationInput: NotationDocumentV2
): Readonly<DowngradedSchemaPairV1> => {
  const scoreV2 = createScoreDocumentV2(scoreInput);
  const score = downgradeScoreDocumentV2ToV1(scoreV2);
  const notation = downgradeNotationDocumentV2ToV1(scoreV2, notationInput, score);
  return Object.freeze({ score, notation });
};
