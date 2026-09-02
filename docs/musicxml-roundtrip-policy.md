# MusicXML Round-Trip Policy

Status: current-reality policy through bounded SEC-NE-XML-ROUNDTRIP.

## Authority rule

MusicXML is an import/export exchange format. It is never live mutable editor state. After admitted import, `ScoreDocument` is canonical musical authority; notation and measure evidence are revision-bound sidecars.

## Import profiles

### Legacy E2

`importMusicXml` remains score-only and intentionally narrow.

### SEC-NE-04B1

`importMusicXmlWithMeasureSemantics` returns same-revision score, notation time declarations and `MusicXmlMeasureSemanticsDocument`. It preserves simple time declaration/inheritance/change, `implicit`, `non-controlling`, exact `backup`/`forward` cursor evidence and source provenance.

### Bounded notation serializer profile

`importNotationMusicXml` is the re-import surface for XML produced by `serializeNotationMusicXml` within the current public 1.0.0 score/notation contracts.

It preserves:

- pitch, chords, rests, onset/duration, voice and staff;
- time/key/clef;
- barline and repeat notation;
- dots and accidentals;
- beams;
- current tuplet representation (`time-modification` + numbered boundary marks);
- MusicXML tie playback markers plus numbered `tied` notation;
- slurs;
- current 04B1 time/measure evidence.

The original input is always parsed through the bounded safe parser before any semantic projection. The score-only subset is then passed through the unchanged 04B1 importer. Notation is reconstructed against deterministic canonical IDs and the final outputs are rebound to the original source identity.

Legacy importers continue to reject notation-rich serializer output; the new profile is additive rather than a silent broadening of E2.

## Equivalence contract

For the fully admitted current profile:

```text
ScoreDocument + NotationDocument
  -> serializeNotationMusicXml
  -> importNotationMusicXml
  -> semantically equivalent score + notation
```

Byte-for-byte XML identity and entity-ID identity with an arbitrary pre-export canonical document are not required. Re-imported deterministic IDs must correctly bind the equivalent imported semantic structure.

Golden regression verifies measure notation, event notation, note notation, current measure semantics and canonical score timing/pitch. It also verifies that inconsistent tie playback/notation projections fail closed.

## Loss policy

Unsupported is not equivalent to ignorable. Unknown or schema-absent semantics must be rejected or separately versioned; they may not disappear silently during round-trip.

Current 1.0.0 does not claim grace notes, articulations, ornaments, whole staff/part topology semantics, arbitrary external MusicXML profiles or `.mxl` container support.

## Corpus policy

Round-trip fixtures must be synthetic, first-party, public-domain or explicitly licensed. Current first-party synthetic golden coverage should be extended when a new public semantic is admitted.

## Container policy

`.mxl` remains unadmitted. A future container contract must define compressed/uncompressed size, entry count, path rules, MIME/content checks, decompression limits and cancellation behavior before support is added.
