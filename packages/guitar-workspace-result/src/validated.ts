import { resolveSemanticAddress } from '../../addressing/src/index.js';
import type { NoteAddress } from '../../addressing/src/index.js';
import {
  createGuitarWorkspaceProjection,
  GUITAR_WORKSPACE_ENGINE_PART_ID,
  GUITAR_WORKSPACE_MUSICXML_VERSION
} from '../../guitar-workspace-projection/src/index.js';
import {
  createNotationDocument,
  notationForMeasure,
  notationForNote,
  type NotationDocument,
  type TimeSignature
} from '../../notation-structure/src/index.js';
import type { NoteAtom, Rational, ScoreDocument, ScoreEvent, Voice } from '../../score-model/src/index.js';

export const GUITAR_WORKSPACE_RESULT_VERSION = '1.0.0' as const;
export const CANONICAL_TAB_RESULT_DOCUMENT_TYPE = 'CanonicalTabResult' as const;
export const CANONICAL_TAB_RESULT_SCHEMA_VERSION = '2.0.0' as const;
export const CANONICAL_TAB_ENGINE_NAME = 'musicxml-to-guitar-tab-engine' as const;
export const CANONICAL_TAB_SOURCE_DOCUMENT_TYPE = 'PolyphonicSourceModel' as const;
export const CANONICAL_TAB_SOURCE_CONTRACT_VERSION = '1.0.0' as const;
export const CANONICAL_TAB_FINAL_SELECTION_POLICY = 'STATIC_ATTACK_PATH_LEXICOGRAPHIC_1.0' as const;
export const CANONICAL_TAB_FINAL_SELECTION_VERSION = '1.0.0' as const;
export const MAX_CANONICAL_TAB_RESULT_JSON_BYTES = 16 * 1024 * 1024;

const MAX_DIVISIONS = 16_384;
const STANDARD_TUNING = Object.freeze([
  Object.freeze({ number: 1, pitch: 'E4', midi: 64 }),
  Object.freeze({ number: 2, pitch: 'B3', midi: 59 }),
  Object.freeze({ number: 3, pitch: 'G3', midi: 55 }),
  Object.freeze({ number: 4, pitch: 'D3', midi: 50 }),
  Object.freeze({ number: 5, pitch: 'A2', midi: 45 }),
  Object.freeze({ number: 6, pitch: 'E2', midi: 40 })
]);
const REVIEW_STATES = new Set(['NOT_REVIEWED', 'APPROVED', 'REJECTED']);
const DECISION_TYPES = new Set(['PRESERVED', 'OMITTED', 'OCTAVE_DISPLACED', 'CHORD_REDUCED']);

export const guitarWorkspaceResultAuthorityProfile = Object.freeze({
  version: GUITAR_WORKSPACE_RESULT_VERSION,
  inputBoundary: 'BOUNDED_JSON_STRING',
  projectionArgumentAccepted: false,
  rederivesProjectionBeforeAcceptance: true,
  sourceFactsMustMatchCurrentCanonicalRevision: true,
  exactCanonicalTabResultContractRequired: true,
  resultStateDerivativeOnly: true,
  readOnly: true,
  engineInvocation: false,
  reverseCanonicalWriteAuthority: false,
  teacherReviewMutationAuthority: false,
  productionAuthority: false
});

export interface GuitarWorkspacePosition { readonly string: number; readonly fret: number }
export interface GuitarWorkspaceTargetPitch {
  readonly step: string; readonly alter: number; readonly octave: number; readonly midi: number; readonly written: string
}
export interface GuitarWorkspaceResultEntry {
  readonly sourceEventId: string;
  readonly target: Readonly<NoteAddress>;
  readonly decisionId: string;
  readonly disposition: 'KEEP' | 'OMIT';
  readonly targetPitch: Readonly<GuitarWorkspaceTargetPitch> | null;
  readonly octaveShiftSemitones: number | null;
  readonly ruleId: string;
  readonly selectedPosition: Readonly<GuitarWorkspacePosition> | null;
  readonly selectedShapeId: string | null;
}
export interface GuitarWorkspaceFingerAssignment { readonly sourceEventId: string; readonly target: Readonly<NoteAddress>; readonly finger: number }
export interface GuitarWorkspaceBarre {
  readonly finger: number; readonly fret: number; readonly startString: number; readonly endString: number; readonly stringSpan: number;
  readonly kind: 'FULL_BARRE' | 'PARTIAL_BARRE'
}
export interface GuitarWorkspaceSelectedShape {
  readonly selectedShapeId: string;
  readonly sourceGroupId: string;
  readonly targets: readonly Readonly<NoteAddress>[];
  readonly fingerAssignments: readonly Readonly<GuitarWorkspaceFingerAssignment>[];
  readonly barres: readonly Readonly<GuitarWorkspaceBarre>[];
  readonly physicalStatus: 'PLAYABLE_WITHIN_POLICY';
}
export interface GuitarWorkspaceResult {
  readonly contractVersion: typeof GUITAR_WORKSPACE_RESULT_VERSION;
  readonly documentId: string;
  readonly revisionId: string;
  readonly engine: Readonly<{ readonly name: typeof CANONICAL_TAB_ENGINE_NAME; readonly version: string }>;
  readonly teacherReviewStatus: 'NOT_REVIEWED' | 'APPROVED' | 'REJECTED';
  readonly entries: readonly Readonly<GuitarWorkspaceResultEntry>[];
  readonly selectedShapes: readonly Readonly<GuitarWorkspaceSelectedShape>[];
}

