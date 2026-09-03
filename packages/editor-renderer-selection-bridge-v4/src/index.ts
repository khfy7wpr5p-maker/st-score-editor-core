import { contentStavesV3, type ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import type { GraceEvent, GraceGroup } from '../../score-model-v2/src/index.js';
import type { ScoreEvent } from '../../score-model/src/index.js';
import {
  RENDER_MANIFEST_V4_VERSION,
  RENDER_REQUEST_V4_VERSION,
  resolveRenderTokenV4,
  type RendererRequestV4
} from '../../renderer-contract-v4/src/index.js';
import type { RendererFamily } from '../../renderer-contract/src/index.js';
import type { SemanticAddressV3 } from '../../addressing-v3/src/index.js';

export const EDITOR_RENDERER_SELECTION_BRIDGE_V4_VERSION = '4.0.0' as const;
export const MAX_EXTERNAL_HIT_TOKEN_LENGTH_V4 = 256 as const;

export interface ExternalRendererHitV4 {
  readonly contractVersion: typeof EDITOR_RENDERER_SELECTION_BRIDGE_V4_VERSION;
  readonly documentId: string;
  readonly revisionId: string;
  readonly rendererFamily: RendererFamily;
  readonly renderRequestVersion: typeof RENDER_REQUEST_V4_VERSION;
  readonly renderManifestVersion: typeof RENDER_MANIFEST_V4_VERSION;
  readonly opaqueHitToken: string;
}

export interface RenderedScoreNoteRefV4 {
  readonly partId: string;
  readonly measureIndex: number;
  readonly noteIndex: number;
  readonly voice?: number;
}

export type EditorRendererSelectionBridgeV4ErrorCode =
  | 'INVALID_EXTERNAL_HIT'
  | 'STALE_EXTERNAL_HIT'
  | 'RENDERER_FAMILY_MISMATCH'
  | 'RENDER_CONTRACT_MISMATCH';

export class EditorRendererSelectionBridgeV4Error extends Error {
  readonly code: EditorRendererSelectionBridgeV4ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: EditorRendererSelectionBridgeV4ErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'EditorRendererSelectionBridgeV4Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const exactFields = Object.freeze([
  'contractVersion', 'documentId', 'revisionId', 'rendererFamily',
  'renderRequestVersion', 'renderManifestVersion', 'opaqueHitToken'
] as const);
const rendererFamilies = new Set<RendererFamily>(['osmd', 'alphatab']);
const bounded = (value: unknown, field: string, max = 128): string => {
  if (typeof value !== 'string' || value.length === 0 || value.length > max || value !== value.trim()) {
    throw new EditorRendererSelectionBridgeV4Error('External V4 renderer hit contains an invalid identifier.', 'INVALID_EXTERNAL_HIT', { field });
  }
  return value;
};

export const parseExternalRendererHitV4 = (input: unknown): Readonly<ExternalRendererHitV4> => {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new EditorRendererSelectionBridgeV4Error('External V4 renderer hit must be an object.', 'INVALID_EXTERNAL_HIT');
  }
  const record = input as Record<string, unknown>;
  if (JSON.stringify(Object.keys(record).sort()) !== JSON.stringify([...exactFields].sort())) {
    throw new EditorRendererSelectionBridgeV4Error('External V4 renderer hit field set is invalid.', 'INVALID_EXTERNAL_HIT');
  }
  if (record.contractVersion !== EDITOR_RENDERER_SELECTION_BRIDGE_V4_VERSION) {
    throw new EditorRendererSelectionBridgeV4Error('External V4 renderer hit bridge version is unsupported.', 'INVALID_EXTERNAL_HIT');
  }
  if (record.renderRequestVersion !== RENDER_REQUEST_V4_VERSION || record.renderManifestVersion !== RENDER_MANIFEST_V4_VERSION) {
    throw new EditorRendererSelectionBridgeV4Error('External V4 renderer hit references unsupported render contracts.', 'RENDER_CONTRACT_MISMATCH');
  }
  if (typeof record.rendererFamily !== 'string' || !rendererFamilies.has(record.rendererFamily as RendererFamily)) {
    throw new EditorRendererSelectionBridgeV4Error('External V4 renderer family is unsupported.', 'INVALID_EXTERNAL_HIT');
  }
  return Object.freeze({
    contractVersion: EDITOR_RENDERER_SELECTION_BRIDGE_V4_VERSION,
    documentId: bounded(record.documentId, 'documentId'),
    revisionId: bounded(record.revisionId, 'revisionId'),
    rendererFamily: record.rendererFamily as RendererFamily,
    renderRequestVersion: RENDER_REQUEST_V4_VERSION,
    renderManifestVersion: RENDER_MANIFEST_V4_VERSION,
    opaqueHitToken: bounded(record.opaqueHitToken, 'opaqueHitToken', MAX_EXTERNAL_HIT_TOKEN_LENGTH_V4)
  });
};

