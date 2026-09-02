# ST Score Editor Core — Architecture

Status: **The bounded SEC-NE autonomous authoring program is implemented through SEC-NE-09. Current public ScoreDocument/NotationDocument 1.0.0 contracts remain authoritative; schema-absent and production capabilities remain explicit human gates.**

## Canonical authority

`ScoreDocument` is the single musical edit authority. `NotationDocument` owns same-revision notation semantics. MusicXML/OMR data is exchange/evidence. Guitar Workspace state is derivative. Renderers and SesliTab are presentation/orchestration layers and are never independent canonical state.

## Implemented program

- SEC-NE-01/02 — explicit-rest note entry and unified session/browser composition.
- SEC-NE-03 — revision-bound semantic insertion position.
- SEC-NE-04A/04C — exact timing veto and explicit-rest position entry.
- SEC-NE-04B1/04B2 — MusicXML measure semantics and proven gap materialization.
- SEC-NE-05 — relation-safe retiming and atomic supported 3:2 triplet movement.
- SEC-NE-06 — bounded measure/voice structure and relation-free fresh-ID copy/paste.
- SEC-NE-07 — advanced current-schema authoring composition.
- SEC-NE-XML-ROUNDTRIP — bounded notation serializer-profile export/re-import.
- SEC-NE-08 — derivative Guitar/TAB authoring companion.
- SEC-NE-09 — single-session SesliTab host integration.

## SesliTab host integration

`seslitab-editor-host/1.0.0` wraps one `EditorSessionState` and does not introduce a second score model.

```text
source / admitted evidence
        ↓
ScoreDocument + NotationDocument
        ↓
EditorSessionState + unified history
        ↓
RenderRequest / opaque render tokens
        ↓
SesliTab host adapter
        ↓
pointer | keyboard | touch
        ↓
existing semantic session-controller operations
```

Selection enters through exact current render tokens. Supported score, notation, keypad and note-entry changes delegate to existing session-controller functions; undo/redo remains the same unified history. Input modality is recorded only as provenance and cannot change semantic mutation rules.

The host adapter converts rejected operations into typed product-facing errors. It does not guess a nearest note, does not mutate renderer/DOM state as musical state and does not maintain hidden fallback score state.

Playback remains outside canonical authoring authority. `editorAdmissionControlsPlayback=false` documents that an edit-admission failure is not itself a playback-disable signal. Playback implementation/data sufficiency remains a separate product concern.

## Guitar/TAB boundary

SEC-NE-08 validates exact-current E8-C results and exposes derivative annotations. Canonical changes continue through Editor Core; any accepted canonical revision invalidates prior Guitar state as `REQUIRES_RECOMPUTE`. E8-D direct engine invocation remains human-gated.

## MusicXML boundary

Legacy score-only, 04B1 evidence and bounded notation-aware import profiles remain distinct. MusicXML never becomes live editor state.

## Human-gated future boundaries

- grace-note canonical schema;
- articulations and ornaments;
- whole staff/part topology and cross-staff rules;
- direct external Guitar engine invocation;
- persistence/network/server-revision authority;
- production/public-write/deployment activation.

## Dependencies / invariants

Runtime dependencies remain only `saxes@6.0.0` and `xmlchars@2.2.0`; build-only remains `typescript@6.0.3` and `esbuild@0.28.2`. Source immutability, revision binding, independent validation, unified history, renderer isolation, derivative Guitar authority and no-production-by-merge remain active.
