# ST Score Editor Core — Architecture

Status: **SEC-NE is complete through SEC-NE-07 for authoring semantics representable by current public ScoreDocument/NotationDocument 1.0.0 contracts. The bounded current notation MusicXML profile now has explicit export→re-import symmetry.**

## Canonical authority

`ScoreDocument` is the single musical edit authority. `NotationDocument` owns same-revision notation semantics. MusicXML/evidence is exchange or bounded source evidence. Renderer/host state is noncanonical. OMR/AI and Guitar Workspace results cannot independently mutate score state.

## Implemented authoring layers

- SEC-NE-01/02 — explicit-rest note entry and unified editor composition.
- SEC-NE-03 — revision-bound semantic insertion position.
- SEC-NE-04A/04C — exact timing veto and explicit-rest position entry.
- SEC-NE-04B1/04B2 — MusicXML measure semantics and proven normal-measure gap materialization.
- SEC-NE-05 — relation-safe same-measure retiming and atomic current 3:2 triplet movement.
- SEC-NE-06 — bounded measure/voice structure and relation-free fresh-ID copy/paste.
- SEC-NE-07 — advanced score-authoring safety composition over existing canonical/notation contracts.
- SEC-NE-XML-ROUNDTRIP — bounded notation serializer-profile re-import.

## MusicXML import/export layers

Three import surfaces remain intentionally distinct:

1. `importMusicXml` — legacy E2 score-only profile.
2. `importMusicXmlWithMeasureSemantics` — score + same-revision time/measure evidence.
3. `importNotationMusicXml` — exact bounded counterpart to `serializeNotationMusicXml` for currently admitted notation semantics.

`importNotationMusicXml` first parses the original XML through the existing resource-bounded safe parser. It then creates a strict score-only projection for the unchanged 04B1 importer and reconstructs notation against deterministic imported entity IDs. The returned score is rebound to the original source identity. Measure evidence is independently revalidated against that final score.

The safe parser allowlist was expanded only for elements/attributes the first-party notation serializer emits: key/clef/barline structures, dots/accidentals/beams, time-modification, tie/tied/slur/tuplet notation and repeat markers. Legacy semantic importers do not inherit broader acceptance because their own semantic child allowlists remain unchanged.

## Current round-trip semantics

Current golden coverage includes canonical pitch/chord/rest/timing/voice/staff plus time, key, clef, barline/repeat, dots, accidentals, beams, current tuplets, tie playback + numbered tied marks and slurs.

Malformed tie/tied disagreement and chord-tone disagreement on event-level notation fail closed. Byte-for-byte XML identity is not required; semantic equivalence is the contract.

## Public schema boundary

Grace notes, articulations and ornaments cannot be represented in public 1.0.0 score/notation schemas. Whole staff/part topology also lacks frozen cross-staff correspondence/ownership rules. These are not inferred from renderer state or attached as unversioned hidden fields.

## Remaining autonomous stages

- SEC-NE-08 — Guitar/TAB authoring composition; standard notation remains canonical.
- SEC-NE-09 — SesliTab integration around one canonical editor state; no dual-write.

## Dependencies / invariants

Runtime dependencies remain only `saxes@6.0.0` and `xmlchars@2.2.0`; build-only remains `typescript@6.0.3` and `esbuild@0.28.2`. Source immutability, revision binding, independent timing veto, relation preservation and no-production-by-merge invariants remain active.
