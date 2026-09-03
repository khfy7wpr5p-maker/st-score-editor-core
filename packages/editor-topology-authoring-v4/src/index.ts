import { createScoreDocumentV3, type ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import { addressEntityV3 } from '../../addressing-v3/src/index.js';
import { createNotationDocumentV3 } from '../../notation-structure-v3/src/index.js';
import { createNotationDocumentV4, type NotationDocumentV4 } from '../../notation-structure-v4/src/index.js';
import { executeTopologyAuthoringV3, type TopologyAuthoringV3Options } from '../../editor-topology-authoring-v3/src/index.js';

export const TOPOLOGY_AUTHORING_V4_VERSION = '1.0.0' as const;
export type TopologyAuthoringV4ErrorCode = 'CROSS_STAFF_ORPHAN_RISK' | 'RESULT_INVALID';

export class TopologyAuthoringV4Error extends Error {
  readonly code: TopologyAuthoringV4ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: TopologyAuthoringV4ErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'TopologyAuthoringV4Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

export interface TopologyAuthoringV4Result {
  readonly score: Readonly<ScoreDocumentV3>;
  readonly notation: Readonly<NotationDocumentV4>;
  readonly selectionEntityId: string;
}

const baseNotation = (score: ScoreDocumentV3, notation: NotationDocumentV4) => createNotationDocumentV3(score, {
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

export const executeTopologyAuthoringV4 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  intent: unknown,
  options: TopologyAuthoringV3Options
): Readonly<TopologyAuthoringV4Result> => {
  const score = createScoreDocumentV3(scoreInput);
  const notation = createNotationDocumentV4(score, notationInput);
  const result = executeTopologyAuthoringV3(score, baseNotation(score, notation), intent, options);
  try {
    const placements = notation.crossStaffPlacements.map(item => {
      const source = addressEntityV3(result.score, item.source.eventId);
      if (source.kind !== 'event') throw new Error(`source event changed kind: ${item.source.eventId}`);
      return { source, displayStaffId: item.displayStaffId };
    });
    const nextNotation = createNotationDocumentV4(result.score, {
      contractVersion: '4.0.0',
      documentId: result.score.id,
      revisionId: result.score.revision.id,
      frames: result.notation.frames,
      measures: result.notation.measures,
      events: result.notation.events,
      notes: result.notation.notes,
      graceEvents: result.notation.graceEvents,
      graceNotes: result.notation.graceNotes,
      crossStaffPlacements: placements
    });
    return Object.freeze({ score: result.score, notation: nextNotation, selectionEntityId: result.selectionEntityId });
  } catch (error) {
    throw new TopologyAuthoringV4Error(
      'Topology edit would orphan or invalidate a current cross-staff placement.',
      'CROSS_STAFF_ORPHAN_RISK',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
};
