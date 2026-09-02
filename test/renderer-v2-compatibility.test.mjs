import test from 'node:test';
import assert from 'node:assert/strict';
import { createScoreDocumentV2 } from '../dist/packages/score-model-v2/src/index.js';
import { createNotationDocumentV2, emptyNotationDocumentV2 } from '../dist/packages/notation-structure-v2/src/index.js';
import { addressEntityV2 } from '../dist/packages/addressing-v2/src/index.js';
import { rendererProfileForIntegration } from '../dist/packages/renderer-contract/src/index.js';
import { createRendererRequestV2, createRendererRequestV2WithProfile, renderableMusicXmlV2, RendererContractV2Error } from '../dist/packages/renderer-contract-v2/src/index.js';
import { renderWithOsmdV2, OsmdAdapterError } from '../dist/packages/renderer-osmd/src/index.js';
import { renderWithAlphaTabV2, AlphaTabAdapterError } from '../dist/packages/renderer-alphatab/src/index.js';

const raw = (previous = null) => ({
  schemaVersion: '2.0.0', id: 'doc-render-v2', revision: { id: 'rev-1', parentId: null },
  source: { sha256: '7'.repeat(64), format: 'synthetic', byteLength: null },
  parts: [{ id: 'part-1', name: 'Part', staves: [{ id: 'staff-1', ordinal: 1, measures: [{
    id: 'measure-1', ordinal: 1, displayNumber: '1', voices: [{ id: 'voice-1', ordinal: 1,
      events: [{ id: 'event-1', kind: 'note', onset: { numerator: 0, denominator: 1 }, duration: { numerator: 1, denominator: 4 }, note: { id: 'note-1', pitch: { step: 'C', alter: 0, octave: 4 } } }],
      graceGroups: [{ id: 'grace-group-1', anchorEventId: 'event-1', placement: 'before', events: [{
        id: 'grace-event-1', kind: 'note', writtenDuration: { numerator: 1, denominator: 8 },
        playback: { stealTimePreviousPercent: previous, stealTimeFollowingPercent: null, makeTime: null },
        note: { id: 'grace-note-1', pitch: { step: 'D', alter: 0, octave: 4 } }
      }] }]
    }]
  }]}]}]
});

const pair = () => {
  const score = createScoreDocumentV2(raw());
  const notation = createNotationDocumentV2(score, {
    contractVersion: '2.0.0', documentId: score.id, revisionId: score.revision.id,
    measures: [], notes: [], graceNotes: [],
    events: [{ target: addressEntityV2(score, 'event-1'), notation: { dots: 0, beams: [], tuplet: null, articulations: [{ kind: 'accent', placement: 'above', direction: null }], ornaments: [] } }],
    graceEvents: [{ target: addressEntityV2(score, 'grace-event-1'), notation: { slash: true, dots: 0, beams: [], articulations: [], ornaments: [{ kind: 'turn', placement: 'above', accidentalMarks: [] }] } }]
  });
  return { score, notation };
};

test('SSE-07 representable v2-only pairs emit V2_SEMANTIC_XML while v1-compatible pairs keep the v1 projection', () => {
  const { score, notation } = pair();
  const request = createRendererRequestV2(score, notation, 'osmd');
  assert.equal(request.projectionStatus, 'V2_SEMANTIC_XML');
  assert.equal(typeof request.musicXml, 'string');
  assert.match(request.musicXml, /<grace/);
  assert.match(request.musicXml, /<articulations>/);
  assert.match(request.musicXml, /<ornaments>/);
  assert.equal(renderableMusicXmlV2(request), request.musicXml);

  const cleanScore = createScoreDocumentV2({ ...raw(), parts: raw().parts.map((part) => ({ ...part, staves: part.staves.map((staff) => ({ ...staff, measures: staff.measures.map((measure) => ({ ...measure, voices: measure.voices.map((voice) => ({ ...voice, graceGroups: [] })) })) })) })) });
  const clean = createRendererRequestV2(cleanScore, emptyNotationDocumentV2(cleanScore), 'osmd');
  assert.equal(clean.projectionStatus, 'V1_COMPATIBLE_XML');
  assert.equal(typeof clean.musicXml, 'string');
});

test('SSE-07 ST Rendering Layer exact profile receives the same bounded v2 semantic XML contract', () => {
  const { score, notation } = pair();
  const request = createRendererRequestV2WithProfile(score, notation, rendererProfileForIntegration('st-score-rendering-layer'));
  assert.equal(request.renderer.packageVersion, '2.1.2');
  assert.equal(request.projectionStatus, 'V2_SEMANTIC_XML');
  assert.match(request.musicXml, /<grace/);
});

test('SSE-07 OSMD and alphaTab v2 adapters consume renderable v2 requests without mutation authority', async () => {
  const { score, notation } = pair();
  let loadedXml = null;
  let rendered = 0;
  const osmd = {
    packageName: 'opensheetmusicdisplay', packageVersion: '2.1.1', license: 'BSD-3-Clause',
    instance: { load: async (xml) => { loadedXml = xml; }, render: () => { rendered += 1; } }
  };
  const osmdRequest = createRendererRequestV2(score, notation, 'osmd');
  const osmdResult = await renderWithOsmdV2(osmd, osmdRequest);
  assert.equal(osmdResult.rendered, true);
  assert.equal(loadedXml, osmdRequest.musicXml);
  assert.equal(rendered, 1);

  let loadedBytes = null;
  const alpha = {
    packageName: '@coderline/alphatab', packageVersion: '1.8.4', license: 'MPL-2.0',
    api: { load: (bytes) => { loadedBytes = bytes; return true; } }
  };
  const alphaRequest = createRendererRequestV2(score, notation, 'alphatab');
  const alphaResult = renderWithAlphaTabV2(alpha, alphaRequest);
  assert.equal(alphaResult.accepted, true);
  assert.equal(new TextDecoder().decode(loadedBytes), alphaRequest.musicXml);
});

test('SSE-07 unrepresentable v2 projection stays pending and adapters fail closed', async () => {
  const score = createScoreDocumentV2(raw({ numerator: 5, denominator: 1 }));
  const notation = emptyNotationDocumentV2(score);
  const osmdRequest = createRendererRequestV2(score, notation, 'osmd');
  assert.equal(osmdRequest.projectionStatus, 'VNEXT_XML_PENDING');
  assert.equal(osmdRequest.musicXml, null);
  assert.throws(() => renderableMusicXmlV2(osmdRequest), (error) => error instanceof RendererContractV2Error && error.code === 'INVALID_RENDER_REQUEST');

  const osmd = { packageName: 'opensheetmusicdisplay', packageVersion: '2.1.1', license: 'BSD-3-Clause', instance: { load: async () => {}, render: () => {} } };
  await assert.rejects(() => renderWithOsmdV2(osmd, osmdRequest), (error) => error instanceof OsmdAdapterError && error.code === 'UNRENDERABLE_V2_REQUEST');

  const alphaRequest = createRendererRequestV2(score, notation, 'alphatab');
  const alpha = { packageName: '@coderline/alphatab', packageVersion: '1.8.4', license: 'MPL-2.0', api: { load: () => true } };
  assert.throws(() => renderWithAlphaTabV2(alpha, alphaRequest), (error) => error instanceof AlphaTabAdapterError && error.code === 'UNRENDERABLE_V2_REQUEST');
});