export type GuitarWorkspaceResultErrorCode =
  | 'INVALID_JSON' | 'RESULT_SIZE_LIMIT' | 'INVALID_RESULT_SHAPE' | 'UNSUPPORTED_RESULT_CONTRACT'
  | 'STALE_NOTATION' | 'SOURCE_FACT_MISMATCH' | 'UNKNOWN_SOURCE_EVENT' | 'INVALID_GUITAR_RESULT' | 'INVALID_SELECTION_RESULT';
export class GuitarWorkspaceResultError extends Error {
  readonly code: GuitarWorkspaceResultErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: GuitarWorkspaceResultErrorCode, details: Record<string, unknown> = {}) {
    super(message); this.name = 'GuitarWorkspaceResultError'; this.code = code; this.details = Object.freeze({ ...details }); Object.freeze(this);
  }
}

type RecordValue = Record<string, unknown>;
const fail = (message: string, code: GuitarWorkspaceResultErrorCode, details: Record<string, unknown> = {}): never => { throw new GuitarWorkspaceResultError(message, code, details); };
const exact = (value: unknown, keys: readonly string[], path: string): RecordValue => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return fail(`${path} must be an object.`, 'INVALID_RESULT_SHAPE', { path });
  const record = value as RecordValue;
  const expected = [...keys].sort(); const observed = Object.keys(record).sort();
  if (JSON.stringify(expected) !== JSON.stringify(observed)) return fail(`${path} has an invalid field set.`, 'INVALID_RESULT_SHAPE', { path, expected, observed });
  return record;
};
const array = (value: unknown, path: string): unknown[] => { if (!Array.isArray(value)) return fail(`${path} must be an array.`, 'INVALID_RESULT_SHAPE', { path }); return value; };
const string = (value: unknown, path: string): string => { if (typeof value !== 'string' || value.length === 0) return fail(`${path} must be non-empty string.`, 'INVALID_RESULT_SHAPE', { path }); return value; };
const nullableString = (value: unknown, path: string): string | null => value === null ? null : string(value, path);
const integer = (value: unknown, path: string, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER): number => {
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || (value as number) < min || (value as number) > max) return fail(`${path} must be a safe integer.`, 'INVALID_RESULT_SHAPE', { path, min, max, value });
  return value as number;
};
const boolean = (value: unknown, path: string): boolean => { if (typeof value !== 'boolean') return fail(`${path} must be boolean.`, 'INVALID_RESULT_SHAPE', { path }); return value; };
const equal = (actual: unknown, expected: unknown, path: string, code: GuitarWorkspaceResultErrorCode = 'SOURCE_FACT_MISMATCH'): void => {
  if (!Object.is(actual, expected)) fail(`${path} does not match the admitted source/result contract.`, code, { path, expected, actual });
};

const gcd = (a0: bigint, b0: bigint): bigint => { let a = a0 < 0n ? -a0 : a0; let b = b0 < 0n ? -b0 : b0; while (b !== 0n) { const n = a % b; a = b; b = n; } return a; };
const lcm = (a: bigint, b: bigint): bigint => a === 0n || b === 0n ? 0n : (a / gcd(a, b)) * b;
const timingFactor = (value: Rational): bigint => BigInt(value.denominator) / gcd(BigInt(value.denominator), 4n);
const meterFactor = (value: TimeSignature): bigint => BigInt(value.beatType) / gcd(BigInt(value.beatType), 4n);
const units = (value: Rational, divisions: number): number => {
  const numerator = BigInt(value.numerator) * 4n * BigInt(divisions); const denominator = BigInt(value.denominator);
  if (numerator % denominator !== 0n) return fail('Canonical timing is not exactly representable.', 'SOURCE_FACT_MISMATCH');
  const result = numerator / denominator; if (result < 0n || result > BigInt(Number.MAX_SAFE_INTEGER)) return fail('Canonical timing exceeds safe integer range.', 'SOURCE_FACT_MISMATCH');
  return Number(result);
};
const pitchMidi = (pitch: { readonly step: string; readonly alter: number; readonly octave: number }): number => {
  const offsets: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const offset = offsets[pitch.step]; if (offset === undefined) return fail('Pitch step invalid.', 'INVALID_SELECTION_RESULT');
  const midi = (pitch.octave + 1) * 12 + offset + pitch.alter; if (!Number.isSafeInteger(midi) || midi < 0 || midi > 127) return fail('Pitch outside MIDI range.', 'INVALID_SELECTION_RESULT'); return midi;
};
const writtenPitch = (pitch: { readonly step: string; readonly alter: number; readonly octave: number }): string => {
  const accidental = ({ '-2': 'bb', '-1': 'b', '0': '', '1': '#', '2': '##' } as Record<string, string>)[String(pitch.alter)];
  if (accidental === undefined) return fail('Pitch alter invalid.', 'INVALID_SELECTION_RESULT'); return `${pitch.step}${accidental}${pitch.octave}`;
};
const parsePitch = (value: unknown, path: string): Readonly<GuitarWorkspaceTargetPitch> => {
  const p = exact(value, ['step','alter','octave','midi','written'], path); const step = string(p.step, `${path}.step`);
  if (!/^[A-G]$/.test(step)) return fail('Pitch step invalid.', 'INVALID_SELECTION_RESULT', { path });
  const alter = integer(p.alter, `${path}.alter`, -2, 2); const octave = integer(p.octave, `${path}.octave`, -1, 9);
  const midi = integer(p.midi, `${path}.midi`, 0, 127); const written = string(p.written, `${path}.written`);
  equal(midi, pitchMidi({step,alter,octave}), `${path}.midi`, 'INVALID_SELECTION_RESULT'); equal(written, writtenPitch({step,alter,octave}), `${path}.written`, 'INVALID_SELECTION_RESULT');
  return Object.freeze({ step, alter, octave, midi, written });
};
const sorted = <T extends { readonly ordinal: number }>(values: readonly T[]): readonly T[] => [...values].sort((a,b)=>a.ordinal-b.ordinal);

