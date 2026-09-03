import { createScoreDocumentV3, type ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import { createNotationDocumentV3, type NotationDocumentV3 } from '../../notation-structure-v3/src/index.js';
import { createNotationDocumentV4, type NotationDocumentV4 } from '../../notation-structure-v4/src/index.js';

export const SCHEMA_MIGRATION_V3_V4_VERSION = '1.0.0' as const;
export type MigrationV3V4ErrorCode = 'DOWNGRADE_UNREPRESENTABLE' | 'MIGRATION_INVALID';

export class MigrationV3V4Error extends Error {
  readonly code: MigrationV3V4ErrorCode;
  readonly path: string;
  constructor(message: string, code: MigrationV3V4ErrorCode, path: string) {
    super(message);
    this.name = 'MigrationV3V4Error';
    this.code = code;
    this.path = path;
  }
}

export const migrateNotationV3ToV4 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV3
): Readonly<NotationDocumentV4> => {
  const score = createScoreDocumentV3(scoreInput);
  const notation = createNotationDocumentV3(score, notationInput);
  return createNotationDocumentV4(score, {
    contractVersion: '4.0.0',
    documentId: notation.documentId,
    revisionId: notation.revisionId,
    frames: notation.frames,
    measures: notation.measures,
    events: notation.events,
    notes: notation.notes,
    graceEvents: notation.graceEvents,
    graceNotes: notation.graceNotes,
    crossStaffPlacements: []
  });
};

export const downgradeNotationV4ToV3 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4
): Readonly<NotationDocumentV3> => {
  const score = createScoreDocumentV3(scoreInput);
  const notation = createNotationDocumentV4(score, notationInput);
  if (notation.crossStaffPlacements.length > 0) {
    throw new MigrationV3V4Error(
      'Cross-staff placement cannot be represented losslessly by NotationDocumentV3.',
      'DOWNGRADE_UNREPRESENTABLE',
      '$.crossStaffPlacements'
    );
  }
  try {
    return createNotationDocumentV3(score, {
      contractVersion: '3.0.0',
      documentId: notation.documentId,
      revisionId: notation.revisionId,
      frames: notation.frames,
      measures: notation.measures,
      events: notation.events,
      notes: notation.notes,
      graceEvents: notation.graceEvents,
      graceNotes: notation.graceNotes
    });
  } catch (error) {
    throw new MigrationV3V4Error(
      `Notation V4 to V3 migration failed: ${error instanceof Error ? error.message : String(error)}`,
      'MIGRATION_INVALID',
      '$'
    );
  }
};
