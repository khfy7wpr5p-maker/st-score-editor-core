import { createScoreDocumentV2, type GraceEvent, type ScoreDocumentV2, type ScoreEvent } from '../../score-model-v2/src/index.js';
import { addressEntityV2, resolveSemanticAddressV2, type SemanticAddressV2 } from '../../addressing-v2/src/index.js';
import { resolveRenderTokenV2, type RendererRequestV2 } from '../../renderer-contract-v2/src/index.js';

export const EDITOR_SELECTION_V2_VERSION = '2.0.0' as const;

export interface SelectionSnapshotV2 {
  readonly contractVersion: typeof EDITOR_SELECTION_V2_VERSION;
  readonly documentId: string;
  readonly revisionId: string;
  readonly primary: SemanticAddressV2 | null;
}

export interface InspectorFieldV2 {
  readonly key: string;
  readonly value: string;
}

export interface InspectorModelV2 {
  readonly version: typeof EDITOR_SELECTION_V2_VERSION;
  readonly documentId: string;
  readonly revisionId: string;
  readonly targetKind: SemanticAddressV2['kind'];
  readonly targetId: string;
  readonly fields: readonly InspectorFieldV2[];
}

export interface EditorSelectionResultV2 {
  readonly selection: Readonly<SelectionSnapshotV2>;
  readonly inspector: Readonly<InspectorModelV2>;
}

const rational = (value: { readonly numerator: number; readonly denominator: number }): string =>
  `${value.numerator}/${value.denominator}`;

const normalEventFields = (event: ScoreEvent): InspectorFieldV2[] => [
  { key: 'eventKind', value: event.kind },
  { key: 'duration', value: rational(event.duration) },
  { key: 'onset', value: rational(event.onset) }
];

const graceEventFields = (event: GraceEvent): InspectorFieldV2[] => [
  { key: 'graceEventKind', value: event.kind },
  { key: 'writtenDuration', value: rational(event.writtenDuration) }
];

const targetId = (address: SemanticAddressV2): string => {
  switch (address.kind) {
    case 'document': return address.documentId;
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

export const createSelectionSnapshotV2 = (
  scoreInput: ScoreDocumentV2,
  primary: SemanticAddressV2 | null
): Readonly<SelectionSnapshotV2> => {
  const score = createScoreDocumentV2(scoreInput);
  if (primary !== null) resolveSemanticAddressV2(score, primary);
  return Object.freeze({
    contractVersion: EDITOR_SELECTION_V2_VERSION,
    documentId: score.id,
    revisionId: score.revision.id,
    primary
  });
};

export const createInspectorModelV2 = (
  scoreInput: ScoreDocumentV2,
  address: SemanticAddressV2
): Readonly<InspectorModelV2> => {
  const score = createScoreDocumentV2(scoreInput);
  const resolved = resolveSemanticAddressV2(score, address);
  const fields: InspectorFieldV2[] = [];

  if (resolved.kind === 'part') fields.push({ key: 'name', value: resolved.value.name ?? '' });
  if (resolved.kind === 'staff' || resolved.kind === 'measure' || resolved.kind === 'voice') {
    fields.push({ key: 'ordinal', value: String(resolved.value.ordinal) });
  }
  if (resolved.kind === 'measure') {
    fields.push({ key: 'displayNumber', value: resolved.value.displayNumber ?? '' });
  }
  if (resolved.kind === 'event') fields.push(...normalEventFields(resolved.value));

  if (address.kind === 'note') {
    if (resolved.kind !== 'note') throw new Error('v2 semantic resolver note kind mismatch');
    const pitch = resolved.value.pitch;
    fields.push({
      key: 'pitch',
      value: `${pitch.step}${pitch.alter === 0 ? '' : pitch.alter > 0 ? `+${pitch.alter}` : pitch.alter}${pitch.octave}`
    });
    const parent = resolveSemanticAddressV2(score, addressEntityV2(score, address.eventId));
    if (parent.kind !== 'event') throw new Error('v2 note parent event resolution mismatch');
    fields.push(...normalEventFields(parent.value));
  }

  if (resolved.kind === 'grace-group') {
    fields.push(
      { key: 'anchorEventId', value: resolved.value.anchorEventId },
      { key: 'placement', value: resolved.value.placement },
      { key: 'graceEventCount', value: String(resolved.value.events.length) }
    );
  }

  if (resolved.kind === 'grace-event') fields.push(...graceEventFields(resolved.value));

  if (address.kind === 'grace-note') {
    if (resolved.kind !== 'grace-note') throw new Error('v2 semantic resolver grace-note kind mismatch');
    const pitch = resolved.value.pitch;
    fields.push({
      key: 'pitch',
      value: `${pitch.step}${pitch.alter === 0 ? '' : pitch.alter > 0 ? `+${pitch.alter}` : pitch.alter}${pitch.octave}`
    });
    const parent = resolveSemanticAddressV2(score, addressEntityV2(score, address.graceEventId));
    if (parent.kind !== 'grace-event') throw new Error('v2 grace-note parent event resolution mismatch');
    fields.push(...graceEventFields(parent.value));
  }

  return Object.freeze({
    version: EDITOR_SELECTION_V2_VERSION,
    documentId: score.id,
    revisionId: score.revision.id,
    targetKind: address.kind,
    targetId: targetId(address),
    fields: Object.freeze(fields.map((field) => Object.freeze({ ...field })))
  });
};

export const selectRenderTokenV2 = (
  score: ScoreDocumentV2,
  request: RendererRequestV2,
  token: string
): Readonly<EditorSelectionResultV2> => {
  const address = resolveRenderTokenV2(score, request, token);
  return Object.freeze({
    selection: createSelectionSnapshotV2(score, address),
    inspector: createInspectorModelV2(score, address)
  });
};
