# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for the standalone ST Score Editor App and later ST score products.

## Current reality

- **SSE-00–10 — COMPLETE / MERGED:** canonical V3/V4 score+notation, bounded MusicXML, topology and cross-staff runtime.
- **ST-SCORE-EDITOR-APP / PRODUCTIZATION — ACTIVE:** standalone editor app is the primary product target.
- **APP-00–08 — COMPLETE / MERGED:** document/runtime, unified V4 authoring, browser shell, local files/recovery, guarded renderer interaction, viewport, local playback and bounded export/print.
- **APP-09 / APP-09B — AUTOMATED HARDENING COMPLETE / PHYSICAL IPHONE BLOCKER RESOLVED:** responsive/accessibility/recovery guards are merged; host-controlled renderer rerender fixes the physical iPhone Safari selection/orientation failure without renderer authority expansion.
- **APP-10A–O — COMPLETE / MERGED:** Guitar/Piano score starts, Voice 1–5 targeting/materialization, browser note-entry palette, exact selected-note edit/delete, explicit semantic Staff switching, bounded append-only synthetic measure-frame growth, presentation-only semantic previous/next measure navigation, exact palette-driven chord-tone authoring, bounded exact articulation/local-ornament toggles, exact explicit Flat/Natural/Sharp authoring, a second bounded Strong Accent/Staccatissimo/Spiccato articulation group, and a second bounded Inverted Turn/Inverted Mordent/Shake local-ornament group.
- **Stage 07 semantic → renderer presentation locators — COMPLETE / MERGED:** PR #108 / `9429116bd5c92d4db4c4edbb21b307c6c74c2391` adds exact read-only current-revision `SemanticAddressV3 -> ScoreNoteRef/ScoreMeasureRef` lookup.
- **Standalone release gate — DEFERRED FOR CURRENT DEVELOPMENT / STILL REQUIRED:** remaining physical Windows/Android/iOS browser evidence must be completed before release.
- **SesliTab V4 product cutover — DEFERRED / NOT AUTHORIZED:** no cutover until the standalone release matrix passes.

## Standalone product authority

