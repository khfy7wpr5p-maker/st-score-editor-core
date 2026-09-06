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
const address=server.address(); if(address===null||typeof address==='string') throw new Error('APP-11I server missing port');

let browser;
try {
  browser=await webkit.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true});
  const page=await context.newPage();
  const errors=[];
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${address.port}/st-score-editor-app.html`,{waitUntil:'load',timeout:30000});
  await page.waitForFunction(()=>Boolean(globalThis.STScoreEditorAppController?.getTripletRetimingState));

  const boot=await page.evaluate(()=>({
    retimingBundled:globalThis.STScoreEditorApp?.profile?.tripletRetimingAuthoringBundled??false,
    retimingRuntime:globalThis.STScoreEditorApp?.tripletRetimingAuthoring?.bundled??false,
    tripletBundled:globalThis.STScoreEditorApp?.profile?.tripletAuthoringBundled??false,
    metadataRetimingAuthority:globalThis.STScoreEditorApp?.profile?.tripletAuthoringRetimingAuthority??null,
    restBalance:globalThis.STScoreEditorApp?.profile?.tripletRetimingRestBalance??null,
    coordinateAuthority:globalThis.STScoreEditorApp?.profile?.tripletRetimingRendererCoordinateAuthority??null,
    release:globalThis.STScoreEditorApp?.profile?.standaloneReleaseGatePassed??null,
    cutover:globalThis.STScoreEditorApp?.profile?.seslitabCutoverAuthorized??null
  }));
  if(!boot.retimingBundled||!boot.retimingRuntime||!boot.tripletBundled||boot.metadataRetimingAuthority!==false||boot.restBalance!=='explicit-residual-rest-or-adjacent-neutral-rest-extension'||boot.coordinateAuthority!==false||boot.release!==false||boot.cutover!==false){
    throw new Error(`APP-11I bootstrap mismatch ${JSON.stringify(boot)}`);
  }

  const setup=await page.evaluate(async()=>{
    const c=globalThis.STScoreEditorAppController;
    const xml=`<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
