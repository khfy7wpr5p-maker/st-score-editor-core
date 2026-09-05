# ST Score Editor Core — Architecture

Status: **SEC-NE and SSE-00–10 are merged. ST-SCORE-EDITOR-APP APP-00–10M are COMPLETE / MERGED. Stage 07 exact semantic-to-render presentation locators are COMPLETE / MERGED. The remaining standalone device/browser release matrix is DEFERRED FOR CURRENT DEVELOPMENT but REQUIRED before release or SesliTab cutover.**

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

## APP-01–08 product substrate

APP-01 owns document lifecycle. APP-02 composes admitted V4 authoring in one history. APP-03 provides the standalone browser bundle/shell. APP-04 provides bounded `.musicxml/.xml` local file workflow. APP-05 provides bounded browser-local recovery. APP-06 provides guarded renderer interaction and presentation-only viewport navigation. APP-07 provides revision-bound local playback. APP-08 provides noncanonical MusicXML export and exact-current-revision browser print/PDF handoff.

Cross-staff presentation preserves original source ownership. Non-empty cross-staff placements still remain `CROSS_STAFF_XML_PENDING` with `musicXml = null`.

## APP-09 / APP-09B presentation hardening

APP-09 automated hardening remains presentation/recovery only. It provides dynamic viewport sizing, safe-area support, coarse-pointer target sizing, accessibility semantics, best-effort recovery lifecycle handling and the standalone bundle budget without canonical/history authority.

APP-09B resolved the physical iPhone renderer interaction blocker without weakening the renderer boundary. Interactive OSMD runs with `autoResize:false`; resize/orientation/`visualViewport` lifecycle requests a controlled render of the exact current revision so the renderer rebuilds its live SVG and ownership index. This rerender is presentation-only and creates no canonical revision.

Physical iPhone Safari evidence proved note selection and portrait → landscape → portrait selection after the permanent policy. That evidence is not equivalent to completion of the full release matrix.

## APP-10 standalone authoring workspace

### APP-10A/B — admitted score starts

The user-facing New workflow admits two explicit product presets: `GUITAR_TREBLE` and `PIANO_GRAND_STAFF`. Both are canonical V4 app documents from creation. Piano grand staff is one Piano part with G/F standard staves and has admitted renderer/export/re-import coverage. The selector is presentation state only.

### APP-10C–J — bounded core score authoring

APP-10C adds revision-bound insertion positions and Voice 1–5; APP-10D safely materializes missing synthetic Voices under proven full-measure coverage; APP-10E exposes browser note entry; APP-10F adds exact selected-note edit/delete; APP-10G adds presentation-only Staff context; APP-10H adds bounded synthetic end-of-score measure growth; APP-10I adds presentation-only semantic previous/next measure navigation; APP-10J adds exact `+Tone` chord construction. All actual mutations remain in unified `EditorSessionV4` history and renderer geometry never chooses canonical targets.

### APP-10K — bounded exact articulation toggles

PR #119 / `9fb9acc93d8121edff2ed97dee26d1213d035966` exposes Staccato, Accent and Tenuto through existing V4 articulation authoring. Exact pitched event/note-parent event semantics are required, new specs use auto placement/null direction, exact single existing same-kind specs are removed without placement normalization, and ambiguity fails closed.

### APP-10L — bounded exact local ornament toggles

PR #121 / `aeb08ecd71cad9a0b09b3ab44493d9fde5f19178` exposes Trill, Turn and Mordent through existing V4 local ornament authoring. Exact pitched event/note-parent event semantics are required, new specs use auto placement with no accidental marks, exact imported placement/accidental-mark semantics are preserved on removal, same-kind ambiguity fails closed, and spanning tremolo/wavy-line plus grace-event ornament authority remain excluded.

### APP-10M — bounded exact explicit accidentals

PR #123 / `25940b118b37edec874f7df3865bdd3cecf9c720` exposes a deliberately narrow subset of the already-admitted V4 keypad execution contract rather than adding another pitch or notation mutation model.

The admitted browser profile is:

- explicit controls are exactly Flat, Natural and Sharp;
- current selection must be exact `SemanticAddressV3` kind `note`; event, rest, measure, document and other selections fail closed instead of being inferred as note targets;
- browser actions call the existing `commitKeypad` path with `accidental.flat`, `accidental.natural` or `accidental.sharp`;
- the canonical keypad executor atomically changes the exact note's `pitch.alter` to -1/0/+1 and `NoteNotation.accidental` to flat/natural/sharp in the same revision;
- note step and octave are not mutation targets of the accidental action;
- on chords, only the exact selected note identity changes; sibling chord tones and their notation remain untouched;
- each accepted action creates exactly one `EditorSessionV4` history revision and selection remains rebound to the exact note in the new revision;
- no `EVENT_RANGE`, `NOTE_PAIR` or other advanced keypad target authority is exposed by APP-10M;
- dot, rest, tuplet, tie and slur keypad actions are not surfaced by this package;
- imported MusicXML explicit accidental authoring is admitted from exact note selection and covered by lossless export/re-import, including explicit Natural;
- renderer DOM/SVG IDs, coordinates, nearest geometry and visual accidental position have no authoring authority;
- explicit accidental button pressed/disabled state is presentation state derived from current canonical note/notation semantics.

Core/browser regression proves Flat/Natural/Sharp atomic score+notation updates, undo/redo, step/octave preservation, exact chord-tone isolation, imported MusicXML explicit accidental export/re-import, unsupported-kind rejection and non-note fail-closed behavior. Exact-head WebKit proves Guitar exact-tone accidental authoring, APP-10H/10I multi-measure accidental isolation and Piano Staff 2 / Voice 5 accidental isolation while APP-10E–L and APP-09B regressions remain in the same gate.

## Next bounded authoring candidate

APP-10M closes the explicit accidental gap but does not make all existing keypad actions safe product controls. No APP-10N scope is declared yet. In particular, augmentation-dot execution changes the selected event's canonical duration without retiming neighboring events, so any future dot surface needs an explicit timing-space admission contract. Tuplet/tie/slur and spanning ornaments require explicit multi-target endpoints; grace workflows remain separately bounded. Fresh repository reality must be audited before the next package is selected.

## Stage 07 semantic ↔ renderer presentation identity

Stage 07, merged through PR #108 / `9429116bd5c92d4db4c4edbb21b307c6c74c2391`, completes exact read-only reverse presentation lookup:

```text
Renderer hit direction:
ScoreNoteRef -> opaque current-revision manifest token -> SemanticAddressV3 -> editor-owned selection

Presentation lookup direction:
SemanticAddressV3 -> exact current-revision ScoreNoteRef or ScoreMeasureRef -> renderer highlight/cursor locator
```

Neither direction accepts DOM/SVG identifiers, renderer coordinates, nearest-note distance, pitch guessing or radius heuristics as canonical evidence.

## Release gate status

```text
manualDeviceValidationRequired = true
standaloneReleaseGatePassed = false
seslitabCutoverAuthorized = false
```

Device validation is currently deferred while authoring-workspace development continues. Before release, the required practical matrix must be completed and recorded. Current required targets remain real iPhone Safari, Android Chrome, Windows Edge, Windows Chrome and Windows Firefox; real iPad Safari remains secondary. Existing iPhone evidence is partial and does not close the gate.

## Remaining gates

Manual device/browser validation, SesliTab V4 cutover, `.mxl`, V4-native cross-staff MusicXML, unsupported advanced cross-staff scopes, direct PDF-byte generation, cloud/server revision authority, public-write/production activation and E8-D direct external-engine invocation remain gated.
