import {
  validateScoreDocument,
  type ChordEvent,
  type EntityId,
  type Measure,
  type NoteAtom,
  type NoteEvent,
  type Part,
  type Pitch,
  type Rational,
  type RestEvent,
  type RevisionIdentity,
  type ScoreEvent,
  type SourceIdentity,
  type Staff
} from '../../score-model/src/index.js';

export const SCORE_DOCUMENT_V2_SCHEMA_VERSION = '2.0.0' as const;
export type ScoreDocumentV2SchemaVersion = typeof SCORE_DOCUMENT_V2_SCHEMA_VERSION;

export type GracePlacement = 'before' | 'after';

export interface GracePlaybackSpec {
  readonly stealTimePreviousPercent: Rational | null;
  readonly stealTimeFollowingPercent: Rational | null;
  readonly makeTime: Rational | null;
}

export interface GraceEventBase {
  readonly id: EntityId;
  readonly writtenDuration: Rational;
  readonly playback: GracePlaybackSpec;
}
export interface GraceNoteEvent extends GraceEventBase { readonly kind: 'note'; readonly note: NoteAtom }
export interface GraceRestEvent extends GraceEventBase { readonly kind: 'rest' }
export interface GraceChordEvent extends GraceEventBase { readonly kind: 'chord'; readonly notes: readonly NoteAtom[] }
export type GraceEvent = GraceNoteEvent | GraceRestEvent | GraceChordEvent;

export interface GraceGroup {
  readonly id: EntityId;
  readonly anchorEventId: EntityId;
  readonly placement: GracePlacement;
  readonly events: readonly GraceEvent[];
}

export interface VoiceV2 {
  readonly id: EntityId;
  readonly ordinal: number;
  readonly events: readonly ScoreEvent[];
  readonly graceGroups: readonly GraceGroup[];
}
export interface MeasureV2 extends Omit<Measure, 'voices'> { readonly voices: readonly VoiceV2[] }
export interface StaffV2 extends Omit<Staff, 'measures'> { readonly measures: readonly MeasureV2[] }
export interface PartV2 extends Omit<Part, 'staves'> { readonly staves: readonly StaffV2[] }
export interface ScoreDocumentV2 {
  readonly schemaVersion: ScoreDocumentV2SchemaVersion;
  readonly id: EntityId;
  readonly revision: RevisionIdentity;
  readonly source: SourceIdentity;
  readonly parts: readonly PartV2[];
}

export type ScoreDocumentV2IssueCode =
  | 'V1_PROJECTION_INVALID'
  | 'SCHEMA_VERSION'
  | 'MISSING_GRACE_GROUPS'
  | 'INVALID_GRACE_GROUP'
  | 'INVALID_GRACE_EVENT'
  | 'INVALID_GRACE_PLAYBACK'
  | 'INVALID_GRACE_ANCHOR'
  | 'DUPLICATE_GRACE_ANCHOR_PLACEMENT'
  | 'DUPLICATE_ID';
export interface ScoreDocumentV2Issue {
  readonly code: ScoreDocumentV2IssueCode;
  readonly path: string;
  readonly message: string;
}
export interface ScoreDocumentV2ValidationResult { readonly ok: boolean; readonly issues: readonly ScoreDocumentV2Issue[] }

export class ScoreDocumentV2ValidationError extends Error {
  readonly issues: readonly ScoreDocumentV2Issue[];
  constructor(issues: readonly ScoreDocumentV2Issue[]) {
    super(`ScoreDocumentV2 validation failed with ${issues.length} issue(s)`);
    this.name = 'ScoreDocumentV2ValidationError';
    this.issues = Object.freeze([...issues]);
  }
}

