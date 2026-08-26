import type {
  Measure,
  NoteAtom,
  Part,
  ScoreDocument,
  ScoreEvent,
  Staff,
  Voice
} from '../../score-model/src/index.js';

export const SEMANTIC_ADDRESS_VERSION = '1.0.0' as const;

export type AddressKind = 'document' | 'part' | 'staff' | 'measure' | 'voice' | 'event' | 'note';

interface AddressBase {
  readonly contractVersion: typeof SEMANTIC_ADDRESS_VERSION;
  readonly kind: AddressKind;
  readonly documentId: string;
  readonly revisionId: string;
}

export interface DocumentAddress extends AddressBase { readonly kind: 'document' }
export interface PartAddress extends AddressBase { readonly kind: 'part'; readonly partId: string }
export interface StaffAddress extends AddressBase { readonly kind: 'staff'; readonly partId: string; readonly staffId: string }
export interface MeasureAddress extends AddressBase { readonly kind: 'measure'; readonly partId: string; readonly staffId: string; readonly measureId: string }
export interface VoiceAddress extends AddressBase { readonly kind: 'voice'; readonly partId: string; readonly staffId: string; readonly measureId: string; readonly voiceId: string }
export interface EventAddress extends AddressBase { readonly kind: 'event'; readonly partId: string; readonly staffId: string; readonly measureId: string; readonly voiceId: string; readonly eventId: string }
export interface NoteAddress extends AddressBase { readonly kind: 'note'; readonly partId: string; readonly staffId: string; readonly measureId: string; readonly voiceId: string; readonly eventId: string; readonly noteId: string }

export type SemanticAddress = DocumentAddress | PartAddress | StaffAddress | MeasureAddress | VoiceAddress | EventAddress | NoteAddress;

export type ResolvedSemanticTarget =
  | { readonly kind: 'document'; readonly value: ScoreDocument }
  | { readonly kind: 'part'; readonly value: Part }
  | { readonly kind: 'staff'; readonly value: Staff }
  | { readonly kind: 'measure'; readonly value: Measure }
  | { readonly kind: 'voice'; readonly value: Voice }
  | { readonly kind: 'event'; readonly value: ScoreEvent }
  | { readonly kind: 'note'; readonly value: NoteAtom };

export type AddressingErrorCode = 'INVALID_ADDRESS' | 'DOCUMENT_MISMATCH' | 'STALE_REVISION' | 'TARGET_NOT_FOUND' | 'ADDRESS_PATH_MISMATCH';

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

const requiredFields: Readonly<Record<AddressKind, readonly string[]>> = Object.freeze({
  document: ['contractVersion', 'kind', 'documentId', 'revisionId'],
  part: ['contractVersion', 'kind', 'documentId', 'revisionId', 'partId'],
  staff: ['contractVersion', 'kind', 'documentId', 'revisionId', 'partId', 'staffId'],
  measure: ['contractVersion', 'kind', 'documentId', 'revisionId', 'partId', 'staffId', 'measureId'],
  voice: ['contractVersion', 'kind', 'documentId', 'revisionId', 'partId', 'staffId', 'measureId', 'voiceId'],
  event: ['contractVersion', 'kind', 'documentId', 'revisionId', 'partId', 'staffId', 'measureId', 'voiceId', 'eventId'],
  note: ['contractVersion', 'kind', 'documentId', 'revisionId', 'partId', 'staffId', 'measureId', 'voiceId', 'eventId', 'noteId']
});

const kinds = new Set<AddressKind>(['document', 'part', 'staff', 'measure', 'voice', 'event', 'note']);

const ensureId = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
    throw new AddressingError('Semantic address contains an invalid identifier.', 'INVALID_ADDRESS', { field });
  }
  return value;
};

const ensureRuntimeShape = (address: SemanticAddress): void => {
  const raw = address as unknown;
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new AddressingError('Semantic address must be a plain object.', 'INVALID_ADDRESS');
  }
  const record = raw as Record<string, unknown>;
  const kind = record.kind;
  if (typeof kind !== 'string' || !kinds.has(kind as AddressKind)) {
    throw new AddressingError('Semantic address kind is unsupported.', 'INVALID_ADDRESS', { kind });
  }
  const expected = [...requiredFields[kind as AddressKind]].sort();
  const observed = Object.keys(record).sort();
  if (JSON.stringify(expected) !== JSON.stringify(observed)) {
    throw new AddressingError('Semantic address field set is invalid.', 'INVALID_ADDRESS', { expected, observed });
  }
};

const freezeAddress = <T extends SemanticAddress>(address: T): Readonly<T> => {
  Object.freeze(address);
  return address;
};

const common = (document: ScoreDocument, kind: AddressKind) => ({
  contractVersion: SEMANTIC_ADDRESS_VERSION,
  kind,
  documentId: document.id,
  revisionId: document.revision.id
});

