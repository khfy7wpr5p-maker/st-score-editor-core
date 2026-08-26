import { createScoreDocument } from '../../score-model/src/index.js';
import type {
  Pitch,
  Rational,
  ScoreDocument,
  SourceIdentity
} from '../../score-model/src/index.js';

import { MusicXmlError } from './errors.js';
import { parseMusicXmlTree } from './parsedXml.js';
import type { ParsedXmlNode } from './parsedXml.js';
import {
  createMusicXmlProcessingRuntime
} from './processing.js';
import type { MusicXmlProcessingOptions } from './processing.js';
import type { MusicXmlInput } from './xmlSafety.js';

export interface MusicXmlImportOptions extends MusicXmlProcessingOptions {
  readonly source: SourceIdentity;
  readonly documentId?: string;
  readonly revisionId?: string;
}

type RawNote = { readonly pitch: Pitch };
type RawEvent =
  | { kind: 'note'; onset: Rational; duration: Rational; note: RawNote }
  | { kind: 'rest'; onset: Rational; duration: Rational }
  | { kind: 'chord'; onset: Rational; duration: Rational; notes: RawNote[] };

type RawStream = {
  readonly staff: number;
  readonly voice: number;
  readonly events: RawEvent[];
};

type RawMeasure = {
  readonly displayNumber: string | null;
  readonly streams: Map<string, RawStream>;
};

type RawPart = {
  readonly name: string | null;
  readonly measures: RawMeasure[];
  readonly maxStaff: number;
};

const elementChildren = (node: ParsedXmlNode, name?: string): readonly ParsedXmlNode[] =>
  name === undefined ? node.children : node.children.filter((child) => child.name === name);

const attribute = (node: ParsedXmlNode, name: string): string | undefined =>
  node.attributes.find((item) => item.name === name && item.uri === '')?.value;

const ensureAttributes = (node: ParsedXmlNode, allowed: readonly string[], path: string): void => {
  const allowedSet = new Set(allowed);
  for (const item of node.attributes) {
    if (item.uri !== '' || !allowedSet.has(item.name)) {
      throw new MusicXmlError('Unsupported MusicXML attribute.', 'UNSUPPORTED_MUSICXML', {
        path,
        attribute: item.name,
        uri: item.uri
      });
    }
  }
};

const ensureChildren = (node: ParsedXmlNode, allowed: readonly string[], path: string): void => {
  const allowedSet = new Set(allowed);
  for (const child of node.children) {
    if (!allowedSet.has(child.name)) {
      throw new MusicXmlError('Unsupported MusicXML element.', 'UNSUPPORTED_MUSICXML', {
        path,
        element: child.name
      });
    }
  }
};

const singleChild = (
  node: ParsedXmlNode,
  name: string,
  path: string,
  required = true
): ParsedXmlNode | null => {
  const children = elementChildren(node, name);
  if (children.length === 0 && !required) return null;
  if (children.length !== 1) {
    throw new MusicXmlError('MusicXML element cardinality is invalid.', 'INVALID_MUSICXML_SEMANTICS', {
      path,
      element: name,
      observed: children.length,
      expected: required ? 1 : '0..1'
    });
  }
  return children[0] ?? null;
};

const text = (node: ParsedXmlNode, path: string): string => {
  const value = node.text.trim();
  if (value.length === 0) {
    throw new MusicXmlError('Required MusicXML text is empty.', 'INVALID_MUSICXML_SEMANTICS', { path });
  }
  return value;
};

const positiveIntText = (node: ParsedXmlNode, path: string): number => {
  const value = text(node, path);
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw new MusicXmlError('MusicXML value must be a positive integer.', 'INVALID_MUSICXML_SEMANTICS', {
      path,
      value
    });
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new MusicXmlError('MusicXML integer exceeds safe range.', 'INVALID_MUSICXML_SEMANTICS', {
      path,
      value
    });
  }
  return parsed;
};

const integerText = (node: ParsedXmlNode, path: string): number => {
  const value = text(node, path);
  if (!/^-?[0-9]+$/.test(value)) {
    throw new MusicXmlError('MusicXML value must be an integer.', 'INVALID_MUSICXML_SEMANTICS', { path, value });
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new MusicXmlError('MusicXML integer exceeds safe range.', 'INVALID_MUSICXML_SEMANTICS', { path, value });
  }
  return parsed;
};

