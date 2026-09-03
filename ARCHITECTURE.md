# ST Score Editor Core — Architecture

Status: **SEC-NE and SSE-00–10 are merged. ST-SCORE-EDITOR-APP / PRODUCTIZATION is active; APP-00–08 are COMPLETE / MERGED and APP-09 is NEXT / NOT STARTED.**

## Product architecture

```text
Standalone HTML / Browser Shell
        |
        +--> browser-local file workflow (noncanonical)
        +--> recovery/autosave cache (noncanonical)
        +--> viewport state (presentation-only)
        +--> playback transport state (noncanonical)
        +--> export/print state (noncanonical)
        |
        v
STScoreEditorApp controller
        |
        v
ScoreEditorAppDocument
        |
        v
EditorSessionV4
        |
        +--> ScoreDocumentV3
        +--> NotationDocumentV4
        |
        +--> PlaybackPlanV1 --> local Web Audio
        +--> admitted lossless MusicXML --> explicit export handoff
        |
        v
RendererRequestV4
        |
        +--> admitted MusicXML projection --> attached renderer host
        +--> opaque manifest token --> SemanticAddressV3 selection
        +--> exact current presentation --> browser print / Save as PDF
```

A backend/service provider is not required for local editing, APP-07 playback or APP-08 export/print orchestration. SesliTab V4 integration remains deferred until APP-09 passes.

## Canonical authority

One product session owns exactly one current pair:

```text
ScoreDocumentV3/3.0.0 + NotationDocumentV4/4.0.0
```

`SemanticAddressV3` is revision-bound canonical source identity. MusicXML is exchange/projection data. Browser file handles, recovery state, shell state, viewport state, renderer DOM/SVG/geometry, playback state and export/print state are noncanonical.

Host/UI/playback/export/print layers cannot dual-write canonical score state. Canonical edits continue only through `EditorSessionV4` validation and unified V4 history.

## APP-01–05 product substrate

APP-01 owns New/Open/export/dirty/saved document lifecycle. APP-02 composes admitted V4 authoring in one history. APP-03 provides the standalone browser bundle/shell. APP-04 provides bounded `.musicxml/.xml` local open/save/download. APP-05 provides bounded browser-local recovery/autosave with explicit guarded apply.

## APP-06 renderer interaction and viewport

APP-06 is COMPLETE / MERGED. Rendering is driven only by current guarded `RendererRequestV4`; opaque current-revision manifest tokens resolve to semantic selection only; stale render/hit state fails closed. Renderer DOM/SVG/coordinates/geometry are never canonical edit targets. Viewport zoom/pan/native-scroll/page navigation is presentation-only.

Cross-staff presentation preserves original source ownership. Non-empty cross-staff placements still remain `CROSS_STAFF_XML_PENDING` with `musicXml = null`.

## APP-07 local playback transport

APP-07 is COMPLETE / MERGED through PR #85 / `0608e231b536299086cd3a516c5f221ca41b01e8`.

`PlaybackPlanV1` is a revision-bound derivative of validated `ScoreDocumentV3`; it is not a second score authority. Normal note/chord pitch and canonical onset/duration are scheduled locally, while unsupported grace timing stays explicit `deferred/partial`. Browser Web Audio transport supports play/pause/stop/seek and playback-only 20–300 BPM tempo. Playback never creates V4 history and stale playback stops on canonical revision change.

## APP-08 export/print/PDF workflow

APP-08 is COMPLETE / MERGED through PR #87 / `1d1c821be4c6192bdf562fcd2d9fde6f90f178fa`.

### MusicXML export boundary

APP-08 exposes a distinct `Export XML` handoff using the existing admitted lossless MusicXML exporter. It is intentionally not the APP-04 save workflow:

- export uses the current canonical score/notation pair only;
- lossless export admission still applies;
- export handoff creates no V4 history entry or canonical revision;
- successful export does not call `markSaved` and does not change dirty/saved identity;
- export state/revision reporting is presentation-only.

### Print/PDF boundary

`printCurrent()` first uses the existing guarded renderer lifecycle, then verifies that the accepted renderer presentation still matches the exact expected document and revision before invoking the browser print host.

Missing renderer attachment, rejected/pending projection, render failure or stale revision fails closed before print handoff. The print layer cannot select or mutate score content and creates no V4 history revision.

APP-08's PDF workflow is `browser-print-dialog-save-as-pdf`. The repository does **not** claim direct PDF byte generation. Print-specific CSS hides editor controls and resets presentation zoom only for paper output.

### Export/print authority result

APP-08 has no canonical, persistence, network, server-revision or publication authority. It introduces no schema change, `.mxl` support, SesliTab integration or E8-D invocation.

## Next product layer

**APP-09 — Product hardening and standalone release gate: NEXT / NOT STARTED.** Planned scope is iPhone/iPad/Safari and desktop browser hardening, touch/pointer/keyboard validation, performance, recovery, accessibility and release checklist.

## Remaining gates

Standalone release before APP-09 passes, SesliTab V4 cutover before APP-09, `.mxl`, V4-native cross-staff MusicXML, unsupported advanced cross-staff scopes, cloud/server revision authority, public-write/production activation and E8-D direct external-engine invocation remain gated.
