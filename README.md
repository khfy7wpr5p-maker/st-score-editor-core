# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for ST score products.

## Current reality

SEC-NE is implemented through **SEC-NE-07 bounded current-schema authoring**.

- 01/02 — selected-rest entry + unified composition.
- 03 — revision-bound insertion position.
- 04A/04C — timing veto + explicit-rest position entry.
- 04B1/04B2 — MusicXML measure evidence + proven legal-gap rest materialization.
- 05 — relation-safe onset movement + atomic current 3:2 triplet movement.
- 06 — bounded measure/voice structure + relation-safe fresh-ID copy/paste.
- 07 — advanced score authoring composed from existing canonical commands, notation commands and explicit-target advanced keypad semantics.

## SEC-NE-07 advanced authoring

`editor-advanced-authoring/1.0.0` composes existing canonical `EditTransaction` semantics with same-revision notation safety.

Admitted score operations include existing canonical pitch edits, rest/note replacement and chord tone add/remove. Duration changes receive extra safeguards: dotted, beamed or tuplet-coupled event notation cannot be independently duration-mutated, MusicXML-derived targets require current safe 04B1 evidence, and the changed voice is independently revalidated by SEC-NE-04A.

If a score edit would delete an entity still targeted by notation, notation rebind fails and the edit is rejected rather than orphaning notation.

Existing first-party notation authority is reused instead of duplicated:

- `notation-commands` — time/key/clef/barline, dots, beams, tuplet metadata, accidentals, tie/slur marks;
- `editor-keypad-advanced` — exact-target current 3:2 triplet creation/toggle plus explicit tie/slur creation/removal with endpoint validation;
- SEC-NE-05 — safe movement of relation-free events and exact supported triplet groups.

## Human-gated schema boundary

Grace notes, articulations and ornaments do **not** exist in public `ScoreDocument` / `NotationDocument` 1.0.0. Whole staff/part topology is also not fully specified. Adding these as canonical/public capabilities requires an explicit schema/topology design approval; this repository does not claim fake support through ad-hoc side fields.

## Remaining autonomous program

- **SEC-NE-XML-ROUNDTRIP:** golden semantic preservation/equivalence hardening.
- **SEC-NE-08:** guitar/TAB authoring composition with derivative fingering authority.
- **SEC-NE-09:** SesliTab product integration contract/composition without dual-write.

## Authority and dependencies

`ScoreDocument` remains canonical. Renderers are presentation-only; SesliTab is host/orchestration only; MusicXML/OMR/Guitar outputs remain exchange/evidence/derivative inputs unless separately admitted. Runtime dependencies remain only `saxes@6.0.0` and `xmlchars@2.2.0`; no SEC-NE stage through 07 adds a third-party runtime dependency. Merge does not activate production/public-write authority.
