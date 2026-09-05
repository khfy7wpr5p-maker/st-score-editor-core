# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for the standalone ST Score Editor App and later ST score products.

## Current reality

- **SSE-00–10 — COMPLETE / MERGED:** canonical V3/V4 score+notation, bounded MusicXML, topology and cross-staff runtime.
- **ST-SCORE-EDITOR-APP / PRODUCTIZATION — ACTIVE:** standalone editor app is the primary product target.
- **APP-00–08 — COMPLETE / MERGED:** document/runtime, unified V4 authoring, browser shell, local files/recovery, guarded renderer interaction, viewport, local playback and bounded export/print.
- **APP-09 / APP-09B — AUTOMATED HARDENING COMPLETE / PHYSICAL IPHONE BLOCKER RESOLVED:** responsive/accessibility/recovery guards are merged; host-controlled renderer rerender fixes the physical iPhone Safari selection/orientation failure without renderer authority expansion.
- **APP-10A–L — COMPLETE / MERGED:** Guitar/Piano score starts, Voice 1–5 targeting/materialization, browser note-entry palette, exact selected-note edit/delete, explicit semantic Staff switching, bounded append-only synthetic measure-frame growth, presentation-only semantic previous/next measure navigation, exact palette-driven chord-tone authoring, bounded exact Staccato/Accent/Tenuto articulation toggles, and bounded exact Trill/Turn/Mordent local ornament toggles.
- **Stage 07 semantic → renderer presentation locators — COMPLETE / MERGED:** PR #108 / `9429116bd5c92d4db4c4edbb21b307c6c74c2391` adds exact read-only current-revision `SemanticAddressV3 -> ScoreNoteRef/ScoreMeasureRef` lookup.
- **Standalone release gate — DEFERRED FOR CURRENT DEVELOPMENT / STILL REQUIRED:** remaining physical Windows/Android/iOS browser evidence must be completed before release.
- **SesliTab V4 product cutover — DEFERRED / NOT AUTHORIZED:** no cutover until the standalone release matrix passes.

## Standalone product authority

```text
ST Score Editor App
        |
        +--> Guitar / Piano New-score selector (presentation state)
        +--> authoring palette: Staff / Voice 1–5 / pitch / accidental / octave / duration / Add measure / previous-next measure / +Tone / Stac-Acc-Ten / Trill-Turn-Mordent
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

The app consumes Core; it never becomes a second score authority. File handles, recovery records, authoring-palette/Staff/Voice/measure-navigation/articulation/ornament-control state, viewport state, renderer DOM/SVG/geometry, playback state, export/print state and release-hardening state remain noncanonical.

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
- APP-10H PR #113 / `8eccb176ec9b21e50b0a98ce207deb160a16f220` adds one compact `Add measure` control for NEW synthetic scores only;
- APP-10H appends exactly one document-global measure frame at the end, requires proven effective meter, gives every content-bearing staff one aligned `StaffMeasureV3` with Voice 1 + an explicit full-measure rest, leaves linked TAB measure ownership unchanged, and keeps imported MusicXML automatic growth fail-closed;
- the admitted synthetic path preserves deterministic `frame:1`, `frame:2`, ... identity so the existing lossless V3→V2 MusicXML projection remains available; non-lossless frame identity fails closed;
- APP-10I PR #115 / `65e58c5a13760121c24a603e071aa72ec13f31d4` adds compact previous/active-measure/next controls on top of exact semantic selection;
- APP-10I navigation remains same-part/same-staff and adjacent-frame only, preserves active Voice 1–5 presentation context, carries the current onset to a containing canonical event where available, and falls back to the exact target measure when that Voice is absent instead of implicitly creating it;
- measure navigation itself creates no canonical history revision and is available for imported MusicXML after an exact frame-bearing semantic selection; renderer DOM/SVG/coordinates/geometry never determine the target;
- APP-10J PR #117 / `578203792d43548c5b174ab7bd29da4819b22275` exposes the existing V4 `ADD_CHORD_TONE` primitive through one compact `+Tone` action;
- APP-10J requires an exact pitched event/note semantic selection, adds the current palette pitch as exactly one fresh tone per action, converts a single-note event into a chord or extends an existing chord, and selects the newly created exact note;
- rests and non-event selections fail closed; imported MusicXML exact chord-tone authoring is admitted and covered by lossless export/re-import; existing exact chord-tone Delete remains the complementary removal path;
- APP-10K PR #119 / `9fb9acc93d8121edff2ed97dee26d1213d035966` exposes bounded Staccato, Accent and Tenuto toggles through the existing V4 articulation authoring path;
- APP-10K requires an exact selected pitched event or note-parent event; new articulation specs use `placement:auto` and `direction:null`;
- if exactly one same-kind articulation already exists, the browser removes that exact existing spec so imported placement is not guessed or rewritten; if multiple same-kind specs exist, the browser fails closed as ambiguous;
- APP-10L PR #121 / `aeb08ecd71cad9a0b09b3ab44493d9fde5f19178` exposes bounded Trill, Turn and Mordent local ornament toggles through the existing V4 ornament authoring path;
- APP-10L requires an exact selected pitched event or note-parent event; new local ornament specs use `placement:auto` and an empty `accidentalMarks` list;
- if exactly one same-kind local ornament already exists, the browser removes that exact existing spec, preserving imported placement and accidental-mark semantics; if multiple same-kind local ornaments exist, the browser fails closed as ambiguous;
- spanning tremolo/wavy-line relation authority and grace-event ornament targeting are explicitly excluded from APP-10L;
- imported MusicXML local ornament add is covered by lossless export/re-import, including exact removal of an imported-style placed ornament with accidental-mark semantics;
- rest/non-event selections and unsupported articulation/ornament kinds fail closed; renderer DOM/SVG/coordinates/geometry never infer notation targets;
- Voice creation, measure append, note entry, selected-note mutations, chord-tone mutations, articulation mutations and local ornament mutations participate in unified `EditorSessionV4` undo/redo; Staff/measure navigation remains presentation-only;
- WebKit regression covers APP-10E note entry, APP-10F selected-note editing, APP-10G Piano Staff/Voice isolation, APP-10H Guitar/Piano measure growth, APP-10I navigation, APP-10J chord authoring, APP-10K articulation, APP-10L Guitar chord-event/multi-measure local ornaments and Piano Staff-2 Voice-5 local ornament isolation, and the APP-09B renderer/orientation chain.

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

`SemanticAddressV3` remains canonical source identity. MusicXML remains exchange/projection data. Renderer, authoring palette, Staff/Voice/measure/articulation/ornament-control choice, print and responsive-browser state never move canonical events outside `EditorSessionV4` authoring paths.

## Next bounded authoring candidate

APP-10L closes the first bounded local ornament exposure gap. The next package is intentionally **not preselected**. Fresh repository reality must be audited before naming APP-10M. Multi-target tremolo/wavy-line, tie/slur and grace workflows remain separate because they require explicit endpoint/target contracts rather than renderer inference.

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
