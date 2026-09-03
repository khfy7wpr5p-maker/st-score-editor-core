import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webkit } from 'playwright';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const browserRoot = path.join(repoRoot, 'dist', 'browser');
const contentTypes = new Map([['.html','text/html; charset=utf-8'],['.js','text/javascript; charset=utf-8'],['.mjs','text/javascript; charset=utf-8'],['.json','application/json; charset=utf-8'],['.svg','image/svg+xml'],['.xml','application/xml; charset=utf-8'],['.musicxml','application/xml; charset=utf-8']]);
const sourceXml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1"><measure number="1"><attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
    <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>
    <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>
    <note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>
    <note><pitch><step>F</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>
  </measure></part>
</score-partwise>`;

function resolveRequestPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl ?? '/', 'http://127.0.0.1').pathname);
  const resolved = path.resolve(browserRoot, pathname.replace(/^\/+/, '') || 'st-score-editor-app09b.html');
  if (resolved !== browserRoot && !resolved.startsWith(`${browserRoot}${path.sep}`)) throw new Error('request escaped browser output root');
  return resolved;
}
const server = createServer(async (request,response)=>{try{const requestedPath=resolveRequestPath(request.url);const info=await stat(requestedPath);if(!info.isFile()){response.writeHead(404).end('not found');return;}response.setHeader('Content-Type',contentTypes.get(path.extname(requestedPath))??'application/octet-stream');response.setHeader('Cache-Control','no-store');createReadStream(requestedPath).pipe(response);}catch{response.writeHead(404).end('not found');}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const address=server.address();if(address===null||typeof address==='string'){server.close();throw new Error('APP-09B WebKit server did not expose a TCP port.');}

let browser;
try {
  browser=await webkit.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true});
  const page=await context.newPage();
  const consoleErrors=[];page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});page.on('pageerror',error=>consoleErrors.push(error.message));
  await page.goto(`http://127.0.0.1:${address.port}/st-score-editor-app09b.html`,{waitUntil:'load',timeout:30000});
  await page.waitForFunction(()=>['true','false'].includes(document.documentElement.dataset.app09bRendererReady??''),null,{timeout:30000});
  await page.waitForTimeout(1200);

  const collect=()=>page.evaluate(()=>{const frame=document.querySelector('iframe[data-app09b-renderer-frame="true"]');const child=frame instanceof HTMLIFrameElement?frame.contentDocument:null;const controller=globalThis.STScoreEditorAppController;const state=globalThis.STScoreEditorApp09B?.getState?.()??null;return{rendererReady:document.documentElement.dataset.app09bRendererReady??null,renderStatus:document.documentElement.dataset.app09bRenderStatus??null,svgCount:child?.querySelectorAll('svg').length??-1,childReady:child?.documentElement.dataset.stScoreRuntimeReady??null,snapshot:state?.snapshot??null,renderer:state?.renderer??null,renderEvidence:state?.renderEvidence??null,coreXml:controller?.getDocument?.()?.session?.renderRequest?.musicXml??null};});
  const automatic=await collect();
  console.log(`APP-09B automatic: ${JSON.stringify({...automatic,coreXml:automatic.coreXml?.slice(0,2200)??null})}`);

  const probe=async(xml,label,ticket)=>{
    const result=await page.evaluate(async({xml,label,ticket})=>{const frame=document.querySelector('iframe[data-app09b-renderer-frame="true"]');const api=frame instanceof HTMLIFrameElement?frame.contentWindow?.__ST_SCORE_RENDER_HOST__:null;if(!api)return{label,error:'HOST_UNAVAILABLE',svgCount:-1};try{await api.renderMusicXml({contractVersion:'0.2.0',musicxml:xml,ticket,pageMode:'continuous',autoResize:true,drawTitle:true,drawComposer:true});return{label,error:null,svgCount:frame.contentDocument?.querySelectorAll('svg').length??-1};}catch(error){return{label,error:`${error?.name??'Error'}:${error?.message??String(error)}`,svgCount:frame.contentDocument?.querySelectorAll('svg').length??-1};}}, {xml,label,ticket});
    console.log(`APP-09B probe ${label}: ${JSON.stringify(result)}`);return result;
  };

  const sourceProbe=await probe(sourceXml,'source',101);
  const coreXml=automatic.coreXml??'';
  const coreProbe=await probe(coreXml,'core',102);
  const patchedXml=coreXml.replaceAll(/(<voice>[^<]+<\/voice>)/g,'$1\n        <type>quarter</type>');
  const typePatchedProbe=await probe(patchedXml,'core-plus-type-quarter',103);

  let forcedRenderError=null;try{await page.evaluate(async()=>{await globalThis.STScoreEditorAppController.renderCurrent();});}catch(error){forcedRenderError=String(error);}
  const afterForced=await collect();
  console.log(`APP-09B forced: ${JSON.stringify({forcedRenderError,svgCount:afterForced.svgCount,renderer:afterForced.renderer})}`);

  const diagnostics=consoleErrors.length===0?'none':consoleErrors.slice(-12).join(' | ');
  if(sourceProbe.error!==null)throw new Error(`Renderer rejected source fixture: ${JSON.stringify(sourceProbe)}; console=${diagnostics}`);
  if(coreProbe.error===null)throw new Error('Diagnostic assumption changed: Core projection unexpectedly loaded.');
  if(typePatchedProbe.error!==null)throw new Error(`Adding note type did not repair Core XML: ${JSON.stringify(typePatchedProbe)}; coreXml=${coreXml.slice(0,2200)}; console=${diagnostics}`);
  throw new Error(`APP-09B root cause confirmed: source loads, Core XML fails, Core XML + note type loads. automatic=${JSON.stringify({svgCount:automatic.svgCount,renderer:automatic.renderer})}; coreError=${coreProbe.error}; forced=${forcedRenderError}`);
} finally {if(browser!==undefined)await browser.close();await new Promise(resolve=>server.close(resolve));}