```text
ST Score Editor App
        |
        +--> Guitar / Piano New-score selector (presentation state)
        +--> authoring palette: Staff / Voice 1–5 / pitch / entry accidental / octave / duration / Add measure / previous-next measure / +Tone / Stac-Acc-Ten / SAcc-Staccis-Spic / Trill-Turn-Mordent / InvTurn-InvMord-Shake / explicit ♭-♮-♯
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
        +--> append-only synthetic measure-frame growth under proven meter
        +--> exact selected-note/chord-tone mutations through existing V4 basic authoring
        +--> exact bounded articulation mutations through existing V4 articulation authoring
        +--> exact bounded local ornament mutations through existing V4 ornament authoring
        +--> exact explicit accidental mutation through existing V4 keypad execution
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

The app consumes Core; it never becomes a second score authority. File handles, recovery records, authoring-palette/Staff/Voice/measure-navigation/articulation/ornament/explicit-accidental control state, viewport state, renderer DOM/SVG/geometry, playback state, export/print state and release-hardening state remain noncanonical.

## APP-10 authoring result

The current standalone browser can create admitted Guitar or Piano scores and perform bounded semantic authoring through one V4 history:

- Guitar starts with one G-clef standard staff;
- Piano grand staff starts as one Piano part with G/F standard staves;
- a new score receives a presentation-only exact semantic authoring anchor on its first standard staff / first frame / Voice 1 event, without creating history;
- active Staff switching is explicit and same-part/same-frame semantic only; it creates no history and cannot materialize a missing Voice;
- active Voice targeting is bounded to Voice 1–5;
- a missing Voice may be materialized only for synthetic/new scores when exact full-measure coverage is proven;
- note entry operates on revision-bound explicit-rest windows rather than renderer coordinates or hidden-silence guessing;
- browser entry controls expose pitch C–B, flat/natural/sharp alter, octave and whole through 1/16 duration;
- an exact selected note can apply palette pitch and an exact pitched event can apply duration; Delete converts a single-note event to rest or removes only the exact selected chord tone;
- APP-10H PR #113 / `8eccb176ec9b21e50b0a98ce207deb160a16f220` adds bounded NEW/synthetic end-only measure growth under proven meter, aligned across content-bearing staves, with deterministic `frame:N` identity;
- APP-10I PR #115 / `65e58c5a13760121c24a603e071aa72ec13f31d4` adds presentation-only previous/active/next semantic measure navigation without history or implicit Voice materialization;
- APP-10J PR #117 / `578203792d43548c5b174ab7bd29da4819b22275` exposes existing V4 `ADD_CHORD_TONE` through one exact semantic `+Tone` action; imported MusicXML chord add + lossless export/re-import is covered;
- APP-10K PR #119 / `9fb9acc93d8121edff2ed97dee26d1213d035966` exposes bounded Staccato/Accent/Tenuto toggles through existing V4 articulation authoring; same-kind ambiguity fails closed and imported placement is preserved on exact removal;
- APP-10L PR #121 / `aeb08ecd71cad9a0b09b3ab44493d9fde5f19178` exposes bounded Trill/Turn/Mordent local ornament toggles through existing V4 ornament authoring; same-kind ambiguity fails closed, imported placement/accidental-mark semantics are preserved, and spanning/grace ornament authority remains excluded;
- APP-10M PR #123 / `25940b118b37edec874f7df3865bdd3cecf9c720` exposes exact explicit Flat, Natural and Sharp authoring through the existing V4 keypad execution path;
- APP-10M requires exact `note` selection only; each admitted accidental action atomically updates canonical `pitch.alter` and `NoteNotation.accidental` while preserving note step/octave and exact chord-tone isolation;
- APP-10N PR #125 / `f3feae65ebb38a70ae09796c6d51f7cc6197a4fa` exposes Strong Accent, Staccatissimo and Spiccato through the same existing V4 articulation authoring authority used by APP-10K;
- APP-10N requires an exact selected pitched event or exact note-parent event; new specs use `placement:'auto'` and `direction:null`;
- if exactly one same-kind APP-10N articulation already exists, that exact `ArticulationSpec` is removed so imported placement/direction semantics are not guessed or normalized; multiple same-kind specs fail closed as ambiguous;
- APP-10N intentionally exposes no grace-event articulation target authority and does not alter APP-10K's original Staccato/Accent/Tenuto contract;
- imported MusicXML Strong Accent authoring is covered by lossless export/re-import; exact imported-style Strong Accent removal preserves placement/direction semantics by removing the exact spec rather than rewriting it;
- APP-10O PR #127 / `75822e2a75db165692fa1fdba4c6c9a774682577` exposes Inverted Turn, Inverted Mordent and Shake through the same existing V4 ornament authoring authority used by APP-10L;
- APP-10O requires an exact selected pitched event or exact note-parent event; new specs use `placement:'auto'` and `accidentalMarks:[]`;
- if exactly one same-kind APP-10O ornament already exists, that exact `OrnamentSpec` is removed so imported placement/accidental-mark semantics are not guessed or normalized; multiple same-kind specs fail closed as ambiguous;
- APP-10O intentionally exposes no spanning tremolo/wavy-line relation authority and no grace-event ornament target authority; APP-10L's original Trill/Turn/Mordent contract remains unchanged;
- imported MusicXML Inverted Turn authoring is covered by lossless export/re-import; exact imported-style removal preserves placement/accidental-mark semantics by removing the exact spec;
- renderer DOM/SVG/coordinates/geometry never infer note, accidental, articulation, ornament or timing targets;
- Voice creation, measure append, note entry, selected-note/chord-tone, articulation, local ornament and explicit accidental mutations participate in unified `EditorSessionV4` undo/redo; Staff/measure navigation remains presentation-only;
- exact-head WebKit retains APP-10E–N and APP-09B regressions and adds APP-10O Guitar chord-event extended local ornament, multi-measure isolation and Piano Staff-2 Voice-5 isolation.

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

`SemanticAddressV3` remains canonical source identity. MusicXML remains exchange/projection data. Renderer, palette and explicit-control state never move canonical events outside admitted `EditorSessionV4` authoring paths.

## Next bounded authoring candidate

APP-10O closes the second compact single-event local-ornament exposure gap. The next package is intentionally **not preselected**. Fresh repository reality must be audited before naming APP-10P. Augmentation dots still require timing-space admission because the existing primitive does not retime neighboring events; tuplets/ties/slurs and spanning ornaments require explicit multi-target contracts; grace workflows remain separately bounded.

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