const absBig = (value: bigint): bigint => value < 0n ? -value : value;
const gcdBig = (left: bigint, right: bigint): bigint => {
  let a = absBig(left);
  let b = absBig(right);
  while (b !== 0n) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a;
};

const rational = (numerator: bigint, denominator: bigint, path: string): Rational => {
  if (denominator <= 0n) {
    throw new MusicXmlError('Rational denominator must be positive.', 'INVALID_MUSICXML_SEMANTICS', { path });
  }
  const divisor = gcdBig(numerator, denominator);
  const normalizedNumerator = numerator / divisor;
  const normalizedDenominator = denominator / divisor;
  if (
    normalizedNumerator > BigInt(Number.MAX_SAFE_INTEGER) ||
    normalizedNumerator < BigInt(Number.MIN_SAFE_INTEGER) ||
    normalizedDenominator > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    throw new MusicXmlError('MusicXML rational exceeds canonical safe range.', 'INVALID_MUSICXML_SEMANTICS', { path });
  }
  return {
    numerator: Number(normalizedNumerator),
    denominator: Number(normalizedDenominator)
  };
};

const add = (left: Rational, right: Rational, path: string): Rational => rational(
  BigInt(left.numerator) * BigInt(right.denominator) + BigInt(right.numerator) * BigInt(left.denominator),
  BigInt(left.denominator) * BigInt(right.denominator),
  path
);

const subtract = (left: Rational, right: Rational, path: string): Rational => rational(
  BigInt(left.numerator) * BigInt(right.denominator) - BigInt(right.numerator) * BigInt(left.denominator),
  BigInt(left.denominator) * BigInt(right.denominator),
  path
);

const equalRational = (left: Rational, right: Rational): boolean =>
  left.numerator === right.numerator && left.denominator === right.denominator;

const durationRational = (duration: number, divisions: number, path: string): Rational =>
  rational(BigInt(duration), BigInt(divisions) * 4n, path);

const parsePitch = (node: ParsedXmlNode, path: string): Pitch => {
  ensureAttributes(node, [], path);
  ensureChildren(node, ['step', 'alter', 'octave'], path);
  const stepNode = singleChild(node, 'step', path);
  const octaveNode = singleChild(node, 'octave', path);
  const alterNode = singleChild(node, 'alter', path, false);
  if (stepNode === null || octaveNode === null) {
    throw new MusicXmlError('Pitch is incomplete.', 'INVALID_MUSICXML_SEMANTICS', { path });
  }
  const step = text(stepNode, `${path}.step`);
  if (!/^[A-G]$/.test(step)) {
    throw new MusicXmlError('Pitch step must be A..G.', 'INVALID_MUSICXML_SEMANTICS', { path, step });
  }
  const alter = alterNode === null ? 0 : integerText(alterNode, `${path}.alter`);
  const octave = integerText(octaveNode, `${path}.octave`);
  if (alter < -2 || alter > 2 || octave < -1 || octave > 9) {
    throw new MusicXmlError('Pitch is outside the admitted canonical range.', 'INVALID_MUSICXML_SEMANTICS', {
      path,
      alter,
      octave
    });
  }
  return { step: step as Pitch['step'], alter, octave };
};

const streamKey = (staff: number, voice: number): string => `${staff}:${voice}`;

const getStream = (measure: RawMeasure, staff: number, voice: number): RawStream => {
  const key = streamKey(staff, voice);
  const existing = measure.streams.get(key);
  if (existing !== undefined) return existing;
  const created: RawStream = { staff, voice, events: [] };
  measure.streams.set(key, created);
  return created;
};

const parsePartList = (root: ParsedXmlNode): Map<string, string | null> => {
  const partList = singleChild(root, 'part-list', '$.score-partwise');
  if (partList === null) {
    throw new MusicXmlError('score-partwise requires part-list.', 'INVALID_MUSICXML_SEMANTICS');
  }
  ensureAttributes(partList, [], '$.part-list');
  ensureChildren(partList, ['score-part'], '$.part-list');
  const result = new Map<string, string | null>();
  for (const [index, scorePart] of elementChildren(partList, 'score-part').entries()) {
    const path = `$.part-list.score-part[${index}]`;
    ensureAttributes(scorePart, ['id'], path);
    ensureChildren(scorePart, ['part-name'], path);
    const id = attribute(scorePart, 'id');
    if (id === undefined || id.length === 0 || result.has(id)) {
      throw new MusicXmlError('score-part id must be present and unique.', 'INVALID_MUSICXML_SEMANTICS', { path, id });
    }
    const nameNode = singleChild(scorePart, 'part-name', path, false);
    result.set(id, nameNode === null ? null : text(nameNode, `${path}.part-name`));
  }
  if (result.size === 0) {
    throw new MusicXmlError('part-list must contain at least one score-part.', 'INVALID_MUSICXML_SEMANTICS');
  }
  return result;
};

