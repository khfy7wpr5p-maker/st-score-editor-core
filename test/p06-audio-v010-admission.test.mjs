import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import {
  SCORE_AUDIO_ENGINE_V010,
  auditionWithScoreAudioV010,
  createScoreAudioAuditionRequestV010,
  createScoreEditorSdkAudioCapabilityProbeV010
} from '../dist/packages/score-editor-sdk-v1/audio-v010.js';

const admission = fs.readFileSync('docs/p06-audio-v010-admission.md', 'utf8');
const adapter = fs.readFileSync('packages/score-editor-sdk-v1/audio-v010.ts', 'utf8');

const score = (revisionId = 'rev-audio-v010') => createScoreDocumentV3({
  schemaVersion: '3.0.0',
  id: 'doc-audio-v010',
  revision: { id: revisionId, parentId: null },
  source: { sha256: 'a'.repeat(64), format: 'synthetic', byteLength: null },
  measureFrames: [{ id: 'frame-1', ordinal: 1, displayNumber: '1' }],
  parts: [{
    id: 'part-1',
    ordinal: 1,
    name: 'Piano',
    instrument: { id: 'instrument-1', name: 'Piano', shortName: 'Pno.' },
    staves: [{
      id: 'staff-1',
      ordinal: 1,
      role: 'standard',
      measures: [{
        id: 'measure-1',
        frameId: 'frame-1',
        voices: [{
          id: 'voice-1',
          ordinal: 1,
          graceGroups: [],
          events: [
            {
              id: 'event-note',
              kind: 'note',
              onset: { numerator: 0, denominator: 1 },
              duration: { numerator: 1, denominator: 4 },
              note: { id: 'note-1', pitch: { step: 'C', alter: 1, octave: 4 } }
            },
            {
              id: 'event-rest',
              kind: 'rest',
              onset: { numerator: 1, denominator: 4 },
              duration: { numerator: 3, denominator: 4 }
            }
          ]
        }]
      }]
    }]
  }]
});

const runtime = ({ lifecycle = 'ACTIVE', sampleReadiness = 'QUALIFIED' } = {}) => ({
  supports: capability => capability === 'note-audition',
  unlockFromUserGesture: async () => ({ ok: true }),
  setInstrument: async () => undefined,
  getInstrumentProfile: instrumentId => ({
    id: instrumentId,
    displayName: instrumentId,
    lifecycle,
    sampleReadiness,
    pitchAuthority: 'CANONICAL_SOUNDING_PITCH',
    family: 'KEYBOARD',
    polyphonic: true,
    releaseSeconds: 0.12,
    articulationRoadmap: []
  }),
  audition: async request => ({ ok: true, requestId: request.requestId })
});

test('P06-F2 preserves the historical v0.1.0 admission identity', () => {
  assert.equal(SCORE_AUDIO_ENGINE_V010.release, 'v0.1.0');
  assert.equal(SCORE_AUDIO_ENGINE_V010.releaseCommit, 'd11a2dd9141169ddfec5901f3cadc4cce0d7b345');
  assert.equal(SCORE_AUDIO_ENGINE_V010.contractsPackage, '@st/score-audio-contracts@0.1.0');
  assert.equal(SCORE_AUDIO_ENGINE_V010.webPackage, '@st/score-audio-web@0.1.0');
  assert.match(admission, /@st\/score-audio-contracts@0\.1\.0/);
  assert.match(admission, /@st\/score-audio-web@0\.1\.0/);
});

test('P06-F2 adapter imports the official contract instead of redefining AuditionRequest', () => {
  assert.match(adapter, /import type \{ AuditionRequest, InstrumentId \} from '@st\/score-audio-contracts'/);
  assert.match(adapter, /import type \{ WebAudioEngine \} from '@st\/score-audio-web'/);
  assert.doesNotMatch(adapter, /interface ScoreAudioAuditionRequest/);
  assert.doesNotMatch(adapter, /interface AuditionRequest/);
  assert.doesNotMatch(adapter, /AudioContext/);
});

test('P06-F2 creates the official request shape from canonical score pitch and REST stays silent', () => {
  const value = score();
  const note = addressEntityV3(value, 'note-1');
  const request = createScoreAudioAuditionRequestV010(value, note, {
    requestId: 'p06-audio-1',
    instrumentId: 'GRAND_PIANO',
    durationMs: 300
  });
  assert.ok(request);
  assert.equal(request.pitch.midi, 61);
  assert.equal(request.sourceRevisionId, 'rev-audio-v010');
  assert.equal(request.sourceEventId, 'event-note');
  assert.equal(request.instrumentId, 'GRAND_PIANO');
  assert.equal(Object.isFrozen(request), true);
  assert.equal(createScoreAudioAuditionRequestV010(value, addressEntityV3(value, 'event-rest'), {
    requestId: 'rest',
    instrumentId: 'GRAND_PIANO'
  }), null);
});

test('P06-F2 stale revisions fail closed before runtime execution', async () => {
  const value = score('rev-old');
  const request = createScoreAudioAuditionRequestV010(value, addressEntityV3(value, 'note-1'), {
    requestId: 'stale',
    instrumentId: 'GRAND_PIANO'
  });
  let auditions = 0;
  const fake = runtime();
  fake.audition = async requestValue => {
    auditions += 1;
    return { ok: true, requestId: requestValue.requestId };
  };
  const result = await auditionWithScoreAudioV010({
    runtime: fake,
    request,
    getCurrentRevisionId: () => 'rev-new'
  });
  assert.equal(result.status, 'STALE_SOURCE_REVISION');
  assert.equal(auditions, 0);
});

test('P06-F2 only ACTIVE/QUALIFIED instruments audition and qualified piano plays', async () => {
  const value = score();
  const request = createScoreAudioAuditionRequestV010(value, addressEntityV3(value, 'note-1'), {
    requestId: 'qualified',
    instrumentId: 'GRAND_PIANO'
  });
  const suspended = await auditionWithScoreAudioV010({
    runtime: runtime({ lifecycle: 'SUSPENDED', sampleReadiness: 'SUSPENDED' }),
    request,
    getCurrentRevisionId: () => value.revision.id
  });
  assert.equal(suspended.status, 'INSTRUMENT_NOT_QUALIFIED');

  const played = await auditionWithScoreAudioV010({
    runtime: runtime(),
    request,
    getCurrentRevisionId: () => value.revision.id
  });
  assert.equal(played.status, 'PLAYED');
});

test('P06-F2 audio capability appears only when an admitted runtime is injected', () => {
  const baseSupports = capability => capability === 'document';
  const absent = createScoreEditorSdkAudioCapabilityProbeV010(baseSupports, null);
  assert.equal(absent.supports('audioAudition'), false);
  assert.equal(absent.supports('document'), true);
  const present = createScoreEditorSdkAudioCapabilityProbeV010(baseSupports, runtime());
  assert.equal(present.supports('audioAudition'), true);
  assert.equal(present.supports('document'), true);
});
