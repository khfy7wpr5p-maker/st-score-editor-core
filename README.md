# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for ST score products.

## Current reality

The bounded SEC-NE autonomous authoring program is implemented through **SEC-NE-09**.

- 01/02 — selected-rest entry + unified session/browser composition.
- 03 — revision-bound insertion position.
- 04A/04C — timing veto + explicit-rest position entry.
- 04B1/04B2 — MusicXML measure evidence + proven legal-gap rest materialization.
- 05 — relation-safe onset movement + atomic current 3:2 triplet movement.
- 06 — bounded measure/voice structure + relation-safe fresh-ID copy/paste.
- 07 — advanced current-schema authoring composition.
- XML round-trip — bounded notation serializer-profile export/re-import.
- 08 — revision-bound derivative Guitar/TAB authoring companion.
- 09 — single-session SesliTab host integration adapter.

## SEC-NE-09 SesliTab integration

`seslitab-editor-host/1.0.0` gives a product host one `EditorSessionState` as the only mutable editor state. Selection enters through exact current render tokens and supported score/notation/keypad/note-entry/history operations delegate to existing session-controller authority.

Pointer, keyboard and touch are input provenance only; they converge on the same semantic mutation paths. Renderer/DOM coordinates never become score-write authority. Rejected editor operations are returned as typed host errors rather than creating fallback mutations.

Playback remains a separate product/media capability. Editor admission does not itself control playback availability, so an unsupported or rejected edit is not a reason for the core adapter to disable listening.

The adapter has no network, persistence, server-revision, publication or production authority and cannot create a host-side second mutable score.

## Human-gated future boundaries

The completed bounded program does not claim capabilities absent from current public contracts. The following remain explicit human-gated future work:

- grace-note canonical identity/timing model;
- articulations and ornaments;
- whole staff/part topology and cross-staff ownership rules;
- E8-D direct external Guitar engine invocation;
- production/public-write/persistence/deployment activation.

## Authority and dependencies

`ScoreDocument` remains canonical. `NotationDocument` remains same-revision notation authority. MusicXML/OMR/Guitar data remains exchange/evidence/derivative state. Renderers and SesliTab remain noncanonical presentation/orchestration layers. Runtime dependencies remain only `saxes@6.0.0` and `xmlchars@2.2.0`; the SEC-NE program adds no third-party runtime dependency. Merge does not activate production authority.