interface ExpectedEvent {
  readonly sourceEventId: string; readonly measureIndex: number; readonly measureNumber: string; readonly sourceOrder: number;
  readonly type: 'note'|'rest'; readonly voice: string; readonly staff: number; readonly onsetDivisions: number; readonly durationDivisions: number;
  readonly pitch: Readonly<GuitarWorkspaceTargetPitch>|null; readonly tieStart: boolean; readonly tieStop: boolean; readonly chordWithPrevious: boolean;
  readonly target: Readonly<NoteAddress>|null;
}
interface ExpectedMeasure { readonly measureId:string; readonly index:number; readonly number:string; readonly divisions:number; readonly timeSignature:Readonly<TimeSignature>; readonly expectedDurationDivisions:number; readonly events:readonly ExpectedEvent[] }
interface ExpectedGroup { readonly groupId:string; readonly measureId:string; readonly onsetDivisions:number; readonly sourceEventIds:readonly string[] }

const activeMeter = (notation: NotationDocument, measureIds: readonly string[], active: TimeSignature|null, measureIndex:number): TimeSignature => {
  const values = measureIds.map(id=>notationForMeasure(notation,id)?.timeSignature ?? null); const present = values.filter((v):v is TimeSignature=>v!==null);
  if (present.length===0) { if (active===null) return fail('Missing active meter.', 'SOURCE_FACT_MISMATCH', {measureIndex}); return active; }
  if (present.length!==values.length || present.some(v=>v.beats!==present[0]!.beats || v.beatType!==present[0]!.beatType)) return fail('Aligned staff meter mismatch.', 'SOURCE_FACT_MISMATCH', {measureIndex});
  return present[0]!;
};
const divisionsFor = (measures: readonly {readonly voices:readonly Voice[]}[], time:TimeSignature): number => {
  let d = meterFactor(time); for (const m of measures) for (const v of m.voices) for (const e of v.events) { d=lcm(d,timingFactor(e.onset)); d=lcm(d,timingFactor(e.duration)); }
  if (d>BigInt(MAX_DIVISIONS)) return fail('Projection divisions exceed bound.', 'SOURCE_FACT_MISMATCH'); return Number(d);
};
const findEvent = (score:ScoreDocument, target:{readonly partId:string;readonly staffId:string;readonly measureId:string;readonly voiceId:string;readonly eventId:string}): ScoreEvent => {
  const part=score.parts.find(x=>x.id===target.partId); const staff=part?.staves.find(x=>x.id===target.staffId); const measure=staff?.measures.find(x=>x.id===target.measureId); const voice=measure?.voices.find(x=>x.id===target.voiceId); const event=voice?.events.find(x=>x.id===target.eventId);
  if (!event) return fail('Source-map event no longer resolves.', 'UNKNOWN_SOURCE_EVENT', {eventId:target.eventId}); return event;
};
const findNote = (score:ScoreDocument, target:NoteAddress): NoteAtom => { const resolved=resolveSemanticAddress(score,target); if(resolved.kind!=='note') return fail('Source-map note no longer resolves.','UNKNOWN_SOURCE_EVENT',{noteId:target.noteId}); return resolved.value; };

const deriveExpected = (score:ScoreDocument, notation:NotationDocument): {readonly measures:readonly ExpectedMeasure[];readonly groups:readonly ExpectedGroup[];readonly notes:readonly ExpectedEvent[]} => {
  const projection=createGuitarWorkspaceProjection(score,notation); const part=score.parts[0]!; const staves=sorted(part.staves); const measuresByStaff=staves.map(s=>sorted(s.measures));
  const output:ExpectedMeasure[]=[]; const notes:ExpectedEvent[]=[]; let meter:TimeSignature|null=null;
  for(let mi=0;mi<measuresByStaff[0]!.length;mi++){
    const staffMeasures=measuresByStaff.map(ms=>ms[mi]!); const ref=staffMeasures[0]!; if(ref.displayNumber===null) return fail('Measure number missing.','SOURCE_FACT_MISMATCH',{mi});
    meter=activeMeter(notation,staffMeasures.map(m=>m.id),meter,mi); const divisions=divisionsFor(staffMeasures,meter); const expectedDurationDivisions=divisions*meter.beats*4/meter.beatType;
    if(!Number.isSafeInteger(expectedDurationDivisions)) return fail('Expected duration non-integral.','SOURCE_FACT_MISMATCH',{mi});
    const prefix=`${GUITAR_WORKSPACE_ENGINE_PART_ID}:measure:${mi}:note:`; const mapEntries=projection.sourceMap.entries.filter(e=>e.sourceEventId.startsWith(prefix));
    const events=mapEntries.map((entry,sourceOrder):ExpectedEvent=>{
      const t=entry.target; const staffIndex=staves.findIndex(s=>s.id===t.staffId); if(staffIndex<0) return fail('Mapped staff missing.','UNKNOWN_SOURCE_EVENT',{sourceEventId:entry.sourceEventId});
      const m=staffMeasures[staffIndex]!; if(m.id!==t.measureId) return fail('Mapped measure mismatch.','UNKNOWN_SOURCE_EVENT',{sourceEventId:entry.sourceEventId});
      const voice=m.voices.find(v=>v.id===t.voiceId); if(!voice) return fail('Mapped voice missing.','UNKNOWN_SOURCE_EVENT',{sourceEventId:entry.sourceEventId}); const event=findEvent(score,t);
      let pitch:Readonly<GuitarWorkspaceTargetPitch>|null=null,tieStart=false,tieStop=false,chordWithPrevious=false,target:Readonly<NoteAddress>|null=null;
      if(t.kind==='note'){
        const note=findNote(score,t); pitch=Object.freeze({...note.pitch,midi:pitchMidi(note.pitch),written:writtenPitch(note.pitch)}); const ties=notationForNote(notation,note.id)?.ties??[]; tieStart=ties.some(x=>x.type==='start'); tieStop=ties.some(x=>x.type==='stop'); target=Object.freeze({...t});
        if(event.kind==='chord'){const ix=event.notes.findIndex(n=>n.id===note.id);if(ix<0)return fail('Mapped chord tone missing.','UNKNOWN_SOURCE_EVENT');chordWithPrevious=ix>0;} else if(event.kind!=='note') return fail('Mapped note belongs to non-note event.','UNKNOWN_SOURCE_EVENT');
      } else if(event.kind!=='rest') return fail('Mapped event target is not a rest.','UNKNOWN_SOURCE_EVENT');
      const out=Object.freeze({sourceEventId:entry.sourceEventId,measureIndex:mi,measureNumber:ref.displayNumber!,sourceOrder,type:t.kind==='note'?'note':'rest',voice:String(voice.ordinal),staff:staffIndex+1,onsetDivisions:units(event.onset,divisions),durationDivisions:units(event.duration,divisions),pitch,tieStart,tieStop,chordWithPrevious,target} as ExpectedEvent); if(out.type==='note')notes.push(out); return out;
    });
    output.push(Object.freeze({measureId:`P1:measure:${mi}`,index:mi,number:ref.displayNumber,divisions,timeSignature:Object.freeze({...meter}),expectedDurationDivisions,events:Object.freeze(events)}));
  }
  const groups:ExpectedGroup[]=[]; for(const m of output){const by=new Map<number,string[]>();for(const e of m.events)if(e.type==='note'){const ids=by.get(e.onsetDivisions)??[];ids.push(e.sourceEventId);by.set(e.onsetDivisions,ids);}for(const onset of [...by.keys()].sort((a,b)=>a-b)){const ids=by.get(onset)!;if(ids.length>=2)groups.push(Object.freeze({groupId:`${m.measureId}:simultaneous:${onset}`,measureId:m.measureId,onsetDivisions:onset,sourceEventIds:Object.freeze(ids)}));}}
  return Object.freeze({measures:Object.freeze(output),groups:Object.freeze(groups),notes:Object.freeze(notes)});
};

