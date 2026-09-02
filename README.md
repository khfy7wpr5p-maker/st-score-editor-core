# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for ST score products.

## Current reality

SEC-NE is implemented through **SEC-NE-07 bounded current-schema authoring** and **SEC-NE-XML-ROUNDTRIP bounded notation-profile export/re-import**.

- 01/02 — selected-rest entry + unified composition.
- 03 — revision-bound insertion position.
- 04A/04C — timing veto + explicit-rest position entry.
- 04B1/04B2 — MusicXML measure evidence + proven legal-gap rest materialization.
- 05 — relation-safe onset movement + atomic current 3:2 triplet movement.
- 06 — bounded measure/voice structure + relation-safe fresh-ID copy/paste.
- 07 — advanced score authoring composed from existing canonical commands, notation commands and explicit-target advanced keypad semantics.
- XML round-trip — notation-aware serializer-profile importer for currently admitted score/notation semantics.

## MusicXML round-trip

`serializeNotationMusicXml` now has a matching bounded import surface: `importNotationMusicXml`.

The notation-aware profile preserves the currently admitted projection for pitch/chord/rest/timing/voice/staff plus time, key, clef, barline/repeat, dots, accidentals, beams, current tuplet representation, numbered tied marks and slurs. The input is first parsed through the bounded safe XML parser; score semantics are projected into the unchanged legacy importer, then notation is reconstructed against deterministic canonical IDs.

Legacy `importMusicXml` / `importMusicXmlWithMeasureSemantics` remain intentionally narrow and still reject notation-rich serializer output. This avoids silently broadening old contracts.

## Human-gated schema boundary

Grace notes, articulations and ornaments do **not** exist in public `ScoreDocument` / `NotationDocument` 1.0.0. Whole staff/part topology is also not fully specified. These remain explicit public-contract design gates rather than fake hidden fields.

## Remaining autonomous program

- **SEC-NE-08:** guitar/TAB authoring composition with derivative fingering authority.
- **SEC-NE-09:** SesliTab product integration without dual-write.

## Authority and dependencies

`ScoreDocument` remains canonical. Renderers are presentation-only; SesliTab is host/orchestration only; MusicXML/OMR/Guitar outputs remain exchange/evidence/derivative inputs unless separately admitted. Runtime dependencies remain only `saxes@6.0.0` and `xmlchars@2.2.0`; no SEC-NE stage through the bounded XML round-trip adds a third-party runtime dependency. Merge does not activate production/public-write authority.
