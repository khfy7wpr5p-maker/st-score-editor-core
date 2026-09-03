# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for the standalone ST Score Editor App and later ST score products.

## Current reality

- **SSE-00–10 — COMPLETE / MERGED:** canonical V3/V4 score+notation, bounded MusicXML, topology and cross-staff runtime.
- **ST-SCORE-EDITOR-APP / PRODUCTIZATION — ACTIVE:** standalone editor app is the primary product target.
- **APP-00–04 — COMPLETE / MERGED:** standalone authority, document/runtime, unified V4 authoring, browser shell and bounded local file workflow.
- **APP-05 — COMPLETE / MERGED:** validated browser-local recovery/autosave with explicit guarded apply; recovery remains noncanonical.
- **APP-06 — COMPLETE / MERGED:** guarded renderer lifecycle, current-revision opaque-token semantic hit mapping and presentation-only zoom/navigation.
- **APP-07 — COMPLETE / MERGED:** revision-bound local playback plan and browser-local Web Audio transport; playback remains noncanonical and independent from edit admission.
- **APP-08 — COMPLETE / MERGED:** noncanonical MusicXML export plus exact-current-revision browser print/PDF handoff.
- **APP-09 — NEXT / NOT STARTED:** product hardening and standalone release gate.
- **SesliTab V4 product cutover — DEFERRED:** no SesliTab integration before APP-09 passes.

## Standalone product authority

```text
ST Score Editor App
        |
        +--> local file workflow (noncanonical)
        +--> IndexedDB recovery cache (noncanonical)
        +--> viewport zoom/pan/page state (presentation-only)
        +--> local playback transport (noncanonical)
        +--> export/print state (noncanonical)
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
        +--> revision-bound playback plan --> local Web Audio output
        |
        +--> admitted lossless MusicXML --> explicit export handoff
        |
        v
RendererRequestV4
        |
        +--> admitted projection --> renderer host (presentation-only)
        +--> opaque hit token --> SemanticAddressV3 selection
        +--> exact current rendered revision --> browser print dialog / Save as PDF
```

The app consumes Core; it never becomes a second score authority. Local editing, playback, export and print orchestration require no backend/service provider. File handles, recovery records, viewport state, renderer DOM/SVG/geometry, playback state and export/print state remain noncanonical.

## Local file and recovery safety

APP-04 admits `.musicxml/.xml` only, with a 32 MiB local bound. Save/download follows lossless-export-first ordering and marks saved only after the admitted external persistence handoff succeeds. File handles remain bound to canonical document ID.

APP-05 provides bounded browser-local recovery with SHA-256 integrity, canonical revalidation, no automatic restore and explicit guarded apply. Recovery storage never becomes canonical, server or publication authority.

## APP-06 renderer and viewport result

- current guarded `RendererRequestV4` only;
- revision-bound opaque token -> `SemanticAddressV3` selection only;
- stale render/hit state fails closed;
- DOM/SVG/coordinates/geometry never become edit authority;
- viewport zoom/pan/native-scroll/page state is presentation-only.

Cross-staff visual hits resolve original source semantic identity. Unsupported cross-staff MusicXML remains fail-closed.

## APP-07 local playback result

PR #85 / `0608e231b536299086cd3a516c5f221ca41b01e8` adds revision-bound `PlaybackPlanV1` and browser-local Web Audio transport. Play/pause/stop/seek, 20–300 BPM playback-only tempo and semantic cursor create no V4 history revision. Grace timing remains explicitly deferred/partial. Playback failures do not block authoring or OMR admission.

## APP-08 export/print result

PR #87 / `1d1c821be4c6192bdf562fcd2d9fde6f90f178fa` adds a bounded export/print surface:

- **Export XML** reuses the existing admitted lossless MusicXML export path but is an export handoff, not a save operation;
- successful APP-08 export does **not** call `markSaved`, does not change dirty/saved identity and creates no canonical revision/history entry;
- **Print / PDF** first renders and verifies the exact current canonical document/revision through the existing guarded renderer lifecycle;
- missing renderer, rejected projection or stale revision fails closed before browser print handoff;
- print CSS removes editor controls and resets presentation zoom for paper output without changing score state;
- PDF support is truthfully the browser print dialog's **Save as PDF** workflow; APP-08 does not claim or generate standalone PDF bytes;
- export/print has no network, backend, server-revision or publication authority.

## Canonical pair

```text
ScoreDocumentV3/3.0.0 + NotationDocumentV4/4.0.0
```

`SemanticAddressV3` remains canonical source identity. MusicXML remains exchange/projection data; renderer and print presentation do not move canonical events.

## Remaining gates

APP-09 iPhone/iPad/Safari and desktop hardening, performance, accessibility and standalone release validation is next and not started. `.mxl`, V4-native cross-staff MusicXML, unsupported advanced cross-staff scopes, cloud/server authority, public-write/production activation, E8-D direct external-engine invocation and SesliTab V4 cutover remain gated.

Full productization sequence: `docs/st-score-editor-app-productization.md`.
