import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const bundlePath = new URL('../dist/browser/st-score-editor-app.js', import.meta.url);
const manifestPath = new URL('../dist/browser/st-score-editor-app.manifest.json', import.meta.url);

test('APP-10E standalone manifest declares bounded Voice 1..5 authoring without new authority', async () => {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.equal(manifest.authoringWorkspaceBundled, true);
  assert.equal(manifest.authoringWorkspaceCanonicalAuthority, false);
  assert.equal(manifest.activeVoicePresentationState, true);
  assert.deepEqual(manifest.activeVoiceOrdinals, [1, 2, 3, 4, 5]);
  assert.equal(manifest.missingVoiceMaterialization, 'synthetic-proven-measure-only');
  assert.equal(manifest.positionNoteEntry, 'explicit-rest-only');
  assert.equal(manifest.rendererCoordinateTimingAuthority, false);
  assert.equal(manifest.noteEntryHistory, 'EditorSessionV4');
  assert.equal(manifest.authoringNetworkAuthority, false);
  assert.equal(manifest.standaloneReleaseGatePassed, false);
  assert.equal(manifest.seslitabCutoverAuthorized, false);
});

test('APP-10E global exposes authoring state and actions while preserving existing standalone APIs', async () => {
  const bundle = await readFile(bundlePath, 'utf8');
  const text = bundle.toString('utf8');
  assert.match(text, /data-st-authoring-palette/);
  const context = vm.createContext({ TextEncoder, Blob, URL: class URL {} });
  vm.runInContext(text, context, { filename: 'st-score-editor-app.js' });
  const app = context.STScoreEditorApp;
  assert.ok(app);
  assert.ok(app.authoringWorkspace);
  assert.equal(app.profile.authoringWorkspaceBundled, true);
  assert.deepEqual(Array.from(app.authoringWorkspace.activeVoiceOrdinals), [1, 2, 3, 4, 5]);
  assert.equal(app.authoringWorkspace.rendererCoordinateTimingAuthority, false);
  assert.equal(app.authoringWorkspace.history, 'EditorSessionV4');
  const controller = app.createController();
  assert.equal(typeof controller.getAuthoringState, 'function');
  assert.equal(typeof controller.setActiveVoice, 'function');
  assert.equal(typeof controller.setEntryPitch, 'function');
  assert.equal(typeof controller.setEntryDuration, 'function');
  assert.equal(typeof controller.enterNoteAtSelection, 'function');
  assert.equal(typeof controller.commitVoiceMaterialization, 'function');
  assert.equal(typeof controller.commitPositionNoteEntry, 'function');
  assert.equal(typeof controller.playbackPlay, 'function');
  assert.equal(typeof controller.exportMusicXmlFile, 'function');
  assert.equal(typeof controller.undo, 'function');
  assert.equal(typeof controller.redo, 'function');
  assert.equal(Object.isFrozen(controller), true);
});
