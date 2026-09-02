import type { ScoreDocument } from '../../score-model/src/index.js';
import { addressEntity, resolveSemanticAddress } from '../../addressing/src/index.js';
import type { EventAddress } from '../../addressing/src/index.js';
import { createNotationDocument, notationForEvent } from '../../notation-structure/src/index.js';
import type { NotationDocument } from '../../notation-structure/src/index.js';
import { applyEditTransaction } from '../../commands/src/index.js';
import type { EditTransaction, ScoreEditCommand } from '../../commands/src/index.js';
import { rebindNotationAfterScoreEdit } from '../../editor-history/src/index.js';
import { createInsertionPosition } from '../../editor-insertion-position/src/index.js';
import { analyzeMeasureTiming } from '../../editor-measure-timing/src/index.js';
import { createMusicXmlMeasureSemanticsDocument, semanticsForMeasure } from '../../musicxml-measure-semantics/src/index.js';
import type { MusicXmlMeasureSemanticsDocument } from '../../musicxml-measure-semantics/src/index.js';

export const ADVANCED_AUTHORING_VERSION = '1.0.0' as const;

export interface AdvancedAuthoringResult {
  readonly score: Readonly<ScoreDocument>;
  readonly notation: Readonly<NotationDocument>;
}

export type AdvancedAuthoringErrorCode =
  | 'STALE_NOTATION'
  | 'TIMING_COUPLED_NOTATION'
  | 'MISSING_MEASURE_EVIDENCE'
  | 'INVALID_MEASURE_EVIDENCE'
  | 'UNSAFE_MEASURE_SEMANTICS'
  | 'NOTATION_ORPHAN_RISK'
  | 'TIMING_REJECTED'
  | 'EDIT_REJECTED';

export class AdvancedAuthoringError extends Error {
  readonly code: AdvancedAuthoringErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: AdvancedAuthoringErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'AdvancedAuthoringError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const timingCommands = (transaction: EditTransaction): readonly ScoreEditCommand[] =>
  transaction.commands.filter((command) => command.type === 'SET_EVENT_DURATION');

const eventFor = (score: ScoreDocument, target: EventAddress) => {
  const resolved = resolveSemanticAddress(score, target);
  if (resolved.kind !== 'event') throw new AdvancedAuthoringError('Duration target is stale or changed semantic kind.', 'EDIT_REJECTED');
  return resolved.value;
};

const assertDurationNotationSafe = (notation: NotationDocument, target: EventAddress): void => {
  const current = notationForEvent(notation, target.eventId);
  if ((current?.dots ?? 0) > 0 || (current?.beams.length ?? 0) > 0 || (current?.tuplet ?? null) !== null) {
    throw new AdvancedAuthoringError(
      'Duration mutation cannot independently rewrite dotted, beamed or tuplet-coupled notation.',
      'TIMING_COUPLED_NOTATION',
      { eventId: target.eventId }
    );
  }
};

const validateMusicXmlTimingEvidence = (
  score: ScoreDocument,
  measureSemantics: MusicXmlMeasureSemanticsDocument | null,
  command: ScoreEditCommand
): void => {
  if (command.type !== 'SET_EVENT_DURATION' || score.source.format !== 'musicxml') return;
  if (measureSemantics === null) {
    throw new AdvancedAuthoringError('MusicXML-derived duration authoring requires current measure-semantics evidence.', 'MISSING_MEASURE_EVIDENCE');
  }
  let evidence: Readonly<MusicXmlMeasureSemanticsDocument>;
  try {
    evidence = createMusicXmlMeasureSemanticsDocument(score, measureSemantics);
  } catch (error) {
    throw new AdvancedAuthoringError('Measure-semantics evidence is stale or invalid.', 'INVALID_MEASURE_EVIDENCE', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
  const entry = semanticsForMeasure(evidence, command.target.measureId);
  if (entry === null || entry.target.partId !== command.target.partId || entry.target.staffId !== command.target.staffId) {
    throw new AdvancedAuthoringError('Exact duration-target measure evidence is missing.', 'INVALID_MEASURE_EVIDENCE');
  }
  if (entry.implicit === 'yes' || entry.nonControlling === 'yes' || entry.effectiveTimeSignature === null) {
    throw new AdvancedAuthoringError(
      'Duration authoring is not admitted for pickup/incomplete, non-controlling or unknown-meter MusicXML measures.',
      'UNSAFE_MEASURE_SEMANTICS'
    );
  }
};

const validateChangedVoiceTiming = (
  score: ScoreDocument,
  notation: NotationDocument,
  command: ScoreEditCommand
): void => {
  if (command.type !== 'SET_EVENT_DURATION') return;
  try {
    const voiceAddress = addressEntity(score, command.target.voiceId);
    if (voiceAddress.kind !== 'voice') throw new Error(`observed ${voiceAddress.kind}`);
    const targetEvent = eventFor(score, addressEntity(score, command.target.eventId) as EventAddress);
    const position = createInsertionPosition(score, voiceAddress, targetEvent.onset);
    analyzeMeasureTiming(score, notation, position);
  } catch (error) {
    throw new AdvancedAuthoringError('Advanced duration edit failed independent measure timing/occupancy validation.', 'TIMING_REJECTED', {
      cause: error instanceof Error ? error.message : String(error),
      commandId: command.commandId
    });
  }
};

export const executeAdvancedScoreAuthoring = (
  score: ScoreDocument,
  notationInput: NotationDocument,
  measureSemantics: MusicXmlMeasureSemanticsDocument | null,
  transaction: EditTransaction
): Readonly<AdvancedAuthoringResult> => {
  let notation: Readonly<NotationDocument>;
  try {
    notation = createNotationDocument(score, notationInput);
  } catch (error) {
    throw new AdvancedAuthoringError('Advanced score authoring requires current same-revision notation.', 'STALE_NOTATION', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  for (const command of timingCommands(transaction)) {
    assertDurationNotationSafe(notation, command.target as EventAddress);
    validateMusicXmlTimingEvidence(score, measureSemantics, command);
  }

  let nextScore: Readonly<ScoreDocument>;
  try {
    nextScore = applyEditTransaction(score, transaction);
  } catch (error) {
    throw new AdvancedAuthoringError('Canonical advanced edit transaction was rejected.', 'EDIT_REJECTED', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  let nextNotation: Readonly<NotationDocument>;
  try {
    nextNotation = rebindNotationAfterScoreEdit(score, notation, nextScore);
  } catch (error) {
    throw new AdvancedAuthoringError(
      'Advanced edit would orphan or invalidate existing notation targets.',
      'NOTATION_ORPHAN_RISK',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }

  for (const command of timingCommands(transaction)) validateChangedVoiceTiming(nextScore, nextNotation, command);

  return Object.freeze({ score: nextScore, notation: nextNotation });
};
