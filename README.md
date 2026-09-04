# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for the standalone ST Score Editor App and later ST score products.

## Current reality

- **SSE-00–10 — COMPLETE / MERGED:** canonical V3/V4 score+notation, bounded MusicXML, topology and cross-staff runtime.
- **ST-SCORE-EDITOR-APP / PRODUCTIZATION — ACTIVE:** standalone editor app is the primary product target.
- **APP-00–08 — COMPLETE / MERGED:** document/runtime, unified V4 authoring, browser shell, local files/recovery, guarded renderer interaction, viewport, local playback and bounded export/print.
- **APP-09 / APP-09B — AUTOMATED HARDENING COMPLETE / PHYSICAL IPHONE BLOCKER RESOLVED:** responsive/accessibility/recovery guards are merged; host-controlled renderer rerender fixes the physical iPhone Safari selection/orientation failure without renderer authority expansion.
- **APP-10A–G — COMPLETE / MERGED:** Guitar/Piano score starts, Voice 1–5 targeting/materialization, browser note-entry palette, exact selected-note edit/delete, and explicit semantic Staff switching for multi-staff scores.
- **Stage 07 semantic → renderer presentation locators — COMPLETE / MERGED:** PR #108 / `9429116bd5c92d4db4c4edbb21b307c6c74c2391` adds exact read-only current-revision `SemanticAddressV3 -> ScoreNoteRef/ScoreMeasureRef` lookup.
- **Standalone release gate — DEFERRED FOR CURRENT DEVELOPMENT / STILL REQUIRED:** remaining physical Windows/Android/iOS browser evidence must be completed before release.
- **SesliTab V4 product cutover — DEFERRED / NOT AUTHORIZED:** no cutover until the standalone release matrix passes.

## Standalone product authority

```text
ST Score Editor App
        |
        +--> Guitar / Piano New-score selector (presentation state)
        +--> authoring palette: Staff / Voice 1–5 / pitch / accidental / octave / duration
        +--> exact selected-note Pitch / Duration / Delete actions
        +--> local file workflow (noncanonical)
        +--> IndexedDB recovery cache (noncanonical)
        +--> viewport + responsive hardening (presentation-only)
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
        +--> revision-bound insertion positions / bounded note entry
        +--> safe synthetic-score Voice materialization
        +--> exact selected-note/chord-tone edits
        +--> unified undo / redo
        +--> revision-bound playback plan --> local Web Audio output
        +--> admitted lossless MusicXML --> explicit export handoff
        |
        v
RendererRequestV4
        |
        +--> admitted projection --> renderer host (presentation-only)
        +--> ScoreNoteRef --> opaque hit token --> SemanticAddressV3 selection
        +--> SemanticAddressV3 --> exact ScoreNoteRef / ScoreMeasureRef presentation locator
        +--> exact current rendered revision --> browser print dialog / Save as PDF
```

The app consumes Core; it never becomes a second score authority. File handles, recovery records, authoring-palette/Staff/Voice state, viewport state, renderer DOM/SVG/geometry, playback state, export/print state and release-hardening state remain noncanonical.

## APP-10 authoring result

The current standalone browser can create admitted Guitar or Piano scores and perform bounded semantic authoring through one V4 history:

- Guitar starts with one G-clef standard staff;
- Piano grand staff starts as one Piano part with G/F standard staves;
- a new score receives a presentation-only exact semantic authoring anchor on its first standard staff / first frame / Voice 1 event, without creating history;
- active Staff switching is explicit and same-part/same-frame semantic only; it creates no history and cannot materialize a missing Voice;
- active Voice targeting is bounded to Voice 1–5;
- a missing Voice may be materialized only for synthetic/new scores when exact full-measure coverage is proven;
- note entry operates on revision-bound explicit-rest windows rather than renderer coordinates or hidden-silence guessing;
- browser controls expose pitch C–B, flat/natural/sharp, octave and whole through 1/16 duration;
- an exact selected note can apply palette pitch and duration; Delete converts a single-note event to rest or removes only the exact selected chord tone;
- Voice creation, note entry and selected-note mutations participate in unified `EditorSessionV4` undo/redo;
- WebKit regression covers APP-10E note entry, APP-10F selected-note editing, APP-10G Piano Staff switching/Voice-5 isolation, and the APP-09B renderer/orientation chain.

## Renderer identity boundary

Renderer presentation has exact identity paths in both directions without becoming score authority:

```text
Renderer hit:
ScoreNoteRef -> opaque current-revision token -> SemanticAddressV3 -> editor selection

Presentation lookup:
SemanticAddressV3 -> exact current-revision ScoreNoteRef / ScoreMeasureRef
```

DOM/SVG identifiers, coordinates, nearest-note distance, pitch guesses and radius heuristics are not canonical evidence. Stale render identity fails closed.

## Canonical pair

```text
ScoreDocumentV3/3.0.0 + NotationDocumentV4/4.0.0
```

`SemanticAddressV3` remains canonical source identity. MusicXML remains exchange/projection data. Renderer, authoring palette, Staff/Voice choice, print and responsive-browser state never move canonical events outside `EditorSessionV4` authoring paths.

## Remaining release gate

Device/browser validation is deliberately deferred while authoring-workspace development continues. It remains mandatory before release or SesliTab cutover.

Current required practical targets are real iPhone Safari, Android Chrome, Windows 10/11 Edge, Windows Chrome and Windows Firefox. Physical iPhone evidence already includes semantic note selection and portrait → landscape → portrait G4 PASS, but the full iPhone release row is not yet complete. Real iPad Safari remains a deferred secondary validation target.

Until the matrix passes:

```text
manualDeviceValidationRequired = true
standaloneReleaseGatePassed = false
seslitabCutoverAuthorized = false
```

`.mxl`, direct PDF-byte generation, V4-native cross-staff MusicXML, unsupported advanced cross-staff scopes, cloud/server authority, public-write/production activation and E8-D direct external-engine invocation also remain gated.

Full productization sequence: `docs/st-score-editor-app-productization.md`.