const parsePart = (
  partNode: ParsedXmlNode,
  partIndex: number,
  partName: string | null,
  runtime: ReturnType<typeof createMusicXmlProcessingRuntime>,
  counters: { measures: number; events: number }
): RawPart => {
  const partPath = `$.part[${partIndex}]`;
  ensureAttributes(partNode, ['id'], partPath);
  ensureChildren(partNode, ['measure'], partPath);

  let currentDivisions: number | null = null;
  let currentStaves = 1;
  let maxStaff = 1;
  const measures: RawMeasure[] = [];

  for (const [measureIndex, measureNode] of elementChildren(partNode, 'measure').entries()) {
    runtime.checkpoint('musicxml:measure');
    counters.measures += 1;
    if (counters.measures > runtime.limits.maxMeasures) {
      throw new MusicXmlError('MusicXML measure limit exceeded.', 'MEASURE_LIMIT_EXCEEDED', {
        limit: runtime.limits.maxMeasures,
        observed: counters.measures
      });
    }

    const measurePath = `${partPath}.measure[${measureIndex}]`;
    ensureAttributes(measureNode, ['number'], measurePath);
    ensureChildren(measureNode, ['attributes', 'note', 'backup', 'forward'], measurePath);

    const rawMeasure: RawMeasure = {
      displayNumber: attribute(measureNode, 'number') ?? null,
      streams: new Map()
    };
    let cursor: Rational = { numerator: 0, denominator: 1 };
    let lastNote: { staff: number; voice: number; event: RawEvent } | null = null;

    for (const [childIndex, child] of measureNode.children.entries()) {
      runtime.checkpoint('musicxml:measure-child');
      const childPath = `${measurePath}.${child.name}[${childIndex}]`;

      if (child.name === 'attributes') {
        ensureAttributes(child, [], childPath);
        ensureChildren(child, ['divisions', 'staves'], childPath);
        const divisionsNode = singleChild(child, 'divisions', childPath, false);
        const stavesNode = singleChild(child, 'staves', childPath, false);
        if (divisionsNode !== null) currentDivisions = positiveIntText(divisionsNode, `${childPath}.divisions`);
        if (stavesNode !== null) {
          currentStaves = positiveIntText(stavesNode, `${childPath}.staves`);
          maxStaff = Math.max(maxStaff, currentStaves);
        }
        lastNote = null;
        continue;
      }

      if (child.name === 'backup' || child.name === 'forward') {
        ensureAttributes(child, [], childPath);
        ensureChildren(child, ['duration'], childPath);
        if (currentDivisions === null) {
          throw new MusicXmlError('divisions must be established before backup/forward.', 'INVALID_MUSICXML_SEMANTICS', { path: childPath });
        }
        const durationNode = singleChild(child, 'duration', childPath);
        if (durationNode === null) throw new MusicXmlError('duration is required.', 'INVALID_MUSICXML_SEMANTICS', { path: childPath });
        const delta = durationRational(positiveIntText(durationNode, `${childPath}.duration`), currentDivisions, childPath);
        cursor = child.name === 'backup' ? subtract(cursor, delta, childPath) : add(cursor, delta, childPath);
        if (cursor.numerator < 0) {
          throw new MusicXmlError('backup moves before measure start.', 'INVALID_MUSICXML_SEMANTICS', { path: childPath });
        }
        lastNote = null;
        continue;
      }

      if (child.name !== 'note') {
        throw new MusicXmlError('Unsupported measure child.', 'UNSUPPORTED_MUSICXML', { path: childPath, element: child.name });
      }

      counters.events += 1;
      if (counters.events > runtime.limits.maxEvents) {
        throw new MusicXmlError('MusicXML event limit exceeded.', 'EVENT_LIMIT_EXCEEDED', {
          limit: runtime.limits.maxEvents,
          observed: counters.events
        });
      }
      if (currentDivisions === null) {
        throw new MusicXmlError('divisions must be established before notes.', 'INVALID_MUSICXML_SEMANTICS', { path: childPath });
      }

      ensureAttributes(child, [], childPath);
      ensureChildren(child, ['chord', 'pitch', 'rest', 'duration', 'voice', 'staff', 'type'], childPath);
      const chordMarker = singleChild(child, 'chord', childPath, false);
      const pitchNode = singleChild(child, 'pitch', childPath, false);
      const restNode = singleChild(child, 'rest', childPath, false);
      const durationNode = singleChild(child, 'duration', childPath);
      const voiceNode = singleChild(child, 'voice', childPath, false);
      const staffNode = singleChild(child, 'staff', childPath, false);
      if ((pitchNode === null) === (restNode === null)) {
        throw new MusicXmlError('note must contain exactly one pitch or rest.', 'INVALID_MUSICXML_SEMANTICS', { path: childPath });
      }
      if (restNode !== null) ensureAttributes(restNode, [], `${childPath}.rest`);
      if (durationNode === null) throw new MusicXmlError('note duration is required.', 'INVALID_MUSICXML_SEMANTICS', { path: childPath });

      const voice = voiceNode === null ? 1 : positiveIntText(voiceNode, `${childPath}.voice`);
      const staff = staffNode === null ? 1 : positiveIntText(staffNode, `${childPath}.staff`);
      if (staff > currentStaves) {
        throw new MusicXmlError('note staff exceeds current staves declaration.', 'INVALID_MUSICXML_SEMANTICS', {
          path: childPath,
          staff,
          currentStaves
        });
      }
      maxStaff = Math.max(maxStaff, staff);
      const duration = durationRational(positiveIntText(durationNode, `${childPath}.duration`), currentDivisions, childPath);
      const stream = getStream(rawMeasure, staff, voice);

      if (chordMarker !== null) {
        ensureAttributes(chordMarker, [], `${childPath}.chord`);
        if (restNode !== null || pitchNode === null || lastNote === null) {
          throw new MusicXmlError('chord marker requires a preceding pitched note.', 'INVALID_MUSICXML_SEMANTICS', { path: childPath });
        }
        if (lastNote.staff !== staff || lastNote.voice !== voice || !equalRational(lastNote.event.duration, duration)) {
          throw new MusicXmlError('chord tone must match preceding note stream and duration.', 'INVALID_MUSICXML_SEMANTICS', { path: childPath });
        }
        const pitch = parsePitch(pitchNode, `${childPath}.pitch`);
        if (lastNote.event.kind === 'note') {
          const index = stream.events.lastIndexOf(lastNote.event);
          if (index < 0) throw new MusicXmlError('chord predecessor is not in active stream.', 'INVALID_MUSICXML_SEMANTICS', { path: childPath });
          const chord: RawEvent = {
            kind: 'chord',
            onset: lastNote.event.onset,
            duration,
            notes: [lastNote.event.note, { pitch }]
          };
          stream.events[index] = chord;
          lastNote = { staff, voice, event: chord };
        } else if (lastNote.event.kind === 'chord') {
          lastNote.event.notes.push({ pitch });
        } else {
          throw new MusicXmlError('rest cannot be extended as a chord.', 'INVALID_MUSICXML_SEMANTICS', { path: childPath });
        }
        continue;
      }

      const onset = cursor;
      const event: RawEvent = restNode !== null
        ? { kind: 'rest', onset, duration }
        : { kind: 'note', onset, duration, note: { pitch: parsePitch(pitchNode as ParsedXmlNode, `${childPath}.pitch`) } };
      stream.events.push(event);
      cursor = add(cursor, duration, childPath);
      lastNote = event.kind === 'rest' ? null : { staff, voice, event };
    }

    measures.push(rawMeasure);
  }

  if (measures.length === 0) {
    throw new MusicXmlError('part must contain at least one measure.', 'INVALID_MUSICXML_SEMANTICS', { path: partPath });
  }
  return { name: partName, measures, maxStaff };
};

