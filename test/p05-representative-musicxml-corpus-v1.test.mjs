import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import {
  areMusicSemanticsEquivalent,
  importMusicXml,
  serializeMusicXml
} from '../dist/packages/musicxml/src/index.js';
import {
  openMusicXmlScoreEditorAppDocument,
  commitAppTeacherPasteOverwrite,
  navigateAppDocumentHistory
} from '../dist/packages/score-editor-app-document/src/index.js';
import { createTeacherEventSpanSelectionV4 } from '../dist/packages/editor-teacher-event-span-v4/src/index.js';
import { createTeacherCopySnapshotV4 } from '../dist/packages/editor-teacher-copy-snapshot-v4/src/index.js';
import { analyzeTeacherPasteDestinationV4 } from '../dist/packages/editor-teacher-paste-admission-v4/src/index.js';
import { planTeacherPasteIdentitiesV4 } from '../dist/packages/editor-teacher-paste-identity-plan-v4/src/index.js';

const manifestPath = 'corpus/p05-representative-musicxml-v1.json';
const taskPlanPath = 'corpus/p05-teacher-pilot-task-plan-v1.json';
const byteLength = value => new TextEncoder().encode(value).byteLength;
const sha256 = async value => createHash('sha256').update(new TextEncoder().encode(value)).digest('hex');
const sourceFor = xml => ({ sha256: 'c'.repeat(64), format: 'musicxml', byteLength: byteLength(xml) });

const scoreFacts = score => {
  let staffCount = 0;
  let voiceCount = 0;
  let eventCount = 0;
  let noteCount = 0;
  let restCount = 0;
  let chordCount = 0;
  for (const part of score.parts) {
    for (const staff of part.staves) {
      if (staff.role === 'tablature-linked') continue;
      staffCount += 1;
      for (const measure of staff.measures) {
        for (const voice of measure.voices) {
          voiceCount += 1;
          for (const event of voice.events) {
            eventCount += 1;
            if (event.kind === 'rest') restCount += 1;
            if (event.kind === 'note') noteCount += 1;
            if (event.kind === 'chord') {
              chordCount += 1;
              noteCount += event.notes.length;
            }
          }
        }
      }
    }
  }
  return { partCount: score.parts.length, staffCount, voiceCount, eventCount, noteCount, restCount, chordCount };
};

const readJson = async path => JSON.parse(await readFile(path, 'utf8'));

const validateProvenance = fixture => {
  assert.equal(fixture.provenance.sourceKind, 'REPOSITORY_FIXTURE');
  assert.equal(fixture.provenance.rightsStatus, 'REPOSITORY_OWNED');
  assert.equal(fixture.provenance.containsPersonalData, false);
  assert.equal(fixture.provenance.externalTrainingAuthorized, false);
  assert.match(fixture.path, /^corpus\/fixtures\/p05-synthetic-[a-z-]+\.musicxml$/);
};

