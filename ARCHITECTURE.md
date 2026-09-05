# ST Score Editor Core — Architecture

Status: **SEC-NE and SSE-00–10 are merged. ST-SCORE-EDITOR-APP APP-00–10N are COMPLETE / MERGED. Stage 07 exact semantic-to-render presentation locators are COMPLETE / MERGED. The remaining standalone device/browser release matrix is DEFERRED FOR CURRENT DEVELOPMENT but REQUIRED before release or SesliTab cutover.**

## Product architecture

```text
Standalone HTML / Browser Shell
        |
        +--> Guitar / Piano New-score selector (presentation state)
        +--> APP-10 authoring palette
        |      +--> exact semantic Staff selection
        |      +--> Voice 1–5
        |      +--> previous / active measure / next semantic navigation
        |      +--> pitch / entry accidental / octave / duration
        |      +--> bounded note entry
        |      +--> exact selected-note Pitch / Duration / Delete
        |      +--> exact selected pitched-event +Tone
        |      +--> bounded Staccato / Accent / Tenuto toggles
        |      +--> bounded Strong Accent / Staccatissimo / Spiccato toggles
        |      +--> bounded Trill / Turn / Mordent local ornament toggles
        |      +--> exact selected-note explicit Flat / Natural / Sharp
        |      +--> bounded Add measure for admitted synthetic scores
        +--> browser-local file workflow (noncanonical)
        +--> recovery/autosave cache (noncanonical)
        +--> viewport + APP-09 responsive hardening (presentation-only)
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
        +--> revision-bound insertion positions
        +--> safe Voice materialization for proven synthetic measures
        +--> append-only synthetic measure-frame topology mutation
        +--> exact basic authoring intents including ADD_CHORD_TONE / REMOVE_CHORD_TONE
        +--> exact V4 articulation authoring intents
        +--> exact V4 local ornament authoring intents
        +--> exact atomic V4 keypad accidental actions
        +--> unified authoring history / undo / redo
        +--> PlaybackPlanV1 --> local Web Audio
        +--> admitted lossless MusicXML --> explicit export handoff
        |
        v
RendererRequestV4
        |
        +--> admitted MusicXML projection --> attached renderer host
        +--> renderer ScoreNoteRef --> opaque manifest token --> SemanticAddressV3 selection
        +--> SemanticAddressV3 --> exact ScoreNoteRef / ScoreMeasureRef presentation locator
        +--> exact current presentation --> browser print / Save as PDF
```

A backend/service provider is not required for local editing, playback, export/print, APP-09 responsive hardening or APP-10 authoring. SesliTab V4 integration remains unauthorized until the standalone device/browser release matrix passes.

## Canonical authority

One product session owns exactly one current pair:

```text
ScoreDocumentV3/3.0.0 + NotationDocumentV4/4.0.0
```

`SemanticAddressV3` is revision-bound canonical source identity. MusicXML is exchange/projection data. Browser file handles, recovery state, shell state, active palette/Staff/Voice/measure-navigation/notation-control choice, viewport state, renderer DOM/SVG/geometry, playback state, export/print state and release-hardening state are noncanonical.

Host/UI/playback/export/print/hardening layers cannot dual-write canonical score state. Canonical edits continue only through `EditorSessionV4` validation and unified V4 history. APP-10G Staff switching and APP-10I measure navigation reuse exact semantic selection and therefore change presentation context without creating a canonical history revision.

## APP-01–09 product substrate

APP-01 owns document lifecycle. APP-02 composes admitted V4 authoring in one history. APP-03 provides the standalone browser bundle/shell. APP-04 provides bounded `.musicxml/.xml` local file workflow. APP-05 provides bounded browser-local recovery. APP-06 provides guarded renderer interaction and presentation-only viewport navigation. APP-07 provides revision-bound local playback. APP-08 provides noncanonical MusicXML export and exact-current-revision browser print/PDF handoff. APP-09/09B adds presentation/recovery hardening and host-controlled exact-current-revision rerender without canonical authority.

Cross-staff presentation preserves original source ownership. Non-empty cross-staff placements still remain `CROSS_STAFF_XML_PENDING` with `musicXml = null`.

## APP-10 standalone authoring workspace

### APP-10A–J — bounded core score authoring

APP-10A/B create admitted Guitar/Piano starts; APP-10C/D add revision-bound Voice 1–5 targeting/materialization; APP-10E exposes note entry; APP-10F adds exact selected-note edit/delete; APP-10G adds presentation-only Staff context; APP-10H adds bounded synthetic end growth; APP-10I adds presentation-only semantic measure navigation; APP-10J adds exact `+Tone`. Actual edits remain in unified `EditorSessionV4` history and renderer geometry never chooses targets.

