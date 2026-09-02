# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for ST score products.

## Current reality

The bounded SEC-NE autonomous authoring program is **COMPLETE / MERGED through SEC-NE-09**.

- 01/02 — selected-rest entry + unified session/browser composition.
- 03 — revision-bound insertion position.
- 04A/04C — timing veto + explicit-rest position entry.
- 04B1/04B2 — MusicXML measure evidence + proven legal-gap rest materialization.
- 05 — relation-safe onset movement + atomic current 3:2 triplet movement.
- 06 — bounded measure/voice structure + relation-safe fresh-ID copy/paste.
- 07 — advanced current-schema authoring composition.
- XML round trip — bounded notation serializer-profile export/re-import.
- 08 — revision-bound derivative Guitar/TAB authoring companion.
- 09 — single-session SesliTab host integration adapter.

Current public runtime contracts remain `ScoreDocument` / `NotationDocument` **1.0.0**.

## Next program: SCORE-SCHEMA-EXPANSION

`SSE-00` is a **documentation/design stage only**. It defines the vNext contract needed for capabilities deliberately absent from 1.0.0:

- canonical grace-note identity and anchoring;
- articulations;
- ornaments;
- later staff/part topology and cross-staff relations.

The proposed vNext versions are `ScoreDocumentV2 2.0.0` and `NotationDocumentV2 2.0.0`, but they are **not active runtime schemas yet**.

Grace material is designed as canonical voice-owned `graceGroups` anchored to an exact normal event. It is not represented as a fake zero-duration timed event. Articulations and ornaments extend typed notation state. v1 -> v2 migration must be lossless; v2 -> v1 downgrade must reject if any v2-only semantic would be lost.

See:

- `docs/score-schema-expansion-program.md`
- `docs/score-schema-vnext-contract-draft.md`
- `docs/score-schema-expansion-program.json`

## SesliTab integration

`seslitab-editor-host/1.0.0` gives a product host one `EditorSessionState` as the only mutable editor state. Selection enters through exact current render tokens and supported score/notation/keypad/note-entry/history operations delegate to existing session-controller authority.

Pointer, keyboard and touch converge on the same semantic mutation paths. Renderer/DOM coordinates never become score-write authority. Playback remains a separate product/media capability: edit rejection is not itself a playback-disable signal.

## Authority and dependencies

`ScoreDocument` remains canonical. `NotationDocument` remains same-revision notation authority. MusicXML/OMR/Guitar data remains exchange/evidence/derivative state. Renderers and SesliTab remain noncanonical presentation/orchestration layers.

Runtime dependencies remain only `saxes@6.0.0` and `xmlchars@2.2.0`. SSE-00 adds no runtime dependency and does not activate a new schema, public write API, persistence or production authority.
