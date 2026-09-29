import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { createSingleNotePartituraEnvelopeV1 } from '../scripts/lib/p-mxml-ref-03-envelope-fixture.mjs';
import {
  routeMusicXmlImportV1
} from '../dist/packages/musicxml-import-router/src/index.js';
import {
  extractPreservedMusicXmlSymbolsV1
} from '../dist/packages/musicxml-symbol-preservation/src/index.js';
import {
  joinPartituraGuitarTechnicalV1
} from '../dist/packages/musicxml-partitura-mapper/src/guitarTechnicalBridge.js';
import {
  createRendererRequestV4,
  renderableMusicXmlV4
} from '../dist/packages/renderer-contract-v4/src/index.js';

const root = new URL('../corpus/fixtures/musicxml-compatibility/', import.meta.url);
const manifestUrl = new URL('p-mxml-ref-03-ses-90-corpus.json', root);
const enc = new TextEncoder();
const sha = xml => createHash('sha256').update(enc.encode(xml)).digest('hex');
const sourceFor = xml => Object.freeze({
  sha256: sha(xml),
  format: 'musicxml',
  byteLength: enc.encode(xml).byteLength
});

const semanticSnapshot = score => score.parts.map(part => ({
  name: part.name,
  staves: part.staves.map(staff => ({
    ordinal: staff.ordinal,
    measures: staff.measures.map(measure => ({
      ordinal: measure.ordinal,
      displayNumber: measure.displayNumber,
      voices: measure.voices.map(voice => ({
        ordinal: voice.ordinal,
        events: voice.events.map(event => {
          const base = {
            kind: event.kind,
            onset: event.onset,
            duration: event.duration
          };
          if (event.kind === 'note') return { ...base, pitches: [event.note.pitch] };
          if (event.kind === 'chord') return { ...base, pitches: event.notes.map(note => note.pitch) };
          return { ...base, pitches: [] };
        })
      }))
    }))
  }))
}));

const fallbackEnvelope = sourceIdentity => createSingleNotePartituraEnvelopeV1(sourceIdentity);

test('SES-90 representative corpus has explicit rights/provenance and deterministic compatibility evidence', async () => {
  const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
  assert.equal(manifest.version, '1.0.0');
  assert.equal(manifest.rightsPolicy, 'FIRST_PARTY_SYNTHETIC_ONLY');
  assert.equal(manifest.fixtures.length, 7);
  assert.deepEqual(
    manifest.fixtures.map(item => item.family),
    [
      'MuseScore-style',
      'Audiveris-style',
      'Finale-style',
      'Sibelius-style',
      'Polyphonic',
      'Guitar-TAB-technical',
      'Unsupported-semantic'
    ]
  );

  for (const item of manifest.fixtures) {
    assert.equal(item.provenance, 'first-party synthetic');
    assert.equal(item.personalData, false);
    assert.equal(item.redistribution, 'repository-owned');
    const xml = await readFile(new URL(item.file, root), 'utf8');

    let fallbackCalls = 0;
    const fallback = async request => {
      fallbackCalls += 1;
      if (item.expectedRoute !== 'PARTITURA_FALLBACK') {
        throw new Error(`Unexpected fallback for ${item.id}`);
      }
      assert.equal(request.sourceIdentity, `sha256:${sha(xml)}`);
      return fallbackEnvelope(request.sourceIdentity);
    };

    if (item.expectedRoute === 'FAIL_CLOSED') {
      await assert.rejects(
        () => routeMusicXmlImportV1(xml, {
          source: sourceFor(xml),
          partituraFallback: fallback
        }),
        error => error?.code === item.expectedError,
        item.id
      );
      assert.equal(fallbackCalls, 0, item.id);
      continue;
    }

    const result = await routeMusicXmlImportV1(xml, {
      source: sourceFor(xml),
      documentId: `doc:${item.id}`,
      revisionId: `rev:${item.id}`,
      partituraFallback: fallback
    });
    assert.equal(result.route, item.expectedRoute, item.id);
    assert.equal(fallbackCalls, item.expectedFallbackCalls, item.id);

    const snapshot = semanticSnapshot(result.score);
    const noteCount = snapshot
      .flatMap(part => part.staves)
      .flatMap(staff => staff.measures)
      .flatMap(measure => measure.voices)
      .flatMap(voice => voice.events)
      .reduce((total, event) => total + event.pitches.length, 0);
    assert.equal(noteCount, item.expectedCanonicalNotes, item.id);

    const inventory = result.preservedSymbols.map(symbol => symbol.element);
    assert.deepEqual(inventory, item.expectedPreservedElements, item.id);

    if (item.roundTrip === 'CANONICAL_REOPEN') {
      const exported = renderableMusicXmlV4(createRendererRequestV4(result.score, result.notation));
      const reopened = await routeMusicXmlImportV1(exported, {
        source: sourceFor(exported),
        documentId: `doc:${item.id}`,
        revisionId: `rev:${item.id}`
      });
      assert.equal(reopened.route, 'NATIVE', item.id);
      assert.deepEqual(semanticSnapshot(reopened.score), snapshot, item.id);
    }

    if (item.id === 'guitar-tab-technical') {
      const sidecar = {
        version: '1.0.0',
        sourceIdentity: `sha256:${sha(xml)}`,
        symbols: result.preservedSymbols
      };
      const bridged = joinPartituraGuitarTechnicalV1(
        fallbackEnvelope(sidecar.sourceIdentity),
        sidecar,
        { score: result.score, notation: result.notation }
      );
      assert.equal(bridged.ok, true);
      assert.deepEqual(bridged.entries[0]?.sourcePosition, { string: 1, fret: 0 });
      assert.equal(bridged.entries[0]?.positionAuthority, 'SOURCE_EXPLICIT');

      const independentlyExtracted = extractPreservedMusicXmlSymbolsV1(xml, {
        sourceIdentity: sidecar.sourceIdentity
      });
      assert.deepEqual(
        independentlyExtracted.symbols.map(symbol => symbol.element),
        item.expectedPreservedElements
      );
    }
  }
});