const ensureEnvelope = (document: ScoreDocument, address: SemanticAddress): void => {
  ensureRuntimeShape(address);
  if (address.contractVersion !== SEMANTIC_ADDRESS_VERSION) {
    throw new AddressingError('Semantic address contract version is unsupported.', 'INVALID_ADDRESS', { contractVersion: address.contractVersion });
  }
  ensureId(address.documentId, 'documentId');
  ensureId(address.revisionId, 'revisionId');
  if (address.documentId !== document.id) {
    throw new AddressingError('Semantic address belongs to another document.', 'DOCUMENT_MISMATCH', { expected: document.id, observed: address.documentId });
  }
  if (address.revisionId !== document.revision.id) {
    throw new AddressingError('Semantic address belongs to a stale revision.', 'STALE_REVISION', { expected: document.revision.id, observed: address.revisionId });
  }
};

const partById = (document: ScoreDocument, id: string): Part => {
  ensureId(id, 'partId');
  const value = document.parts.find((item) => item.id === id);
  if (value === undefined) throw new AddressingError('Part target was not found.', 'TARGET_NOT_FOUND', { partId: id });
  return value;
};

const childById = <T extends { readonly id: string }>(items: readonly T[], id: string, field: string, parent: string): T => {
  ensureId(id, field);
  const value = items.find((item) => item.id === id);
  if (value === undefined) throw new AddressingError('Semantic target does not belong to the addressed parent.', 'ADDRESS_PATH_MISMATCH', { [field]: id, parent });
  return value;
};

const eventNotes = (event: ScoreEvent): readonly NoteAtom[] => event.kind === 'note' ? [event.note] : event.kind === 'chord' ? event.notes : [];

export const resolveSemanticAddress = (document: ScoreDocument, address: SemanticAddress): ResolvedSemanticTarget => {
  ensureEnvelope(document, address);
  if (address.kind === 'document') return Object.freeze({ kind: 'document', value: document });
  const part = partById(document, address.partId);
  if (address.kind === 'part') return Object.freeze({ kind: 'part', value: part });
  const staff = childById(part.staves, address.staffId, 'staffId', part.id);
  if (address.kind === 'staff') return Object.freeze({ kind: 'staff', value: staff });
  const measure = childById(staff.measures, address.measureId, 'measureId', staff.id);
  if (address.kind === 'measure') return Object.freeze({ kind: 'measure', value: measure });
  const voice = childById(measure.voices, address.voiceId, 'voiceId', measure.id);
  if (address.kind === 'voice') return Object.freeze({ kind: 'voice', value: voice });
  const event = childById(voice.events, address.eventId, 'eventId', voice.id);
  if (address.kind === 'event') return Object.freeze({ kind: 'event', value: event });
  const note = childById(eventNotes(event), address.noteId, 'noteId', event.id);
  return Object.freeze({ kind: 'note', value: note });
};

export interface SemanticAddressIndex {
  readonly document: DocumentAddress;
  readonly byEntityId: ReadonlyMap<string, SemanticAddress>;
}

export const createSemanticAddressIndex = (document: ScoreDocument): SemanticAddressIndex => {
  const documentAddress = freezeAddress<DocumentAddress>({ ...common(document, 'document'), kind: 'document' });
  const index = new Map<string, SemanticAddress>([[document.id, documentAddress]]);
  const add = (id: string, address: SemanticAddress): void => {
    if (index.has(id)) throw new AddressingError('Duplicate entity identity prevents deterministic addressing.', 'INVALID_ADDRESS', { id });
    index.set(id, freezeAddress(address));
  };

  for (const part of document.parts) {
    add(part.id, { ...common(document, 'part'), kind: 'part', partId: part.id });
    for (const staff of part.staves) {
      add(staff.id, { ...common(document, 'staff'), kind: 'staff', partId: part.id, staffId: staff.id });
      for (const measure of staff.measures) {
        add(measure.id, { ...common(document, 'measure'), kind: 'measure', partId: part.id, staffId: staff.id, measureId: measure.id });
        for (const voice of measure.voices) {
          add(voice.id, { ...common(document, 'voice'), kind: 'voice', partId: part.id, staffId: staff.id, measureId: measure.id, voiceId: voice.id });
          for (const event of voice.events) {
            add(event.id, { ...common(document, 'event'), kind: 'event', partId: part.id, staffId: staff.id, measureId: measure.id, voiceId: voice.id, eventId: event.id });
            for (const note of eventNotes(event)) {
              add(note.id, { ...common(document, 'note'), kind: 'note', partId: part.id, staffId: staff.id, measureId: measure.id, voiceId: voice.id, eventId: event.id, noteId: note.id });
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
  if (address === undefined) throw new AddressingError('Entity target was not found.', 'TARGET_NOT_FOUND', { entityId });
  return address;
};

export interface SelectionSnapshot {
  readonly contractVersion: '1.0.0';
  readonly documentId: string;
  readonly revisionId: string;
  readonly primary: SemanticAddress | null;
}

export const createSelectionSnapshot = (document: ScoreDocument, primary: SemanticAddress | null): Readonly<SelectionSnapshot> => {
  if (primary !== null) resolveSemanticAddress(document, primary);
  return Object.freeze({ contractVersion: '1.0.0', documentId: document.id, revisionId: document.revision.id, primary });
};
