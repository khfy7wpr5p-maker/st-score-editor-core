import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createScoreEditorSdkV1,
  scoreEditorSdkCapabilitiesV1
} from '../dist/packages/score-editor-sdk-v1/src/index.js';

const ids = prefix => {
  let index = 0;
  return () => `${prefix}-${++index}`;
};

test('P06-B exposes one frozen versioned SDK surface without canonical/session escape hatches', () => {
  const sdk = createScoreEditorSdkV1();
  assert.equal(sdk.version, '1.0.0');
  assert.equal(Object.isFrozen(sdk), true);
  assert.equal(Object.isFrozen(sdk.capabilities), true);
  assert.equal(sdk.capabilities, scoreEditorSdkCapabilitiesV1);
  assert.equal(sdk.capabilities.canonicalAuthority, false);
  assert.equal(sdk.capabilities.historyAuthority, 'EditorSessionV4');
  assert.equal(sdk.capabilities.semanticSelectionAuthority, 'SemanticAddressV3');
  assert.equal(sdk.capabilities.rendererCoordinateAuthority, false);
  assert.equal(sdk.capabilities.networkAuthority, false);
  assert.equal(sdk.capabilities.serverRevisionAuthority, false);
  assert.equal(sdk.capabilities.publicationAuthority, false);
  assert.equal(Object.hasOwn(sdk, 'getDocument'), false);
  assert.equal(Object.hasOwn(sdk, 'controller'), false);
  assert.equal(Object.hasOwn(sdk, 'session'), false);
});

test('P06-B negotiates optional capabilities independently instead of globally blocking editing', () => {
  const sdk = createScoreEditorSdkV1();
  assert.equal(sdk.supports('document'), true);
  assert.equal(sdk.supports('history'), true);
  assert.equal(sdk.supports('selection'), true);
  assert.equal(sdk.supports('authoring'), true);
  assert.equal(sdk.supports('renderer'), false);
  assert.equal(sdk.supports('files'), false);
  assert.equal(sdk.supports('recovery'), false);
  assert.equal(sdk.supports('playback'), false);
  assert.equal(sdk.supports('teacherWorkflow'), false);
  assert.equal(sdk.supports('audioAudition'), false);

  const renderer = sdk.requireCapability('renderer');
  assert.equal(renderer.ok, false);
  assert.equal(renderer.error.code, 'UNSUPPORTED_CAPABILITY');
  assert.equal(renderer.error.details.capability, 'renderer');

  const document = sdk.requireCapability('document');
  assert.deepEqual(document, { ok: true, value: true });

  const created = sdk.document.newDocument({ title: 'SDK capability test', preset: 'GUITAR_TREBLE', idFactory: ids('caps') });
  assert.equal(created.ok, true);
  assert.equal(sdk.getSnapshot().hasDocument, true);
});

test('P06-B exposes exact current document/revision identity and guards stale requests fail-closed', () => {
  const sdk = createScoreEditorSdkV1();
  const first = sdk.document.newDocument({ title: 'First', preset: 'GUITAR_TREBLE', idFactory: ids('first') });
  assert.equal(first.ok, true);
  const stale = sdk.getRevisionGuard();
  assert.ok(stale);

  const second = sdk.document.newDocument({ title: 'Second', preset: 'PIANO_GRAND_STAFF', idFactory: ids('second') });
  assert.equal(second.ok, true);
  const current = sdk.getRevisionGuard();
  assert.ok(current);
  assert.notEqual(current.documentId, stale.documentId);
  assert.notEqual(current.revisionId, stale.revisionId);

  const before = sdk.getSnapshot();
  const selection = sdk.selection.select(null, stale);
  assert.equal(selection.ok, false);
  assert.equal(selection.error.code, 'STALE_REQUEST');

  const undo = sdk.history.undo(stale);
  assert.equal(undo.ok, false);
  assert.equal(undo.error.code, 'STALE_REQUEST');

  const authoring = sdk.authoring.commitKeypad({
    expected: stale,
    action: { version: '1.0.0', actionId: 'duration.quarter' },
    nextRevisionId: 'rev:must-not-commit'
  });
  assert.equal(authoring.ok, false);
  assert.equal(authoring.error.code, 'STALE_REQUEST');

  assert.deepEqual(sdk.getRevisionGuard(), current);
  assert.deepEqual(sdk.getSnapshot(), before);
});

test('P06-B semantic selection is revision-guarded and presentation-only', () => {
  const sdk = createScoreEditorSdkV1();
  const created = sdk.document.newDocument({ title: 'Selection', idFactory: ids('selection') });
  assert.equal(created.ok, true);
  const expected = sdk.getRevisionGuard();
  assert.ok(expected);
  const before = sdk.getSnapshot();

  const selected = sdk.selection.select(null, expected);
  assert.equal(selected.ok, true);
  assert.deepEqual(sdk.getRevisionGuard(), expected);
  assert.equal(sdk.getSnapshot().revisionId, before.revisionId);
  assert.equal(sdk.getSnapshot().selectionKind, null);
});

test('P06-B current-revision export stays read-only and returns typed results', () => {
  const sdk = createScoreEditorSdkV1();
  sdk.document.newDocument({ title: 'Export', preset: 'GUITAR_TREBLE', idFactory: ids('export') });
  const expected = sdk.getRevisionGuard();
  assert.ok(expected);
  const before = sdk.getSnapshot();

  const exported = sdk.document.exportMusicXml(expected);
  assert.equal(exported.ok, true);
  assert.match(exported.value, /score-partwise/);
  assert.deepEqual(sdk.getRevisionGuard(), expected);
  assert.deepEqual(sdk.getSnapshot(), before);
});

test('P06-B SDK subscription can be detached without changing canonical history', () => {
  const sdk = createScoreEditorSdkV1();
  const observed = [];
  const unsubscribe = sdk.subscribe(value => observed.push(value));
  sdk.document.newDocument({ idFactory: ids('sub-a') });
  assert.equal(observed.length, 1);
  const firstRevision = observed[0].revisionId;
  unsubscribe();
  sdk.document.newDocument({ idFactory: ids('sub-b') });
  assert.equal(observed.length, 1);
  assert.equal(observed[0].revisionId, firstRevision);
});

test('P06-B authoring without a document fails closed before reaching mutation authority', () => {
  const sdk = createScoreEditorSdkV1();
  const result = sdk.authoring.commitKeypad({
    expected: { documentId: 'doc:none', revisionId: 'rev:none' },
    action: { version: '1.0.0', actionId: 'duration.quarter' },
    nextRevisionId: 'rev:no-document'
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'NO_DOCUMENT');
  assert.equal(sdk.getRevisionGuard(), null);
});
