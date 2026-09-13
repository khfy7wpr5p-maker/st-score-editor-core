import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTeacherPilotCorpusV1,
  summarizeTeacherPilotCorpusV1
} from '../dist/packages/editor-teacher-pilot-corpus-v1/src/index.js';

const baseCase = (id, verification) => ({
  id,
  title: id,
  capabilities: ['teacher-pilot-evidence'],
  provenance: {
    sourceKind: 'REPOSITORY_FIXTURE',
    sourceRef: `test:${id}`,
    rightsStatus: 'REPOSITORY_OWNED',
    containsPersonalData: false,
    externalTrainingAuthorized: false
  },
  verification
});

test('P05 observed teacher FAIL counts as human evidence even without a PASS', () => {
  const corpus = createTeacherPilotCorpusV1([
    baseCase('teacher-fail-01', {
      level: 'TEACHER_PILOT',
      outcome: 'FAIL',
      observer: 'TEACHER',
      evidenceRef: 'pilot:teacher-fail-01',
      device: null
    })
  ]);
  const metrics = summarizeTeacherPilotCorpusV1(corpus);
  assert.equal(metrics.teacherPilotPasses, 0);
  assert.equal(metrics.humanTeacherEvidenceAvailable, true);
  assert.equal(metrics.productionReleaseAuthority, false);
});

test('P05 observed physical BLOCKED counts as device evidence even without a PASS', () => {
  const corpus = createTeacherPilotCorpusV1([
    baseCase('device-blocked-01', {
      level: 'PHYSICAL_DEVICE',
      outcome: 'BLOCKED',
      observer: 'DEVICE_TESTER',
      evidenceRef: 'pilot:device-blocked-01',
      device: {
        hardware: 'iPhone test device',
        platform: 'iOS',
        osVersion: 'recorded-by-pilot',
        browser: 'Safari',
        browserVersion: 'recorded-by-pilot'
      }
    })
  ]);
  const metrics = summarizeTeacherPilotCorpusV1(corpus);
  assert.equal(metrics.physicalDevicePasses, 0);
  assert.equal(metrics.physicalDeviceEvidenceAvailable, true);
  assert.equal(metrics.productionReleaseAuthority, false);
});
