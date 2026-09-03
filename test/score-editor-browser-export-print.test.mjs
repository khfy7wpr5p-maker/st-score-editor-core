import test from 'node:test';
import assert from 'node:assert/strict';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import {
  createExportPrintEnabledStandaloneScoreEditorController,
  ExportPrintControllerError
} from '../dist/packages/score-editor-browser-app/src/export-print-enabled.js';

const idFactory=()=>{let n=0;return()=>`app08-${++n}`;};
const memoryStore=()=>{const values=new Map();return Object.freeze({put:async record=>{values.set(record.documentId,structuredClone(record));},list:async()=>[...values.values()].map(value=>structuredClone(value)),delete:async documentId=>{values.delete(documentId);},clear:async()=>{values.clear();}});};
const controller=()=>createExportPrintEnabledStandaloneScoreEditorController({store:memoryStore(),autosaveDelayMs:60_000,sha256Hex:async()=> 'a'.repeat(64),playbackHostFactory:()=>({currentTime:()=>0,resume:async()=>{},scheduleTone:()=>Object.freeze({stop:()=>{}}),dispose:async()=>{}})});
const rendererHost=()=>{const calls={loads:[],renders:0,clears:0};return {calls,value:{packageName:'opensheetmusicdisplay',packageVersion:'2.1.1',license:'BSD-3-Clause',instance:{async load(xml){calls.loads.push(xml);},render(){calls.renders+=1;},clear(){calls.clears+=1;}}}};};
const makeDirty=value=>{const score=value.getDocument().session.history.present.score;const rest=score.parts[0].staves[0].measures[0].voices[0].events[0];const result=value.commitBasic({version:'1.0.0',type:'REPLACE_REST_WITH_NOTE',target:addressEntityV3(score,rest.id),noteId:'app08-note',pitch:{step:'C',alter:0,octave:4}},{nextRevisionId:'app08-rev-note'});assert.equal(result.error,null);};

test('APP-08 MusicXML export is lossless handoff only and does not mark a dirty canonical revision saved',async()=>{
  const value=controller();
  value.newDocument({title:'APP08 Export',idFactory:idFactory()});
  makeDirty(value);
  const before=value.getDocument();
  assert.equal(before.dirty,true);
  const beforeRevision=before.session.history.present.score.revision.id;
  const beforePast=before.session.history.past.length;
  let captured=null;
  const artifact=await value.exportMusicXmlFile(async item=>{captured=item;});
  assert.equal(captured,artifact);
  assert.match(artifact.fileName,/\.musicxml$/);
  assert.match(artifact.text,/<score-partwise/);
  const after=value.getDocument();
  assert.equal(after.dirty,true);
  assert.equal(after.session.history.present.score.revision.id,beforeRevision);
  assert.equal(after.session.history.past.length,beforePast);
  assert.equal(value.getExportPrintState().lastExportedRevisionId,beforeRevision);
  assert.equal(value.getExportPrintState().status.code,'MUSICXML_EXPORTED');
  assert.equal(value.profile.musicXmlExportCanonicalAuthority,false);
  assert.equal(value.profile.musicXmlExportMarksSaved,false);
});

test('APP-08 print/PDF renders exact current revision then hands only presentation to browser print host',async()=>{
  const value=controller();
  value.newDocument({title:'APP08 Print',idFactory:idFactory()});
  const osmd=rendererHost();
  value.attachOsmdRenderer(osmd.value);
  const before=value.getDocument();
  const revision=before.session.history.present.score.revision.id;
  const historyPast=before.session.history.past.length;
  let prints=0;
  const result=await value.printCurrent({print:async()=>{prints+=1;}});
  assert.equal(prints,1);
  assert.equal(osmd.calls.loads.length,1);
  assert.equal(osmd.calls.renders,1);
  assert.equal(result.lastPrintedRevisionId,revision);
  assert.equal(result.printReady,true);
  assert.equal(result.status.code,'PRINT_PDF_HANDED_OFF');
  assert.equal(result.pdfWorkflow,'browser-print-dialog-save-as-pdf');
  assert.equal(result.pdfBytesGenerated,false);
  const after=value.getDocument();
  assert.equal(after.session.history.present.score.revision.id,revision);
  assert.equal(after.session.history.past.length,historyPast);
  assert.equal(value.profile.printCanonicalAuthority,false);
  assert.equal(value.profile.printRequiresCurrentRendererRevision,true);
});

test('APP-08 print fails closed without an attached current renderer and never invokes print host',async()=>{
  const value=controller();
  value.newDocument({idFactory:idFactory()});
  let prints=0;
  await assert.rejects(
    ()=>value.printCurrent({print:()=>{prints+=1;}}),
    error=>error instanceof ExportPrintControllerError && error.code==='PRINT_RENDER_FAILED'
  );
  assert.equal(prints,0);
  assert.equal(value.getExportPrintState().lastPrintedRevisionId,null);
  assert.equal(value.getDocument().dirty,false);
});
