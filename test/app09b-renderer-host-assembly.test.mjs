import test from 'node:test';
import assert from 'node:assert/strict';

import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createRenderManifestV4 } from '../dist/packages/renderer-contract-v4/src/index.js';
import { rendererProfileForIntegration } from '../dist/packages/renderer-contract/src/index.js';
import {
  createExternalRendererHitFromScoreNoteRefV4,
  resolveRenderedScoreNoteRefTokenV4
} from '../dist/packages/editor-renderer-selection-bridge-v4/src/index.js';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createRendererHitEnabledStandaloneScoreEditorController } from '../dist/packages/score-editor-browser-app/src/renderer-hit-enabled.js';

const memoryStore = () => {
  const values = new Map();
  return Object.freeze({
    put: async record => { values.set(record.documentId, structuredClone(record)); },
    list: async () => [...values.values()].map(value => structuredClone(value)),
    delete: async documentId => { values.delete(documentId); },
    clear: async () => { values.clear(); }
  });
};
const idFactory = () => { let index = 0; return () => `app09b-${++index}`; };
const integrationProfile = rendererProfileForIntegration('st-score-rendering-layer');

const mappingScore = () => createScoreDocumentV3({
  schemaVersion: '3.0.0',
  id: 'doc-map',
  revision: { id: 'rev-map-1', parentId: null },
  source: { sha256: 'a'.repeat(64), format: 'synthetic', byteLength: null },
  measureFrames: [{ id: 'frame-1', ordinal: 1, displayNumber: '1' }],
  parts: [{
    id: 'part-1', ordinal: 1, name: 'Part',
    instrument: { id: 'instrument-1', name: 'Part', shortName: null },
    staves: [
      {
        id: 'staff-1', ordinal: 1, role: 'standard',
        measures: [{
          id: 'measure-1a', frameId: 'frame-1',
          voices: [
            {
              id: 'voice-1a', ordinal: 1,
              events: [
                { id: 'event-1', kind: 'note', onset: { numerator: 0, denominator: 1 }, duration: { numerator: 1, denominator: 4 }, note: { id: 'note-1', pitch: { step: 'C', alter: 0, octave: 4 } } },
                { id: 'event-2', kind: 'chord', onset: { numerator: 1, denominator: 4 }, duration: { numerator: 1, denominator: 4 }, notes: [
                  { id: 'note-2', pitch: { step: 'E', alter: 0, octave: 4 } },
                  { id: 'note-3', pitch: { step: 'G', alter: 0, octave: 4 } }
                ] },
                { id: 'event-3', kind: 'rest', onset: { numerator: 1, denominator: 2 }, duration: { numerator: 1, denominator: 4 } }
              ],
              graceGroups: []
            },
            {
              id: 'voice-2a', ordinal: 2,
              events: [{ id: 'event-4', kind: 'note', onset: { numerator: 0, denominator: 1 }, duration: { numerator: 1, denominator: 4 }, note: { id: 'note-5', pitch: { step: 'D', alter: 0, octave: 3 } } }],
              graceGroups: []
            }
          ]
        }]
      },
      {
        id: 'staff-2', ordinal: 2, role: 'standard',
        measures: [{
          id: 'measure-1b', frameId: 'frame-1',
          voices: [{
            id: 'voice-1b', ordinal: 1,
            events: [{ id: 'event-5', kind: 'note', onset: { numerator: 0, denominator: 1 }, duration: { numerator: 1, denominator: 4 }, note: { id: 'note-4', pitch: { step: 'C', alter: 0, octave: 5 } } }],
            graceGroups: []
          }]
        }]
      }
    ]
  }]
});

const requestFor = score => Object.freeze({
  contractVersion: '4.0.0',
  renderer: integrationProfile,
  documentId: score.id,
  revisionId: score.revision.id,
  projectionStatus: 'V3_COMPATIBLE_XML',
  sourceProjectionStatus: 'V2_COMPATIBLE_XML',
  musicXml: '<score-partwise/>',
  manifest: createRenderManifestV4(score)
});
const tokenFor = (request, noteId) => request.manifest.entries.find(entry => entry.address.kind === 'note' && entry.address.noteId === noteId)?.token;

