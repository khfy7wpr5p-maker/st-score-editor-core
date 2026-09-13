import { contentStavesV3, type ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import type { GraceEvent, GraceGroup } from '../../score-model-v2/src/index.js';
import type { ScoreEvent } from '../../score-model/src/index.js';
import {
  RENDER_MANIFEST_V4_VERSION,
  RENDER_REQUEST_V4_VERSION,
  resolveRenderTokenV4,
  type RendererRequestV4
} from '../../renderer-contract-v4/src/index.js';
import {
  addressEntityV3,
  resolveSemanticAddressV3,
  type SemanticAddressV3
} from '../../addressing-v3/src/index.js';
import { resolveRenderedScoreNoteRefTokenV4 } from './index.js';

export const GENERIC_RENDERED_EVENT_TARGET_VERSION = '1.0.0' as const;

export interface RenderedScoreEventRefV4 {
  readonly kind: 'NOTE' | 'REST';
  readonly partId: string;
  readonly measureIndex: number;
  readonly eventIndex: number;
  readonly voice?: number;
}

type EmittedRenderedSlot = Readonly<{
  kind: 'NOTE' | 'REST';
  voice: number;
  address: SemanticAddressV3;
}>;

const bounded = (value: unknown, field: string, max = 128): string => {
  if (typeof value !== 'string' || value.length === 0 || value.length > max || value !== value.trim() || value.includes('\u0000')) {
    throw new TypeError(`${field} must be a non-empty bounded string without surrounding whitespace or NUL.`);
  }
  return value;
};

const parseRenderedScoreEventRefV4 = (input: unknown): Readonly<RenderedScoreEventRefV4> => {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Rendered score event locator must be an object.');
  }
  const value = input as Record<string, unknown>;
  const keys = Object.keys(value).sort();
  const withoutVoice = ['eventIndex', 'kind', 'measureIndex', 'partId'];
  const withVoice = ['eventIndex', 'kind', 'measureIndex', 'partId', 'voice'];
  if (JSON.stringify(keys) !== JSON.stringify(withoutVoice) && JSON.stringify(keys) !== JSON.stringify(withVoice)) {
    throw new TypeError('Rendered score event locator field set is invalid.');
  }
  if (value.kind !== 'NOTE' && value.kind !== 'REST') {
    throw new TypeError('Rendered score event locator kind must be NOTE or REST.');
  }
  const partId = bounded(value.partId, 'partId');
  const measureIndex = value.measureIndex;
  const eventIndex = value.eventIndex;
  const voice = value.voice;
  if (!Number.isSafeInteger(measureIndex) || (measureIndex as number) < 0 || !Number.isSafeInteger(eventIndex) || (eventIndex as number) < 0) {
    throw new RangeError('Rendered score event locator indices must be non-negative safe integers.');
  }
  if (voice !== undefined && (!Number.isSafeInteger(voice) || (voice as number) < 0)) {
    throw new RangeError('Rendered score event locator voice must be a non-negative safe integer.');
  }
  return voice === undefined
    ? Object.freeze({ kind: value.kind, partId, measureIndex: measureIndex as number, eventIndex: eventIndex as number })
    : Object.freeze({ kind: value.kind, partId, measureIndex: measureIndex as number, eventIndex: eventIndex as number, voice: voice as number });
};

const assertCurrentRequest = (score: ScoreDocumentV3, request: RendererRequestV4): void => {
  if (
    request.contractVersion !== RENDER_REQUEST_V4_VERSION ||
    request.manifest.contractVersion !== RENDER_MANIFEST_V4_VERSION ||
    request.documentId !== score.id || request.revisionId !== score.revision.id ||
    request.manifest.documentId !== score.id || request.manifest.revisionId !== score.revision.id
  ) {
    throw new Error('Rendered event locator belongs to a stale or invalid V4 render request.');
  }
};