export const createExternalRendererHitV4 = (
  request: RendererRequestV4,
  opaqueHitToken: string
): Readonly<ExternalRendererHitV4> => parseExternalRendererHitV4({
  contractVersion: EDITOR_RENDERER_SELECTION_BRIDGE_V4_VERSION,
  documentId: request.documentId,
  revisionId: request.revisionId,
  rendererFamily: request.renderer.family,
  renderRequestVersion: request.contractVersion,
  renderManifestVersion: request.manifest.contractVersion,
  opaqueHitToken
});

const parseRenderedScoreNoteRefV4 = (input: unknown): Readonly<RenderedScoreNoteRefV4> => {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new EditorRendererSelectionBridgeV4Error('Rendered score note locator must be an object.', 'INVALID_EXTERNAL_HIT');
  }
  const value = input as Record<string, unknown>;
  const keys = Object.keys(value).sort();
  const withoutVoice = ['measureIndex','noteIndex','partId'];
  const withVoice = ['measureIndex','noteIndex','partId','voice'];
  if (JSON.stringify(keys) !== JSON.stringify(withoutVoice) && JSON.stringify(keys) !== JSON.stringify(withVoice)) {
    throw new EditorRendererSelectionBridgeV4Error('Rendered score note locator field set is invalid.', 'INVALID_EXTERNAL_HIT');
  }
  const partId = bounded(value.partId, 'partId');
  const measureIndex = value.measureIndex;
  const noteIndex = value.noteIndex;
  const voice = value.voice;
  if (!Number.isSafeInteger(measureIndex) || (measureIndex as number) < 0 || !Number.isSafeInteger(noteIndex) || (noteIndex as number) < 0) {
    throw new EditorRendererSelectionBridgeV4Error('Rendered score note locator indices must be non-negative safe integers.', 'INVALID_EXTERNAL_HIT');
  }
  if (voice !== undefined && (!Number.isSafeInteger(voice) || (voice as number) < 0)) {
    throw new EditorRendererSelectionBridgeV4Error('Rendered score note locator voice must be a non-negative safe integer.', 'INVALID_EXTERNAL_HIT');
  }
  return voice === undefined
    ? Object.freeze({ partId, measureIndex: measureIndex as number, noteIndex: noteIndex as number })
    : Object.freeze({ partId, measureIndex: measureIndex as number, noteIndex: noteIndex as number, voice: voice as number });
};

type EmittedRenderedNote = Readonly<{ voice: number; token: string | null }>;
const tokenForEntity = (request: RendererRequestV4, kind: 'note' | 'grace-note', id: string): string | null => {
  const matches = request.manifest.entries.filter((entry) =>
    kind === 'note'
      ? entry.address.kind === 'note' && entry.address.noteId === id
      : entry.address.kind === 'grace-note' && entry.address.graceNoteId === id
  );
  return matches.length === 1 ? matches[0]!.token : null;
};
const emitNormalEvent = (request: RendererRequestV4, event: ScoreEvent, voice: number): readonly EmittedRenderedNote[] => {
  if (event.kind === 'rest') return [Object.freeze({ voice, token: null })];
  if (event.kind === 'note') return [Object.freeze({ voice, token: tokenForEntity(request, 'note', event.note.id) })];
  return event.notes.map((note) => Object.freeze({ voice, token: tokenForEntity(request, 'note', note.id) }));
};
const emitGraceEvent = (request: RendererRequestV4, event: GraceEvent, voice: number): readonly EmittedRenderedNote[] => {
  if (event.kind === 'rest') return [Object.freeze({ voice, token: null })];
  if (event.kind === 'note') return [Object.freeze({ voice, token: tokenForEntity(request, 'grace-note', event.note.id) })];
  return event.notes.map((note) => Object.freeze({ voice, token: tokenForEntity(request, 'grace-note', note.id) }));
};
const graceGroupFor = (groups: readonly GraceGroup[], anchorEventId: string, placement: 'before' | 'after'): GraceGroup | null =>
  groups.find((group) => group.anchorEventId === anchorEventId && group.placement === placement) ?? null;

