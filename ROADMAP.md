# Roadmap

## Current source of truth

Repository reality only; planned capability is not production capability.

## Completed baseline

- **E0–E7-H — COMPLETE**
- **E8-A/B/C — IMPLEMENTED**
- **E8-D — HUMAN-GATED / NOT AUTHORIZED**
- **SEC-KP-00–10 — COMPLETE**
- **SEC-NE-00–09 + XML ROUNDTRIP — COMPLETE / MERGED** within documented bounded profiles.
- **SSE-00–10 — COMPLETE / MERGED** including bounded V3 topology and V4 cross-staff runtime.

## ST-SCORE-EDITOR-APP / PRODUCTIZATION

The standalone ST Score Editor App is the active product target. SesliTab V4 product cutover is deferred until APP-09.

- **APP-00–04 — COMPLETE / MERGED:** standalone authority, document runtime, unified V4 authoring, browser shell and bounded local file workflow.
- **APP-05 — COMPLETE / MERGED:** validated browser-local recovery/autosave.
  - current canonical V3/V4 snapshot only; undo/redo history is not serialized;
  - SHA-256 integrity + canonical/metadata validation;
  - 64 MiB recovery payload bound;
  - IndexedDB cache only in standalone app; legacy core remains no-IndexedDB;
  - max 8 document recovery records;
  - autosave only after accepted dirty revisions;
  - stale digest/revision race cannot commit an older recovery over newer live state;
  - corrupt records fail closed;
  - automatic restore disabled;
  - explicit prepare/apply flow with active document/revision guard;
  - recovered snapshot revalidated before live adoption;
  - successful apply starts fresh V4 history and clears stale file association;
  - recovery remains noncanonical and `persistenceCapable:false`.
- **APP-06 — NEXT:** renderer interaction, semantic hit mapping, zoom/navigation.
- **APP-07 — PLANNED:** local playback transport.
- **APP-08 — PLANNED:** MusicXML export/print/PDF workflow.
- **APP-09 — PLANNED:** iPhone/iPad/desktop hardening, performance, accessibility and standalone release gate.

Local editing still requires no backend/service provider.

## Product safety result through APP-05

All edit surfaces converge on the same `ScoreDocumentV3 + NotationDocumentV4` session/history. File APIs and recovery cache cannot directly mutate canonical score state. Recovery can affect the live document only through explicit guarded application after canonical revalidation; silent or stale restore is rejected.

## Still fail-closed / gated

- standalone release before APP-09;
- SesliTab V4 cutover before APP-09 completion;
- split-chord/grace/rest/percussion cross-staff placement;
- linked TAB as cross-staff target;
- relations between independent source voices/staffs;
- V4-native cross-staff MusicXML round trip;
- polymeter/non-controlling topology;
- part groups/brackets/braces;
- arbitrary instrument transposition and percussion maps;
- renderer-coordinate authoring, DOM/SVG authority and host dual-write;
- E8-D direct external-engine invocation;
- cloud sync/collaboration/server revision authority;
- public-write/production activation;
- `.mxl` container support.
