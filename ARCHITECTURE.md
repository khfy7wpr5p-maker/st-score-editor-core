# ST Score Editor Core — Architecture

Status: **SEC-NE is COMPLETE / MERGED through SEC-NE-07 for all authoring semantics representable by current public ScoreDocument/NotationDocument 1.0.0 contracts. Schema-absent semantics and whole staff/part topology remain explicit human gates.**

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

## SEC-NE-07 composition

`editor-advanced-authoring/1.0.0` accepts existing canonical `EditTransaction` operations but adds editor-authoring safeguards around them.

Current representable advanced score semantics:

- `SET_NOTE_PITCH`;
- `REPLACE_EVENT_WITH_REST`;
- `REPLACE_REST_WITH_NOTE`;
- `ADD_CHORD_TONE` / `REMOVE_CHORD_TONE`;
- `SET_EVENT_DURATION`, with extra timing/notation restrictions.

Duration edits reject a target event carrying dots, beams or tuplet metadata. MusicXML-derived duration edits require current safe 04B1 evidence. After the canonical candidate is built, notation must rebind and the changed voice must pass 04A timing/occupancy validation.

Existing notation authority is reused:

- `notation-commands` owns time/key/clef/barline, dots, beams, tuplets, accidentals, tie/slur mark storage;
- `editor-keypad-advanced` owns the currently validated explicit-target 3:2 triplet and tie/slur interaction semantics;
- SEC-NE-05 owns admitted movement semantics.

No second notation model is introduced.

## Public schema boundary

Grace notes, articulations and ornaments cannot be represented in public 1.0.0 score/notation schemas. Whole staff/part topology also lacks frozen cross-staff correspondence/ownership rules. These are not inferred from renderer state or attached as unversioned hidden fields.

A future approved schema/topology expansion must define versioning, validation, MusicXML import/export preservation, migration and compatibility before these become canonical capabilities.

## Remaining autonomous stages

- SEC-NE-XML-ROUNDTRIP — golden semantic equivalence hardening.
- SEC-NE-08 — Guitar/TAB authoring composition; standard notation remains canonical.
- SEC-NE-09 — SesliTab integration around one canonical editor state; no dual-write.

## Dependencies / invariants

Runtime dependencies remain only `saxes@6.0.0` and `xmlchars@2.2.0`; build-only remains `typescript@6.0.3` and `esbuild@0.28.2`. All existing source immutability, revision binding, independent timing veto, relation-preservation and no-production-by-merge invariants remain active.
