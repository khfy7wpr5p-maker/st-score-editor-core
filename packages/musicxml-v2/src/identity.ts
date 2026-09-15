import { addressEntityV2 } from '../../addressing-v2/src/index.js';
import type { ParsedXmlNode } from '../../musicxml/src/index.js';
import {
  createScoreDocumentV2,
  type GraceEvent,
  type ScoreDocumentV2,
  type ScoreEvent
} from '../../score-model-v2/src/index.js';
import { createNotationDocumentV2, type NotationDocumentV2 } from '../../notation-structure-v2/src/index.js';
import { importNotationMusicXmlV2 as importLegacy, type NotationMusicXmlV2ImportResult } from './importer.js';
import { parseMusicXmlV2Tree } from './parser.js';
import { serializeNotationMusicXmlV2 as serializeLegacy } from './serializer.js';

export const MUSICXML_NOTE_IDENTITY_BRIDGE_VERSION = '0.2.0' as const;
const XML_ID = /^[A-Za-z_][A-Za-z0-9._-]{0,127}$/;

const children = (node: ParsedXmlNode, name?: string): readonly ParsedXmlNode[] =>
  name === undefined ? node.children : node.children.filter((item) => item.name === name);
const attr = (node: ParsedXmlNode, name: string): string | undefined =>
  node.attributes.find((item) => item.name === name && item.uri === '')?.value;
const textInt = (node: ParsedXmlNode | undefined): number => {
  if (node === undefined) return 1;
  const value = Number(node.text.trim());
  return Number.isSafeInteger(value) && value > 0 ? value : 1;
};
const validIdentity = (value: string | undefined): value is string =>
  value !== undefined && XML_ID.test(value);

type IdentityCandidate = Readonly<{ generatedId: string; explicitId: string }>;

const explicitNormalNoteIdCandidates = (root: ParsedXmlNode): readonly IdentityCandidate[] => {
  const candidates: IdentityCandidate[] = [];
  for (const [partIndex, part] of children(root, 'part').entries()) {
    const p = partIndex + 1;
    for (const [measureIndex, measure] of children(part, 'measure').entries()) {
      const m = measureIndex + 1;
      const eventCounters = new Map<string, number>();
      const noteCounters = new Map<string, number>();
      for (const note of children(measure, 'note')) {
        if (children(note, 'grace').length > 0) continue;
        const staff = textInt(children(note, 'staff')[0]);
        const voice = textInt(children(note, 'voice')[0]);
        const key = `${staff}:${voice}`;
        const chord = children(note, 'chord').length > 0;
        let eventIndex = eventCounters.get(key) ?? 0;
        if (!chord) {
          eventIndex += 1;
          eventCounters.set(key, eventIndex);
          noteCounters.set(key, 0);
        }
        if (eventIndex === 0 || children(note, 'pitch').length === 0) continue;
        const noteIndex = (noteCounters.get(key) ?? 0) + 1;
        noteCounters.set(key, noteIndex);
        const explicitId = attr(note, 'id');
        if (!validIdentity(explicitId)) continue;
        candidates.push(Object.freeze({
          generatedId: `note-${p}-${staff}-${m}-${voice}-${eventIndex}-${noteIndex}`,
          explicitId
        }));
      }
    }
  }
  return Object.freeze(candidates);
};

const allEntityIds = (score: ScoreDocumentV2): ReadonlySet<string> => {
  const ids = new Set<string>([score.id]);
  for (const part of score.parts) {
    ids.add(part.id);
    for (const staff of part.staves) {
      ids.add(staff.id);
      for (const measure of staff.measures) {
        ids.add(measure.id);
        for (const voice of measure.voices) {
          ids.add(voice.id);
          for (const event of voice.events) {
            ids.add(event.id);
            if (event.kind === 'note') ids.add(event.note.id);
            else if (event.kind === 'chord') event.notes.forEach((note) => ids.add(note.id));
          }
          for (const group of voice.graceGroups) {
            ids.add(group.id);
            for (const event of group.events) {
              ids.add(event.id);
              if (event.kind === 'note') ids.add(event.note.id);
              else if (event.kind === 'chord') event.notes.forEach((note) => ids.add(note.id));
            }
          }
        }
      }
    }
  }
  return ids;
};

const safeExplicitNormalNoteIdMap = (
  root: ParsedXmlNode,
  score: ScoreDocumentV2
): ReadonlyMap<string, string> => {
  const candidates = explicitNormalNoteIdCandidates(root);
  const explicitCounts = new Map<string, number>();
  for (const candidate of candidates) {
    explicitCounts.set(candidate.explicitId, (explicitCounts.get(candidate.explicitId) ?? 0) + 1);
  }
  const occupied = allEntityIds(score);
  const admitted = candidates.filter((candidate) =>
    explicitCounts.get(candidate.explicitId) === 1 &&
    (candidate.explicitId === candidate.generatedId || !occupied.has(candidate.explicitId))
  );
  return new Map(admitted.map((candidate) => [candidate.generatedId, candidate.explicitId] as const));
};

