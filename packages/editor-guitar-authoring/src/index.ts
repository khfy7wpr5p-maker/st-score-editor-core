import type { NoteAddress } from '../../addressing/src/index.js';
import type { EditTransaction } from '../../commands/src/index.js';
import { executeAdvancedScoreAuthoring } from '../../editor-advanced-authoring/src/index.js';
import type { MusicXmlMeasureSemanticsDocument } from '../../musicxml-measure-semantics/src/index.js';
import type { NotationDocument } from '../../notation-structure/src/index.js';
import type { ScoreDocument } from '../../score-model/src/index.js';
import {
  createGuitarWorkspaceResult,
  type GuitarWorkspacePosition,
  type GuitarWorkspaceResult
} from '../../guitar-workspace-result/src/index.js';

export const GUITAR_AUTHORING_COMPANION_VERSION = '1.0.0' as const;

export const guitarAuthoringAuthorityProfile = Object.freeze({
  version: GUITAR_AUTHORING_COMPANION_VERSION,
  canonicalAuthority: 'ScoreDocument',
  guitarStateAuthority: 'DERIVATIVE_ONLY',
  validatedResultRequired: true,
  exactRevisionBinding: true,
  reverseWriteFromGuitarResult: false,
  teacherReviewGrantsWriteAuthority: false,
  canonicalEditPath: 'EDITOR_CORE_TYPED_AUTHORING_ONLY',
  canonicalEditInvalidatesGuitarResult: true,
  engineInvocation: false,
  productionAuthority: false
});

export interface GuitarAuthoringAnnotation {
  readonly target: Readonly<NoteAddress>;
  readonly disposition: 'KEEP' | 'OMIT';
  readonly position: Readonly<GuitarWorkspacePosition> | null;
  readonly finger: number | null;
  readonly selectedShapeId: string | null;
}

export interface GuitarAuthoringCompanion {
  readonly contractVersion: typeof GUITAR_AUTHORING_COMPANION_VERSION;
  readonly documentId: string;
  readonly revisionId: string;
  readonly teacherReviewStatus: GuitarWorkspaceResult['teacherReviewStatus'];
  readonly annotations: readonly Readonly<GuitarAuthoringAnnotation>[];
}

export interface GuitarResultInvalidation {
  readonly contractVersion: typeof GUITAR_AUTHORING_COMPANION_VERSION;
  readonly status: 'REQUIRES_RECOMPUTE';
  readonly documentId: string;
  readonly sourceRevisionId: string;
  readonly currentRevisionId: string;
  readonly reason: 'CANONICAL_SCORE_CHANGED';
}

export interface GuitarAwareAuthoringResult {
  readonly score: Readonly<ScoreDocument>;
  readonly notation: Readonly<NotationDocument>;
  readonly guitar: Readonly<GuitarResultInvalidation>;
}

export type GuitarAuthoringErrorCode = 'INVALID_GUITAR_RESULT' | 'REVISION_MISMATCH' | 'CANONICAL_EDIT_REJECTED';
export class GuitarAuthoringError extends Error {
  readonly code:GuitarAuthoringErrorCode;
  readonly details:Readonly<Record<string,unknown>>;
  constructor(message:string,code:GuitarAuthoringErrorCode,details:Record<string,unknown>={}){super(message);this.name='GuitarAuthoringError';this.code=code;this.details=Object.freeze({...details});Object.freeze(this);}
}

const validatedResult=(score:ScoreDocument,notation:NotationDocument,json:string):Readonly<GuitarWorkspaceResult>=>{
  try{return createGuitarWorkspaceResult(score,notation,json);}
  catch(error){throw new GuitarAuthoringError('Guitar authoring requires a validated result for the exact current score revision.','INVALID_GUITAR_RESULT',{cause:error instanceof Error?error.message:String(error)});}
};

const fingerByNote=(result:GuitarWorkspaceResult):ReadonlyMap<string,number>=>{
  const map=new Map<string,number>();
  for(const shape of result.selectedShapes) for(const assignment of shape.fingerAssignments) map.set(assignment.target.noteId,assignment.finger);
  return map;
};

export const createGuitarAuthoringCompanion=(
  score:ScoreDocument,
  notation:NotationDocument,
  canonicalTabResultJson:string
):Readonly<GuitarAuthoringCompanion>=>{
  const result=validatedResult(score,notation,canonicalTabResultJson);
  if(result.documentId!==score.id||result.revisionId!==score.revision.id)throw new GuitarAuthoringError('Validated guitar result is not bound to the exact current revision.','REVISION_MISMATCH');
  const fingers=fingerByNote(result);
  const annotations=result.entries.map((entry)=>Object.freeze({
    target:Object.freeze({...entry.target}),
    disposition:entry.disposition,
    position:entry.selectedPosition===null?null:Object.freeze({...entry.selectedPosition}),
    finger:fingers.get(entry.target.noteId)??(entry.selectedPosition?.fret===0?0:null),
    selectedShapeId:entry.selectedShapeId
  }));
  return Object.freeze({
    contractVersion:GUITAR_AUTHORING_COMPANION_VERSION,
    documentId:score.id,
    revisionId:score.revision.id,
    teacherReviewStatus:result.teacherReviewStatus,
    annotations:Object.freeze(annotations)
  });
};

export const executeCanonicalAuthoringWithGuitarInvalidation=(
  score:ScoreDocument,
  notation:NotationDocument,
  measureSemantics:MusicXmlMeasureSemanticsDocument|null,
  canonicalTabResultJson:string,
  transaction:EditTransaction
):Readonly<GuitarAwareAuthoringResult>=>{
  validatedResult(score,notation,canonicalTabResultJson);
  let edited:ReturnType<typeof executeAdvancedScoreAuthoring>;
  try{edited=executeAdvancedScoreAuthoring(score,notation,measureSemantics,transaction);}
  catch(error){throw new GuitarAuthoringError('Canonical authoring was rejected; guitar state was not advanced.','CANONICAL_EDIT_REJECTED',{cause:error instanceof Error?error.message:String(error)});}
  return Object.freeze({
    score:edited.score,
    notation:edited.notation,
    guitar:Object.freeze({
      contractVersion:GUITAR_AUTHORING_COMPANION_VERSION,
      status:'REQUIRES_RECOMPUTE',
      documentId:score.id,
      sourceRevisionId:score.revision.id,
      currentRevisionId:edited.score.revision.id,
      reason:'CANONICAL_SCORE_CHANGED'
    })
  });
};
