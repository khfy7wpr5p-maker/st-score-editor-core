import type { ParsedXmlNode } from '../musicxml/src/index.js';
import { parseMusicXmlV2Tree } from '../musicxml-v2/src/index.js';
import {
  createScoreEditorSdkV1,
  type ScoreEditorSdkRevisionGuardV1,
  type ScoreEditorSdkResultV1,
  type ScoreEditorSdkSemanticTargetV1,
  type ScoreEditorSdkV1
} from './src/index.js';

export const SCORE_EDITOR_SOURCE_NOTE_IDENTITY_V1_VERSION = '1.0.0' as const;
const SOURCE_NOTE_ID = /^[A-Za-z_][A-Za-z0-9._-]{0,127}$/;

export interface ScoreEditorSdkSourceNoteMappingV1 {
  readonly version: typeof SCORE_EDITOR_SOURCE_NOTE_IDENTITY_V1_VERSION;
  readonly sourceNoteId: string;
  readonly target: Readonly<ScoreEditorSdkSemanticTargetV1>;
}

export interface ScoreEditorSdkSourceIdentitySurfaceV1 {
  readonly version: typeof SCORE_EDITOR_SOURCE_NOTE_IDENTITY_V1_VERSION;
  readonly listNoteMappings: (
    expected: Readonly<ScoreEditorSdkRevisionGuardV1>
  ) => Readonly<ScoreEditorSdkResultV1<readonly Readonly<ScoreEditorSdkSourceNoteMappingV1>[]>>;
}

export type ScoreEditorSdkV1WithSourceIdentity = ScoreEditorSdkV1 & Readonly<{
  sourceIdentity: Readonly<ScoreEditorSdkSourceIdentitySurfaceV1>;
}>;

type SourcePair = Readonly<{ sourceNoteId: string; internalNoteId: string }>;
type Candidate = Readonly<{ sourceNoteId: string; generatedNoteId: string }>;

const children = (node: ParsedXmlNode, name: string): readonly ParsedXmlNode[] =>
  node.children.filter((item) => item.name === name);
const attribute = (node: ParsedXmlNode, name: string): string | null =>
  node.attributes.find((item) => item.uri === '' && item.name === name)?.value ?? null;
const positive = (node: ParsedXmlNode | undefined): number => {
  const value = Number(node?.text.trim() ?? '1');
  return Number.isSafeInteger(value) && value > 0 ? value : 1;
};

const sourceCandidates = (musicXml: string): readonly Candidate[] => {
  try {
    const root = parseMusicXmlV2Tree(musicXml).root;
    const found: Candidate[] = [];
    const counts = new Map<string, number>();
    for (const [partIndex, part] of children(root, 'part').entries()) {
      for (const [measureIndex, measure] of children(part, 'measure').entries()) {
        const eventCounters = new Map<string, number>();
        const noteCounters = new Map<string, number>();
        for (const note of children(measure, 'note')) {
          if (children(note, 'grace').length > 0) continue;
          const staff = positive(children(note, 'staff')[0]);
          const voice = positive(children(note, 'voice')[0]);
          const streamKey = `${staff}:${voice}`;
          const chord = children(note, 'chord').length > 0;
          let eventIndex = eventCounters.get(streamKey) ?? 0;
          if (!chord) {
            eventIndex += 1;
            eventCounters.set(streamKey, eventIndex);
            noteCounters.set(streamKey, 0);
          }
          if (eventIndex === 0 || children(note, 'pitch').length === 0) continue;
          const noteIndex = (noteCounters.get(streamKey) ?? 0) + 1;
          noteCounters.set(streamKey, noteIndex);
          const sourceNoteId = attribute(note, 'id');
          if (sourceNoteId === null || !SOURCE_NOTE_ID.test(sourceNoteId)) continue;
          const generatedNoteId = `note-${partIndex + 1}-${staff}-${measureIndex + 1}-${voice}-${eventIndex}-${noteIndex}`;
          found.push(Object.freeze({ sourceNoteId, generatedNoteId }));
          counts.set(sourceNoteId, (counts.get(sourceNoteId) ?? 0) + 1);
        }
      }
    }
    return Object.freeze(found.filter((item) => counts.get(item.sourceNoteId) === 1));
  } catch {
    return Object.freeze([]);
  }
};

const materializePairs = (
  sdk: Readonly<ScoreEditorSdkV1>,
  candidates: readonly Candidate[]
): readonly SourcePair[] => {
  if (candidates.length === 0) return Object.freeze([]);
  const guard = sdk.getRevisionGuard();
  if (guard === null) return Object.freeze([]);
  const targets = sdk.selection.listTargets(guard);
  if (!targets.ok) return Object.freeze([]);
  const noteIds = new Set(targets.value
    .filter((target) => target.entityKind === 'note')
    .map((target) => target.address.kind === 'note' ? target.address.noteId : null)
    .filter((value): value is string => value !== null));
  return Object.freeze(candidates
    .filter((item) => noteIds.has(item.generatedNoteId))
    .map((item) => Object.freeze({ sourceNoteId: item.sourceNoteId, internalNoteId: item.generatedNoteId })));
};

export const createScoreEditorSdkV1WithSourceIdentity = (): Readonly<ScoreEditorSdkV1WithSourceIdentity> => {
  const base = createScoreEditorSdkV1();
  let pairs: readonly SourcePair[] = Object.freeze([]);

  const document = Object.freeze({
    ...base.document,
    newDocument: (options?: Parameters<typeof base.document.newDocument>[0]) => {
      const result = base.document.newDocument(options);
      if (result.ok) pairs = Object.freeze([]);
      return result;
    },
    openMusicXml: async (
      musicXml: string,
      options?: Parameters<typeof base.document.openMusicXml>[1]
    ) => {
      const candidates = sourceCandidates(musicXml);
      const result = await base.document.openMusicXml(musicXml, options);
      if (result.ok) pairs = materializePairs(base, candidates);
      return result;
    }
  });

  const sourceIdentity: Readonly<ScoreEditorSdkSourceIdentitySurfaceV1> = Object.freeze({
    version: SCORE_EDITOR_SOURCE_NOTE_IDENTITY_V1_VERSION,
    listNoteMappings: (expected) => {
      const targets = base.selection.listTargets(expected);
      if (!targets.ok) return targets;
      const current = new Map<string, Readonly<ScoreEditorSdkSemanticTargetV1>>();
      for (const target of targets.value) {
        if (target.entityKind === 'note' && target.address.kind === 'note') {
          current.set(target.address.noteId, target);
        }
      }
      const value = Object.freeze(pairs.flatMap((pair) => {
        const target = current.get(pair.internalNoteId);
        return target === undefined ? [] : [Object.freeze({
          version: SCORE_EDITOR_SOURCE_NOTE_IDENTITY_V1_VERSION,
          sourceNoteId: pair.sourceNoteId,
          target
        })];
      }));
      return Object.freeze({ ok: true as const, value });
    }
  });

  return Object.freeze({ ...base, document, sourceIdentity });
};
