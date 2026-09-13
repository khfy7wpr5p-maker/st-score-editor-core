import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTeacherPilotCorpusV1,
  summarizeTeacherPilotCorpusV1,
  TeacherPilotCorpusV1Error
} from '../dist/packages/editor-teacher-pilot-corpus-v1/src/index.js';

const automatedCase = (overrides = {}) => ({
  id: 'fixture-open-01',
  title: 'Text MusicXML open remains available',
  capabilities: ['musicxml-open', 'file-isolation'],
  provenance: {
    sourceKind: 'REPOSITORY_FIXTURE',
    sourceRef: 'test:p04-file-open-fixture',
    rightsStatus: 'REPOSITORY_OWNED',
    containsPersonalData: false,
    externalTrainingAuthorized: false
  },
  verification: {
    level: 'AUTOMATED',
    outcome: 'PASS',
    observer: 'AUTOMATION',
    evidenceRef: 'ci:test:p04-file-open-fixture',
    device: null
  },
  ...overrides
});

test('P05-CORPUS01 keeps automated, teacher and physical-device evidence separate', () => {
  const corpus = createTeacherPilotCorpusV1([
    automatedCase(),
    {
      ...automatedCase({ id: 'teacher-pilot-01', title: 'Teacher copy/paste pilot' }),
      capabilities: ['teacher-copy-paste'],
      verification: {
        level: 'TEACHER_PILOT',
        outcome: 'NOT_RUN',
        observer: 'NONE',
        evidenceRef: null,
        device: null
      }
    },
    {
      ...automatedCase({ id: 'device-safari-01', title: 'Physical iPhone Safari pilot' }),
      capabilities: ['mobile-touch', 'viewport'],
      verification: {
        level: 'PHYSICAL_DEVICE',
        outcome: 'NOT_RUN',
        observer: 'NONE',
        evidenceRef: null,
        device: null
      }
    }
  ]);

  const metrics = summarizeTeacherPilotCorpusV1(corpus);
  assert.equal(corpus.caseCount, 3);
  assert.deepEqual(metrics.outcomes, { PASS: 1, FAIL: 0, BLOCKED: 0, NOT_RUN: 2 });
  assert.equal(metrics.automatedCases, 1);
  assert.equal(metrics.teacherPilotCases, 1);
  assert.equal(metrics.physicalDeviceCases, 1);
  assert.equal(metrics.teacherPilotPasses, 0);
  assert.equal(metrics.physicalDevicePasses, 0);
  assert.equal(metrics.humanTeacherEvidenceAvailable, false);
  assert.equal(metrics.physicalDeviceEvidenceAvailable, false);
  assert.equal(metrics.productionReleaseAuthority, false);
  assert.equal(metrics.externalTrainingAuthority, false);
  assert.deepEqual(
    metrics.capabilitySummaries.map(entry => entry.capability),
    ['file-isolation', 'mobile-touch', 'musicxml-open', 'teacher-copy-paste', 'viewport']
  );
  assert.equal(Object.isFrozen(corpus), true);
  assert.equal(Object.isFrozen(corpus.cases), true);
  assert.equal(Object.isFrozen(metrics.capabilitySummaries), true);
});

test('P05-CORPUS01 accepts explicit physical-device evidence without granting release authority', () => {
  const physical = {
    ...automatedCase({ id: 'device-real-01', title: 'Observed physical-device check' }),
    capabilities: ['mobile-touch'],
    verification: {
      level: 'PHYSICAL_DEVICE',
      outcome: 'PASS',
      observer: 'DEVICE_TESTER',
      evidenceRef: 'pilot-session:device-real-01',
      device: {
        hardware: 'iPhone test device',
        platform: 'iOS',
        osVersion: 'recorded-by-pilot',
        browser: 'Safari',
        browserVersion: 'recorded-by-pilot'
      }
    }
  };
  const metrics = summarizeTeacherPilotCorpusV1(createTeacherPilotCorpusV1([physical]));
  assert.equal(metrics.physicalDevicePasses, 1);
  assert.equal(metrics.physicalDeviceEvidenceAvailable, true);
  assert.equal(metrics.productionReleaseAuthority, false);
});

test('P05-CORPUS01 rejects physical PASS without physical-device evidence', () => {
  const invalid = {
    ...automatedCase({ id: 'device-fake-01' }),
    verification: {
      level: 'PHYSICAL_DEVICE',
      outcome: 'PASS',
      observer: 'AUTOMATION',
      evidenceRef: 'ci:webkit-emulation',
      device: null
    }
  };
  assert.throws(
    () => createTeacherPilotCorpusV1([invalid]),
    error => error instanceof TeacherPilotCorpusV1Error && error.code === 'PHYSICAL_DEVICE_EVIDENCE_REQUIRED'
  );
});

test('P05-CORPUS01 rejects teacher PASS produced by automation', () => {
  const invalid = {
    ...automatedCase({ id: 'teacher-fake-01' }),
    verification: {
      level: 'TEACHER_PILOT',
      outcome: 'PASS',
      observer: 'AUTOMATION',
      evidenceRef: 'ci:teacher-emulation',
      device: null
    }
  };
  assert.throws(
    () => createTeacherPilotCorpusV1([invalid]),
    error => error instanceof TeacherPilotCorpusV1Error && error.code === 'TEACHER_EVIDENCE_REQUIRED'
  );
});

test('P05-CORPUS01 rejects duplicate IDs and corpus-granted external training authority', () => {
  assert.throws(
    () => createTeacherPilotCorpusV1([automatedCase(), automatedCase()]),
    error => error instanceof TeacherPilotCorpusV1Error && error.code === 'DUPLICATE_CASE_ID'
  );

  const invalidAuthority = automatedCase({
    id: 'training-authority-fake-01',
    provenance: {
      sourceKind: 'USER_PROVIDED_LOCAL',
      sourceRef: 'local-only:teacher-example',
      rightsStatus: 'USER_AUTHORIZED_PRIVATE',
      containsPersonalData: true,
      externalTrainingAuthorized: true
    }
  });
  assert.throws(
    () => createTeacherPilotCorpusV1([invalidAuthority]),
    error => error instanceof TeacherPilotCorpusV1Error && error.code === 'EXTERNAL_TRAINING_AUTHORITY_INVALID'
  );
});

test('P05-CORPUS01 requires NOT_RUN rows to carry no fabricated observation evidence', () => {
  const invalid = {
    ...automatedCase({ id: 'not-run-fake-01' }),
    verification: {
      level: 'PHYSICAL_DEVICE',
      outcome: 'NOT_RUN',
      observer: 'DEVICE_TESTER',
      evidenceRef: 'planned:test',
      device: {
        hardware: 'planned', platform: 'iOS', osVersion: 'planned', browser: 'Safari', browserVersion: 'planned'
      }
    }
  };
  assert.throws(
    () => createTeacherPilotCorpusV1([invalid]),
    error => error instanceof TeacherPilotCorpusV1Error && error.code === 'INVALID_EVIDENCE'
  );
});
