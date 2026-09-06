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
const address=server.address(); if(address===null||typeof address==='string') throw new Error('APP-11F server missing port');

let browser;
try {
  browser=await webkit.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true});
  const page=await context.newPage();
  const errors=[];
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${address.port}/st-score-editor-app.html`,{waitUntil:'load',timeout:30000});
  await page.waitForFunction(()=>Boolean(globalThis.STScoreEditorAppController?.getTripletAuthoringState));

  const boot=await page.evaluate(()=>({
    tripletBundled:globalThis.STScoreEditorApp?.profile?.tripletAuthoringBundled??false,
    tripletRuntime:globalThis.STScoreEditorApp?.tripletAuthoring?.bundled??false,
    slurBundled:globalThis.STScoreEditorApp?.profile?.slurAuthoringBundled??false,
    tieBundled:globalThis.STScoreEditorApp?.profile?.tieAuthoringBundled??false,
    selectionModel:globalThis.STScoreEditorApp?.profile?.tripletAuthoringSelectionModel??null,
    retiming:globalThis.STScoreEditorApp?.profile?.tripletAuthoringRetimingAuthority??null,
    removal:globalThis.STScoreEditorApp?.profile?.tripletAuthoringRemovalAuthority??null,
    captureHistory:globalThis.STScoreEditorApp?.profile?.tripletAuthoringCaptureHistoryMutationAuthority??null,
    coordinateAuthority:globalThis.STScoreEditorApp?.profile?.tripletAuthoringRendererCoordinateAuthority??null,
    release:globalThis.STScoreEditorApp?.profile?.standaloneReleaseGatePassed??null,
    cutover:globalThis.STScoreEditorApp?.profile?.seslitabCutoverAuthorized??null
  }));
  if(!boot.tripletBundled||!boot.tripletRuntime||!boot.slurBundled||!boot.tieBundled||boot.selectionModel!=='editor-semantic-selection-v4'||boot.retiming!==false||boot.removal!==false||boot.captureHistory!==false||boot.coordinateAuthority!==false||boot.release!==false||boot.cutover!==false){
    throw new Error(`APP-11F bootstrap mismatch ${JSON.stringify(boot)}`);
  }

  const setup=await page.evaluate(async()=>{
    const c=globalThis.STScoreEditorAppController;
    const xml=`<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
<part-list><score-part id="P1"><part-name>Part</part-name></score-part></part-list>
<part id="P1"><measure number="1">
<attributes><divisions>3</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><type>eighth</type></note>
<note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><type>eighth</type></note>
<note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><type>eighth</type></note>
<note><rest/><duration>9</duration><voice>1</voice></note>
</measure></part></score-partwise>`;
    await c.openLocalFile({name:'app11f-webkit.musicxml',size:new TextEncoder().encode(xml).byteLength,type:'application/vnd.recordare.musicxml+xml',text:async()=>xml});
    const d=c.getDocument(),score=d.session.history.present.score,part=score.parts[0],staff=part.staves.find(item=>item.role==='standard'),measure=staff.measures[0],voice=measure.voices[0];
    const events=voice.events.filter(event=>event.kind==='note');
    if(events.length!==3) return {ok:false,count:events.length};
    const noteAddress=event=>({contractVersion:'3.0.0',kind:'note',documentId:score.id,revisionId:score.revision.id,partId:part.id,staffId:staff.id,frameId:measure.frameId,measureId:measure.id,voiceId:voice.id,eventId:event.id,noteId:event.note.id});
    c.select(noteAddress(events[0]));
    return {ok:true,past:d.session.history.past.length,eventIds:events.map(event=>event.id),durations:events.map(event=>event.duration),addresses:events.map(noteAddress)};
  });
  if(!setup.ok||JSON.stringify(setup.durations)!==JSON.stringify([{numerator:1,denominator:12},{numerator:1,denominator:12},{numerator:1,denominator:12}])) throw new Error(`APP-11F import setup mismatch ${JSON.stringify(setup)}`);

  for(let index=0;index<3;index+=1){
    if(index>0) await page.evaluate(address=>globalThis.STScoreEditorAppController.select(address),setup.addresses[index]);
    if(await page.getByRole('button',{name:'Capture selected event as next triplet member',exact:true}).isDisabled()) throw new Error(`APP-11F capture ${index+1} unexpectedly disabled`);
    await page.getByRole('button',{name:'Capture selected event as next triplet member',exact:true}).click();
    const captured=await page.evaluate(()=>{const c=globalThis.STScoreEditorAppController,d=c.getDocument(),s=c.getTripletAuthoringState();return{ids:s.capturedEventIds,past:d.session.history.past.length};});
    if(captured.ids.length!==index+1||captured.past!==setup.past) throw new Error(`APP-11F capture mismatch ${JSON.stringify(captured)}`);
  }

  if(await page.getByRole('button',{name:'Apply triplet metadata to three captured events',exact:true}).isDisabled()) throw new Error('APP-11F apply must enable for exact three-event range');
  await page.getByRole('button',{name:'Apply triplet metadata to three captured events',exact:true}).click();

  const applied=await page.evaluate(()=>{
    const c=globalThis.STScoreEditorAppController,d=c.getDocument(),s=c.getTripletAuthoringState();
    const notation=d.session.history.present.notation;
    const tuplets=saved=>notation.events.find(entry=>entry.target.eventId===saved)?.notation.tuplet??null;
    const score=d.session.history.present.score,voice=score.parts[0].staves.find(item=>item.role==='standard').measures[0].voices[0],ids=voice.events.filter(event=>event.kind==='note').map(event=>event.id);
    return{ids,tuplets:ids.map(tuplets),past:d.session.history.past.length,captured:s.capturedEventIds,selectionKind:d.session.selection?.kind??null,selectionEventId:d.session.selection?.kind==='event'?d.session.selection.eventId:null};
  });
  const expected=[
    {actualNotes:3,normalNotes:2,marks:[{number:1,type:'start'}]},
    {actualNotes:3,normalNotes:2,marks:[]},
    {actualNotes:3,normalNotes:2,marks:[{number:1,type:'stop'}]}
  ];
  if(JSON.stringify(applied.tuplets)!==JSON.stringify(expected)||applied.past!==setup.past+1||applied.captured.length!==0||applied.selectionKind!=='event'||applied.selectionEventId!==setup.eventIds[0]){
    throw new Error(`APP-11F apply mismatch ${JSON.stringify(applied)}`);
  }

  await page.getByRole('button',{name:'Undo',exact:true}).click();
  const undone=await page.evaluate(()=>{const d=globalThis.STScoreEditorAppController.getDocument();return d.session.history.present.notation.events.map(entry=>entry.notation.tuplet??null);});
  if(undone.some(value=>value!==null)) throw new Error(`APP-11F undo mismatch ${JSON.stringify(undone)}`);
  if(errors.length) throw new Error(`APP-11F console errors ${JSON.stringify(errors)}`);
  console.log('APP-11F WebKit bounded triplet authoring regression: PASS');
} finally {
  if(browser) await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
