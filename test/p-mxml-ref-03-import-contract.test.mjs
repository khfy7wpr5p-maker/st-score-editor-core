import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NORMALIZED_IMPORT_ENVELOPE_VERSION,
  classifyImportFallbackEligibility,
  createPreservedMusicXmlSymbolV1,
  importDispositionForCompatibilityClass,
  validateNormalizedImportEnvelopeV1
} from '../dist/packages/musicxml-import-contract/src/index.js';

test('P-MXML-REF-03 import contract exposes stable v1 version and compatibility dispositions', () => {
  assert.equal(NORMALIZED_IMPORT_ENVELOPE_VERSION, '1.0.0');
  assert.equal(importDispositionForCompatibilityClass('SEMANTIC_REQUIRED'), 'CANONICAL_EDITABLE');
  assert.equal(importDispositionForCompatibilityClass('IGNORABLE_PRESENTATION_METADATA'), 'PRESERVED_RENDERABLE');
  assert.equal(importDispositionForCompatibilityClass('UNSUPPORTED_SEMANTIC_FAIL_CLOSED'), 'UNSUPPORTED_SEMANTIC_FAIL_CLOSED');
});

test('P-MXML-REF-03 preserved symbols retain source path, note association, attributes, text and provenance', () => {
  const symbol = createPreservedMusicXmlSymbolV1({
    element: 'fret',
    sourcePath: 'score-partwise/part/measure/note/notations/technical/fret',
    measureNumber: '12',
    sourceNoteId: 'n-42',
    attributes: { placement: 'above' },
    text: '7',
    provenance: { sourceIdentity: 'fixture:tab.musicxml', parser: 'raw-musicxml' }
  });

  assert.equal(symbol.version, '1.0.0');
  assert.equal(symbol.disposition, 'PRESERVED_RENDERABLE');
  assert.equal(symbol.element, 'fret');
  assert.equal(symbol.sourcePath, 'score-partwise/part/measure/note/notations/technical/fret');
  assert.equal(symbol.measureNumber, '12');
  assert.equal(symbol.sourceNoteId, 'n-42');
  assert.deepEqual(symbol.attributes, { placement: 'above' });
  assert.equal(symbol.text, '7');
  assert.deepEqual(symbol.provenance, { sourceIdentity: 'fixture:tab.musicxml', parser: 'raw-musicxml' });
  assert.equal(Object.isFrozen(symbol), true);
  assert.equal(Object.isFrozen(symbol.attributes), true);
  assert.equal(Object.isFrozen(symbol.provenance), true);
});

test('P-MXML-REF-03 fallback eligibility excludes malformed, security, resource and unrepresentable failures', () => {
  assert.deepEqual(classifyImportFallbackEligibility('NATIVE_COMPATIBILITY_REJECTION'), {
    eligible: true,
    reason: 'native compatibility rejection is eligible for bounded fallback'
  });

  for (const kind of ['MALFORMED_XML', 'SECURITY_POLICY', 'RESOURCE_LIMIT', 'UNREPRESENTABLE_SEMANTIC']) {
    const result = classifyImportFallbackEligibility(kind);
    assert.equal(result.eligible, false);
  }
});

test('P-MXML-REF-03 envelope validation rejects missing or wrong versions and unsafe canonical promotion', () => {
  const base = {
    version: '1.0.0',
    sourceIdentity: 'fixture:score.musicxml',
    parts: [],
    preservedSymbols: [],
    diagnostics: []
  };

  assert.equal(validateNormalizedImportEnvelopeV1(base).version, '1.0.0');
  assert.throws(() => validateNormalizedImportEnvelopeV1({ ...base, version: '2.0.0' }), /version/i);
  assert.throws(() => validateNormalizedImportEnvelopeV1({ ...base, version: undefined }), /version/i);

  const illegal = {
    ...base,
    preservedSymbols: [{
      version: '1.0.0',
      disposition: 'CANONICAL_EDITABLE',
      element: 'fret',
      sourcePath: 'score-partwise/part/measure/note/notations/technical/fret',
      measureNumber: '1',
      sourceNoteId: 'n1',
      attributes: {},
      text: '3',
      provenance: { sourceIdentity: 'fixture:score.musicxml', parser: 'raw-musicxml' }
    }]
  };
  assert.throws(() => validateNormalizedImportEnvelopeV1(illegal), /PRESERVED_RENDERABLE/);
});