test('APP-09B rendered ScoreNoteRef maps deterministically to current opaque V4 tokens and rests abstain', () => {
  const score = mappingScore();
  const request = requestFor(score);
  assert.equal(resolveRenderedScoreNoteRefTokenV4(score, request, { partId: 'P1', measureIndex: 0, noteIndex: 0, voice: 1 }), tokenFor(request, 'note-1'));
  assert.equal(resolveRenderedScoreNoteRefTokenV4(score, request, { partId: 'P1', measureIndex: 0, noteIndex: 1, voice: 1 }), tokenFor(request, 'note-2'));
  assert.equal(resolveRenderedScoreNoteRefTokenV4(score, request, { partId: 'P1', measureIndex: 0, noteIndex: 2, voice: 1 }), tokenFor(request, 'note-3'));
  assert.equal(resolveRenderedScoreNoteRefTokenV4(score, request, { partId: 'P1', measureIndex: 0, noteIndex: 3, voice: 1 }), null);
  assert.equal(resolveRenderedScoreNoteRefTokenV4(score, request, { partId: 'P1', measureIndex: 0, noteIndex: 4, voice: 1 }), tokenFor(request, 'note-4'));
  assert.equal(resolveRenderedScoreNoteRefTokenV4(score, request, { partId: 'P1', measureIndex: 0, noteIndex: 0, voice: 2 }), tokenFor(request, 'note-5'));
  assert.equal(resolveRenderedScoreNoteRefTokenV4(score, request, { partId: 'P1', measureIndex: 0, noteIndex: 4 }), tokenFor(request, 'note-5'));
  assert.equal(resolveRenderedScoreNoteRefTokenV4(score, request, { partId: 'P1', measureIndex: 0, noteIndex: 5 }), tokenFor(request, 'note-4'));
  assert.equal(resolveRenderedScoreNoteRefTokenV4(score, request, { partId: 'P99', measureIndex: 0, noteIndex: 0, voice: 1 }), null);
  const hit = createExternalRendererHitFromScoreNoteRefV4(score, request, { partId: 'P1', measureIndex: 0, noteIndex: 0, voice: 1 });
  assert.ok(hit);
  assert.equal(hit.opaqueHitToken, tokenFor(request, 'note-1'));
});

test('APP-09B browser renderer profile remains exact 2.1.2 across selection and renders through 2.1.2 host', async () => {
  const controller = createRendererHitEnabledStandaloneScoreEditorController({
    rendererProfile: integrationProfile,
    store: memoryStore(),
    autosaveDelayMs: 60_000,
    sha256Hex: async () => 'b'.repeat(64)
  });
  controller.newDocument({ title: 'APP09B', idFactory: idFactory() });
  assert.equal(controller.getDocument().session.renderRequest.renderer.packageVersion, '2.1.2');
  const score = controller.getDocument().session.history.present.score;
  controller.select(addressEntityV3(score, score.measureFrames[0].id));
  assert.equal(controller.getDocument().session.renderRequest.renderer.packageVersion, '2.1.2');

  const calls = { loads: 0, renders: 0 };
  controller.attachOsmdRenderer({
    packageName: 'opensheetmusicdisplay', packageVersion: '2.1.2', license: 'BSD-3-Clause',
    instance: {
      async load() { calls.loads += 1; },
      render() { calls.renders += 1; }
    }
  });
  const rendered = await controller.renderCurrent();
  assert.equal(rendered.status.code, 'RENDERED_CURRENT_REVISION');
  assert.equal(calls.loads, 1);
  assert.equal(calls.renders, 1);
  assert.equal(controller.getDocument().session.renderRequest.renderer.packageVersion, '2.1.2');
  controller.unmount();
});
