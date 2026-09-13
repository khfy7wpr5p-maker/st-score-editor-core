import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createTeacherPilotCorpusV1,
  summarizeTeacherPilotCorpusV1
} from '../dist/packages/editor-teacher-pilot-corpus-v1/src/index.js';

test('P05 baseline manifest separates automated evidence from pending teacher/device work', async () => {
  const raw = await readFile(new URL('../corpus/p05-teacher-pilot-baseline-v1.json', import.meta.url), 'utf8');
  const parsed = JSON.parse(raw);
  assert.equal(parsed.version, '1.0.0');
  assert.equal(parsed.kind, 'TEACHER_PILOT_CORPUS_INPUT');

  const corpus = createTeacherPilotCorpusV1(parsed.cases);
  const metrics = summarizeTeacherPilotCorpusV1(corpus);

  assert.equal(metrics.totalCases, 6);
  assert.deepEqual(metrics.outcomes, { PASS: 3, FAIL: 0, BLOCKED: 0, NOT_RUN: 3 });
  assert.equal(metrics.automatedCases, 3);
  assert.equal(metrics.teacherPilotCases, 1);
  assert.equal(metrics.physicalDeviceCases, 2);
  assert.equal(metrics.teacherPilotPasses, 0);
  assert.equal(metrics.physicalDevicePasses, 0);
  assert.equal(metrics.humanTeacherEvidenceAvailable, false);
  assert.equal(metrics.physicalDeviceEvidenceAvailable, false);
  assert.equal(metrics.externalTrainingAuthority, false);
  assert.equal(metrics.productionReleaseAuthority, false);

  const mobileTouch = metrics.capabilitySummaries.find(entry => entry.capability === 'mobile-touch');
  assert.deepEqual(mobileTouch, {
    capability: 'mobile-touch',
    total: 2,
    outcomes: { PASS: 0, FAIL: 0, BLOCKED: 0, NOT_RUN: 2 }
  });
});
