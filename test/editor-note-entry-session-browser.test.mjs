import test from 'node:test';
import assert from 'node:assert/strict';

import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { emptyNotationDocument } from '../dist/packages/notation-structure/src/index.js';
import {
  createEditorSession,
  selectSessionRenderToken,
  commitSessionNoteEntry,
  navigateSessionHistory
} from '../dist/packages/editor-session-controller/src/index.js';
import { createBrowserRuntime } from '../dist/packages/browser-runtime/src/index.js';

const scoreInput = () => ({
  schemaVersion: '1.0.0',
  id: 'doc-note-entry-browser',
  revision: { id: 'rev-1', parentId: null },
  source: { sha256: 'c'.repeat(64), format: 'synthetic', byteLength: null },
  parts: [{
    id: 'part-1', name: 'Piano', staves: [{
      id: 'staff-1', ordinal: 1, measures: [{
        id: 'measure-1', ordinal: 1, displayNumber: '1', voices: [{
          id: 'voice-1', ordinal: 1, events: [
            {
              id: 'event-note', kind: 'note',
              onset: { numerator: 0, denominator: 1 },
              duration: { numerator: 1, denominator: 2 },
              note: { id: 'note-existing', pitch: { step: 'C', alter: 0, octave: 4 } }
            },
            {
              id: 'event-rest', kind: 'rest',
              onset: { numerator: 1, denominator: 2 },
              duration: { numerator: 1, denominator: 2 }
            }
          ]
        }]
      }]
    }]
  }]
});

const noteEntry = (duration = { numerator: 1, denominator: 4 }, remainderEventId = 'event-rest-tail') => ({
  version: '1.0.0',
  type: 'ENTER_NOTE_IN_REST',
  noteId: 'note-entered',
  pitch: { step: 'E', alter: -1, octave: 4 },
  duration,
  remainderEventId
});

const identity = (nextRevisionId = 'rev-2') => ({
  operationId: `entry-${nextRevisionId}`,
  nextRevisionId
});

const restToken = (session) => session.renderRequest.manifest.entries.find(
  (entry) => entry.address.kind === 'event' && entry.address.eventId === 'event-rest'
)?.token;

const events = (session) => session.history.present.score.parts[0].staves[0].measures[0].voices[0].events;

test('session note entry commits score+notation history, refreshes render revision, and rebinds exact event selection', () => {
  const score = createScoreDocument(scoreInput());
  let session = createEditorSession(score, emptyNotationDocument(score), 'osmd');
  const token = restToken(session);
  assert.ok(token);
  session = selectSessionRenderToken(session, token);
  assert.equal(session.selection?.primary?.kind, 'event');
  assert.equal(session.selection?.primary?.eventId, 'event-rest');

  session = commitSessionNoteEntry(session, noteEntry(), identity());

  assert.equal(session.history.present.score.revision.id, 'rev-2');
  assert.equal(session.history.present.notation.revisionId, 'rev-2');
  assert.equal(session.renderRequest.revisionId, 'rev-2');
  assert.equal(session.renderRequest.manifest.revisionId, 'rev-2');
  assert.equal(session.status.code, 'NOTE_ENTRY_COMMITTED');

  const result = events(session);
  assert.equal(result.length, 3);
  assert.equal(result[1].id, 'event-rest');
  assert.equal(result[1].kind, 'note');
  assert.equal(result[1].note.id, 'note-entered');
  assert.deepEqual(result[1].note.pitch, { step: 'E', alter: -1, octave: 4 });
  assert.deepEqual(result[1].duration, { numerator: 1, denominator: 4 });
  assert.equal(result[2].id, 'event-rest-tail');
  assert.equal(result[2].kind, 'rest');
  assert.deepEqual(result[2].onset, { numerator: 3, denominator: 4 });
  assert.deepEqual(result[2].duration, { numerator: 1, denominator: 4 });

  assert.equal(session.selection?.revisionId, 'rev-2');
  assert.equal(session.selection?.primary?.kind, 'event');
  assert.equal(session.selection?.primary?.eventId, 'event-rest');
  assert.equal(session.inspector?.targetKind, 'event');
});

test('undo after note entry restores the original rest and clears selection safely', () => {
  const score = createScoreDocument(scoreInput());
  let session = createEditorSession(score, emptyNotationDocument(score), 'osmd');
  const token = restToken(session);
  assert.ok(token);
  session = selectSessionRenderToken(session, token);
  session = commitSessionNoteEntry(session, noteEntry({ numerator: 1, denominator: 2 }, null), identity());
  assert.equal(events(session)[1].kind, 'note');

  session = navigateSessionHistory(session, 'UNDO');

  assert.equal(session.history.present.score.revision.id, 'rev-1');
  assert.equal(events(session).length, 2);
  assert.equal(events(session)[1].id, 'event-rest');
  assert.equal(events(session)[1].kind, 'rest');
  assert.equal(session.renderRequest.revisionId, 'rev-1');
  assert.equal(session.selection, null);
  assert.equal(session.inspector, null);
});

test('browser runtime exposes bounded local note entry and returns typed failure instead of throwing', () => {
  const runtime = createBrowserRuntime();
  assert.equal(runtime.profile.noteEntryAvailable, true);
  assert.equal(runtime.profile.noteEntryRestTargetOnly, true);
  assert.equal(typeof runtime.commitNoteEntry, 'function');

  const score = runtime.createScoreDocument(scoreInput());
  let session = runtime.createEditorSession(score, runtime.emptyNotationDocument(score), 'osmd');
  const token = restToken(session);
  assert.ok(token);
  session = runtime.selectSessionRenderToken(session, token);

  const committed = runtime.commitNoteEntry(session, noteEntry(), identity('browser-rev-2'));
  assert.equal(committed.ok, true);
  if (committed.ok) {
    assert.equal(committed.session.history.present.score.revision.id, 'browser-rev-2');
    assert.equal(committed.session.renderRequest.revisionId, 'browser-rev-2');
  }

  const rejected = runtime.commitNoteEntry(
    session,
    { ...noteEntry(), duration: { numerator: 3, denominator: 4 } },
    identity('browser-rev-bad')
  );
  assert.equal(rejected.ok, false);
  if (!rejected.ok) {
    assert.equal(rejected.error.version, '1.0.0');
    assert.equal(rejected.error.code, 'DURATION_EXCEEDS_REST');
  }
  assert.equal(session.history.present.score.revision.id, 'rev-1');
  assert.equal(events(session)[1].kind, 'rest');
});