const materializeScoreDocument = (
  rawParts: readonly RawPart[],
  source: SourceIdentity,
  documentId: string,
  revisionId: string
): Readonly<ScoreDocument> => {
  const parts = rawParts.map((part, partIndex) => {
    const p = partIndex + 1;
    return {
      id: `part-${p}`,
      name: part.name,
      staves: Array.from({ length: part.maxStaff }, (_, staffOffset) => {
        const staff = staffOffset + 1;
        return {
          id: `staff-${p}-${staff}`,
          ordinal: staff,
          measures: part.measures.map((measure, measureIndex) => {
            const m = measureIndex + 1;
            const streams = [...measure.streams.values()]
              .filter((stream) => stream.staff === staff)
              .sort((left, right) => left.voice - right.voice);
            const actualStreams = streams.length === 0 ? [{ staff, voice: 1, events: [] as RawEvent[] }] : streams;
            return {
              id: `measure-${p}-${staff}-${m}`,
              ordinal: m,
              displayNumber: measure.displayNumber,
              voices: actualStreams.map((stream) => ({
                id: `voice-${p}-${staff}-${m}-${stream.voice}`,
                ordinal: stream.voice,
                events: stream.events.map((event, eventIndex) => {
                  const e = eventIndex + 1;
                  const base = {
                    id: `event-${p}-${staff}-${m}-${stream.voice}-${e}`,
                    onset: event.onset,
                    duration: event.duration
                  };
                  if (event.kind === 'rest') return { ...base, kind: 'rest' as const };
                  if (event.kind === 'note') {
                    return {
                      ...base,
                      kind: 'note' as const,
                      note: {
                        id: `note-${p}-${staff}-${m}-${stream.voice}-${e}-1`,
                        pitch: event.note.pitch
                      }
                    };
                  }
                  return {
                    ...base,
                    kind: 'chord' as const,
                    notes: event.notes.map((note, noteIndex) => ({
                      id: `note-${p}-${staff}-${m}-${stream.voice}-${e}-${noteIndex + 1}`,
                      pitch: note.pitch
                    }))
                  };
                })
              }))
            };
          })
        };
      })
    };
  });

  return createScoreDocument({
    schemaVersion: '1.0.0',
    id: documentId,
    revision: { id: revisionId, parentId: null },
    source,
    parts
  });
};

