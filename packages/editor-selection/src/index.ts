import type { ScoreDocument, ScoreEvent } from '../../score-model/src/index.js';
import { addressEntity, createSelectionSnapshot, resolveSemanticAddress } from '../../addressing/src/index.js';
import type { SemanticAddress, SelectionSnapshot } from '../../addressing/src/index.js';
import { resolveRenderToken } from '../../renderer-contract/src/index.js';
import type { RendererRequest } from '../../renderer-contract/src/index.js';

export const EDITOR_SELECTION_VERSION = '1.0.0' as const;

export interface InspectorField {
  readonly key: string;
  readonly value: string;
}

export interface InspectorModel {
  readonly version: typeof EDITOR_SELECTION_VERSION;
  readonly documentId: string;
  readonly revisionId: string;
  readonly targetKind: SemanticAddress['kind'];
  readonly targetId: string;
  readonly fields: readonly InspectorField[];
}

export interface EditorSelectionResult {
  readonly selection: Readonly<SelectionSnapshot>;
  readonly inspector: Readonly<InspectorModel>;
}

const rationalText = (value: { readonly numerator: number; readonly denominator: number }): string =>
  `${value.numerator}/${value.denominator}`;

const eventFields = (event: ScoreEvent): readonly InspectorField[] => Object.freeze([
  Object.freeze({ key:'eventKind', value:event.kind }),
  Object.freeze({ key:'duration', value:rationalText(event.duration) }),
  Object.freeze({ key:'onset', value:rationalText(event.onset) })
]);

const targetId = (address: SemanticAddress): string => {
  switch (address.kind) {
    case 'document': return address.documentId;
    case 'part': return address.partId;
    case 'staff': return address.staffId;
    case 'measure': return address.measureId;
    case 'voice': return address.voiceId;
    case 'event': return address.eventId;
    case 'note': return address.noteId;
  }
};

export const createInspectorModel = (
  score: ScoreDocument,
  address: SemanticAddress
): Readonly<InspectorModel> => {
  const resolved = resolveSemanticAddress(score, address);
  const fields: InspectorField[] = [];

  if (resolved.kind === 'part') fields.push({ key:'name', value:resolved.value.name ?? '' });
  if (resolved.kind === 'staff') fields.push({ key:'ordinal', value:String(resolved.value.ordinal) });
  if (resolved.kind === 'measure') {
    fields.push({ key:'ordinal', value:String(resolved.value.ordinal) });
    fields.push({ key:'displayNumber', value:resolved.value.displayNumber ?? '' });
  }
  if (resolved.kind === 'voice') fields.push({ key:'ordinal', value:String(resolved.value.ordinal) });
  if (resolved.kind === 'event') fields.push(...eventFields(resolved.value));

  if (address.kind === 'note') {
    if (resolved.kind !== 'note') throw new Error('semantic resolver kind mismatch');
    const pitch = resolved.value.pitch;
    fields.push({ key:'pitch', value:`${pitch.step}${pitch.alter === 0 ? '' : pitch.alter > 0 ? `+${pitch.alter}` : pitch.alter}${pitch.octave}` });
    const parent = resolveSemanticAddress(score, addressEntity(score, address.eventId));
    if (parent.kind !== 'event') throw new Error('note parent event resolution mismatch');
    fields.push(...eventFields(parent.value));
  }

  return Object.freeze({
    version: EDITOR_SELECTION_VERSION,
    documentId: score.id,
    revisionId: score.revision.id,
    targetKind: address.kind,
    targetId: targetId(address),
    fields: Object.freeze(fields.map((field) => Object.freeze({ ...field })))
  });
};

export const selectRenderToken = (
  score: ScoreDocument,
  request: RendererRequest,
  token: string
): Readonly<EditorSelectionResult> => {
  const address = resolveRenderToken(score, request, token);
  return Object.freeze({
    selection: createSelectionSnapshot(score, address),
    inspector: createInspectorModel(score, address)
  });
};
