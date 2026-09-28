import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MUSICXML_COMPATIBILITY_POLICY_VERSION,
  MUSICXML_COMPATIBILITY_DIAGNOSTIC_LIMIT,
  classifyMusicXmlCompatibilityElement,
  classifyMusicXmlCompatibilityAttribute,
  createMusicXmlCompatibilityRecorder
} from '../dist/packages/musicxml/src/index.js';

const classOfElement = (path, name, uri = '') =>
  classifyMusicXmlCompatibilityElement(path, name, uri).classification;

const classOfAttribute = (path, element, attribute, uri = '') =>
  classifyMusicXmlCompatibilityAttribute(path, element, attribute, uri).classification;

test('P-MXML-REF-01 compatibility policy exposes a stable v1 contract', () => {
  assert.equal(MUSICXML_COMPATIBILITY_POLICY_VERSION, '1.0.0');
  assert.equal(MUSICXML_COMPATIBILITY_DIAGNOSTIC_LIMIT, 64);
});

test('P-MXML-REF-01 policy classifies current v2 semantic elements as required', () => {
  assert.equal(classOfElement([], 'score-partwise'), 'SEMANTIC_REQUIRED');
  assert.equal(classOfElement(['score-partwise'], 'part-list'), 'SEMANTIC_REQUIRED');
  assert.equal(classOfElement(['score-partwise', 'part-list'], 'score-part'), 'SEMANTIC_REQUIRED');
  assert.equal(classOfElement(['score-partwise', 'part'], 'measure'), 'SEMANTIC_REQUIRED');
  assert.equal(classOfElement(['score-partwise', 'part', 'measure'], 'note'), 'SEMANTIC_REQUIRED');
  assert.equal(classOfElement(['score-partwise', 'part', 'measure', 'note'], 'pitch'), 'SEMANTIC_REQUIRED');
  assert.equal(classOfElement(['score-partwise', 'part', 'measure', 'note', 'notations', 'articulations'], 'staccato'), 'SEMANTIC_REQUIRED');
});

test('P-MXML-REF-01 policy admits only reviewed presentation and metadata subtrees', () => {
  assert.equal(classOfElement(['score-partwise'], 'identification'), 'IGNORABLE_PRESENTATION_METADATA');
  assert.equal(classOfElement(['score-partwise'], 'defaults'), 'IGNORABLE_PRESENTATION_METADATA');
  assert.equal(classOfElement(['score-partwise', 'part-list', 'score-part'], 'part-abbreviation'), 'IGNORABLE_PRESENTATION_METADATA');
  assert.equal(classOfElement(['score-partwise', 'part-list', 'score-part'], 'score-instrument'), 'IGNORABLE_PRESENTATION_METADATA');
  assert.equal(classOfElement(['score-partwise', 'part-list', 'score-part'], 'midi-instrument'), 'IGNORABLE_PRESENTATION_METADATA');
  assert.equal(classOfElement(['score-partwise', 'part', 'measure'], 'print'), 'IGNORABLE_PRESENTATION_METADATA');
  assert.equal(classOfElement(['score-partwise', 'part', 'measure', 'note'], 'stem'), 'IGNORABLE_PRESENTATION_METADATA');

  assert.equal(classOfElement(['score-partwise', 'part', 'measure'], 'direction'), 'UNSUPPORTED_SEMANTIC_FAIL_CLOSED');
  assert.equal(classOfElement(['score-partwise', 'part', 'measure'], 'sound'), 'UNSUPPORTED_SEMANTIC_FAIL_CLOSED');
  assert.equal(classOfElement(['score-partwise', 'part', 'measure'], 'harmony'), 'UNSUPPORTED_SEMANTIC_FAIL_CLOSED');
  assert.equal(classOfElement(['score-partwise', 'part', 'measure', 'note'], 'notehead'), 'UNSUPPORTED_SEMANTIC_FAIL_CLOSED');
  assert.equal(classOfElement(['score-partwise', 'part', 'measure', 'attributes'], 'staff-details'), 'UNSUPPORTED_SEMANTIC_FAIL_CLOSED');
  assert.equal(classOfElement(['score-partwise', 'part', 'measure'], 'note', 'urn:foreign'), 'UNSUPPORTED_SEMANTIC_FAIL_CLOSED');
});

