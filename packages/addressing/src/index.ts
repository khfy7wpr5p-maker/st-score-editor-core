import type {
  ChordEvent,
  Measure,
  NoteAtom,
  NoteEvent,
  Part,
  RestEvent,
  ScoreDocument,
  ScoreEvent,
  Staff,
  Voice
} from '../../score-model/src/index.js';

export const SEMANTIC_ADDRESS_VERSION = '1.0.0' as const;

export type AddressKind =
  | 'document'
  | 'part'
  | 'staff'
  | 'measure'
  | 'voice'
  | 'event'
  | 'note';

interface AddressBase {
  readonly contractVersion: typeof SEMANTIC_ADDRESS_VERSION;
  readonly kind: AddressKind;
  readonly documentId: string;
  readonly revisionId: string;
}

export interface DocumentAddress extends AddressBase {
  readonly kind: 'document';
}

export interface PartAddress extends AddressBase {
  readonly kind: 'part';
  readonly partId: string;
}

export interface StaffAddress extends AddressBase {
  readonly kind: 'staff';
  readonly partId: string;
  readonly staffId: string;
}

export interface MeasureAddress extends AddressBase {
  readonly kind: 'measure';
  readonly partId: string;
  readonly staffId: string;
  readonly measureId: string;
}

export interface VoiceAddress extends AddressBase {
  readonly kind: 'voice';
  readonly partId: string;
  readonly staffId: string;
  readonly measureId: string;
  readonly voiceId: string;
}

export interface EventAddress extends AddressBase {
  readonly kind: 'event';
  readonly partId: string;
  readonly staffId: string;
  readonly measureId: string;
  readonly voiceId: string;
  readonly eventId: string;
}

export interface NoteAddress extends AddressBase {
  readonly kind: 'note';
  readonly partId: string;
  readonly staffId: string;
  readonly measureId: string;
  readonly voiceId: string;
  readonly eventId: string;
  readonly noteId: string;
}

export type SemanticAddress =
  | DocumentAddress
  | PartAddress
  | StaffAddress
  | MeasureAddress
  | VoiceAddress
  | EventAddress
  | NoteAddress;

export type ResolvedSemanticTarget =
  | { readonly kind: 'document'; readonly value: ScoreDocument }
  | { readonly kind: 'part'; readonly value: Part }
  | { readonly kind: 'staff'; readonly value: Staff }
  | { readonly kind: 'measure'; readonly value: Measure }
  | { readonly kind: 'voice'; readonly value: Voice }
  | { readonly kind: 'event'; readonly value: ScoreEvent }
  | { readonly kind: 'note'; readonly value: NoteAtom };

export type AddressingErrorCode =
  | 'INVALID_ADDRESS'
  | 'DOCUMENT_MISMATCH'
  | 'STALE_REVISION'
  | 'TARGET_NOT_FOUND'
  | 'ADDRESS_PATH_MISMATCH';

export class AddressingError extends Error {
  readonly code: AddressingErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(message: string, code: AddressingErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'AddressingError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const freezeAddress = <T extends SemanticAddress>(address: T): Readonly<T> =>
  Object.freeze({ ...address });

const base = (document: ScoreDocument, kind: AddressKind): AddressBase => ({
  contractVersion: SEMANTIC_ADDRESS_VERSION,
  kind,
  documentId: document.id,
  revisionId: document.revision.id
});

const ensureId = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0 || value !== value.trim()) {
    throw new AddressingError('Semantic address contains an invalid identifier.', 'INVALID_ADDRESS', { field });
  }
  return value;
};

const ensureEnvelope = (document: ScoreDocument, address: SemanticAddress): void => {
  if (address.contractVersion !== SEMANTIC_ADDRESS_VERSION) {
    throw new AddressingError('Semantic address contract version is unsupported.', 'INVALID_ADDRESS', {
      contractVersion: address.contractVersion
    });
  }
  ensureId(address.documentId, 'documentId');
  ensureId(address.revisionId, 'revisionId');
  if (address.documentId !== document.id) {
    throw new AddressingError('Semantic address belongs to another document.', 'DOCUMENT_MISMATCH', {
      expected: document.id,
      observed: address.documentId
    });
  }
  if (address.revisionId !== document.revision.id) {
    throw new AddressingError('Semantic address belongs to a stale revision.', 'STALE_REVISION', {
      expected: document.revision.id,
      observed: address.revisionId
    });
  }
};

const findPart = (document: ScoreDocument, partId: string): Part => {
  ensureId(partId, 'partId');
  const part = document.parts.find((candidate) => candidate.id === partId);
  if (part === undefined) throw new AddressingError('Part target was not found.', 'TARGET_NOT_FOUND', { partId });
  return part;
};

const findStaff = (part: Part, staffId: string): Staff => {
  ensureId(staffId, 'staffId');
  const staff = part.staves.find((candidate) => candidate.id === staffId);
  if (staff === undefined) throw new AddressingError('Staff target was not found under addressed part.', 'ADDRESS_PATH_MISMATCH', { staffId, partId: part.id });
  return staff;
};

const findMeasure = (staff: Staff, measureId: string): Measure => {
  ensureId(measureId, 'measureId');
  const measure = staff.measures.find((candidate) => candidate.id === measureId);
  if (measure === undefined) throw new AddressingError('Measure target was not found under addressed staff.', 'ADDRESS_PATH_MISMATCH', { measureId, staffId: staff.id });
  return measure;
};

