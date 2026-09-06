import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webkit } from 'playwright';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const browserRoot = path.join(repoRoot, 'dist', 'browser');
const types = new Map([['.html','text/html; charset=utf-8'],['.js','text/javascript; charset=utf-8'],['.json','application/json; charset=utf-8']]);
const server = createServer(async (req,res) => {
  try {
    const p = path.resolve(browserRoot, decodeURIComponent(new URL(req.url ?? '/', 'http://127.0.0.1').pathname).replace(/^\/+/, '') || 'st-score-editor-app.html');
    if (p !== browserRoot && !p.startsWith(`${browserRoot}${path.sep}`)) throw new Error();
    const s = await stat(p); if (!s.isFile()) throw new Error();
    res.setHeader('Content-Type', types.get(path.extname(p)) ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    createReadStream(p).pipe(res);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const address=server.address(); if(address===null||typeof address==='string') throw new Error('APP-11D server missing port');

let browser;
try {
  browser=await webkit.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true});
  const page=await context.newPage();
  const errors=[];
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${address.port}/st-score-editor-app.html`,{waitUntil:'load',timeout:30000});
  await page.waitForFunction(()=>Boolean(globalThis.STScoreEditorAppController?.getTieAuthoringState));

  const boot=await page.evaluate(()=>({
    bundled:globalThis.STScoreEditorApp?.profile?.tieAuthoringBundled??false,
    runtime:globalThis.STScoreEditorApp?.tieAuthoring?.bundled??false,
    selectionModel:globalThis.STScoreEditorApp?.profile?.tieAuthoringSelectionModel??null,
    captureHistory:globalThis.STScoreEditorApp?.profile?.tieAuthoringCaptureHistoryMutationAuthority??null,
    coordinateAuthority:globalThis.STScoreEditorApp?.profile?.tieAuthoringRendererCoordinateAuthority??null,
    release:globalThis.STScoreEditorApp?.profile?.standaloneReleaseGatePassed??null,
    cutover:globalThis.STScoreEditorApp?.profile?.seslitabCutoverAuthorized??null
  }));
  if(!boot.bundled||!boot.runtime||boot.selectionModel!=='editor-semantic-selection-v4'||boot.captureHistory!==false||boot.coordinateAuthority!==false||boot.release!==false||boot.cutover!==false){
    throw new Error(`APP-11D bootstrap mismatch ${JSON.stringify(boot)}`);
  }

  await page.getByRole('combobox',{name:'New score type',exact:true}).selectOption('GUITAR_TREBLE');
  await page.getByRole('button',{name:'New',exact:true}).click();
  if(!(await page.getByRole('button',{name:'Capture selected note as tie start',exact:true}).isDisabled())) throw new Error('APP-11D rest selection must disable tie start');

  await page.getByRole('button',{name:'Pitch G',exact:true}).click();
  await page.getByRole('button',{name:'Duration 1/2',exact:true}).click();
  await page.getByRole('button',{name:'Enter note at selected event time',exact:true}).click();

  const selectResidual=await page.evaluate(()=>{
    const c=globalThis.STScoreEditorAppController;
    const d=c.getDocument();
    const score=d.session.history.present.score;
    const part=score.parts[0];
    const staff=part.staves.find(item=>item.role==='standard');
    const measure=staff.measures[0];
    const voice=measure.voices[0];
    const rest=voice.events.find(event=>event.kind==='rest');
    if(!rest) return {ok:false,reason:'NO_RESIDUAL_REST'};
    c.select({contractVersion:'3.0.0',kind:'event',documentId:score.id,revisionId:score.revision.id,partId:part.id,staffId:staff.id,frameId:measure.frameId,measureId:measure.id,voiceId:voice.id,eventId:rest.id});
    return {ok:true};
  });
  if(!selectResidual.ok) throw new Error(`APP-11D residual selection failed ${JSON.stringify(selectResidual)}`);

  await page.getByRole('button',{name:'Pitch G',exact:true}).click();
  await page.getByRole('button',{name:'Duration 1/2',exact:true}).click();
  await page.getByRole('button',{name:'Enter note at selected event time',exact:true}).click();

  const setup=await page.evaluate(()=>{
    const c=globalThis.STScoreEditorAppController;
    const d=c.getDocument();
    const score=d.session.history.present.score;
    const part=score.parts[0];
    const staff=part.staves.find(item=>item.role==='standard');
    const measure=staff.measures[0];
    const voice=measure.voices[0];
    const events=voice.events.filter(event=>event.kind==='note');
    if(events.length!==2) return {ok:false,count:events.length};
    const first=events[0],second=events[1];
    const noteAddress=event=>({contractVersion:'3.0.0',kind:'note',documentId:score.id,revisionId:score.revision.id,partId:part.id,staffId:staff.id,frameId:measure.frameId,measureId:measure.id,voiceId:voice.id,eventId:event.id,noteId:event.note.id});
    c.select(noteAddress(first));
    return {ok:true,firstNoteId:first.note.id,secondNoteId:second.note.id,secondAddress:noteAddress(second),past:d.session.history.past.length};
  });
  if(!setup.ok) throw new Error(`APP-11D two-note setup failed ${JSON.stringify(setup)}`);

  await page.getByRole('button',{name:'Capture selected note as tie start',exact:true}).click();
  const captured=await page.evaluate(()=>{const c=globalThis.STScoreEditorAppController,d=c.getDocument(),s=c.getTieAuthoringState();return{pending:s.pendingStartNoteId,past:d.session.history.past.length};});
  if(captured.pending!==setup.firstNoteId||captured.past!==setup.past) throw new Error(`APP-11D capture mismatch ${JSON.stringify(captured)}`);

  await page.evaluate(secondAddress=>globalThis.STScoreEditorAppController.select(secondAddress),setup.secondAddress);
  if(await page.getByRole('button',{name:'Toggle tie from captured start to selected note',exact:true}).isDisabled()) throw new Error('APP-11D tie apply must enable for valid exact pair');
  await page.getByRole('button',{name:'Toggle tie from captured start to selected note',exact:true}).click();

  const applied=await page.evaluate(()=>{
    const c=globalThis.STScoreEditorAppController,d=c.getDocument(),s=c.getTieAuthoringState();
    const score=d.session.history.present.score;
    const part=score.parts[0],staff=part.staves.find(item=>item.role==='standard'),measure=staff.measures[0],voice=measure.voices[0];
    const notes=voice.events.filter(event=>event.kind==='note').map(event=>event.note.id);
    const ties=noteId=>d.session.history.present.notation.notes.find(entry=>entry.target.noteId===noteId)?.notation.ties??[];
    return{notes,ties:notes.map(ties),past:d.session.history.past.length,pending:s.pendingStartNoteId,selectionKind:d.session.selection?.kind??null,selectionNoteId:d.session.selection?.kind==='note'?d.session.selection.noteId:null};
  });
  if(JSON.stringify(applied.ties)!==JSON.stringify([[{number:1,type:'start'}],[{number:1,type:'stop'}]])||applied.past!==setup.past+1||applied.pending!==null||applied.selectionKind!=='note'||applied.selectionNoteId!==setup.firstNoteId){
    throw new Error(`APP-11D apply mismatch ${JSON.stringify(applied)}`);
  }

  await page.getByRole('button',{name:'Undo',exact:true}).click();
  const undone=await page.evaluate(()=>{const c=globalThis.STScoreEditorAppController,d=c.getDocument(),notes=d.session.history.present.notation.notes;return notes.map(entry=>entry.notation.ties??[]);});
  if(undone.some(ties=>ties.length!==0)) throw new Error(`APP-11D undo mismatch ${JSON.stringify(undone)}`);
  if(errors.length) throw new Error(`APP-11D console errors ${JSON.stringify(errors)}`);
  console.log('APP-11D WebKit bounded tie authoring regression: PASS');
} finally {
  if(browser) await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
