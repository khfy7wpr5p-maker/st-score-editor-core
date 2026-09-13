import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTeacherPilotCorpusV1,
  summarizeTeacherPilotCorpusV1,
  TeacherPilotCorpusV1Error
} from '../dist/packages/editor-teacher-pilot-corpus-v1/src/index.js';

const validCase = () => ({
  id: 'runtime-hardening-01',
  title: 'Runtime hardening fixture',
  capabilities: ['runtime-validation'],
  provenance: {
    sourceKind: 'SYNTHETIC_FIXTURE',
    sourceRef: 'test:runtime-hardening',
    rightsStatus: 'REPOSITORY_OWNED',
    containsPersonalData: false,
    externalTrainingAuthorized: false
  },
  verification: {
    level: 'AUTOMATED',
    outcome: 'PASS',
    observer: 'AUTOMATION',
    evidenceRef: 'test:runtime-hardening',
    device: null
  }
});

test('P05-CORPUS01 rejects unsupported runtime evidence enums from JSON/JS callers', () => {
  const invalidOutcome = validCase();
  invalidOutcome.verification.outcome = 'PASSED';
  assert.throws(
    () => createTeacherPilotCorpusV1([invalidOutcome]),
    error => error instanceof TeacherPilotCorpusV1Error && error.code === 'INVALID_EVIDENCE'
  );

  const invalidLevel = validCase();
  invalidLevel.verification.level = 'WEBKIT_DEVICE';
  assert.throws(
    () => createTeacherPilotCorpusV1([invalidLevel]),
    error => error instanceof TeacherPilotCorpusV1Error && error.code === 'INVALID_EVIDENCE'
  );

  const invalidObserver = validCase();
  invalidObserver.verification.observer = 'BOT_TEACHER';
  assert.throws(
    () => createTeacherPilotCorpusV1([invalidObserver]),
    error => error instanceof TeacherPilotCorpusV1Error && error.code === 'INVALID_EVIDENCE'
  );
});

test('P05-CORPUS01 rejects unsupported provenance enums at runtime', () => {
  const invalidSource = validCase();
  invalidSource.provenance.sourceKind = 'REMOTE_UNTRACKED';
  assert.throws(
    () => createTeacherPilotCorpusV1([invalidSource]),
    error => error instanceof TeacherPilotCorpusV1Error && error.code === 'INVALID_PROVENANCE'
  );

  const invalidRights = validCase();
  invalidRights.provenance.rightsStatus = 'ASSUMED_OK';
  assert.throws(
    () => createTeacherPilotCorpusV1([invalidRights]),
    error => error instanceof TeacherPilotCorpusV1Error && error.code === 'INVALID_PROVENANCE'
  );
});

test('P05-CORPUS01 metrics reject a stale or tampered corpus envelope', () => {
  const corpus = createTeacherPilotCorpusV1([validCase()]);
  const tampered = {
    ...corpus,
    productionReleaseAuthority: true
  };
  assert.throws(
    () => summarizeTeacherPilotCorpusV1(tampered),
    error => error instanceof TeacherPilotCorpusV1Error && error.code === 'INVALID_CORPUS'
  );
});
