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
const address=server.address(); if(address===null||typeof address==='string') throw new Error('APP-11E server missing port');

let browser;
try {
  browser=await webkit.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true});
  const page=await context.newPage();
  const errors=[];
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${address.port}/st-score-editor-app.html`,{waitUntil:'load',timeout:30000});
  await page.waitForFunction(()=>Boolean(globalThis.STScoreEditorAppController?.getSlurAuthoringState));

  const boot=await page.evaluate(()=>({
    slurBundled:globalThis.STScoreEditorApp?.profile?.slurAuthoringBundled??false,
    slurRuntime:globalThis.STScoreEditorApp?.slurAuthoring?.bundled??false,
    tieBundled:globalThis.STScoreEditorApp?.profile?.tieAuthoringBundled??false,
    selectionModel:globalThis.STScoreEditorApp?.profile?.slurAuthoringSelectionModel??null,
    samePitch:globalThis.STScoreEditorApp?.profile?.slurAuthoringSamePitchRequired??null,
    consecutive:globalThis.STScoreEditorApp?.profile?.slurAuthoringConsecutiveEventsRequired??null,
    captureHistory:globalThis.STScoreEditorApp?.profile?.slurAuthoringCaptureHistoryMutationAuthority??null,
    coordinateAuthority:globalThis.STScoreEditorApp?.profile?.slurAuthoringRendererCoordinateAuthority??null,
    release:globalThis.STScoreEditorApp?.profile?.standaloneReleaseGatePassed??null,
    cutover:globalThis.STScoreEditorApp?.profile?.seslitabCutoverAuthorized??null
  }));
  if(!boot.slurBundled||!boot.slurRuntime||!boot.tieBundled||boot.selectionModel!=='editor-semantic-selection-v4'||boot.samePitch!==false||boot.consecutive!==false||boot.captureHistory!==false||boot.coordinateAuthority!==false||boot.release!==false||boot.cutover!==false){
    throw new Error(`APP-11E bootstrap mismatch ${JSON.stringify(boot)}`);
  }

  await page.getByRole('combobox',{name:'New score type',exact:true}).selectOption('GUITAR_TREBLE');
  await page.getByRole('button',{name:'New',exact:true}).click();
  if(!(await page.getByRole('button',{name:'Capture selected note as slur start',exact:true}).isDisabled())) throw new Error('APP-11E rest selection must disable slur start');
  await page.getByRole('button',{name:'Duration 1/4',exact:true}).click();

  for (const pitch of ['C','D','E','F']) {
    if (pitch !== 'C') {
      const selectResidual=await page.evaluate(()=>{
        const c=globalThis.STScoreEditorAppController,d=c.getDocument(),score=d.session.history.present.score;
        const part=score.parts[0],staff=part.staves.find(item=>item.role==='standard'),measure=staff.measures[0],voice=measure.voices[0];
        const rest=voice.events.find(event=>event.kind==='rest');
        if(!rest) return {ok:false};
        c.select({contractVersion:'3.0.0',kind:'event',documentId:score.id,revisionId:score.revision.id,partId:part.id,staffId:staff.id,frameId:measure.frameId,measureId:measure.id,voiceId:voice.id,eventId:rest.id});
        return {ok:true};
      });
      if(!selectResidual.ok) throw new Error(`APP-11E residual selection failed before ${pitch}`);
    }
    await page.getByRole('button',{name:`Pitch ${pitch}`,exact:true}).click();
    await page.getByRole('button',{name:'Enter note at selected event time',exact:true}).click();
  }

  const setup=await page.evaluate(()=>{
    const c=globalThis.STScoreEditorAppController,d=c.getDocument(),score=d.session.history.present.score;
    const part=score.parts[0],staff=part.staves.find(item=>item.role==='standard'),measure=staff.measures[0],voice=measure.voices[0];
    const events=voice.events.filter(event=>event.kind==='note');
    if(events.length!==4) return {ok:false,count:events.length};
    const noteAddress=event=>({contractVersion:'3.0.0',kind:'note',documentId:score.id,revisionId:score.revision.id,partId:part.id,staffId:staff.id,frameId:measure.frameId,measureId:measure.id,voiceId:voice.id,eventId:event.id,noteId:event.note.id});
    c.select(noteAddress(events[0]));
    return {ok:true,firstNoteId:events[0].note.id,secondNoteId:events[1].note.id,thirdNoteId:events[2].note.id,thirdAddress:noteAddress(events[2]),past:d.session.history.past.length};
  });
  if(!setup.ok) throw new Error(`APP-11E four-note setup failed ${JSON.stringify(setup)}`);

  await page.getByRole('button',{name:'Capture selected note as slur start',exact:true}).click();
  const captured=await page.evaluate(()=>{const c=globalThis.STScoreEditorAppController,d=c.getDocument(),s=c.getSlurAuthoringState();return{pending:s.pendingStartNoteId,past:d.session.history.past.length};});
  if(captured.pending!==setup.firstNoteId||captured.past!==setup.past) throw new Error(`APP-11E capture mismatch ${JSON.stringify(captured)}`);

  await page.evaluate(thirdAddress=>globalThis.STScoreEditorAppController.select(thirdAddress),setup.thirdAddress);
  if(await page.getByRole('button',{name:'Toggle slur from captured start to selected note',exact:true}).isDisabled()) throw new Error('APP-11E slur apply must enable for valid non-consecutive forward pair');
  await page.getByRole('button',{name:'Toggle slur from captured start to selected note',exact:true}).click();

  const applied=await page.evaluate(()=>{
    const c=globalThis.STScoreEditorAppController,d=c.getDocument(),s=c.getSlurAuthoringState();
    const score=d.session.history.present.score,part=score.parts[0],staff=part.staves.find(item=>item.role==='standard'),measure=staff.measures[0],voice=measure.voices[0];
    const notes=voice.events.filter(event=>event.kind==='note').map(event=>event.note.id);
    const slurs=noteId=>d.session.history.present.notation.notes.find(entry=>entry.target.noteId===noteId)?.notation.slurs??[];
    return{notes,slurs:notes.map(slurs),past:d.session.history.past.length,pending:s.pendingStartNoteId,selectionKind:d.session.selection?.kind??null,selectionNoteId:d.session.selection?.kind==='note'?d.session.selection.noteId:null};
  });
  const expected=[[{number:1,type:'start'}],[],[{number:1,type:'stop'}],[]];
  if(JSON.stringify(applied.slurs)!==JSON.stringify(expected)||applied.past!==setup.past+1||applied.pending!==null||applied.selectionKind!=='note'||applied.selectionNoteId!==setup.firstNoteId){
    throw new Error(`APP-11E apply mismatch ${JSON.stringify(applied)}`);
  }

  await page.getByRole('button',{name:'Undo',exact:true}).click();
  const undone=await page.evaluate(()=>{const c=globalThis.STScoreEditorAppController,d=c.getDocument();return d.session.history.present.notation.notes.map(entry=>entry.notation.slurs??[]);});
  if(undone.some(slurs=>slurs.length!==0)) throw new Error(`APP-11E undo mismatch ${JSON.stringify(undone)}`);
  if(errors.length) throw new Error(`APP-11E console errors ${JSON.stringify(errors)}`);
  console.log('APP-11E WebKit bounded slur authoring regression: PASS');
} finally {
  if(browser) await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