const ENTITY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const PITCH_STEPS = new Set(['A','B','C','D','E','F','G']);
const isRecord = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
const exactKeys = (value: unknown, expected: readonly string[]): value is Record<string, unknown> =>
  isRecord(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
const gcd = (left: number, right: number): number => {
  let a = Math.abs(left); let b = Math.abs(right);
  while (b !== 0) { const next = a % b; a = b; b = next; }
  return a;
};
const rational = (value: unknown, allowZero: boolean): value is Rational => {
  if (!exactKeys(value, ['numerator','denominator'])) return false;
  const n = value.numerator; const d = value.denominator;
  return typeof n === 'number' && typeof d === 'number' && Number.isSafeInteger(n) && Number.isSafeInteger(d)
    && d > 0 && (allowZero ? n >= 0 : n > 0) && gcd(n, d) === 1;
};
const rationalCompareInteger = (value: Rational, integer: number): number => {
  const left = BigInt(value.numerator); const right = BigInt(integer) * BigInt(value.denominator);
  return left < right ? -1 : left > right ? 1 : 0;
};
const validPitch = (value: unknown): value is Pitch => exactKeys(value, ['step','alter','octave'])
  && typeof value.step === 'string' && PITCH_STEPS.has(value.step)
  && typeof value.alter === 'number' && Number.isInteger(value.alter) && value.alter >= -2 && value.alter <= 2
  && typeof value.octave === 'number' && Number.isInteger(value.octave) && value.octave >= -1 && value.octave <= 9;

const projectVoiceToV1 = (raw: unknown): unknown => {
  if (!isRecord(raw)) return raw;
  const { graceGroups: _graceGroups, ...rest } = raw;
  return rest;
};
const projectToV1 = (value: unknown): unknown => {
  if (!isRecord(value)) return value;
  const root: Record<string, unknown> = { ...value, schemaVersion: '1.0.0' };
  if (Array.isArray(root.parts)) root.parts = root.parts.map((part) => {
    if (!isRecord(part)) return part;
    const nextPart: Record<string, unknown> = { ...part };
    if (Array.isArray(nextPart.staves)) nextPart.staves = nextPart.staves.map((staff) => {
      if (!isRecord(staff)) return staff;
      const nextStaff: Record<string, unknown> = { ...staff };
      if (Array.isArray(nextStaff.measures)) nextStaff.measures = nextStaff.measures.map((measure) => {
        if (!isRecord(measure)) return measure;
        const nextMeasure: Record<string, unknown> = { ...measure };
        if (Array.isArray(nextMeasure.voices)) nextMeasure.voices = nextMeasure.voices.map(projectVoiceToV1);
        return nextMeasure;
      });
      return nextStaff;
    });
    return nextPart;
  });
  return root;
};

const collectNormalIds = (document: Record<string, unknown>): Set<string> => {
  const ids = new Set<string>();
  const add = (value: unknown): void => { if (typeof value === 'string') ids.add(value); };
  add(document.id);
  if (isRecord(document.revision)) add(document.revision.id);
  if (!Array.isArray(document.parts)) return ids;
  for (const part of document.parts) {
    if (!isRecord(part)) continue; add(part.id);
    if (!Array.isArray(part.staves)) continue;
    for (const staff of part.staves) {
      if (!isRecord(staff)) continue; add(staff.id);
      if (!Array.isArray(staff.measures)) continue;
      for (const measure of staff.measures) {
        if (!isRecord(measure)) continue; add(measure.id);
        if (!Array.isArray(measure.voices)) continue;
        for (const voice of measure.voices) {
          if (!isRecord(voice)) continue; add(voice.id);
          if (!Array.isArray(voice.events)) continue;
          for (const event of voice.events) {
            if (!isRecord(event)) continue; add(event.id);
            if (event.kind === 'note' && isRecord(event.note)) add(event.note.id);
            if (event.kind === 'chord' && Array.isArray(event.notes)) for (const note of event.notes) if (isRecord(note)) add(note.id);
          }
        }
      }
    }
  }
  return ids;
};

const addUniqueId = (value: unknown, path: string, ids: Set<string>, issues: ScoreDocumentV2Issue[]): boolean => {
  if (typeof value !== 'string' || !ENTITY_ID_PATTERN.test(value)) {
    issues.push({ code: 'INVALID_GRACE_EVENT', path, message: 'grace entity id must be a stable 1..128 character id' });
    return false;
  }
  if (ids.has(value)) {
    issues.push({ code: 'DUPLICATE_ID', path, message: `duplicate entity id: ${value}` });
    return false;
  }
  ids.add(value); return true;
};
const validatePlayback = (value: unknown, path: string, issues: ScoreDocumentV2Issue[]): void => {
  if (!exactKeys(value, ['stealTimePreviousPercent','stealTimeFollowingPercent','makeTime'])) {
    issues.push({ code: 'INVALID_GRACE_PLAYBACK', path, message: 'GracePlaybackSpec field set is invalid' }); return;
  }
  for (const key of ['stealTimePreviousPercent','stealTimeFollowingPercent'] as const) {
    const item = value[key];
    if (item !== null && (!rational(item, true) || rationalCompareInteger(item, 100) > 0)) {
      issues.push({ code: 'INVALID_GRACE_PLAYBACK', path: `${path}.${key}`, message: 'percentage must be a reduced rational in 0..100 or null' });
    }
  }
  if (value.makeTime !== null && !rational(value.makeTime, true)) {
    issues.push({ code: 'INVALID_GRACE_PLAYBACK', path: `${path}.makeTime`, message: 'makeTime must be a non-negative reduced score-time rational or null' });
  }
};
const validateGraceNote = (value: unknown, path: string, ids: Set<string>, issues: ScoreDocumentV2Issue[]): void => {
  if (!exactKeys(value, ['id','pitch'])) {
    issues.push({ code: 'INVALID_GRACE_EVENT', path, message: 'grace note atom field set is invalid' }); return;
  }
  addUniqueId(value.id, `${path}.id`, ids, issues);
  if (!validPitch(value.pitch)) issues.push({ code: 'INVALID_GRACE_EVENT', path: `${path}.pitch`, message: 'grace pitch is invalid' });
};
const validateGraceEvent = (value: unknown, path: string, ids: Set<string>, issues: ScoreDocumentV2Issue[]): void => {
  if (!isRecord(value) || (value.kind !== 'note' && value.kind !== 'rest' && value.kind !== 'chord')) {
    issues.push({ code: 'INVALID_GRACE_EVENT', path, message: 'grace event must be note, rest or chord' }); return;
  }
  const expected = value.kind === 'note' ? ['id','kind','writtenDuration','playback','note']
    : value.kind === 'rest' ? ['id','kind','writtenDuration','playback'] : ['id','kind','writtenDuration','playback','notes'];
  if (!exactKeys(value, expected)) issues.push({ code: 'INVALID_GRACE_EVENT', path, message: 'grace event field set is invalid' });
  addUniqueId(value.id, `${path}.id`, ids, issues);
  if (!rational(value.writtenDuration, false)) issues.push({ code: 'INVALID_GRACE_EVENT', path: `${path}.writtenDuration`, message: 'writtenDuration must be a positive reduced rational' });
  validatePlayback(value.playback, `${path}.playback`, issues);
  if (value.kind === 'note') validateGraceNote(value.note, `${path}.note`, ids, issues);
  if (value.kind === 'chord') {
    if (!Array.isArray(value.notes) || value.notes.length < 2) issues.push({ code: 'INVALID_GRACE_EVENT', path: `${path}.notes`, message: 'grace chord requires at least two note atoms' });
    else value.notes.forEach((note, index) => validateGraceNote(note, `${path}.notes[${index}]`, ids, issues));
  }
};

export const validateScoreDocumentV2 = (value: unknown): ScoreDocumentV2ValidationResult => {
  const issues: ScoreDocumentV2Issue[] = [];
  if (!isRecord(value)) return { ok: false, issues: [{ code: 'V1_PROJECTION_INVALID', path: '$', message: 'ScoreDocumentV2 must be a plain object' }] };
  if (value.schemaVersion !== SCORE_DOCUMENT_V2_SCHEMA_VERSION) issues.push({ code: 'SCHEMA_VERSION', path: '$.schemaVersion', message: `must equal ${SCORE_DOCUMENT_V2_SCHEMA_VERSION}` });
  const projection = projectToV1(value);
  const base = validateScoreDocument(projection);
  for (const issue of base.issues) issues.push({ code: 'V1_PROJECTION_INVALID', path: issue.path, message: `${issue.code}: ${issue.message}` });
  if (!base.ok) return { ok: false, issues };

  const ids = collectNormalIds(projection as Record<string, unknown>);
  const parts = value.parts as unknown[];
  parts.forEach((part, partIndex) => {
    if (!isRecord(part) || !Array.isArray(part.staves)) return;
    part.staves.forEach((staff, staffIndex) => {
      if (!isRecord(staff) || !Array.isArray(staff.measures)) return;
      staff.measures.forEach((measure, measureIndex) => {
        if (!isRecord(measure) || !Array.isArray(measure.voices)) return;
        measure.voices.forEach((voice, voiceIndex) => {
          const voicePath = `$.parts[${partIndex}].staves[${staffIndex}].measures[${measureIndex}].voices[${voiceIndex}]`;
          if (!isRecord(voice) || !Object.prototype.hasOwnProperty.call(voice, 'graceGroups') || !Array.isArray(voice.graceGroups)) {
            issues.push({ code: 'MISSING_GRACE_GROUPS', path: `${voicePath}.graceGroups`, message: 'v2 voice requires graceGroups array' }); return;
          }
          const normalEventIds = new Set<string>((voice.events as unknown[]).filter(isRecord).map((event) => event.id).filter((id): id is string => typeof id === 'string'));
          const anchorPlacements = new Set<string>();
          voice.graceGroups.forEach((group, groupIndex) => {
            const groupPath = `${voicePath}.graceGroups[${groupIndex}]`;
            if (!exactKeys(group, ['id','anchorEventId','placement','events'])) {
              issues.push({ code: 'INVALID_GRACE_GROUP', path: groupPath, message: 'GraceGroup field set is invalid' }); return;
            }
            addUniqueId(group.id, `${groupPath}.id`, ids, issues);
            if (typeof group.anchorEventId !== 'string' || !normalEventIds.has(group.anchorEventId)) {
              issues.push({ code: 'INVALID_GRACE_ANCHOR', path: `${groupPath}.anchorEventId`, message: 'anchor must resolve to a normal timed event in the same voice' });
            }
            if (group.placement !== 'before' && group.placement !== 'after') issues.push({ code: 'INVALID_GRACE_GROUP', path: `${groupPath}.placement`, message: 'placement must be before or after' });
            if (typeof group.anchorEventId === 'string' && (group.placement === 'before' || group.placement === 'after')) {
              const key = `${group.anchorEventId}:${group.placement}`;
              if (anchorPlacements.has(key)) issues.push({ code: 'DUPLICATE_GRACE_ANCHOR_PLACEMENT', path: groupPath, message: 'only one grace group is allowed per anchor and placement' });
              anchorPlacements.add(key);
            }
            if (!Array.isArray(group.events) || group.events.length === 0) issues.push({ code: 'INVALID_GRACE_GROUP', path: `${groupPath}.events`, message: 'grace group must contain at least one event' });
            else group.events.forEach((event, eventIndex) => validateGraceEvent(event, `${groupPath}.events[${eventIndex}]`, ids, issues));
          });
        });
      });
    });
  });
  return { ok: issues.length === 0, issues: Object.freeze(issues) };
};

const clone = (value: unknown): unknown => Array.isArray(value) ? value.map(clone) : isRecord(value)
  ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)])) : value;
const freeze = <T>(value: T): Readonly<T> => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const item of Object.values(value as Record<string, unknown>)) freeze(item);
    Object.freeze(value);
  }
  return value;
};
export const createScoreDocumentV2 = (value: unknown): Readonly<ScoreDocumentV2> => {
  const result = validateScoreDocumentV2(value);
  if (!result.ok) throw new ScoreDocumentV2ValidationError(result.issues);
  return freeze(clone(value) as ScoreDocumentV2);
};

export type { ChordEvent, NoteAtom, NoteEvent, Pitch, Rational, RestEvent, ScoreEvent, SourceIdentity };
