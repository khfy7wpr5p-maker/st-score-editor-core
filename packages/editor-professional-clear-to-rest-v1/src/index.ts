import {
  addressEntityV3,
  resolveSemanticAddressV3,
  type EventAddressV3,
  type SemanticAddressV3
} from '../../addressing-v3/src/index.js';
import {
  createScoreDocumentV3,
  type ScoreDocumentV3
} from '../../score-model-v3/src/index.js';
import type { ScoreEvent } from '../../score-model/src/index.js';
import {
  createNotationDocumentV4,
  type NotationDocumentV4
} from '../../notation-structure-v4/src/index.js';
import {
  createEventSetProfessionalSelectionV1,
  createEventSpanProfessionalSelectionV1,
  type ProfessionalSelectionV1
} from '../../editor-professional-selection-v1/src/index.js';

export const EDITOR_PROFESSIONAL_CLEAR_TO_REST_V1_VERSION = '1.0.0' as const;

export interface ProfessionalClearToRestAdmissionV1 {
  readonly version: typeof EDITOR_PROFESSIONAL_CLEAR_TO_REST_V1_VERSION;
  readonly kind: 'PROFESSIONAL_CLEAR_TO_REST_ADMISSION';
  readonly admitted: true;
  readonly sourceRevisionId: string;
  readonly selectionKind: ProfessionalSelectionV1['kind'];
  readonly targetEventIds: readonly string[];
  readonly replacementEventIds: readonly string[];
  readonly alreadyRestEventIds: readonly string[];
  readonly removedNoteIds: readonly string[];
  readonly canonicalMutationAuthority: false;
  readonly historyMutationAuthority: false;
}

export interface ProfessionalClearToRestOptionsV1 {
  readonly nextRevisionId: string;
}

export interface ProfessionalClearToRestResultV1 {
  readonly version: typeof EDITOR_PROFESSIONAL_CLEAR_TO_REST_V1_VERSION;
  readonly score: Readonly<ScoreDocumentV3>;
  readonly notation: Readonly<NotationDocumentV4>;
  readonly selection: Readonly<ProfessionalSelectionV1>;
  readonly admission: Readonly<ProfessionalClearToRestAdmissionV1>;
  readonly changedEventIds: readonly string[];
  readonly removedNoteIds: readonly string[];
  readonly historyMutationAuthority: false;
}

export type ProfessionalClearToRestV1ErrorCode =
  | 'SELECTION_STALE_OR_TAMPERED'
  | 'NO_PITCHED_TARGETS'
  | 'NOTATION_ORPHAN_RISK'
  | 'CROSS_STAFF_CONFLICT'
  | 'ADMISSION_STALE_OR_TAMPERED'
  | 'INVALID_REVISION_ID'
  | 'TARGET_PLAN_INVALID'
  | 'RESULT_INVALID'
  | 'NOTATION_RESULT_INVALID'
  | 'RESULT_SELECTION_INVALID';

