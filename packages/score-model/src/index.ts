export {
  SCORE_DOCUMENT_SCHEMA_VERSION
} from './types.js';

export type {
  ChordEvent,
  EntityId,
  EventBase,
  Measure,
  NoteAtom,
  NoteEvent,
  Part,
  Pitch,
  PitchStep,
  Rational,
  RestEvent,
  RevisionIdentity,
  ScoreDocument,
  ScoreDocumentSchemaVersion,
  ScoreEvent,
  SourceFormat,
  SourceIdentity,
  Staff,
  ValidationIssue,
  ValidationIssueCode,
  ValidationResult,
  Voice
} from './types.js';

export {
  createScoreDocument,
  ScoreDocumentValidationError,
  validateScoreDocument
} from './validation.js';