const findVoice = (measure: Measure, voiceId: string): Voice => {
  ensureId(voiceId, 'voiceId');
  const voice = measure.voices.find((candidate) => candidate.id === voiceId);
  if (voice === undefined) throw new AddressingError('Voice target was not found under addressed measure.', 'ADDRESS_PATH_MISMATCH', { voiceId, measureId: measure.id });
  return voice;
};

const findEvent = (voice: Voice, eventId: string): ScoreEvent => {
  ensureId(eventId, 'eventId');
  const event = voice.events.find((candidate) => candidate.id === eventId);
  if (event === undefined) throw new AddressingError('Event target was not found under addressed voice.', 'ADDRESS_PATH_MISMATCH', { eventId, voiceId: voice.id });
  return event;
};

const eventNotes = (event: ScoreEvent): readonly NoteAtom[] => {
  if (event.kind === 'note') return [event.note];
  if (event.kind === 'chord') return event.notes;
  return [];
};

export const resolveSemanticAddress = (
  document: ScoreDocument,
  address: SemanticAddress
): ResolvedSemanticTarget => {
  ensureEnvelope(document, address);
  if (address.kind === 'document') return Object.freeze({ kind: 'document', value: document });

  const part = findPart(document, address.partId);
  if (address.kind === 'part') return Object.freeze({ kind: 'part', value: part });

  const staff = findStaff(part, address.staffId);
  if (address.kind === 'staff') return Object.freeze({ kind: 'staff', value: staff });

  const measure = findMeasure(staff, address.measureId);
  if (address.kind === 'measure') return Object.freeze({ kind: 'measure', value: measure });

  const voice = findVoice(measure, address.voiceId);
  if (address.kind === 'voice') return Object.freeze({ kind: 'voice', value: voice });

  const event = findEvent(voice, address.eventId);
  if (address.kind === 'event') return Object.freeze({ kind: 'event', value: event });

  ensureId(address.noteId, 'noteId');
  const note = eventNotes(event).find((candidate) => candidate.id === address.noteId);
  if (note === undefined) {
    throw new AddressingError('Note target was not found under addressed event.', 'ADDRESS_PATH_MISMATCH', {
      noteId: address.noteId,
      eventId: event.id
    });
  }
  return Object.freeze({ kind: 'note', value: note });
};

export interface SemanticAddressIndex {
  readonly document: DocumentAddress;
  readonly byEntityId: ReadonlyMap<string, SemanticAddress>;
}

export const createSemanticAddressIndex = (document: ScoreDocument): SemanticAddressIndex => {
  const documentAddress = freezeAddress({ ...base(document, 'document'), kind: 'document' });
  const index = new Map<string, SemanticAddress>([[document.id, documentAddress]]);
  const add = (id: string, address: SemanticAddress): void => {
    if (index.has(id)) {
      throw new AddressingError('Duplicate entity identity prevents deterministic addressing.', 'INVALID_ADDRESS', { id });
    }
    index.set(id, freezeAddress(address));
  };

  for (const part of document.parts) {
    const partAddress: PartAddress = { ...base(document, 'part'), kind: 'part', partId: part.id };
    add(part.id, partAddress);
    for (const staff of part.staves) {
      const staffAddress: StaffAddress = { ...base(document, 'staff'), kind: 'staff', partId: part.id, staffId: staff.id };
      add(staff.id, staffAddress);
      for (const measure of staff.measures) {
        const measureAddress: MeasureAddress = {
          ...base(document, 'measure'), kind: 'measure', partId: part.id, staffId: staff.id, measureId: measure.id
        };
        add(measure.id, measureAddress);
        for (const voice of measure.voices) {
          const voiceAddress: VoiceAddress = {
            ...base(document, 'voice'), kind: 'voice', partId: part.id, staffId: staff.id, measureId: measure.id, voiceId: voice.id
          };
          add(voice.id, voiceAddress);
          for (const event of voice.events) {
            const eventAddress: EventAddress = {
              ...base(document, 'event'), kind: 'event', partId: part.id, staffId: staff.id, measureId: measure.id, voiceId: voice.id, eventId: event.id
            };
            add(event.id, eventAddress);
            for (const note of eventNotes(event)) {
              const noteAddress: NoteAddress = {
                ...base(document, 'note'), kind: 'note', partId: part.id, staffId: staff.id, measureId: measure.id,
                voiceId: voice.id, eventId: event.id, noteId: note.id
              };
              add(note.id, noteAddress);
            }
          }
        }
      }
    }
  }

  return Object.freeze({ document: documentAddress, byEntityId: index });
};

export const addressEntity = (document: ScoreDocument, entityId: string): SemanticAddress => {
  ensureId(entityId, 'entityId');
  const address = createSemanticAddressIndex(document).byEntityId.get(entityId);
  if (address === undefined) {
    throw new AddressingError('Entity target was not found.', 'TARGET_NOT_FOUND', { entityId });
  }
  return address;
};

export interface SelectionSnapshot {
  readonly contractVersion: '1.0.0';
  readonly documentId: string;
  readonly revisionId: string;
  readonly primary: SemanticAddress | null;
}

export const createSelectionSnapshot = (
  document: ScoreDocument,
  primary: SemanticAddress | null
): Readonly<SelectionSnapshot> => {
  if (primary !== null) resolveSemanticAddress(document, primary);
  return Object.freeze({
    contractVersion: '1.0.0',
    documentId: document.id,
    revisionId: document.revision.id,
    primary
  });
};

export type PitchedEvent = NoteEvent | ChordEvent;
export type NonPitchedEvent = RestEvent;
