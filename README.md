# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for ST score products.

## Current reality

SEC-NE is implemented through **SEC-NE-08 bounded Guitar/TAB authoring composition**.

- 01/02 — selected-rest entry + unified composition.
- 03 — revision-bound insertion position.
- 04A/04C — timing veto + explicit-rest position entry.
- 04B1/04B2 — MusicXML measure evidence + proven legal-gap rest materialization.
- 05 — relation-safe onset movement + atomic current 3:2 triplet movement.
- 06 — bounded measure/voice structure + relation-safe fresh-ID copy/paste.
- 07 — advanced current-schema authoring composition.
- XML round-trip — bounded notation serializer-profile export/re-import.
- 08 — revision-bound derivative Guitar/TAB authoring companion.

## SEC-NE-08 Guitar/TAB composition

`editor-guitar-authoring/1.0.0` composes existing E8-A/B/C Guitar Workspace evidence with canonical editor authoring without making fingering/TAB state canonical.

A `CanonicalTabResult` must first pass the existing E8-C validation against the exact current `ScoreDocument` + `NotationDocument`. The companion may then expose derivative note annotations such as KEEP/OMIT, selected string/fret and validated finger/shape information.

Canonical changes never originate from guitar-result state. They continue through existing typed Editor Core authoring. When a canonical edit is accepted, the old guitar result becomes `REQUIRES_RECOMPUTE`; replaying that old result against the new revision fails source-fact validation.

Teacher review status does not grant reverse-write authority. E8-D direct external engine invocation remains human-gated and is not activated by SEC-NE-08.

## Human-gated boundaries

Grace notes, articulations and ornaments do not exist in public `ScoreDocument` / `NotationDocument` 1.0.0. Whole staff/part topology is not fully specified. Direct external Guitar engine invocation and production/public-write activation also remain explicit gates.

## Remaining autonomous program

- **SEC-NE-09:** SesliTab product integration without dual-write.

## Authority and dependencies

`ScoreDocument` remains canonical. `NotationDocument` remains same-revision notation authority. Renderers are presentation-only; SesliTab is host/orchestration only; MusicXML/OMR/Guitar outputs remain exchange/evidence/derivative state. Runtime dependencies remain only `saxes@6.0.0` and `xmlchars@2.2.0`; SEC-NE-08 adds no third-party runtime dependency. Merge does not activate production/public-write authority.