const rewriteEventNoteIds = (event: ScoreEvent, ids: ReadonlyMap<string, string>): ScoreEvent => {
  if (event.kind === 'rest') return event;
  if (event.kind === 'note') {
    const id = ids.get(event.note.id) ?? event.note.id;
    return id === event.note.id ? event : Object.freeze({ ...event, note: Object.freeze({ ...event.note, id }) });
  }
  let changed = false;
  const notes = event.notes.map((note) => {
    const id = ids.get(note.id) ?? note.id;
    if (id !== note.id) changed = true;
    return id === note.id ? note : Object.freeze({ ...note, id });
  });
  return changed ? Object.freeze({ ...event, notes: Object.freeze(notes) }) : event;
};

const rewriteScoreNoteIds = (score: ScoreDocumentV2, ids: ReadonlyMap<string, string>): Readonly<ScoreDocumentV2> => {
  if (ids.size === 0) return score;
  return createScoreDocumentV2({
    ...score,
    parts: score.parts.map((part) => ({
      ...part,
      staves: part.staves.map((staff) => ({
        ...staff,
        measures: staff.measures.map((measure) => ({
          ...measure,
          voices: measure.voices.map((voice) => ({
            ...voice,
            events: voice.events.map((event) => rewriteEventNoteIds(event, ids))
          }))
        }))
      }))
    }))
  });
};

const rewriteNotationNoteTargets = (
  score: Readonly<ScoreDocumentV2>,
  notation: Readonly<NotationDocumentV2>,
  ids: ReadonlyMap<string, string>
): Readonly<NotationDocumentV2> => {
  if (ids.size === 0) return notation;
  return createNotationDocumentV2(score, {
    ...notation,
    notes: notation.notes.map((entry) => {
      const noteId = ids.get(entry.target.noteId);
      if (noteId === undefined) return entry;
      const target = addressEntityV2(score, noteId);
      if (target.kind !== 'note') return entry;
      return Object.freeze({ target, notation: entry.notation });
    })
  });
};

export const importNotationMusicXmlV2PreservingNoteIds = (
  input: Parameters<typeof importLegacy>[0],
  options: Parameters<typeof importLegacy>[1]
): NotationMusicXmlV2ImportResult => {
  const parsed = parseMusicXmlV2Tree(input, options);
  const imported = importLegacy(input, options);
  const ids = safeExplicitNormalNoteIdMap(parsed.root, imported.score);
  const score = rewriteScoreNoteIds(imported.score, ids);
  const notation = rewriteNotationNoteTargets(score, imported.notation, ids);
  return Object.freeze({ score, notation });
};

const normalAtoms = (event: ScoreEvent): readonly (string | null)[] =>
  event.kind === 'rest' ? Object.freeze([null])
    : event.kind === 'note' ? Object.freeze([event.note.id])
      : Object.freeze(event.notes.map((note) => note.id));

const gracePlaceholders = (event: GraceEvent): readonly null[] =>
  event.kind === 'chord'
    ? Object.freeze(event.notes.map(() => null))
    : Object.freeze([null]);

const serializedNoteIdPlan = (score: ScoreDocumentV2): readonly (string | null)[] => {
  const out: (string | null)[] = [];
  const sorted = <T extends { readonly ordinal: number }>(items: readonly T[]) => [...items].sort((a, b) => a.ordinal - b.ordinal);
  for (const part of score.parts) {
    const staves = sorted(part.staves);
    const reference = sorted(staves[0]?.measures ?? []);
    for (let measureIndex = 0; measureIndex < reference.length; measureIndex += 1) {
      for (const staff of staves) {
        const measure = sorted(staff.measures)[measureIndex];
        if (measure === undefined) continue;
        for (const voice of sorted(measure.voices)) {
          if (voice.events.length === 0) continue;
          for (const event of voice.events) {
            const before = voice.graceGroups.find((group) => group.anchorEventId === event.id && group.placement === 'before');
            if (before !== undefined) for (const grace of before.events) out.push(...gracePlaceholders(grace));
            out.push(...normalAtoms(event));
            const after = voice.graceGroups.find((group) => group.anchorEventId === event.id && group.placement === 'after');
            if (after !== undefined) for (const grace of after.events) out.push(...gracePlaceholders(grace));
          }
        }
      }
    }
  }
  return Object.freeze(out);
};

const escapeAttribute = (value: string): string => value
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

export const serializeNotationMusicXmlV2PreservingNoteIds = (
  scoreInput: Parameters<typeof serializeLegacy>[0],
  notationInput: Parameters<typeof serializeLegacy>[1]
): string => {
  const score = createScoreDocumentV2(scoreInput);
  const xml = serializeLegacy(score, notationInput);
  const plan = serializedNoteIdPlan(score);
  let index = 0;
  const output = xml.replace(/<note>/g, () => {
    const id = plan[index++];
    return typeof id === 'string' && validIdentity(id)
      ? `<note id="${escapeAttribute(id)}">`
      : '<note>';
  });
  if (index !== plan.length) {
    throw new Error('MusicXML note identity serializer plan did not match legacy note emission count.');
  }
  return output;
};
