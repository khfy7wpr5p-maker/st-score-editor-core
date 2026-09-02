import test from 'node:test';
import assert from 'node:assert/strict';
import { createScoreDocument, } from '../dist/packages/score-model/src/index.js';
import { emptyNotationDocument } from '../dist/packages/notation-structure/src/index.js';
import { createScoreDocumentV2 } from '../dist/packages/score-model-v2/src/index.js';
import { emptyNotationDocumentV2 } from '../dist/packages/notation-structure-v2/src/index.js';
import { addressEntityV2 } from '../dist/packages/addressing-v2/src/index.js';
import {
  createSesliTabEditorHostV2,
  createSesliTabEditorHostV2FromV1,
  createSesliTabHostSnapshotV2,
  selectSesliTabV2RenderToken,
  commitSesliTabArticulationIntentV2,
  navigateSesliTabHistoryV2,
  sesliTabEditorHostProfileV2
} from '../dist/packages/seslitab-editor-host-v2/src/index.js';

const v2Score = () => createScoreDocumentV2({
  schemaVersion: '2.0.0', id: 'doc-seslitab-v2', revision: { id: 'rev-1', parentId: null },
  source: { sha256: '8'.repeat(64), format: 'synthetic', byteLength: null },
  parts: [{ id: 'part-1', name: 'Part', staves: [{ id: 'staff-1', ordinal: 1, measures: [{
    id: 'measure-1', ordinal: 1, displayNumber: '1', voices: [{ id: 'voice-1', ordinal: 1,
      events: [{ id: 'event-1', kind: 'note', onset: { numerator: 0, denominator: 1 }, duration: { numerator: 1, denominator: 4 }, note: { id: 'note-1', pitch: { step: 'C', alter: 0, octave: 4 } } }],
      graceGroups: [{ id: 'grace-group-1', anchorEventId: 'event-1', placement: 'before', events: [{
        id: 'grace-event-1', kind: 'note', writtenDuration: { numerator: 1, denominator: 8 },
        playback: { stealTimePreviousPercent: null, stealTimeFollowingPercent: null, makeTime: null },
        note: { id: 'grace-note-1', pitch: { step: 'D', alter: 0, octave: 4 } }
      }] }]
    }]
  }]}]}]
});

const v1Score = () => createScoreDocument({
  schemaVersion: '1.0.0', id: 'doc-seslitab-v1', revision: { id: 'rev-v1', parentId: null },
  source: { sha256: '9'.repeat(64), format: 'synthetic', byteLength: null },
  parts: [{ id: 'part-1', name: 'Part', staves: [{ id: 'staff-1', ordinal: 1, measures: [{ id: 'measure-1', ordinal: 1, displayNumber: '1', voices: [{ id: 'voice-1', ordinal: 1, events: [{ id: 'event-1', kind: 'note', onset: { numerator: 0, denominator: 1 }, duration: { numerator: 1, denominator: 4 }, note: { id: 'note-1', pitch: { step: 'C', alter: 0, octave: 4 } } }] }] }] }] }]
});

const eventArticulations = (host) => host.session.history.present.notation.events.find((entry) => entry.target.eventId === 'event-1')?.notation.articulations ?? [];

test('SSE-07 SesliTab v2 host exposes one canonical v2 session and keeps renderer/host non-authoritative', () => {
  const score = v2Score();
  const host = createSesliTabEditorHostV2(score, emptyNotationDocumentV2(score));
  const snapshot = createSesliTabHostSnapshotV2(host);
  assert.equal(snapshot.documentId, score.id);
  assert.equal(snapshot.revisionId, score.revision.id);
  assert.equal(snapshot.renderRequest.projectionStatus, 'V2_SEMANTIC_XML');
  assert.equal(typeof snapshot.renderRequest.musicXml, 'string');
  assert.equal(snapshot.capabilities.canonicalStateCount, 1);
  assert.equal(sesliTabEditorHostProfileV2.hostDualWriteAllowed, false);
  assert.equal(sesliTabEditorHostProfileV2.rendererMutationAuthority, false);
  assert.equal(sesliTabEditorHostProfileV2.domCoordinateMutationAuthority, false);
  assert.equal(sesliTabEditorHostProfileV2.playbackOwnedByHost, true);
  assert.equal(sesliTabEditorHostProfileV2.editorAdmissionControlsPlayback, false);
  assert.equal(sesliTabEditorHostProfileV2.productionAuthority, false);
});