export class ProfessionalClearToRestV1Error extends Error {
  readonly code: ProfessionalClearToRestV1ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    code: ProfessionalClearToRestV1ErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'ProfessionalClearToRestV1Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const sameJson = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

const selectionFacts = (selection: ProfessionalSelectionV1): unknown =>
  selection.kind === 'EVENT_SPAN'
    ? {
        version: selection.version,
        kind: selection.kind,
        anchorEventId: selection.anchor.eventId,
        focusEventId: selection.focus.eventId,
        direction: selection.direction,
        scope: selection.scope,
        targetEventIds: selection.targets.map(target => target.eventId)
      }
    : {
        version: selection.version,
        kind: selection.kind,
        primaryEventId: selection.primary.eventId,
        scope: selection.scope,
        targetEventIds: selection.targets.map(target => target.eventId)
      };

const requireCurrentSelection = (
  score: ScoreDocumentV3,
  selection: ProfessionalSelectionV1
): Readonly<ProfessionalSelectionV1> => {
  let current: Readonly<ProfessionalSelectionV1>;
  try {
    if (selection.kind === 'EVENT_SPAN') {
      current = createEventSpanProfessionalSelectionV1(score, selection.anchor, selection.focus);
    } else {
      current = createEventSetProfessionalSelectionV1(score, [
        selection.primary,
        ...selection.targets.filter(target => target.eventId !== selection.primary.eventId)
      ]);
    }
  } catch (error) {
    throw new ProfessionalClearToRestV1Error(
      'Professional clear selection no longer resolves against the current score revision.',
      'SELECTION_STALE_OR_TAMPERED',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  if (!sameJson(selectionFacts(current), selectionFacts(selection))) {
    throw new ProfessionalClearToRestV1Error(
      'Professional clear selection facts changed or were tampered with.',
      'SELECTION_STALE_OR_TAMPERED'
    );
  }
  return current;
};

const selectedEvent = (score: ScoreDocumentV3, target: EventAddressV3): ScoreEvent => {
  try {
    const resolved = resolveSemanticAddressV3(score, target);
    if (resolved.kind !== 'event') throw new Error('target is not event');
    return resolved.value;
  } catch (error) {
    throw new ProfessionalClearToRestV1Error(
      'Professional clear target no longer resolves as an event.',
      'SELECTION_STALE_OR_TAMPERED',
      { eventId: target.eventId, cause: error instanceof Error ? error.message : String(error) }
    );
  }
};

const noteIds = (event: ScoreEvent): readonly string[] =>
  event.kind === 'note' ? [event.note.id] : event.kind === 'chord' ? event.notes.map(note => note.id) : [];

export const analyzeProfessionalClearToRestV1 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  selectionInput: ProfessionalSelectionV1
): Readonly<ProfessionalClearToRestAdmissionV1> => {
  const score = createScoreDocumentV3(scoreInput);
  const notation = createNotationDocumentV4(score, notationInput);
  const selection = requireCurrentSelection(score, selectionInput);
  const replacementEventIds: string[] = [];
  const alreadyRestEventIds: string[] = [];
  const removedNoteIds: string[] = [];
  const noteNotationIds = new Set(notation.notes.map(entry => entry.target.noteId));
  const crossStaffEventIds = new Set(notation.crossStaffPlacements.map(entry => entry.source.eventId));

  for (const target of selection.targets) {
    const event = selectedEvent(score, target);
    if (event.kind === 'rest') {
      alreadyRestEventIds.push(event.id);
      continue;
    }
    const removed = noteIds(event);
    const orphaned = removed.filter(noteId => noteNotationIds.has(noteId));
    if (orphaned.length > 0) {
      throw new ProfessionalClearToRestV1Error(
        'Clearing this selected event to REST would orphan note-level notation.',
        'NOTATION_ORPHAN_RISK',
        { eventId: event.id, noteIds: orphaned }
      );
    }
    if (crossStaffEventIds.has(event.id)) {
      throw new ProfessionalClearToRestV1Error(
        'Cross-staff placement must be explicitly removed before clearing its source event to REST.',
        'CROSS_STAFF_CONFLICT',
        { eventId: event.id }
      );
    }
    replacementEventIds.push(event.id);
    removedNoteIds.push(...removed);
  }

  if (replacementEventIds.length === 0) {
    throw new ProfessionalClearToRestV1Error(
      'Professional clear selection contains no pitched event to replace with REST.',
      'NO_PITCHED_TARGETS'
    );
  }

  return Object.freeze({
    version: EDITOR_PROFESSIONAL_CLEAR_TO_REST_V1_VERSION,
    kind: 'PROFESSIONAL_CLEAR_TO_REST_ADMISSION' as const,
    admitted: true as const,
    sourceRevisionId: score.revision.id,
    selectionKind: selection.kind,
    targetEventIds: Object.freeze(selection.targets.map(target => target.eventId)),
    replacementEventIds: Object.freeze(replacementEventIds),
    alreadyRestEventIds: Object.freeze(alreadyRestEventIds),
    removedNoteIds: Object.freeze(removedNoteIds),
    canonicalMutationAuthority: false as const,
    historyMutationAuthority: false as const
  });
};

const targetId = (address: SemanticAddressV3): string => {
  switch (address.kind) {
    case 'document': return address.documentId;
    case 'measure-frame': return address.frameId;
    case 'part': return address.partId;
    case 'staff': return address.staffId;
    case 'measure': return address.measureId;
    case 'voice': return address.voiceId;
    case 'event': return address.eventId;
    case 'note': return address.noteId;
    case 'grace-group': return address.graceGroupId;
    case 'grace-event': return address.graceEventId;
    case 'grace-note': return address.graceNoteId;
  }
};

const rebind = (score: ScoreDocumentV3, address: SemanticAddressV3): SemanticAddressV3 => {
  try {
    const next = addressEntityV3(score, targetId(address));
    if (next.kind !== address.kind) throw new Error('semantic kind changed');
    return next;
  } catch (error) {
    throw new ProfessionalClearToRestV1Error(
      'Professional clear result would orphan surviving notation.',
      'NOTATION_RESULT_INVALID',
      { targetKind: address.kind, targetId: targetId(address), cause: error instanceof Error ? error.message : String(error) }
    );
  }
};

const rebindNotation = (
  score: ScoreDocumentV3,
  notation: NotationDocumentV4
): Readonly<NotationDocumentV4> => {
  try {
    return createNotationDocumentV4(score, {
      contractVersion: '4.0.0',
      documentId: score.id,
      revisionId: score.revision.id,
      frames: notation.frames.map(entry => ({ target: rebind(score, entry.target) as typeof entry.target, notation: entry.notation })),
      measures: notation.measures.map(entry => ({ target: rebind(score, entry.target) as typeof entry.target, notation: entry.notation })),
      events: notation.events.map(entry => ({ target: rebind(score, entry.target) as typeof entry.target, notation: entry.notation })),
      notes: notation.notes.map(entry => ({ target: rebind(score, entry.target) as typeof entry.target, notation: entry.notation })),
      graceEvents: notation.graceEvents.map(entry => ({ target: rebind(score, entry.target) as typeof entry.target, notation: entry.notation })),
      graceNotes: notation.graceNotes.map(entry => ({ target: rebind(score, entry.target) as typeof entry.target, notation: entry.notation })),
      crossStaffPlacements: notation.crossStaffPlacements.map(entry => ({
        source: rebind(score, entry.source) as EventAddressV3,
        displayStaffId: entry.displayStaffId
      }))
    });
  } catch (error) {
    if (error instanceof ProfessionalClearToRestV1Error) throw error;
    throw new ProfessionalClearToRestV1Error(
      'Professional clear notation result failed canonical validation.',
      'NOTATION_RESULT_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
};

const assertFreshRevision = (score: ScoreDocumentV3, nextRevisionId: string): void => {
  if (!ID.test(nextRevisionId) || nextRevisionId === score.revision.id || nextRevisionId === score.revision.parentId) {
    throw new ProfessionalClearToRestV1Error(
      'Professional clear requires a fresh stable revision id.',
      'INVALID_REVISION_ID',
      { nextRevisionId, currentRevisionId: score.revision.id, parentRevisionId: score.revision.parentId }
    );
  }
};

const eventAddress = (score: ScoreDocumentV3, eventId: string): EventAddressV3 => {
  const address = addressEntityV3(score, eventId);
  if (address.kind !== 'event') {
    throw new ProfessionalClearToRestV1Error(
      'Professional clear result selection no longer resolves as event.',
      'RESULT_SELECTION_INVALID',
      { eventId, observedKind: address.kind }
    );
  }
  return address;
};

const rebindSelection = (
  score: ScoreDocumentV3,
  selection: ProfessionalSelectionV1
): Readonly<ProfessionalSelectionV1> => {
  if (selection.kind === 'EVENT_SPAN') {
    return createEventSpanProfessionalSelectionV1(
      score,
      eventAddress(score, selection.anchor.eventId),
      eventAddress(score, selection.focus.eventId)
    );
  }
  const primary = eventAddress(score, selection.primary.eventId);
  return createEventSetProfessionalSelectionV1(score, [
    primary,
    ...selection.targets
      .filter(target => target.eventId !== selection.primary.eventId)
      .map(target => eventAddress(score, target.eventId))
  ]);
};

export const executeProfessionalClearToRestV1 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  selectionInput: ProfessionalSelectionV1,
  admissionInput: ProfessionalClearToRestAdmissionV1,
  options: ProfessionalClearToRestOptionsV1
): Readonly<ProfessionalClearToRestResultV1> => {
  const score = createScoreDocumentV3(scoreInput);
  const notation = createNotationDocumentV4(score, notationInput);
  const selection = requireCurrentSelection(score, selectionInput);
  const currentAdmission = analyzeProfessionalClearToRestV1(score, notation, selection);
  if (!sameJson(currentAdmission, admissionInput)) {
    throw new ProfessionalClearToRestV1Error(
      'Professional clear admission facts changed or were tampered with before mutation.',
      'ADMISSION_STALE_OR_TAMPERED'
    );
  }
  assertFreshRevision(score, options.nextRevisionId);

  const targetIds = new Set(currentAdmission.replacementEventIds);
  const expectedRemoved = new Set(currentAdmission.removedNoteIds);
  const observedRemoved = new Set<string>();
  const changedEventIds: string[] = [];
  const raw = structuredClone(score) as ScoreDocumentV3;

  for (const part of raw.parts) for (const staff of part.staves) {
    if (staff.role === 'tablature-linked') continue;
    for (const measure of staff.measures) for (const voice of measure.voices) {
      (voice as { events: readonly ScoreEvent[] }).events = voice.events.map((event): ScoreEvent => {
        if (!targetIds.has(event.id)) return event;
        if (event.kind === 'rest') {
          throw new ProfessionalClearToRestV1Error(
            'Professional clear target plan no longer points to a pitched event.',
            'TARGET_PLAN_INVALID',
            { eventId: event.id }
          );
        }
        for (const noteId of noteIds(event)) observedRemoved.add(noteId);
        changedEventIds.push(event.id);
        return {
          id: event.id,
          kind: 'rest',
          onset: event.onset,
          duration: event.duration
        };
      });
    }
  }

  if (
    changedEventIds.length !== targetIds.size ||
    observedRemoved.size !== expectedRemoved.size ||
    [...expectedRemoved].some(noteId => !observedRemoved.has(noteId))
  ) {
    throw new ProfessionalClearToRestV1Error(
      'Professional clear did not apply the admitted event/note removal plan exactly once.',
      'TARGET_PLAN_INVALID',
      {
        expectedEvents: targetIds.size,
        changedEvents: changedEventIds.length,
        expectedNotes: expectedRemoved.size,
        removedNotes: observedRemoved.size
      }
    );
  }

  (raw as { revision: ScoreDocumentV3['revision'] }).revision = {
    id: options.nextRevisionId,
    parentId: score.revision.id
  };
  let nextScore: Readonly<ScoreDocumentV3>;
  try {
    nextScore = createScoreDocumentV3(raw);
  } catch (error) {
    throw new ProfessionalClearToRestV1Error(
      'Professional clear score result failed canonical validation.',
      'RESULT_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  const nextNotation = rebindNotation(nextScore, notation);
  const nextSelection = rebindSelection(nextScore, selection);

  return Object.freeze({
    version: EDITOR_PROFESSIONAL_CLEAR_TO_REST_V1_VERSION,
    score: nextScore,
    notation: nextNotation,
    selection: nextSelection,
    admission: currentAdmission,
    changedEventIds: Object.freeze(changedEventIds),
    removedNoteIds: Object.freeze([...observedRemoved]),
    historyMutationAuthority: false as const
  });
};
