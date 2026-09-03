import test from 'node:test';
import assert from 'node:assert/strict';

import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { emptyNotationDocument } from '../dist/packages/notation-structure/src/index.js';
import {
  RendererContractError,
  createRendererRequest,
  createRendererRequestWithProfile,
  rendererProfileForIntegration,
  resolveRenderToken
} from '../dist/packages/renderer-contract/src/index.js';
import { OsmdAdapterError, renderWithOsmd } from '../dist/packages/renderer-osmd/src/index.js';
import { AlphaTabAdapterError, renderWithAlphaTab } from '../dist/packages/renderer-alphatab/src/index.js';

const makeScore = (revisionId = 'rev-1') => createScoreDocument({
  schemaVersion: '1.0.0',
  id: 'doc-1',
  revision: { id: revisionId, parentId: revisionId === 'rev-1' ? null : 'rev-1' },
  source: { sha256: 'a'.repeat(64), format: 'canonical', byteLength: null },
  parts: [{
    id: 'part-1',
    name: 'Piano',
    staves: [{
      id: 'staff-1', ordinal: 1,
      measures: [{
        id: 'measure-1', ordinal: 1, displayNumber: '1',
        voices: [{
          id: 'voice-1', ordinal: 1,
          events: [{
            id: 'event-1', kind: 'note', onset: { numerator: 0, denominator: 1 }, duration: { numerator: 1, denominator: 4 },
            note: { id: 'note-1', pitch: { step: 'C', alter: 0, octave: 4 } }
          }]
        }]
      }]
    }]
  }]
});

const requestFor = (family, score = makeScore()) => createRendererRequest(score, emptyNotationDocument(score), family);
const renderingLayerRequest = (score = makeScore()) => createRendererRequestWithProfile(
  score,
  emptyNotationDocument(score),
  rendererProfileForIntegration('st-score-rendering-layer')
);

test('render manifest uses opaque unique tokens bound to semantic revision addresses', () => {
  const score = makeScore();
  const request = requestFor('osmd', score);
  const tokens = request.manifest.entries.map((entry) => entry.token);
  assert.equal(new Set(tokens).size, tokens.length);
  assert.ok(tokens.every((token) => /^stse-r1-[0-9a-z]+$/.test(token)));
  assert.ok(tokens.every((token) => !token.includes('note-1') && !token.includes('event-1')));
  const noteEntry = request.manifest.entries.find((entry) => entry.address.kind === 'note');
  assert.ok(noteEntry);
  const address = resolveRenderToken(score, request, noteEntry.token);
  assert.equal(address.kind, 'note');
  assert.equal(address.noteId, 'note-1');
});

test('unknown hit token and stale render request fail closed', () => {
  const oldScore = makeScore('rev-1');
  const request = requestFor('osmd', oldScore);
  assert.throws(
    () => resolveRenderToken(oldScore, request, 'stse-r1-does-not-exist'),
    (error) => error instanceof RendererContractError && error.code === 'UNKNOWN_RENDER_TOKEN'
  );
  const newScore = makeScore('rev-2');
  const validToken = request.manifest.entries[0].token;
  assert.throws(
    () => resolveRenderToken(newScore, request, validToken),
    (error) => error instanceof RendererContractError && error.code === 'STALE_RENDER_REQUEST'
  );
});

test('OSMD host adapter loads canonical MusicXML then renders without mutation authority', async () => {
  const request = requestFor('osmd');
  const calls = [];
  const host = {
    packageName: 'opensheetmusicdisplay', packageVersion: '2.1.1', license: 'BSD-3-Clause',
    instance: {
      async load(xml) { calls.push(['load', xml]); },
      render() { calls.push(['render']); }
    }
  };
  const session = await renderWithOsmd(host, request);
  assert.equal(session.rendered, true);
  assert.equal(session.revisionId, 'rev-1');
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], 'load');
  assert.ok(calls[0][1].includes('<score-partwise'));
  assert.deepEqual(calls[1], ['render']);
  assert.equal(Object.prototype.hasOwnProperty.call(session, 'mutate'), false);
});

test('OSMD 2.1.2 ST Rendering Layer host is admitted only with the exact 2.1.2 request profile', async () => {
  const calls = [];
  const host = {
    packageName: 'opensheetmusicdisplay', packageVersion: '2.1.2', license: 'BSD-3-Clause',
    instance: {
      async load(xml) { calls.push(['load', xml]); },
      render() { calls.push(['render']); }
    }
  };
  const request = renderingLayerRequest();
  const session = await renderWithOsmd(host, request);
  assert.equal(session.rendered, true);
  assert.equal(request.renderer.packageVersion, '2.1.2');
  assert.equal(calls.length, 2);

  await assert.rejects(
    () => renderWithOsmd(host, requestFor('osmd')),
    (error) => error instanceof OsmdAdapterError && error.code === 'INVALID_OSMD_HOST'
  );
});

test('OSMD rejects a host version outside the admitted profiles', async () => {
  const request = requestFor('osmd');
  const host = {
    packageName: 'opensheetmusicdisplay', packageVersion: '2.1.3', license: 'BSD-3-Clause',
    instance: { async load() {}, render() {} }
  };
  await assert.rejects(
    () => renderWithOsmd(host, request),
    (error) => error instanceof OsmdAdapterError && error.code === 'INVALID_OSMD_HOST'
  );
});

test('alphaTab host adapter sends UTF-8 MusicXML bytes to exact 1.8.4 load surface', () => {
  const request = requestFor('alphatab');
  let received = null;
  const host = {
    packageName: '@coderline/alphatab', packageVersion: '1.8.4', license: 'MPL-2.0',
    api: {
      load(bytes) { received = bytes; return true; }
    }
  };
  const session = renderWithAlphaTab(host, request);
  assert.equal(session.accepted, true);
  assert.ok(received instanceof Uint8Array);
  assert.ok(new TextDecoder().decode(received).includes('<score-partwise'));
  assert.equal(Object.prototype.hasOwnProperty.call(session, 'mutate'), false);
});

test('alphaTab load rejection and wrong-family request fail closed', () => {
  const alphaHost = {
    packageName: '@coderline/alphatab', packageVersion: '1.8.4', license: 'MPL-2.0',
    api: { load() { return false; } }
  };
  assert.throws(
    () => renderWithAlphaTab(alphaHost, requestFor('alphatab')),
    (error) => error instanceof AlphaTabAdapterError && error.code === 'ALPHATAB_LOAD_REJECTED'
  );
  assert.throws(
    () => renderWithAlphaTab({ ...alphaHost, api: { load() { return true; } } }, requestFor('osmd')),
    (error) => error instanceof AlphaTabAdapterError && error.code === 'WRONG_RENDERER_FAMILY'
  );
});
