import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const bundlePath=new URL('../dist/browser/st-score-editor-app.js',import.meta.url);
const manifestPath=new URL('../dist/browser/st-score-editor-app.manifest.json',import.meta.url);

test('P03-BUNDLE01 global runtime preserves prior standalone capabilities and adds teacher/mobile viewport',async()=>{
  const bundle=await readFile(bundlePath);
  const context=vm.createContext({TextEncoder,Blob,URL:class URL{}});
  vm.runInContext(bundle.toString('utf8'),context,{filename:'st-score-editor-app.js'});
  const app=context.STScoreEditorApp;
  assert.ok(app);

  // Existing global capability chain must remain present after the superset cutover.
  assert.ok(app.releaseHardening);
  assert.ok(app.renderer);
  assert.ok(app.viewport);
  assert.ok(app.fileWorkflow);
  assert.ok(app.recovery);
  assert.ok(app.playback);
  assert.ok(app.exportPrint);
  assert.ok(app.tripletRetimingAuthoring);

  // P02/P03 additions are now in the actual standalone global runtime.
  assert.ok(app.teacherWorkflow);
  assert.equal(app.teacherWorkflow.canonicalAuthority,false);
  assert.ok(app.mobileTeacherToolbar);
  assert.equal(app.mobileTeacherToolbar.canonicalAuthority,false);
  assert.equal(app.mobileTeacherToolbar.minimumTouchTargetPx,44);
  assert.equal(app.mobileTeacherToolbar.safeAreaAware,true);
  assert.ok(app.mobileTeacherViewport);
  assert.equal(app.mobileTeacherViewport.singleCanonicalController,true);
  assert.equal(app.mobileTeacherViewport.reusesExistingViewport,true);
  assert.equal(app.mobileTeacherViewport.presentationOnly,true);
  assert.equal(app.mobileTeacherViewport.coordinateAuthoring,false);

  const controller=app.createController();
  assert.equal(Object.isFrozen(controller),true);
  assert.equal(typeof controller.copyTeacherRangeToSelection,'function');
  assert.equal(typeof controller.pasteTeacherClipboardOverwriteAtSelection,'function');
  assert.equal(typeof controller.insertTeacherClipboardAfterSelection,'function');
  assert.equal(typeof controller.transposeTeacherRangeToSelectionByOctaves,'function');
  assert.equal(typeof controller.zoomIn,'function');
  assert.equal(typeof controller.panBy,'function');
  assert.equal(typeof controller.applyRetimedTripletToCapturedEvents,'function');
  assert.equal(controller.profile.releaseHardeningBundled,true);
  assert.equal(controller.profile.mobileTeacherToolbarBundled,true);
  assert.equal(controller.profile.mobileTeacherViewportBundled,true);
  assert.equal(controller.profile.mobileTeacherViewportReusesExistingViewport,true);
  assert.equal(controller.profile.canonicalAuthority,false);
  assert.equal(controller.profile.mobileTeacherViewportCanonicalAuthority,false);
});

test('P03-BUNDLE01 keeps existing release safety gates and the bounded teacher/mobile budget',async()=>{
  const bundle=await readFile(bundlePath);
  const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
  assert.equal(manifest.contract,'ST_SCORE_EDITOR_APP_BROWSER_BUNDLE');
  assert.equal(manifest.releaseHardeningBundled,true);
  assert.equal(manifest.teacherWorkflowCommandsBundled,true);
  assert.equal(manifest.mobileTeacherToolbarBundled,true);
  assert.equal(manifest.mobileTeacherViewportBundled,true);
  assert.equal(manifest.mobileTeacherViewportReusesExistingViewport,true);
  assert.equal(manifest.bundleBudgetRevision,'P03-TEACHER-MOBILE-1');
  assert.equal(manifest.maxBytes,540672);
  assert.ok(bundle.byteLength<=manifest.maxBytes);
  assert.equal(manifest.manualDeviceValidationRequired,true);
  assert.equal(manifest.standaloneReleaseGatePassed,false);
  assert.equal(manifest.seslitabCutoverAuthorized,false);
  assert.equal(manifest.canonicalAuthority,false);
  assert.equal(manifest.publicationAuthority,false);
  assert.equal(manifest.networkCapable,false);
});
