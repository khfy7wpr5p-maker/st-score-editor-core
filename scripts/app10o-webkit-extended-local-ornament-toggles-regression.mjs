import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webkit } from 'playwright';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const browserRoot = path.join(repoRoot, 'dist', 'browser');
const types = new Map([['.html','text/html; charset=utf-8'],['.js','text/javascript; charset=utf-8'],['.json','application/json; charset=utf-8']]);
const server = createServer(async (req,res) => { try { const p = path.resolve(browserRoot, decodeURIComponent(new URL(req.url ?? '/', 'http://127.0.0.1').pathname).replace(/^\/+/, '') || 'st-score-editor-app.html'); if (p !== browserRoot && !p.startsWith(`${browserRoot}${path.sep}`)) throw new Error(); const s=await stat(p); if(!s.isFile()) throw new Error(); res.setHeader('Content-Type',types.get(path.extname(p))??'application/octet-stream'); res.setHeader('Cache-Control','no-store'); createReadStream(p).pipe(res); } catch { res.writeHead(404).end('not found'); } });
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const address=server.address(); if(address===null||typeof address==='string') throw new Error('APP-10O server missing port');
let browser;
try {
  browser=await webkit.launch({headless:true});
  const page=await (await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true})).newPage();
  const errors=[]; page.on('console',m=>{if(m.type()==='error')errors.push(m.text());}); page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${address.port}/st-score-editor-app.html`,{waitUntil:'load',timeout:30000});
  await page.waitForFunction(()=>Boolean(globalThis.STScoreEditorAppController?.getExtendedLocalOrnamentTogglesState));
  const boot=await page.evaluate(()=>({
    bundled:globalThis.STScoreEditorApp?.profile?.extendedLocalOrnamentTogglesBundled??false,
    runtime:globalThis.STScoreEditorApp?.extendedLocalOrnamentToggles?.bundled??false,
    kinds:globalThis.STScoreEditorApp?.profile?.extendedLocalOrnamentToggleKinds??null,
    spanning:globalThis.STScoreEditorApp?.profile?.extendedLocalOrnamentSpanningRelationAuthority??null,
    grace:globalThis.STScoreEditorApp?.profile?.extendedLocalOrnamentGraceTargetAuthority??null,
    coord:globalThis.STScoreEditorApp?.profile?.extendedLocalOrnamentRendererCoordinateAuthority??null,
    release:globalThis.STScoreEditorApp?.profile?.standaloneReleaseGatePassed??null,
    cutover:globalThis.STScoreEditorApp?.profile?.seslitabCutoverAuthorized??null
  }));
  if(!boot.bundled||!boot.runtime||JSON.stringify(boot.kinds)!==JSON.stringify(['inverted-turn','inverted-mordent','shake'])||boot.spanning!==false||boot.grace!==false||boot.coord!==false||boot.release!==false||boot.cutover!==false) throw new Error(`APP-10O bootstrap mismatch ${JSON.stringify(boot)}`);

  await page.getByRole('combobox',{name:'New score type',exact:true}).selectOption('GUITAR_TREBLE'); await page.getByRole('button',{name:'New',exact:true}).click();
  if(!(await page.getByRole('button',{name:'Toggle inverted turn on selected pitched event',exact:true}).isDisabled())) throw new Error('APP-10O rest must disable ornament');
  await page.getByRole('button',{name:'Pitch C',exact:true}).click(); await page.getByRole('button',{name:'Duration 1/4',exact:true}).click(); await page.getByRole('button',{name:'Enter note at selected event time',exact:true}).click();
  await page.getByRole('button',{name:'Pitch E',exact:true}).click(); await page.getByRole('button',{name:'Add palette pitch as chord tone to selected pitched event',exact:true}).click();
  await page.getByRole('button',{name:'Toggle inverted turn on selected pitched event',exact:true}).click();
  const first=await page.evaluate(()=>{const c=globalThis.STScoreEditorAppController,d=c.getDocument(),e=d.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events[0],n=d.session.history.present.notation.events.find(x=>x.target.eventId===e.id)?.notation;return{kind:e.kind,orn:n?.ornaments??[],past:d.session.history.past.length};});
  if(first.kind!=='chord'||JSON.stringify(first.orn)!==JSON.stringify([{kind:'inverted-turn',placement:'auto',accidentalMarks:[]}])||first.past!==3) throw new Error(`APP-10O Guitar mismatch ${JSON.stringify(first)}`);

  await page.getByRole('button',{name:'Add measure',exact:true}).click(); await page.getByRole('button',{name:'Pitch D',exact:true}).click(); await page.getByRole('button',{name:'Enter note at selected event time',exact:true}).click(); await page.getByRole('button',{name:'Toggle shake on selected pitched event',exact:true}).click(); await page.getByRole('button',{name:'Previous measure',exact:true}).click();
  const multi=await page.evaluate(()=>{const c=globalThis.STScoreEditorAppController,d=c.getDocument(),s=d.session.history.present.score.parts[0].staves[0],a=s.measures[0].voices[0].events[0],b=s.measures[1].voices[0].events[0],o=id=>d.session.history.present.notation.events.find(x=>x.target.eventId===id)?.notation.ornaments??[];return{frame:d.session.selection?.frameId??null,a:o(a.id),b:o(b.id),past:d.session.history.past.length};});
  if(multi.frame!=='frame:1'||JSON.stringify(multi.a)!==JSON.stringify([{kind:'inverted-turn',placement:'auto',accidentalMarks:[]}])||JSON.stringify(multi.b)!==JSON.stringify([{kind:'shake',placement:'auto',accidentalMarks:[]}])||multi.past!==6) throw new Error(`APP-10O multi mismatch ${JSON.stringify(multi)}`);

  await page.getByRole('combobox',{name:'New score type',exact:true}).selectOption('PIANO_GRAND_STAFF'); await page.getByRole('button',{name:'New',exact:true}).click(); await page.getByRole('button',{name:'Staff 2',exact:true}).click(); await page.getByRole('button',{name:'Voice 5',exact:true}).click(); await page.getByRole('button',{name:'Pitch C',exact:true}).click(); await page.getByRole('button',{name:'Duration 1/4',exact:true}).click(); await page.getByRole('button',{name:'Enter note at selected event time',exact:true}).click(); await page.getByRole('button',{name:'Toggle inverted mordent on selected pitched event',exact:true}).click();
  const piano=await page.evaluate(()=>{const c=globalThis.STScoreEditorAppController,d=c.getDocument(),s=d.session.history.present.score.parts[0].staves.filter(x=>x.role==='standard'),v=s[1].measures[0].voices.find(x=>x.ordinal===5),e=v?.events[0],n=e?d.session.history.present.notation.events.find(x=>x.target.eventId===e.id)?.notation:null;return{staff:c.getActiveStaffState().activeStaffOrdinal,voice:c.getAuthoringState().activeVoiceOrdinal,kind:e?.kind??null,orn:n?.ornaments??[],upper:d.session.history.present.notation.events.filter(x=>x.target.staffId===s[0].id).length,past:d.session.history.past.length};});
  if(piano.staff!==2||piano.voice!==5||piano.kind!=='note'||JSON.stringify(piano.orn)!==JSON.stringify([{kind:'inverted-mordent',placement:'auto',accidentalMarks:[]}])||piano.upper!==0||piano.past!==3) throw new Error(`APP-10O Piano mismatch ${JSON.stringify(piano)}`);
  if(errors.length) throw new Error(`APP-10O console errors ${JSON.stringify(errors)}`);
  console.log('APP-10O WebKit bounded extended local ornament toggles regression: PASS');
} finally { if(browser) await browser.close(); await new Promise(resolve=>server.close(resolve)); }