const validateEnvelope=(r:RecordValue):{engineVersion:string;reviewState:'NOT_REVIEWED'|'APPROVED'|'REJECTED'}=>{
  equal(r.documentType,CANONICAL_TAB_RESULT_DOCUMENT_TYPE,'canonicalTabResult.documentType','UNSUPPORTED_RESULT_CONTRACT');equal(r.schemaVersion,CANONICAL_TAB_RESULT_SCHEMA_VERSION,'canonicalTabResult.schemaVersion','UNSUPPORTED_RESULT_CONTRACT');
  const eng=exact(r.engine,['name','version'],'canonicalTabResult.engine');equal(string(eng.name,'engine.name'),CANONICAL_TAB_ENGINE_NAME,'engine.name','UNSUPPORTED_RESULT_CONTRACT');const engineVersion=string(eng.version,'engine.version');
  const src=exact(r.source,['documentType','contractVersion','format','musicXmlVersion','partId'],'canonicalTabResult.source');equal(src.documentType,CANONICAL_TAB_SOURCE_DOCUMENT_TYPE,'source.documentType','UNSUPPORTED_RESULT_CONTRACT');equal(src.contractVersion,CANONICAL_TAB_SOURCE_CONTRACT_VERSION,'source.contractVersion','UNSUPPORTED_RESULT_CONTRACT');equal(src.format,'score-partwise','source.format','UNSUPPORTED_RESULT_CONTRACT');equal(nullableString(src.musicXmlVersion,'source.musicXmlVersion'),GUITAR_WORKSPACE_MUSICXML_VERSION,'source.musicXmlVersion','UNSUPPORTED_RESULT_CONTRACT');equal(string(src.partId,'source.partId'),'P1','source.partId');
  const rev=exact(r.review,['teacherReviewStatus'],'review');const rs=string(rev.teacherReviewStatus,'review.teacherReviewStatus');if(!REVIEW_STATES.has(rs))return fail('Unsupported teacher review state.','INVALID_RESULT_SHAPE');
  const g=exact(r.guitar,['contractVersion','tuning','minimumFret','maximumFret'],'guitar');equal(g.contractVersion,'1.0.0','guitar.contractVersion','INVALID_GUITAR_RESULT');equal(integer(g.minimumFret,'guitar.minimumFret',0),0,'guitar.minimumFret','INVALID_GUITAR_RESULT');equal(integer(g.maximumFret,'guitar.maximumFret',0),20,'guitar.maximumFret','INVALID_GUITAR_RESULT');const tuning=array(g.tuning,'guitar.tuning');equal(tuning.length,6,'guitar.tuning.length','INVALID_GUITAR_RESULT');tuning.forEach((raw,i)=>{const x=exact(raw,['number','pitch','midi'],`guitar.tuning[${i}]`);const ex=STANDARD_TUNING[i]!;equal(integer(x.number,'number',1,6),ex.number,'number','INVALID_GUITAR_RESULT');equal(string(x.pitch,'pitch'),ex.pitch,'pitch','INVALID_GUITAR_RESULT');equal(integer(x.midi,'midi',0,127),ex.midi,'midi','INVALID_GUITAR_RESULT');});
  return {engineVersion,reviewState:rs as 'NOT_REVIEWED'|'APPROVED'|'REJECTED'};
};
const validatePolicy=(v:unknown):void=>{
  const p=exact(v,['arrangement','reduction','voicing','leftHand','physicalValidation','finalSelection'],'policyProvenance');
  const a=exact(p.arrangement,['documentType','contractVersion'],'arrangement');equal(a.documentType,'GuitarArrangementPlan','arrangement.documentType','UNSUPPORTED_RESULT_CONTRACT');equal(a.contractVersion,'1.0.0','arrangement.contractVersion','UNSUPPORTED_RESULT_CONTRACT');
  const r=exact(p.reduction,['documentType','contractVersion','policy','octaveTieBreak'],'reduction');equal(r.documentType,'DeterministicReductionPlan','reduction.documentType','UNSUPPORTED_RESULT_CONTRACT');equal(r.contractVersion,'1.0.0','reduction.contractVersion','UNSUPPORTED_RESULT_CONTRACT');equal(r.policy,'STANDARD_GUITAR_REGISTER_20_FRET_1.0','reduction.policy','UNSUPPORTED_RESULT_CONTRACT');equal(r.octaveTieBreak,'DOWNWARD_TIE_BREAK_1.0','reduction.octaveTieBreak','UNSUPPORTED_RESULT_CONTRACT');
  const vo=exact(p.voicing,['documentType','contractVersion','policy'],'voicing');equal(vo.documentType,'GuitarVoicingCandidateModel','voicing.documentType','UNSUPPORTED_RESULT_CONTRACT');equal(vo.contractVersion,'1.0.0','voicing.contractVersion','UNSUPPORTED_RESULT_CONTRACT');equal(vo.policy,'STANDARD_SIX_STRING_DISTINCT_STRING_1.0','voicing.policy','UNSUPPORTED_RESULT_CONTRACT');
  const lh=exact(p.leftHand,['documentType','contractVersion','policy'],'leftHand');equal(lh.documentType,'LeftHandShapeModel','leftHand.documentType','UNSUPPORTED_RESULT_CONTRACT');equal(lh.contractVersion,'1.0.0','leftHand.contractVersion','UNSUPPORTED_RESULT_CONTRACT');equal(lh.policy,'ORDERED_FRET_FINGER_BARRE_1.0','leftHand.policy','UNSUPPORTED_RESULT_CONTRACT');
  const ph=exact(p.physicalValidation,['documentType','contractVersion','policy','configuration'],'physicalValidation');equal(ph.documentType,'PhysicalPlayabilityValidation','physical.documentType','UNSUPPORTED_RESULT_CONTRACT');equal(ph.contractVersion,'2.0.0','physical.contractVersion','UNSUPPORTED_RESULT_CONTRACT');equal(ph.policy,'CONSERVATIVE_STATIC_LEFT_HAND_2.0','physical.policy','UNSUPPORTED_RESULT_CONTRACT');const c=exact(ph.configuration,['maximumStaticFretSpan','maximumExtraFretReach'],'physical.configuration');equal(integer(c.maximumStaticFretSpan,'span',0),4,'span','UNSUPPORTED_RESULT_CONTRACT');equal(integer(c.maximumExtraFretReach,'reach',0),1,'reach','UNSUPPORTED_RESULT_CONTRACT');
  const fs=exact(p.finalSelection,['policyId','policyVersion'],'finalSelection');equal(fs.policyId,CANONICAL_TAB_FINAL_SELECTION_POLICY,'finalSelection.policyId','UNSUPPORTED_RESULT_CONTRACT');equal(fs.policyVersion,CANONICAL_TAB_FINAL_SELECTION_VERSION,'finalSelection.policyVersion','UNSUPPORTED_RESULT_CONTRACT');
};

