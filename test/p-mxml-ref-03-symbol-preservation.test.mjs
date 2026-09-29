import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractPreservedMusicXmlSymbolsV1,
  REVIEWED_GUITAR_TECHNICAL_SYMBOLS
} from '../dist/packages/musicxml-symbol-preservation/src/index.js';

const score = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>Guitar</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="12">
      <attributes>
        <divisions>4</divisions>
        <staff-details number="1">
          <staff-lines>6</staff-lines>
          <staff-tuning line="6">
            <tuning-step>E</tuning-step>
            <tuning-octave>2</tuning-octave>
          </staff-tuning>
        </staff-details>
      </attributes>
      <note id="n-42">
        <pitch><step>G</step><octave>3</octave></pitch>
        <duration>4</duration><voice>1</voice><staff>1</staff>
        <notations><technical>
          <string>6</string><fret>3</fret>
          <bend><bend-alter>1</bend-alter></bend>
          <hammer-on type="start">H</hammer-on>
          <harmonic><natural/></harmonic>
          <pluck>p</pluck><golpe/>
        </technical></notations>
      </note>
      <note id="n-43">
        <chord/><pitch><step>C</step><octave>4</octave></pitch>
        <duration>4</duration><voice>2</voice><staff>1</staff>
        <notations><technical>
          <string>5</string><fret>3</fret>
          <pull-off type="stop">P</pull-off>
        </technical></notations>
      </note>
    </measure>
  </part>
</score-partwise>`;

test('P-MXML-REF-03 raw preservation captures reviewed TAB and guitar technical symbols with note identity', () => {
  const result = extractPreservedMusicXmlSymbolsV1(score, {
    sourceIdentity: 'fixture:guitar.musicxml'
  });

  assert.equal(result.sourceIdentity, 'fixture:guitar.musicxml');
  assert.ok(REVIEWED_GUITAR_TECHNICAL_SYMBOLS.includes('string'));
  assert.ok(REVIEWED_GUITAR_TECHNICAL_SYMBOLS.includes('fret'));

  const n42 = result.symbols.filter(symbol => symbol.sourceNoteId === 'n-42');
  const n43 = result.symbols.filter(symbol => symbol.sourceNoteId === 'n-43');

  assert.deepEqual(
    n42.filter(symbol => symbol.element === 'string' || symbol.element === 'fret').map(symbol => [symbol.element, symbol.text]),
    [['string', '6'], ['fret', '3']]
  );
  assert.deepEqual(
    n43.filter(symbol => symbol.element === 'string' || symbol.element === 'fret').map(symbol => [symbol.element, symbol.text]),
    [['string', '5'], ['fret', '3']]
  );

  const hammer = n42.find(symbol => symbol.element === 'hammer-on');
  assert.deepEqual(hammer?.attributes, { type: 'start' });
  assert.equal(hammer?.measureNumber, '12');

  const tuning = result.symbols.find(symbol => symbol.element === 'staff-tuning');
  assert.equal(tuning?.measureNumber, '12');
  assert.deepEqual(tuning?.attributes, { line: '6' });

  assert.ok(result.symbols.every(symbol => symbol.disposition === 'PRESERVED_RENDERABLE'));
  assert.ok(result.symbols.every(symbol => symbol.sourcePath.includes('measure[0]')));
});

test('P-MXML-REF-03 preservation uses deterministic indexed note paths when note id is absent', () => {
  const xml = score.replace(' id="n-42"', '').replace(' id="n-43"', '');
  const first = extractPreservedMusicXmlSymbolsV1(xml, { sourceIdentity: 'fixture:no-id.musicxml' });
  const second = extractPreservedMusicXmlSymbolsV1(xml, { sourceIdentity: 'fixture:no-id.musicxml' });

  const fretPaths = first.symbols.filter(symbol => symbol.element === 'fret').map(symbol => symbol.sourcePath);
  assert.equal(new Set(fretPaths).size, 2);
  assert.deepEqual(fretPaths, second.symbols.filter(symbol => symbol.element === 'fret').map(symbol => symbol.sourcePath));
});

test('P-MXML-REF-03 unreviewed technical semantics fail closed but an explicitly reviewed extension is preserved', () => {
  const withTap = score.replace('<pluck>p</pluck>', '<tap>t</tap><pluck>p</pluck>');

  assert.throws(
    () => extractPreservedMusicXmlSymbolsV1(withTap, { sourceIdentity: 'fixture:tap.musicxml' }),
    /unreviewed MusicXML technical symbol: tap/i
  );

  const reviewed = extractPreservedMusicXmlSymbolsV1(withTap, {
    sourceIdentity: 'fixture:tap.musicxml',
    additionalReviewedElements: ['tap']
  });
  const tap = reviewed.symbols.find(symbol => symbol.element === 'tap');
  assert.equal(tap?.text, 't');
  assert.equal(tap?.disposition, 'PRESERVED_RENDERABLE');
});