const emitNormalSlots = (score: ScoreDocumentV3, event: ScoreEvent, voice: number): readonly EmittedRenderedSlot[] => {
  if (event.kind === 'rest') {
    return [Object.freeze({ kind: 'REST', voice, address: addressEntityV3(score, event.id) })];
  }
  if (event.kind === 'note') {
    return [Object.freeze({ kind: 'NOTE', voice, address: addressEntityV3(score, event.note.id) })];
  }
  return event.notes.map((note) => Object.freeze({ kind: 'NOTE' as const, voice, address: addressEntityV3(score, note.id) }));
};

const emitGraceSlots = (score: ScoreDocumentV3, event: GraceEvent, voice: number): readonly EmittedRenderedSlot[] => {
  if (event.kind === 'rest') {
    return [Object.freeze({ kind: 'REST', voice, address: addressEntityV3(score, event.id) })];
  }
  if (event.kind === 'note') {
    return [Object.freeze({ kind: 'NOTE', voice, address: addressEntityV3(score, event.note.id) })];
  }
  return event.notes.map((note) => Object.freeze({ kind: 'NOTE' as const, voice, address: addressEntityV3(score, note.id) }));
};

const graceGroupFor = (groups: readonly GraceGroup[], anchorEventId: string, placement: 'before' | 'after'): GraceGroup | null =>
  groups.find((group) => group.anchorEventId === anchorEventId && group.placement === placement) ?? null;

const slotsForPartMeasure = (
  score: ScoreDocumentV3,
  partIndex: number,
  measureIndex: number
): readonly EmittedRenderedSlot[] | null => {
  const part = score.parts[partIndex];
  if (part === undefined || measureIndex < 0 || measureIndex >= score.measureFrames.length) return null;
  const slots: EmittedRenderedSlot[] = [];
  for (const staff of [...contentStavesV3(part)].sort((left, right) => left.ordinal - right.ordinal)) {
    const measure = staff.measures[measureIndex];
    if (measure === undefined) return null;
    for (const voice of [...measure.voices].sort((left, right) => left.ordinal - right.ordinal)) {
      for (const event of voice.events) {
        const before = graceGroupFor(voice.graceGroups, event.id, 'before');
        if (before !== null) for (const graceEvent of before.events) slots.push(...emitGraceSlots(score, graceEvent, voice.ordinal));
        slots.push(...emitNormalSlots(score, event, voice.ordinal));
        const after = graceGroupFor(voice.graceGroups, event.id, 'after');
        if (after !== null) for (const graceEvent of after.events) slots.push(...emitGraceSlots(score, graceEvent, voice.ordinal));
      }
    }
  }
  return Object.freeze(slots);
};

export const resolveRenderedScoreEventRefAddressV4 = (
  score: ScoreDocumentV3,
  request: RendererRequestV4,
  rawRef: unknown
): Readonly<SemanticAddressV3> | null => {
  assertCurrentRequest(score, request);
  const ref = parseRenderedScoreEventRefV4(rawRef);
  const partIndex = score.parts.findIndex((_part, index) => `P${index + 1}` === ref.partId);
  if (partIndex < 0) return null;
  const slots = slotsForPartMeasure(score, partIndex, ref.measureIndex);
  if (slots === null) return null;
  const selected = ref.voice === undefined
    ? slots[ref.eventIndex]
    : slots.filter((entry) => entry.voice === ref.voice)[ref.eventIndex];
  if (selected === undefined || selected.kind !== ref.kind) return null;

  if (ref.kind === 'NOTE') {
    const token = resolveRenderedScoreNoteRefTokenV4(score, request, {
      partId: ref.partId,
      measureIndex: ref.measureIndex,
      noteIndex: ref.eventIndex,
      ...(ref.voice === undefined ? {} : { voice: ref.voice })
    });
    if (token === null) return null;
    const tokenAddress = resolveRenderTokenV4(score, request, token);
    if (JSON.stringify(tokenAddress) !== JSON.stringify(selected.address)) return null;
    return tokenAddress;
  }

  if (selected.address.kind !== 'event' && selected.address.kind !== 'grace-event') return null;
  const resolved = resolveSemanticAddressV3(score, selected.address);
  if ((resolved.kind !== 'event' && resolved.kind !== 'grace-event') || resolved.value.kind !== 'rest') return null;
  return selected.address;
};