const validateSource=(r:RecordValue,e:ReturnType<typeof deriveExpected>):void=>{
  const ms=array(r.measures,'measures');equal(ms.length,e.measures.length,'measures.length');e.measures.forEach((em,mi)=>{const p=`measures[${mi}]`;const m=exact(ms[mi],['measureId','index','number','implicit','divisions','timeSignature','expectedDurationDivisions','events'],p);equal(string(m.measureId,`${p}.measureId`),em.measureId,`${p}.measureId`);equal(integer(m.index,`${p}.index`,0),em.index,`${p}.index`);equal(string(m.number,`${p}.number`),em.number,`${p}.number`);equal(boolean(m.implicit,`${p}.implicit`),false,`${p}.implicit`);equal(integer(m.divisions,`${p}.divisions`,1,MAX_DIVISIONS),em.divisions,`${p}.divisions`);const t=exact(m.timeSignature,['beats','beatType'],`${p}.timeSignature`);equal(integer(t.beats,'beats',1),em.timeSignature.beats,'beats');equal(integer(t.beatType,'beatType',1),em.timeSignature.beatType,'beatType');equal(integer(m.expectedDurationDivisions,'expectedDuration',1),em.expectedDurationDivisions,'expectedDuration');const evs=array(m.events,`${p}.events`);equal(evs.length,em.events.length,`${p}.events.length`);em.events.forEach((ee,ei)=>{const ep=`${p}.events[${ei}]`;const keys=ee.type==='note'?['sourceEventId','sourceOrder','type','voice','staff','onsetDivisions','durationDivisions','pitch','tieStart','tieStop','source']:['sourceEventId','sourceOrder','type','voice','staff','onsetDivisions','durationDivisions','tieStart','tieStop','source'];const x=exact(evs[ei],keys,ep);equal(string(x.sourceEventId,'sourceEventId'),ee.sourceEventId,'sourceEventId');equal(integer(x.sourceOrder,'sourceOrder',0),ee.sourceOrder,'sourceOrder');equal(x.type,ee.type,'type');equal(string(x.voice,'voice'),ee.voice,'voice');equal(integer(x.staff,'staff',1,2),ee.staff,'staff');equal(integer(x.onsetDivisions,'onset',0),ee.onsetDivisions,'onset');equal(integer(x.durationDivisions,'duration',1),ee.durationDivisions,'duration');equal(boolean(x.tieStart,'tieStart'),ee.tieStart,'tieStart');equal(boolean(x.tieStop,'tieStop'),ee.tieStop,'tieStop');const s=exact(x.source,['partId','measureIndex','measureNumber','noteIndex','chordWithPrevious'],'source');equal(string(s.partId,'partId'),'P1','partId');equal(integer(s.measureIndex,'measureIndex',0),mi,'measureIndex');equal(string(s.measureNumber,'measureNumber'),ee.measureNumber,'measureNumber');equal(integer(s.noteIndex,'noteIndex',0),ei,'noteIndex');equal(boolean(s.chordWithPrevious,'chordWithPrevious'),ee.chordWithPrevious,'chordWithPrevious');if(ee.type==='note'){const pp=parsePitch(x.pitch,'pitch');equal(pp.step,ee.pitch!.step,'pitch.step');equal(pp.alter,ee.pitch!.alter,'pitch.alter');equal(pp.octave,ee.pitch!.octave,'pitch.octave');}});});
};

