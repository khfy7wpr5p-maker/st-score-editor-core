import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readJson = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));

test('P05-PILOT01 prepared session mirrors the declared task plan without fabricating human evidence', async () => {
  const plan = await readJson('corpus/p05-teacher-pilot-task-plan-v1.json');
  const session = await readJson('corpus/p05-teacher-pilot-session-template-v1.json');

  assert.equal(session.version, '1.0.0');
  assert.equal(session.kind, 'TEACHER_PILOT_SESSION');
  assert.equal(session.status, 'PREPARED');
  assert.equal(session.observerRole, 'TEACHER');
  assert.equal(session.sessionId, null);
  assert.equal(session.startedAt, null);
  assert.equal(session.completedAt, null);
  assert.equal(session.evidenceRef, null);
  assert.equal(session.teacherPilotPassClaim, false);
  assert.equal(session.physicalDevicePassClaim, false);
  assert.equal(session.productionReleaseAuthority, false);
  assert.equal(session.externalTrainingAuthority, false);
  assert.equal(session.deviceContext.physicalDeviceEvidenceClaim, false);

  assert.deepEqual(
    session.tasks.map(task => task.taskId),
    plan.tasks.map(task => task.id)
  );

  for (const task of session.tasks) {
    assert.equal(task.outcome, 'NOT_RUN');
    assert.equal(task.elapsedMs, null);
    assert.equal(task.canonicalCommitCount, null);
    assert.equal(task.undoCount, null);
    assert.equal(task.redoCount, null);
    assert.equal(task.taskCompleted, null);
    assert.equal(task.teacherAcceptedFinalResult, null);
    assert.equal(task.dataLossObserved, null);
    assert.equal(task.notes, null);
  }
});