test('P-MXML-REF-01 policy admits exact reviewed presentation attributes and no lookalikes', () => {
  assert.equal(classOfAttribute([], 'score-partwise', 'version'), 'SEMANTIC_REQUIRED');
  assert.equal(classOfAttribute(['score-partwise', 'part-list'], 'score-part', 'id'), 'SEMANTIC_REQUIRED');
  assert.equal(classOfAttribute(['score-partwise', 'part', 'measure'], 'note', 'id'), 'SEMANTIC_REQUIRED');
  assert.equal(classOfAttribute(['score-partwise', 'part'], 'measure', 'width'), 'IGNORABLE_PRESENTATION_METADATA');
  assert.equal(classOfAttribute(['score-partwise', 'part', 'measure'], 'note', 'default-x'), 'IGNORABLE_PRESENTATION_METADATA');
  assert.equal(classOfAttribute(['score-partwise', 'part', 'measure', 'note'], 'stem', 'default-y'), 'IGNORABLE_PRESENTATION_METADATA');
  assert.equal(classOfAttribute(['score-partwise', 'part', 'measure', 'note', 'notations', 'articulations'], 'staccato', 'default-y'), 'IGNORABLE_PRESENTATION_METADATA');
  assert.equal(classOfAttribute(['score-partwise', 'part', 'measure', 'note', 'notations', 'articulations'], 'staccato', 'placement'), 'SEMANTIC_REQUIRED');

  assert.equal(classOfAttribute(['score-partwise', 'part'], 'measure', 'default-x'), 'UNSUPPORTED_SEMANTIC_FAIL_CLOSED');
  assert.equal(classOfAttribute(['score-partwise', 'part', 'measure'], 'note', 'width'), 'UNSUPPORTED_SEMANTIC_FAIL_CLOSED');
  assert.equal(classOfAttribute(['score-partwise', 'part', 'measure'], 'note', 'color'), 'UNSUPPORTED_SEMANTIC_FAIL_CLOSED');
  assert.equal(classOfAttribute(['score-partwise', 'part', 'measure'], 'note', 'default-x', 'urn:foreign'), 'UNSUPPORTED_SEMANTIC_FAIL_CLOSED');
});

test('P-MXML-REF-01 compatibility diagnostics aggregate duplicate keys and cap unique evidence', () => {
  const recorder = createMusicXmlCompatibilityRecorder(2);
  const first = {
    classification: 'IGNORABLE_PRESENTATION_METADATA',
    element: 'note',
    attribute: 'default-x',
    pathClass: 'score-partwise/part/measure/note',
    reason: 'reviewed note horizontal layout'
  };
  const second = {
    classification: 'IGNORABLE_PRESENTATION_METADATA',
    element: 'measure',
    attribute: 'width',
    pathClass: 'score-partwise/part/measure',
    reason: 'reviewed measure layout width'
  };
  const overflow = {
    classification: 'IGNORABLE_PRESENTATION_METADATA',
    element: 'print',
    attribute: null,
    pathClass: 'score-partwise/part/measure/print',
    reason: 'reviewed measure presentation subtree'
  };

  recorder.record(first);
  recorder.record(first);
  recorder.record(second);
  recorder.record(overflow);

  const evidence = recorder.snapshot();
  assert.equal(evidence.diagnostics.length, 2);
  assert.equal(evidence.diagnostics[0]?.count, 2);
  assert.equal(evidence.diagnostics[1]?.count, 1);
  assert.equal(evidence.truncated, true);
  assert.equal(Object.isFrozen(evidence), true);
  assert.equal(Object.isFrozen(evidence.diagnostics), true);
  assert.equal(Object.isFrozen(evidence.diagnostics[0]), true);
});

test('P-MXML-REF-01 compatibility diagnostics reject invalid caps', () => {
  assert.throws(() => createMusicXmlCompatibilityRecorder(0), RangeError);
  assert.throws(() => createMusicXmlCompatibilityRecorder(1.5), RangeError);
});