const validateGroups=(r:RecordValue,expected:readonly ExpectedGroup[]):Map<string,ExpectedGroup>=>{const a=array(r.simultaneousGroups,'simultaneousGroups');equal(a.length,expected.length,'simultaneousGroups.length','INVALID_SELECTION_RESULT');const map=new Map<string,ExpectedGroup>();expected.forEach((eg,i)=>{const p=`simultaneousGroups[${i}]`;const g=exact(a[i],['groupId','measureId','onsetDivisions','sourceEventIds'],p);equal(string(g.groupId,'groupId'),eg.groupId,'groupId','INVALID_SELECTION_RESULT');equal(string(g.measureId,'measureId'),eg.measureId,'measureId','INVALID_SELECTION_RESULT');equal(integer(g.onsetDivisions,'onset',0),eg.onsetDivisions,'onset','INVALID_SELECTION_RESULT');const ids=array(g.sourceEventIds,'sourceEventIds').map((x,j)=>string(x,`id${j}`));if(JSON.stringify(ids)!==JSON.stringify(eg.sourceEventIds))return fail('Group membership/order mismatch.','INVALID_SELECTION_RESULT',{groupId:eg.groupId});map.set(eg.groupId,eg);});return map;};
interface Decision {readonly decisionId:string;readonly decisionType:'PRESERVED'|'OMITTED'|'OCTAVE_DISPLACED'|'CHORD_REDUCED';readonly sourceEventIds:readonly string[];readonly sourceGroupId:string|null}
const validateDecisions=(r:RecordValue,notes:readonly ExpectedEvent[],groups:Map<string,ExpectedGroup>):Map<string,Decision>=>{const a=array(r.arrangementDecisions,'arrangementDecisions');const order=new Map(notes.map((n,i)=>[n.sourceEventId,i]));const covered=new Set<string>();const map=new Map<string,Decision>();let prev=-1;a.forEach((raw,i)=>{const p=`arrangementDecisions[${i}]`;const d=exact(raw,['decisionId','decisionType','sourceEventIds','sourceGroupId'],p);const id=string(d.decisionId,'decisionId');equal(id,`P1:arrangement-decision:${i}`,'decisionId','INVALID_SELECTION_RESULT');const type=string(d.decisionType,'decisionType');if(!DECISION_TYPES.has(type))return fail('Unsupported decision type.','INVALID_SELECTION_RESULT');const ids=array(d.sourceEventIds,'ids').map((x,j)=>string(x,`id${j}`));if(ids.length===0)return fail('Empty decision.','INVALID_SELECTION_RESULT');let first=-1;ids.forEach((sid,j)=>{const oi=order.get(sid);if(oi===undefined)return fail('Unknown decision source.','UNKNOWN_SOURCE_EVENT',{sid});if(covered.has(sid))return fail('Duplicate decision coverage.','INVALID_SELECTION_RESULT',{sid});if(j>0&&oi<=order.get(ids[j-1]!)!)return fail('Decision member order mismatch.','INVALID_SELECTION_RESULT');if(j===0)first=oi;covered.add(sid);});if(first<=prev)return fail('Decision order mismatch.','INVALID_SELECTION_RESULT');prev=first;let gid:string|null=null;if(type==='CHORD_REDUCED'){gid=string(d.sourceGroupId,'sourceGroupId');const g=groups.get(gid);if(!g||JSON.stringify(ids)!==JSON.stringify(g.sourceEventIds))return fail('Reduced group mismatch.','INVALID_SELECTION_RESULT');}else{equal(d.sourceGroupId,null,'sourceGroupId','INVALID_SELECTION_RESULT');equal(ids.length,1,'ids.length','INVALID_SELECTION_RESULT');}map.set(id,Object.freeze({decisionId:id,decisionType:type as Decision['decisionType'],sourceEventIds:Object.freeze(ids),sourceGroupId:gid}));});equal(covered.size,notes.length,'decision.coverage','INVALID_SELECTION_RESULT');return map;};

