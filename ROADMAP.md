# Roadmap

## Current source of truth

Repository reality only; planned capability is not production capability.

## Completed baseline

- **E0–E7-H — COMPLETE**
- **E8-A/B/C — IMPLEMENTED**
- **E8-D — HUMAN-GATED / NOT AUTHORIZED**
- **SEC-KP-00–10 — COMPLETE**
- **SEC-NE-00–09 + XML ROUNDTRIP — COMPLETE / MERGED** within documented bounded profiles.

## SCORE-SCHEMA-EXPANSION

- **SSE-00–07 — COMPLETE / MERGED:** V2 contract/session, grace/articulation/ornament authoring, bounded MusicXML V2, renderer and SesliTab V2 compatibility.
- **SSE-08 — COMPLETE / MERGED:** approved V3 staff/part topology contract freeze.
- **SSE-09 — COMPLETE / MERGED:** bounded V3 topology runtime and authoring.
- **SSE-10 design — APPROVED / FROZEN / MERGED:** cross-staff presentation ownership contract.
- **SSE-10 runtime — COMPLETE / MERGED:** bounded Notation V4 cross-staff placement runtime.

## ST-SCORE-EDITOR-APP / PRODUCTIZATION

The standalone ST Score Editor App is the active product target. SesliTab V4 product cutover is deferred until the standalone product passes APP-09.

- **APP-00 — COMPLETE / MERGE CANDIDATE:** standalone product/authority contract.
- **APP-01 — COMPLETE / MERGE CANDIDATE:** standalone document runtime: New, MusicXML Open, admitted MusicXML Export, title/origin, dirty/saved revision tracking, V4 undo/redo and current V4 topology/cross-staff commits.
- **APP-02 — NEXT:** unify note/rest insertion/deletion, pitch/duration, chord tones, grace, articulation, ornament and keypad semantics inside the same V4 history.
- **APP-03 — PLANNED:** independent browser bundle and responsive editor shell.
- **APP-04 — PLANNED:** local file picker/open/save/download workflow.
- **APP-05 — PLANNED:** browser-local recovery/autosave with validated envelopes.
- **APP-06 — PLANNED:** renderer interaction, semantic hit mapping, zoom/navigation.
- **APP-07 — PLANNED:** local playback transport, independent from edit/OMR admission.
- **APP-08 — PLANNED:** MusicXML export/print/PDF workflow within admitted semantics.
- **APP-09 — PLANNED:** iPhone/iPad/desktop hardening, performance, accessibility and standalone release gate.

Local editing does not require a backend/service provider. Persistence/network/server revision authority is not introduced by APP-00/01.

## APP-02 safety requirement

Existing authoring capability is distributed across older V1/V2 controllers/packages. APP-02 must compose it natively against `ScoreDocumentV3 + NotationDocumentV4`; it must not use a lossy V4 -> V2 -> V4 editing round trip or maintain parallel mutable authorities.

Every accepted product edit must create exactly one direct-child canonical revision in the unified V4 history.

## Still fail-closed / gated

- standalone release before APP-09 product gate;
- SesliTab V4 product cutover before standalone product completion;
- split-chord cross-staff placement;
- grace/rest/percussion cross-staff placement;
- linked TAB as cross-staff target;
- beam/tie/slur/tuplet/ornament relations between independent source voices/staffs;
- V4-native cross-staff MusicXML round trip;
- polymeter/non-controlling topology;
- part groups/brackets/braces;
- arbitrary instrument transposition and percussion maps;
- renderer-coordinate authoring, DOM/SVG authority and host dual-write;
- E8-D direct external-engine invocation;
- cloud sync/collaboration/server revision authority;
- persistence/network/public-write/production activation;
- `.mxl` container support.