### APP-10K — bounded exact articulation toggles

PR #119 / `9fb9acc93d8121edff2ed97dee26d1213d035966` exposes Staccato, Accent and Tenuto through existing V4 articulation authoring. Exact pitched event/note-parent semantics are required, new specs use auto placement/null direction, exact single existing same-kind specs are removed without placement normalization, and ambiguity fails closed.

### APP-10L — bounded exact local ornament toggles

PR #121 / `aeb08ecd71cad9a0b09b3ab44493d9fde5f19178` exposes Trill, Turn and Mordent through existing V4 local ornament authoring. Exact pitched event/note-parent semantics are required, new specs use auto placement with no accidental marks, exact imported placement/accidental-mark semantics are preserved on removal, same-kind ambiguity fails closed, and spanning tremolo/wavy-line plus grace-event ornament authority remain excluded.

### APP-10M — bounded exact explicit accidentals

PR #123 / `25940b118b37edec874f7df3865bdd3cecf9c720` exposes exact Flat/Natural/Sharp through existing V4 keypad execution. Exact note selection is required. Canonical `pitch.alter` and `NoteNotation.accidental` change atomically while note step/octave and sibling chord tones remain isolated. No advanced keypad target or dot/rest/tuplet/tie/slur surface is granted.

### APP-10N — bounded extended articulation toggles

PR #125 / `f3feae65ebb38a70ae09796c6d51f7cc6197a4fa` adds a second deliberately bounded single-event articulation surface without changing APP-10K or introducing a new notation mutation model.

The admitted browser profile is:

- kinds are exactly `strong-accent`, `staccatissimo` and `spiccato`;
- current selection must resolve exactly to a pitched normal event or a note whose exact parent event resolves semantically;
- rest, measure, document and other non-event targets fail closed;
- new browser-authored specs use `placement:'auto'` and `direction:null`;
- if exactly one same-kind articulation exists, the browser removes that exact `ArticulationSpec` rather than normalizing placement or Strong Accent direction;
- if multiple same-kind specs exist, the state is ambiguous and the toggle fails closed;
- Strong Accent imported `direction:'up'|'down'` semantics remain representable by the existing MusicXML importer/serializer; APP-10N does not invent a direction for new specs;
- every accepted operation uses existing `commitArticulation -> EditorSessionV4` and creates one canonical history revision;
- grace-event articulation target authority is explicitly excluded from this browser layer even though lower-level V4 authoring has a grace target type;
- APP-10K's Staccato/Accent/Tenuto bounded contract is unchanged;
- renderer DOM/SVG IDs, coordinates, nearest geometry and visual mark positions have no authoring authority;
- control pressed/disabled state is noncanonical presentation derived from current notation semantics.

Core regression proves all three kinds, undo/redo, imported MusicXML Strong Accent export/re-import, exact removal of imported-style Strong Accent placement/direction, same-kind ambiguity rejection, unsupported-kind rejection and non-pitched fail-closed behavior. Exact-head WebKit proves Guitar chord-event authoring, multi-measure isolation and Piano Staff 2 / Voice 5 isolation while APP-10E–M and APP-09B remain green.

## Next bounded authoring candidate

APP-10N closes a second compact single-event articulation exposure gap. No APP-10O scope is declared yet. Augmentation dots still need timing-space admission because their current primitive changes selected-event duration without retiming neighboring events. Tuplet/tie/slur and spanning ornaments require explicit multi-target endpoints; grace workflows remain separately bounded. Fresh repository reality must be audited before the next package is selected.

## Stage 07 semantic ↔ renderer presentation identity

Stage 07, merged through PR #108 / `9429116bd5c92d4db4c4edbb21b307c6c74c2391`, completes exact read-only reverse presentation lookup. Neither renderer-hit nor presentation-lookup direction accepts DOM/SVG identifiers, renderer coordinates, nearest-note distance, pitch guessing or radius heuristics as canonical evidence.

## Release gate status

```text
manualDeviceValidationRequired = true
standaloneReleaseGatePassed = false
seslitabCutoverAuthorized = false
```

Device validation is currently deferred while authoring-workspace development continues. Before release, the required practical matrix must be completed and recorded. Current required targets remain real iPhone Safari, Android Chrome, Windows Edge, Windows Chrome and Windows Firefox; real iPad Safari remains secondary. Existing iPhone evidence is partial and does not close the gate.

## Remaining gates

Manual device/browser validation, SesliTab V4 cutover, `.mxl`, V4-native cross-staff MusicXML, unsupported advanced cross-staff scopes, direct PDF-byte generation, cloud/server revision authority, public-write/production activation and E8-D direct external-engine invocation remain gated.