const validateDispositions=(r:RecordValue,notes:readonly ExpectedEvent[],decisions:Map<string,Decision>,groups:Map<string,ExpectedGroup>):{entries:readonly Readonly<GuitarWorkspaceResultEntry>[];byId:Map<string,GuitarWorkspaceResultEntry>}=>{const a=array(r.noteDispositions,'noteDispositions');equal(a.length,notes.length,'noteDispositions.length','INVALID_SELECTION_RESULT');const out:Readonly<GuitarWorkspaceResultEntry>[]=[];const byId=new Map<string,GuitarWorkspaceResultEntry>();a.forEach((raw,i)=>{const p=`noteDispositions[${i}]`;const d=exact(raw,['sourceEventId','decisionId','disposition','targetPitch','octaveShiftSemitones','ruleId','selectedPosition','selectedShapeId'],p);const en=notes[i]!;const sid=string(d.sourceEventId,'sourceEventId');equal(sid,en.sourceEventId,'sourceEventId','UNKNOWN_SOURCE_EVENT');const did=string(d.decisionId,'decisionId');const dec=decisions.get(did);if(!dec||!dec.sourceEventIds.includes(sid))return fail('Disposition decision link invalid.','INVALID_SELECTION_RESULT',{sid,did});const disp=string(d.disposition,'disposition');if(disp!=='KEEP'&&disp!=='OMIT')return fail('Disposition invalid.','INVALID_SELECTION_RESULT');const rule=string(d.ruleId,'ruleId');const shapeId=nullableString(d.selectedShapeId,'selectedShapeId');let tp:Readonly<GuitarWorkspaceTargetPitch>|null=null,shift:number|null=null,pos:Readonly<GuitarWorkspacePosition>|null=null;if(disp==='OMIT'){equal(d.targetPitch,null,'targetPitch','INVALID_SELECTION_RESULT');equal(d.octaveShiftSemitones,null,'shift','INVALID_SELECTION_RESULT');equal(d.selectedPosition,null,'position','INVALID_SELECTION_RESULT');equal(d.selectedShapeId,null,'shape','INVALID_SELECTION_RESULT');if(dec.decisionType==='OMITTED')equal(rule,'OMIT_EXPLICIT','rule','INVALID_SELECTION_RESULT');else if(dec.decisionType==='CHORD_REDUCED')equal(rule,'CHORD_REDUCTION_OMIT_INNER','rule','INVALID_SELECTION_RESULT');else return fail('OMIT conflicts with decision.','INVALID_SELECTION_RESULT');}else{shift=integer(d.octaveShiftSemitones,'shift');if(shift%12!==0)return fail('Shift not octave multiple.','INVALID_SELECTION_RESULT');tp=parsePitch(d.targetPitch,'targetPitch');equal(tp.step,en.pitch!.step,'targetPitch.step','INVALID_SELECTION_RESULT');equal(tp.alter,en.pitch!.alter,'targetPitch.alter','INVALID_SELECTION_RESULT');equal(tp.midi,en.pitch!.midi+shift,'targetPitch.midi','INVALID_SELECTION_RESULT');equal(tp.octave,en.pitch!.octave+shift/12,'targetPitch.octave','INVALID_SELECTION_RESULT');const px=exact(d.selectedPosition,['string','fret'],'selectedPosition');const sn=integer(px.string,'string',1,6),fret=integer(px.fret,'fret',0,20);const open=STANDARD_TUNING.find(x=>x.number===sn)!.midi;equal(open+fret,tp.midi,'selectedPosition','INVALID_SELECTION_RESULT');pos=Object.freeze({string:sn,fret});if(dec.decisionType==='PRESERVED'){equal(shift,0,'shift','INVALID_SELECTION_RESULT');equal(rule,'PRESERVE_IN_REGISTER','rule','INVALID_SELECTION_RESULT');}else if(dec.decisionType==='OCTAVE_DISPLACED'){if(shift===0)return fail('Octave displacement needs nonzero shift.','INVALID_SELECTION_RESULT');equal(rule,'OCTAVE_NEAREST_IN_REGISTER','rule','INVALID_SELECTION_RESULT');}else if(dec.decisionType==='CHORD_REDUCED'){equal(shift,0,'shift','INVALID_SELECTION_RESULT');equal(rule,'CHORD_REDUCTION_KEEP_OUTER','rule','INVALID_SELECTION_RESULT');}else return fail('KEEP conflicts with omitted decision.','INVALID_SELECTION_RESULT');}const x=Object.freeze({sourceEventId:sid,target:Object.freeze({...en.target!}),decisionId:did,disposition:disp as 'KEEP'|'OMIT',targetPitch:tp,octaveShiftSemitones:shift,ruleId:rule,selectedPosition:pos,selectedShapeId:shapeId});out.push(x);byId.set(sid,x);});for(const g of groups.values()){const retained=g.sourceEventIds.map(id=>byId.get(id)!).filter(x=>x.disposition==='KEEP');const strings=new Set<number>();for(const x of retained){if(strings.has(x.selectedPosition!.string))return fail('Simultaneous retained notes use same string.','INVALID_SELECTION_RESULT',{groupId:g.groupId});strings.add(x.selectedPosition!.string);}if(retained.length<2)retained.forEach(x=>equal(x.selectedShapeId,null,'selectedShapeId','INVALID_SELECTION_RESULT'));}return{entries:Object.freeze(out),byId};};