export const resolveRenderedScoreNoteRefTokenV4 = (
  score: ScoreDocumentV3,
  request: RendererRequestV4,
  rawRef: unknown
): string | null => {
  if (
    request.contractVersion !== RENDER_REQUEST_V4_VERSION ||
    request.manifest.contractVersion !== RENDER_MANIFEST_V4_VERSION ||
    request.documentId !== score.id || request.revisionId !== score.revision.id ||
    request.manifest.documentId !== score.id || request.manifest.revisionId !== score.revision.id
  ) {
    throw new EditorRendererSelectionBridgeV4Error('Rendered note locator belongs to a stale or invalid V4 render request.', 'STALE_EXTERNAL_HIT');
  }
  const ref = parseRenderedScoreNoteRefV4(rawRef);
  const partIndex = score.parts.findIndex((_part, index) => `P${index + 1}` === ref.partId);
  if (partIndex < 0 || ref.measureIndex >= score.measureFrames.length) return null;
  const part = score.parts[partIndex];
  if (part === undefined) return null;
  const emitted: EmittedRenderedNote[] = [];
  for (const staff of [...contentStavesV3(part)].sort((left, right) => left.ordinal - right.ordinal)) {
    const measure = staff.measures[ref.measureIndex];
    if (measure === undefined) return null;
    for (const voice of [...measure.voices].sort((left, right) => left.ordinal - right.ordinal)) {
      for (const event of voice.events) {
        const before = graceGroupFor(voice.graceGroups, event.id, 'before');
        if (before !== null) for (const graceEvent of before.events) emitted.push(...emitGraceEvent(request, graceEvent, voice.ordinal));
        emitted.push(...emitNormalEvent(request, event, voice.ordinal));
        const after = graceGroupFor(voice.graceGroups, event.id, 'after');
        if (after !== null) for (const graceEvent of after.events) emitted.push(...emitGraceEvent(request, graceEvent, voice.ordinal));
      }
    }
  }
  const selected = ref.voice === undefined
    ? emitted[ref.noteIndex]
    : emitted.filter((entry) => entry.voice === ref.voice)[ref.noteIndex];
  if (selected === undefined || selected.token === null) return null;
  resolveRenderTokenV4(score, request, selected.token);
  return selected.token;
};

export const createExternalRendererHitFromScoreNoteRefV4 = (
  score: ScoreDocumentV3,
  request: RendererRequestV4,
  rawRef: unknown
): Readonly<ExternalRendererHitV4> | null => {
  const token = resolveRenderedScoreNoteRefTokenV4(score, request, rawRef);
  return token === null ? null : createExternalRendererHitV4(request, token);
};

export const resolveExternalRendererHitV4 = (
  score: ScoreDocumentV3,
  request: RendererRequestV4,
  rawHit: unknown
): Readonly<SemanticAddressV3> => {
  const hit = parseExternalRendererHitV4(rawHit);
  if (hit.documentId !== score.id || hit.documentId !== request.documentId || hit.revisionId !== score.revision.id || hit.revisionId !== request.revisionId) {
    throw new EditorRendererSelectionBridgeV4Error('External V4 renderer hit is stale or belongs to another render request.', 'STALE_EXTERNAL_HIT', {
      hitDocumentId: hit.documentId,
      hitRevisionId: hit.revisionId,
      scoreDocumentId: score.id,
      scoreRevisionId: score.revision.id,
      requestDocumentId: request.documentId,
      requestRevisionId: request.revisionId
    });
  }
  if (hit.rendererFamily !== request.renderer.family) {
    throw new EditorRendererSelectionBridgeV4Error('External V4 renderer family does not match the current request.', 'RENDERER_FAMILY_MISMATCH');
  }
  if (request.contractVersion !== RENDER_REQUEST_V4_VERSION || request.manifest.contractVersion !== RENDER_MANIFEST_V4_VERSION) {
    throw new EditorRendererSelectionBridgeV4Error('Current V4 render request does not match bridge contracts.', 'RENDER_CONTRACT_MISMATCH');
  }
  return resolveRenderTokenV4(score, request, hit.opaqueHitToken);
};
