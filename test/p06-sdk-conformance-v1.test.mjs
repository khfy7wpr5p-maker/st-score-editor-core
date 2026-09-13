import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  SCORE_EDITOR_SDK_NEGOTIATION_VERSION,
  SCORE_EDITOR_SDK_V1_VERSION,
  SUPPORTED_SCORE_EDITOR_SDK_VERSIONS_V1,
  negotiateScoreEditorSdkV1
} from '../dist/packages/score-editor-sdk-v1/public.js';

const ids = prefix => {
  let index = 0;
  return () => `${prefix}-${++index}`;
};

test('P06-E negotiates SDK 1.0.0 only when explicitly accepted', () => {
  const negotiated = negotiateScoreEditorSdkV1({
    version: SCORE_EDITOR_SDK_NEGOTIATION_VERSION,
    acceptedVersions: ['2.0.0', '1.0.0']
  });
  assert.equal(negotiated.ok, true);
  assert.equal(negotiated.value.selectedVersion, SCORE_EDITOR_SDK_V1_VERSION);
  assert.equal(negotiated.value.sdk.version, SCORE_EDITOR_SDK_V1_VERSION);
  assert.equal(negotiated.value.sdk.capabilities.canonicalAuthority, false);
});

test('P06-E incompatible SDK versions fail explicitly without silent fallback', () => {
  const negotiated = negotiateScoreEditorSdkV1({
    version: '1.0.0',
    acceptedVersions: ['2.0.0']
  });
  assert.equal(negotiated.ok, false);
  assert.equal(negotiated.error.code, 'INCOMPATIBLE_SDK_VERSION');
  assert.deepEqual(negotiated.error.acceptedVersions, ['2.0.0']);
  assert.deepEqual(negotiated.error.supportedVersions, ['1.0.0']);
});

test('P06-E malformed negotiation requests fail closed and supported versions are immutable', () => {
  assert.equal(Object.isFrozen(SUPPORTED_SCORE_EDITOR_SDK_VERSIONS_V1), true);
  assert.deepEqual(SUPPORTED_SCORE_EDITOR_SDK_VERSIONS_V1, ['1.0.0']);
  const empty = negotiateScoreEditorSdkV1({ version: '1.0.0', acceptedVersions: [] });
  assert.equal(empty.ok, false);
  assert.equal(empty.error.code, 'INVALID_VERSION_REQUEST');
  const wrongContract = negotiateScoreEditorSdkV1({ version: '0.0.0', acceptedVersions: ['1.0.0'] });
  assert.equal(wrongContract.ok, false);
  assert.equal(wrongContract.error.code, 'INVALID_VERSION_REQUEST');
});

test('P06-E semantic target enumeration is revision-bound and becomes stale after document replacement', () => {
  const negotiated = negotiateScoreEditorSdkV1({ version: '1.0.0', acceptedVersions: ['1.0.0'] });
  assert.equal(negotiated.ok, true);
  const sdk = negotiated.value.sdk;
  assert.equal(sdk.document.newDocument({ idFactory: ids('first') }).ok, true);
  const stale = sdk.getRevisionGuard();
  assert.ok(stale);
  const initialTargets = sdk.selection.listTargets(stale);
  assert.equal(initialTargets.ok, true);
  assert.ok(initialTargets.value.some(target => target.entityKind === 'event'));

  assert.equal(sdk.document.newDocument({ idFactory: ids('second') }).ok, true);
  const staleTargets = sdk.selection.listTargets(stale);
  assert.equal(staleTargets.ok, false);
  assert.equal(staleTargets.error.code, 'STALE_REQUEST');
});

test('P06-E neutral example consumes only the public SDK entry and no private product/internals', async () => {
  const source = await readFile(new URL('../examples/p06-generic-sdk-host.mjs', import.meta.url), 'utf8');
  assert.match(source, /score-editor-sdk-v1\/public\.js/);
  assert.doesNotMatch(source, /score-editor-sdk-v1\/src\//);
  assert.doesNotMatch(source, /score-editor-browser-app/);
  assert.doesNotMatch(source, /score-editor-app-document/);
  assert.doesNotMatch(source, /editor-session/);
  assert.doesNotMatch(source, /score-model/);
  assert.doesNotMatch(source, /seslitab/i);
});

test('P06-E public entry is narrow and exports source contract plus negotiation only', async () => {
  const source = await readFile(new URL('../packages/score-editor-sdk-v1/public.ts', import.meta.url), 'utf8');
  const lines = source.trim().split(/\r?\n/);
  assert.deepEqual(lines, [
    "export * from './src/index.js';",
    "export * from './version-negotiation.js';"
  ]);
});