test('P05-CORPUS02 representative fixtures are repository-owned and structurally match their manifest', async () => {
  const manifest = await readJson(manifestPath);
  assert.equal(manifest.version, '1.0.0');
  assert.equal(manifest.kind, 'REPRESENTATIVE_MUSICXML_CORPUS');
  assert.equal(manifest.externalTrainingAuthority, false);
  assert.equal(manifest.productionReleaseAuthority, false);
  assert.equal(manifest.fixtures.length, 3);
  assert.equal(new Set(manifest.fixtures.map(entry => entry.id)).size, manifest.fixtures.length);
  assert.equal(new Set(manifest.fixtures.map(entry => entry.path)).size, manifest.fixtures.length);

  for (const fixture of manifest.fixtures) {
    validateProvenance(fixture);
    assert.ok(Array.isArray(fixture.capabilities) && fixture.capabilities.length > 0);
    assert.equal(new Set(fixture.capabilities).size, fixture.capabilities.length);
    const xml = await readFile(fixture.path, 'utf8');
    assert.match(xml, /<score-partwise version="4\.0">/);

    if (fixture.validationProfile === 'CANONICAL_ROUNDTRIP') {
      const first = importMusicXml(xml, { source: sourceFor(xml) });
      assert.deepEqual(scoreFacts(first), fixture.expected);
      const serialized = serializeMusicXml(first);
      const second = importMusicXml(serialized, { source: sourceFor(serialized) });
      assert.equal(areMusicSemanticsEquivalent(first, second), true);
      continue;
    }

    assert.equal(fixture.validationProfile, 'TEACHER_COPY_PASTE_UNDO');
    const document = await openMusicXmlScoreEditorAppDocument(xml, {
      documentId: `doc:${fixture.id}`,
      revisionId: `rev:${fixture.id}:saved`,
      title: fixture.title,
      sha256Hex: sha256
    });
    assert.deepEqual(scoreFacts(document.session.history.present.score), fixture.expected);
    assert.equal(document.dirty, false);

    const before = structuredClone(document.session.history.present);
    const score = document.session.history.present.score;
    const notation = document.session.history.present.notation;
    const staff = score.parts[0].staves.find(candidate => candidate.role === 'standard');
    assert.ok(staff);
    const voice = staff.measures[0].voices[0];
    assert.equal(voice.events.length, 3);
    assert.notEqual(voice.events[0].kind, 'rest');
    assert.notEqual(voice.events[1].kind, 'rest');
    assert.equal(voice.events[2].kind, 'rest');

    const selection = createTeacherEventSpanSelectionV4(
      score,
      addressEntityV3(score, voice.events[0].id),
      addressEntityV3(score, voice.events[1].id)
    );
    const snapshot = createTeacherCopySnapshotV4(score, notation, selection);
    const admission = analyzeTeacherPasteDestinationV4(
      score,
      notation,
      snapshot,
      addressEntityV3(score, voice.events[2].id)
    );
    const nextRevisionId = `rev:${fixture.id}:pasted`;
    const identities = planTeacherPasteIdentitiesV4(score, notation, snapshot, admission, nextRevisionId);
    const pasted = commitAppTeacherPasteOverwrite(document, snapshot, admission, identities);
    assert.equal(pasted.session.history.present.score.revision.id, nextRevisionId);
    assert.equal(pasted.session.history.past.length, 1);
    assert.equal(pasted.dirty, true);

    const undone = navigateAppDocumentHistory(pasted, 'UNDO');
    assert.deepEqual(undone.session.history.present, before);
    assert.equal(undone.dirty, false);
  }
});

test('P05-CORPUS02 teacher task plan references the corpus and contains no fabricated pilot results', async () => {
  const manifest = await readJson(manifestPath);
  const plan = await readJson(taskPlanPath);
  const fixtures = new Map(manifest.fixtures.map(entry => [entry.id, entry]));
  const knownMetrics = new Set([
    'elapsedMs',
    'canonicalCommitCount',
    'undoCount',
    'redoCount',
    'taskCompleted',
    'teacherAcceptedFinalResult',
    'dataLossObserved'
  ]);

  assert.equal(plan.version, '1.0.0');
  assert.equal(plan.kind, 'TEACHER_PILOT_TASK_PLAN');
  assert.equal(plan.teacherPilotPassClaim, false);
  assert.equal(plan.physicalDevicePassClaim, false);
  assert.equal(plan.productionReleaseAuthority, false);
  assert.equal(plan.tasks.length, 3);
  assert.equal(new Set(plan.tasks.map(task => task.id)).size, plan.tasks.length);

  for (const task of plan.tasks) {
    const fixture = fixtures.get(task.fixtureId);
    assert.ok(fixture, `missing fixture for ${task.id}`);
    assert.ok(task.requiredCapabilities.length > 0);
    for (const capability of task.requiredCapabilities) {
      assert.ok(fixture.capabilities.includes(capability), `${task.id} requires undeclared fixture capability ${capability}`);
    }
    assert.ok(task.acceptanceCriteria.length > 0);
    assert.equal(new Set(task.acceptanceCriteria).size, task.acceptanceCriteria.length);
    assert.ok(task.requestedMetrics.length > 0);
    for (const metric of task.requestedMetrics) assert.ok(knownMetrics.has(metric));

    assert.deepEqual(task.verification, {
      level: 'TEACHER_PILOT',
      outcome: 'NOT_RUN',
      observer: 'NONE',
      evidenceRef: null
    });
    for (const value of Object.values(task.results)) assert.equal(value, null);
  }
});