test('SSE-07 pointer keyboard and touch selection converge on the same opaque semantic token path', () => {
  for (const mode of ['pointer', 'keyboard', 'touch']) {
    const score = v2Score();
    const host = createSesliTabEditorHostV2(score, emptyNotationDocumentV2(score));
    const token = host.session.renderRequest.manifest.entries.find((entry) => entry.address.kind === 'grace-note')?.token;
    assert.ok(token);
    const selected = selectSesliTabV2RenderToken(host, token, mode);
    assert.equal(selected.ok, true);
    assert.equal(selected.host.lastInputMode, mode);
    assert.equal(selected.host.session.selection.primary.kind, 'grace-note');
    assert.equal(selected.host.session.selection.primary.graceNoteId, 'grace-note-1');
    assert.equal(selected.host.session.renderRequest.projectionStatus, 'V2_SEMANTIC_XML');
  }
});

test('SSE-07 v2 host commits notation through editor session and undo restores the exact prior pair', () => {
  const score = v2Score();
  let host = createSesliTabEditorHostV2(score, emptyNotationDocumentV2(score));
  const committed = commitSesliTabArticulationIntentV2(host, {
    version: '1.0.0', type: 'TOGGLE_ARTICULATION', target: addressEntityV2(score, 'event-1'),
    value: { kind: 'accent', placement: 'above', direction: null }
  }, { nextRevisionId: 'rev-2' }, 'touch');
  assert.equal(committed.ok, true);
  host = committed.host;
  assert.equal(host.session.history.present.score.revision.id, 'rev-2');
  assert.equal(eventArticulations(host)[0].kind, 'accent');
  assert.equal(host.session.renderRequest.projectionStatus, 'V2_SEMANTIC_XML');
  assert.match(host.session.renderRequest.musicXml, /<articulations>/);

  const undone = navigateSesliTabHistoryV2(host, 'UNDO', 'keyboard');
  assert.equal(undone.ok, true);
  assert.equal(undone.host.session.history.present.score.revision.id, 'rev-1');
  assert.equal(eventArticulations(undone.host).length, 0);
});

test('SSE-07 stale v2 semantic operations return typed host failure and cannot dual-write canonical state', () => {
  const score = v2Score();
  const stale = addressEntityV2(score, 'event-1');
  const host = createSesliTabEditorHostV2(score, emptyNotationDocumentV2(score));
  const first = commitSesliTabArticulationIntentV2(host, {
    version: '1.0.0', type: 'TOGGLE_ARTICULATION', target: stale,
    value: { kind: 'accent', placement: 'auto', direction: null }
  }, { nextRevisionId: 'rev-2' }, 'pointer');
  assert.equal(first.ok, true);
  const rejected = commitSesliTabArticulationIntentV2(first.host, {
    version: '1.0.0', type: 'TOGGLE_ARTICULATION', target: stale,
    value: { kind: 'tenuto', placement: 'auto', direction: null }
  }, { nextRevisionId: 'rev-3' }, 'touch');
  assert.equal(rejected.ok, false);
  assert.equal(rejected.error.code, 'STALE_TARGET');
  assert.equal(first.host.session.history.present.score.revision.id, 'rev-2');
});

test('SSE-07 v1 input migration remains one-time and keeps a v1-compatible renderer projection', () => {
  const score = v1Score();
  const host = createSesliTabEditorHostV2FromV1(score, emptyNotationDocument(score), 'osmd');
  assert.equal(host.session.history.present.score.schemaVersion, '2.0.0');
  assert.equal(host.session.renderRequest.projectionStatus, 'V1_COMPATIBLE_XML');
  assert.equal(typeof host.session.renderRequest.musicXml, 'string');
});
