# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for the standalone ST Score Editor App and later ST score products.

## Current reality

- **SSE-00–10 — COMPLETE / MERGED:** canonical V3/V4 score+notation, bounded MusicXML, topology and cross-staff runtime.
- **ST-SCORE-EDITOR-APP / PRODUCTIZATION — ACTIVE:** standalone editor app is the primary product target.
- **APP-00–08 — COMPLETE / MERGED:** document/runtime, unified V4 authoring, browser shell, local files/recovery, guarded renderer interaction, viewport, local playback and bounded export/print.
- **APP-09 / APP-09B — AUTOMATED HARDENING COMPLETE / PHYSICAL IPHONE BLOCKER RESOLVED:** responsive/accessibility/recovery guards are merged; host-controlled renderer rerender fixes the physical iPhone Safari selection/orientation failure without renderer authority expansion.
- **APP-10A–O — COMPLETE / MERGED:** Guitar/Piano score starts, Voice 1–5 targeting/materialization, browser note-entry palette, exact selected-note edit/delete, semantic Staff/measure navigation, bounded synthetic measure growth, chord-tone authoring, two bounded articulation groups, two bounded local-ornament groups and exact explicit Flat/Natural/Sharp authoring.
- **Stage 07 semantic → renderer presentation locators — COMPLETE / MERGED:** PR #108 / `9429116bd5c92d4db4c4edbb21b307c6c74c2391` adds exact read-only current-revision `SemanticAddressV3 -> ScoreNoteRef/ScoreMeasureRef` lookup.
- **Standalone release gate — DEFERRED / STILL REQUIRED.**
- **SesliTab V4 product cutover — DEFERRED / NOT AUTHORIZED.**

## APP-10 browser reality

All actual edits converge on `ScoreDocumentV3 + NotationDocumentV4` through `EditorSessionV4`; renderer DOM/SVG/coordinates/geometry remain non-authoritative.

- APP-10H PR #113 / `8eccb176ec9b21e50b0a98ce207deb160a16f220`: bounded NEW/synthetic end-only measure growth.
- APP-10I PR #115 / `65e58c5a13760121c24a603e071aa72ec13f31d4`: presentation-only semantic previous/next measure navigation.
- APP-10J PR #117 / `578203792d43548c5b174ab7bd29da4819b22275`: exact `+Tone` chord construction.
- APP-10K PR #119 / `9fb9acc93d8121edff2ed97dee26d1213d035966`: Staccato/Accent/Tenuto exact articulation toggles.
- APP-10L PR #121 / `aeb08ecd71cad9a0b09b3ab44493d9fde5f19178`: Trill/Turn/Mordent exact local-ornament toggles.
- APP-10M PR #123 / `25940b118b37edec874f7df3865bdd3cecf9c720`: exact selected-note Flat/Natural/Sharp; canonical `pitch.alter` + `NoteNotation.accidental` update atomically.
- APP-10N PR #125 / `f3feae65ebb38a70ae09796c6d51f7cc6197a4fa`: Strong Accent/Staccatissimo/Spiccato exact articulation toggles.
- **APP-10O PR #127 / `75822e2a75db165692fa1fdba4c6c9a774682577`: Inverted Turn/Inverted Mordent/Shake exact local-ornament toggles through the existing V4 ornament authoring path.**
- APP-10O requires exact selected pitched event or exact note-parent event; new specs use `placement:'auto'` + `accidentalMarks:[]`.
- A single same-kind APP-10O ornament is removed using the exact existing `OrnamentSpec`; imported placement/accidental-mark semantics are not normalized. Multiple same-kind specs fail closed.
- APP-10O exposes no spanning tremolo/wavy-line relation authority and no grace-event ornament target authority.
- Imported MusicXML Inverted Turn add survives admitted lossless export/re-import; exact imported-style removal is covered.
- Exact-head WebKit covers APP-10O Guitar chord-event authoring, multi-measure isolation and Piano Staff 2 / Voice 5 isolation, while APP-10E–N and APP-09B remain green.

## Canonical boundary

```text
ScoreDocumentV3/3.0.0 + NotationDocumentV4/4.0.0
EditorSessionV4 = history authority
SemanticAddressV3 = exact source identity
MusicXML = exchange/projection only
Renderer geometry = non-authoritative
```

## Next bounded authoring candidate

APP-10O closes a second compact simple-ornament exposure gap. The next package is intentionally **not preselected**. Fresh repository reality must be audited before naming APP-10P. Augmentation dots still require timing-space admission; tuplets/ties/slurs and spanning ornaments require explicit multi-target contracts; grace workflows remain separately bounded.

## Remaining release gate

Device/browser validation remains mandatory before release or SesliTab cutover. Current practical targets remain real iPhone Safari, Android Chrome, Windows Edge, Windows Chrome and Windows Firefox; existing iPhone evidence is partial only.

```text
manualDeviceValidationRequired = true
standaloneReleaseGatePassed = false
seslitabCutoverAuthorized = false
```

`.mxl`, direct PDF-byte generation, V4-native cross-staff MusicXML, unsupported advanced scopes, cloud/server authority, public-write activation and E8-D direct external-engine invocation remain gated.