export const importMusicXml = (
  input: MusicXmlInput,
  options: MusicXmlImportOptions
): Readonly<ScoreDocument> => {
  const runtime = createMusicXmlProcessingRuntime(options);
  const { normalizedInput, document: parsed } = parseMusicXmlTree(input, runtime);
  runtime.checkpoint('musicxml:semantic:start');

  if (options.source.format !== 'musicxml') {
    throw new MusicXmlError('MusicXML import requires source.format=musicxml.', 'SOURCE_IDENTITY_MISMATCH', {
      format: options.source.format
    });
  }
  if (options.source.byteLength === null || options.source.byteLength !== normalizedInput.byteLength) {
    throw new MusicXmlError('Source byteLength does not match imported bytes.', 'SOURCE_IDENTITY_MISMATCH', {
      expected: options.source.byteLength,
      observed: normalizedInput.byteLength
    });
  }

  const root = parsed.root;
  if (root.name !== 'score-partwise' || root.uri !== '') {
    throw new MusicXmlError('Only unnamespaced MusicXML score-partwise is supported in E2.', 'UNSUPPORTED_MUSICXML', {
      root: root.name,
      uri: root.uri
    });
  }
  ensureAttributes(root, ['version'], '$.score-partwise');
  ensureChildren(root, ['part-list', 'part'], '$.score-partwise');

  const partNames = parsePartList(root);
  const partNodes = elementChildren(root, 'part');
  if (partNodes.length !== partNames.size) {
    throw new MusicXmlError('part-list and part count must match.', 'INVALID_MUSICXML_SEMANTICS', {
      declared: partNames.size,
      observed: partNodes.length
    });
  }

  const seenPartIds = new Set<string>();
  const counters = { measures: 0, events: 0 };
  const rawParts = partNodes.map((partNode, index) => {
    const id = attribute(partNode, 'id');
    if (id === undefined || !partNames.has(id) || seenPartIds.has(id)) {
      throw new MusicXmlError('part id must map exactly once to part-list.', 'INVALID_MUSICXML_SEMANTICS', { index, id });
    }
    seenPartIds.add(id);
    return parsePart(partNode, index, partNames.get(id) ?? null, runtime, counters);
  });

  const suffix = options.source.sha256.slice(0, 16);
  const result = materializeScoreDocument(
    rawParts,
    options.source,
    options.documentId ?? `doc-${suffix}`,
    options.revisionId ?? `rev-${suffix}-0`
  );
  runtime.checkpoint('musicxml:semantic:complete');
  return result;
};