<part-list><score-part id="P1"><part-name>Part</part-name></score-part></part-list>
<part id="P1"><measure number="1">
<attributes><divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
<note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type></note>
<note><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type></note>
<note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type></note>
<note><rest/><duration>10</duration><voice>1</voice></note>
</measure></part></score-partwise>`;
    await c.openLocalFile({name:'app11i-webkit.musicxml',size:new TextEncoder().encode(xml).byteLength,type:'application/vnd.recordare.musicxml+xml',text:async()=>xml});
    const d=c.getDocument(),score=d.session.history.present.score,part=score.parts[0],staff=part.staves.find(item=>item.role==='standard'),measure=staff.measures[0],voice=measure.voices[0];
    const notes=voice.events.filter(event=>event.kind==='note');
    const rest=voice.events.find(event=>event.kind==='rest');
    if(notes.length!==3||rest===undefined) return {ok:false,count:notes.length,hasRest:rest!==undefined};
    const noteAddress=event=>({contractVersion:'3.0.0',kind:'note',documentId:score.id,revisionId:score.revision.id,partId:part.id,staffId:staff.id,frameId:measure.frameId,measureId:measure.id,voiceId:voice.id,eventId:event.id,noteId:event.note.id});
    c.select(noteAddress(notes[0]));
    return {
      ok:true,
      past:d.session.history.past.length,
      eventIds:notes.map(event=>event.id),
      addresses:notes.map(noteAddress),
      durations:notes.map(event=>event.duration),
      onsets:notes.map(event=>event.onset),
      restId:rest.id,
      restOnset:rest.onset,
      restDuration:rest.duration
    };
  });
  const straight=[{numerator:1,denominator:8},{numerator:1,denominator:8},{numerator:1,denominator:8}];
  if(!setup.ok||JSON.stringify(setup.durations)!==JSON.stringify(straight)||JSON.stringify(setup.onsets)!==JSON.stringify([{numerator:0,denominator:1},{numerator:1,denominator:8},{numerator:1,denominator:4}])||JSON.stringify(setup.restOnset)!==JSON.stringify({numerator:3,denominator:8})||JSON.stringify(setup.restDuration)!==JSON.stringify({numerator:5,denominator:8})){
    throw new Error(`APP-11I import setup mismatch ${JSON.stringify(setup)}`);
  }

  for(let index=0;index<3;index+=1){
    if(index>0) await page.evaluate(address=>globalThis.STScoreEditorAppController.select(address),setup.addresses[index]);
    const capture=page.getByRole('button',{name:'Capture selected event as next triplet member',exact:true});
    if(await capture.isDisabled()) throw new Error(`APP-11I capture ${index+1} unexpectedly disabled`);
    await capture.click();
  }

  const pre=await page.evaluate(()=>({
    triplet:globalThis.STScoreEditorAppController.getTripletAuthoringState(),
    retiming:globalThis.STScoreEditorAppController.getTripletRetimingState(),
    past:globalThis.STScoreEditorAppController.getDocument().session.history.past.length
  }));
  if(pre.triplet.capturedEventIds.length!==3||!pre.retiming.canApplyRetimedTriplet||pre.retiming.admissionReason!=='ADMITTED_STRAIGHT_THREE_TO_TRIPLET'||pre.past!==setup.past){
    throw new Error(`APP-11I preflight mismatch ${JSON.stringify(pre)}`);
  }

  const retimeButton=page.getByRole('button',{name:'Convert three captured straight events to triplet timing',exact:true});
  if(await retimeButton.isDisabled()) throw new Error('APP-11I retiming button must enable for three straight eighths');
  await retimeButton.click();

  const applied=await page.evaluate(()=>{
    const c=globalThis.STScoreEditorAppController,d=c.getDocument(),score=d.session.history.present.score;
    const voice=score.parts[0].staves.find(item=>item.role==='standard').measures[0].voices[0];
    const notes=voice.events.filter(event=>event.kind==='note');
    const rest=voice.events.find(event=>event.kind==='rest');
    const tuplets=notes.map(event=>d.session.history.present.notation.events.find(entry=>entry.target.eventId===event.id)?.notation.tuplet??null);
    return {
      ids:notes.map(event=>event.id),
      onsets:notes.map(event=>event.onset),
      durations:notes.map(event=>event.duration),
      restId:rest?.id??null,
      restOnset:rest?.onset??null,
      restDuration:rest?.duration??null,
      tuplets,
      past:d.session.history.past.length,
      captured:c.getTripletAuthoringState().capturedEventIds,
      retiming:c.getTripletRetimingState(),
      selectionKind:d.session.selection?.kind??null,
      selectionEventId:d.session.selection?.kind==='event'?d.session.selection.eventId:null,
      status:d.session.status.code
    };
  });
  const expectedTuplets=[
    {actualNotes:3,normalNotes:2,marks:[{number:1,type:'start'}]},
    {actualNotes:3,normalNotes:2,marks:[]},
    {actualNotes:3,normalNotes:2,marks:[{number:1,type:'stop'}]}
  ];
  if(JSON.stringify(applied.ids)!==JSON.stringify(setup.eventIds)||JSON.stringify(applied.onsets)!==JSON.stringify([{numerator:0,denominator:1},{numerator:1,denominator:12},{numerator:1,denominator:6}])||JSON.stringify(applied.durations)!==JSON.stringify([{numerator:1,denominator:12},{numerator:1,denominator:12},{numerator:1,denominator:12}])||applied.restId!==setup.restId||JSON.stringify(applied.restOnset)!==JSON.stringify({numerator:1,denominator:4})||JSON.stringify(applied.restDuration)!==JSON.stringify({numerator:3,denominator:4})||JSON.stringify(applied.tuplets)!==JSON.stringify(expectedTuplets)||applied.past!==setup.past+1||applied.captured.length!==0||applied.retiming.canApplyRetimedTriplet!==false||applied.selectionKind!=='event'||applied.selectionEventId!==setup.eventIds[0]||applied.status!=='TUPLET_RETIMING_EDIT_COMMITTED'){
    throw new Error(`APP-11I apply mismatch ${JSON.stringify(applied)}`);
  }

  await page.getByRole('button',{name:'Undo',exact:true}).click();
  const undone=await page.evaluate(()=>{
    const d=globalThis.STScoreEditorAppController.getDocument(),score=d.session.history.present.score;
    const voice=score.parts[0].staves.find(item=>item.role==='standard').measures[0].voices[0];
    const notes=voice.events.filter(event=>event.kind==='note'),rest=voice.events.find(event=>event.kind==='rest');
    return {
      ids:notes.map(event=>event.id),
      onsets:notes.map(event=>event.onset),
      durations:notes.map(event=>event.duration),
      restId:rest?.id??null,
      restOnset:rest?.onset??null,
      restDuration:rest?.duration??null,
      tuplets:d.session.history.present.notation.events.map(entry=>entry.notation.tuplet??null)
    };
  });
  if(JSON.stringify(undone.ids)!==JSON.stringify(setup.eventIds)||JSON.stringify(undone.onsets)!==JSON.stringify(setup.onsets)||JSON.stringify(undone.durations)!==JSON.stringify(setup.durations)||undone.restId!==setup.restId||JSON.stringify(undone.restOnset)!==JSON.stringify(setup.restOnset)||JSON.stringify(undone.restDuration)!==JSON.stringify(setup.restDuration)||undone.tuplets.some(value=>value!==null)){
    throw new Error(`APP-11I undo mismatch ${JSON.stringify(undone)}`);
  }
  if(errors.length) throw new Error(`APP-11I console errors ${JSON.stringify(errors)}`);
  console.log('APP-11I WebKit straight-note triplet retiming regression: PASS');
} finally {
  if(browser) await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