const validateShapes=(r:RecordValue,expectedGroups:readonly ExpectedGroup[],disp:Map<string,GuitarWorkspaceResultEntry>):readonly Readonly<GuitarWorkspaceSelectedShape>[]=>{const needed=expectedGroups.map(g=>({g,ids:g.sourceEventIds.filter(id=>disp.get(id)!.disposition==='KEEP')})).filter(x=>x.ids.length>=2);const a=array(r.selectedShapes,'selectedShapes');equal(a.length,needed.length,'selectedShapes.length','INVALID_SELECTION_RESULT');const out:Readonly<GuitarWorkspaceSelectedShape>[]=[];needed.forEach(({g,ids},i)=>{const p=`selectedShapes[${i}]`;const s=exact(a[i],['selectedShapeId','sourceGroupId','sourceEventIds','voicingCandidateId','shapeCandidateId','fingerAssignments','barres','physicalValidation'],p);const shapeId=string(s.selectedShapeId,'selectedShapeId');equal(string(s.sourceGroupId,'sourceGroupId'),g.groupId,'sourceGroupId','INVALID_SELECTION_RESULT');equal(shapeId,`${g.groupId}:selected-shape`,'selectedShapeId','INVALID_SELECTION_RESULT');string(s.voicingCandidateId,'voicingCandidateId');string(s.shapeCandidateId,'shapeCandidateId');const actualIds=array(s.sourceEventIds,'sourceEventIds').map((x,j)=>string(x,`id${j}`));if(JSON.stringify(actualIds)!==JSON.stringify(ids))return fail('Selected shape membership mismatch.','INVALID_SELECTION_RESULT');const targets=ids.map(id=>{const d=disp.get(id)!;equal(d.selectedShapeId,shapeId,'disposition.selectedShapeId','INVALID_SELECTION_RESULT');return d.target;});const rawAssignments=array(s.fingerAssignments,'fingerAssignments');equal(rawAssignments.length,ids.length,'fingerAssignments.length','INVALID_SELECTION_RESULT');const fingerBy=new Map<string,number>();const assignments=rawAssignments.map((raw,j)=>{const x=exact(raw,['sourceEventId','finger'],`fingerAssignments[${j}]`);const sid=string(x.sourceEventId,'sourceEventId');equal(sid,ids[j],'sourceEventId','INVALID_SELECTION_RESULT');const finger=integer(x.finger,'finger',0,4);const position=disp.get(sid)!.selectedPosition!;if(position.fret===0)equal(finger,0,'finger','INVALID_SELECTION_RESULT');else if(finger===0)return fail('Fretted note requires finger.','INVALID_SELECTION_RESULT');fingerBy.set(sid,finger);return Object.freeze({sourceEventId:sid,target:disp.get(sid)!.target,finger});});const barres=array(s.barres,'barres').map((raw,j)=>{const b=exact(raw,['finger','fret','startString','endString','stringSpan','kind'],`barres[${j}]`);const finger=integer(b.finger,'finger',1,4),fret=integer(b.fret,'fret',1,20),startString=integer(b.startString,'startString',1,6),endString=integer(b.endString,'endString',1,6);if(startString>endString)return fail('Barre order invalid.','INVALID_SELECTION_RESULT');const span=integer(b.stringSpan,'stringSpan',1,6);equal(span,endString-startString+1,'stringSpan','INVALID_SELECTION_RESULT');const kind=string(b.kind,'kind');equal(kind,startString===1&&endString===6?'FULL_BARRE':'PARTIAL_BARRE','kind','INVALID_SELECTION_RESULT');let matching=0;for(const id of ids){const position=disp.get(id)!.selectedPosition!;if(position.string<startString||position.string>endString)continue;if(position.fret<fret)return fail('Barre blocked by lower fret.','INVALID_SELECTION_RESULT');if(position.fret===fret){if(fingerBy.get(id)!==finger)return fail('Barre finger mismatch.','INVALID_SELECTION_RESULT');matching++;}}if(matching<2)return fail('Barre requires multiple assignments.','INVALID_SELECTION_RESULT');return Object.freeze({finger,fret,startString,endString,stringSpan:span,kind:kind as 'FULL_BARRE'|'PARTIAL_BARRE'});});const ph=exact(s.physicalValidation,['status'],'physicalValidation');equal(ph.status,'PLAYABLE_WITHIN_POLICY','physicalValidation.status','INVALID_SELECTION_RESULT');out.push(Object.freeze({selectedShapeId:shapeId,sourceGroupId:g.groupId,targets:Object.freeze(targets.map(t=>Object.freeze({...t}))),fingerAssignments:Object.freeze(assignments),barres:Object.freeze(barres),physicalStatus:'PLAYABLE_WITHIN_POLICY' as const}));});return Object.freeze(out);};

export const createGuitarWorkspaceResult=(score:ScoreDocument,notationInput:NotationDocument,canonicalTabResultJson:string):Readonly<GuitarWorkspaceResult>=>{
  if(typeof canonicalTabResultJson!=='string')return fail('CanonicalTabResult input must be JSON string.','INVALID_JSON');const bytes=new TextEncoder().encode(canonicalTabResultJson).byteLength;if(bytes===0||bytes>MAX_CANONICAL_TAB_RESULT_JSON_BYTES)return fail('CanonicalTabResult JSON size invalid.','RESULT_SIZE_LIMIT',{bytes});let parsed:unknown;try{parsed=JSON.parse(canonicalTabResultJson);}catch{return fail('CanonicalTabResult JSON invalid.','INVALID_JSON');}
  const r=exact(parsed,['documentType','schemaVersion','engine','source','review','guitar','policyProvenance','measures','simultaneousGroups','arrangementDecisions','noteDispositions','selectedShapes'],'canonicalTabResult');let notation:Readonly<NotationDocument>;try{notation=createNotationDocument(score,notationInput);}catch(error){const code=error instanceof Error&&'code'in error?String((error as{code?:unknown}).code):null;return fail('Notation is not bound to current revision.',code==='STALE_NOTATION'?'STALE_NOTATION':'SOURCE_FACT_MISMATCH',{notationCode:code});}
  const env=validateEnvelope(r);validatePolicy(r.policyProvenance);const expected=deriveExpected(score,notation);validateSource(r,expected);const groups=validateGroups(r,expected.groups);const decisions=validateDecisions(r,expected.notes,groups);const dispositions=validateDispositions(r,expected.notes,decisions,groups);const shapes=validateShapes(r,expected.groups,dispositions.byId);return Object.freeze({contractVersion:GUITAR_WORKSPACE_RESULT_VERSION,documentId:score.id,revisionId:score.revision.id,engine:Object.freeze({name:CANONICAL_TAB_ENGINE_NAME,version:env.engineVersion}),teacherReviewStatus:env.reviewState,entries:dispositions.entries,selectedShapes:shapes});
};
