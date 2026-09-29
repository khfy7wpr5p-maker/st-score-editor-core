import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSuspiciousMeasureHighlightStateV1
} from '../dist/packages/score-editor-browser-app/src/correction-measure-highlight-state.js';

const current = Object.freeze({
  documentId: 'doc-1',
  revisionId: 'rev-1',
  renderEpoch: 'epoch-1',
  sourceId: 'source-1'
});

const finding = (id, measureTargets, overrides = {}) => Object.freeze({
  findingId: id,
  documentId: 'doc-1',
  revisionId: 'rev-1',
  renderEpoch: 'epoch-1',
  sourceId: 'source-1',
  measureTargets,
  ...overrides
});

test('SES-106 aggregates exact current findings to one highlight per measure without canonical authority', () => {
  const state = createSuspiciousMeasureHighlightStateV1({
    current,
    findings: [
      finding('f1', [{ partId: 'P1', measureIndex: 0 }]),
      finding('f2', [{ partId: 'P1', measureIndex: 0 }]),
      finding('f3', [{ partId: 'P1', measureIndex: 2 }])
    ]
  });

  assert.deepEqual(state.targets, [
    { partId: 'P1', measureIndex: 0 },
    { partId: 'P1', measureIndex: 2 }
  ]);
});

test('SES-106 fails closed for missing, ambiguous and stale measure mapping', () => {
  const state = createSuspiciousMeasureHighlightStateV1({
    current,
    findings: [
      finding('missing', []),
      finding('ambiguous', [
        { partId: 'P1', measureIndex: 0 },
        { partId: 'P1', measureIndex: 1 }
      ]),
      finding('stale-revision', [{ partId: 'P1', measureIndex: 0 }], { revisionId: 'rev-old' }),
      finding('stale-epoch', [{ partId: 'P1', measureIndex: 0 }], { renderEpoch: 'epoch-old' }),
      finding('stale-source', [{ partId: 'P1', measureIndex: 0 }], { sourceId: 'source-old' })
    ]
  });

  assert.deepEqual(state.targets, []);
});

test('SES-106 removes highlights when a fresh analysis contains no findings', () => {
  const state = createSuspiciousMeasureHighlightStateV1({ current, findings: [] });
  assert.deepEqual(state.targets, []);
});

test('SES-106 rejects malformed measure locators instead of guessing', () => {
  const state = createSuspiciousMeasureHighlightStateV1({
    current,
    findings: [finding('bad', [{ partId: 'P1', measureIndex: -1 }])]
  });
  assert.deepEqual(state.targets, []);
});
