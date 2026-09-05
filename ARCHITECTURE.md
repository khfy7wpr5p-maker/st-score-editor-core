# ST Score Editor Core — Architecture

Status: **SEC-NE and SSE-00–10 are merged. ST-SCORE-EDITOR-APP APP-00–10K are COMPLETE / MERGED. Stage 07 exact semantic-to-render presentation locators are COMPLETE / MERGED. The remaining standalone device/browser release matrix is DEFERRED FOR CURRENT DEVELOPMENT but REQUIRED before release or SesliTab cutover.**

## Product architecture

```text
Standalone HTML / Browser Shell
        |
        +--> Guitar / Piano New-score selector (presentation state)
        +--> APP-10 authoring palette
        |      +--> exact semantic Staff selection
        |      +--> Voice 1–5
        |      +--> previous / active measure / next semantic navigation
        |      +--> pitch / accidental / octave / duration
        |      +--> bounded note entry
        |      +--> exact selected-note Pitch / Duration / Delete
        |      +--> exact selected pitched-event +Tone
        |      +--> bounded Staccato / Accent / Tenuto toggles
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

`SemanticAddressV3` is revision-bound canonical source identity. MusicXML is exchange/projection data. Browser file handles, recovery state, shell state, active palette/Staff/Voice/measure-navigation/articulation-control choice, viewport state, renderer DOM/SVG/geometry, playback state, export/print state and release-hardening state are noncanonical.

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

### APP-10C — position note entry and Voice targeting

Authoring uses revision-bound insertion positions. Active Voice targeting is bounded to ordinals 1–5. Note entry may only replace/split an exact explicit-rest window; it does not infer timing from renderer coordinates, hidden silence or nearest visual position. Stale insertion positions fail closed.

### APP-10D — missing Voice materialization

A missing Voice 1–5 may be materialized only for a synthetic/new score when the current canonical measure proves exact full-measure coverage. The new Voice starts as one explicit full-measure rest with fresh identities. Imported MusicXML does not receive automatic invented Voices.

### APP-10E — browser authoring surface

The standalone browser runtime exposes Voice 1–5, pitch C–B, flat/natural/sharp, octave, whole through 1/16 duration and bounded note entry. Voice materialization and note entry stay in the same `EditorSessionV4` history.

### APP-10F — exact selected-note editing

PR #110 / `bc0c094af4a6e7b937882a3b09cfe6fd199f439a` exposes exact selected-note pitch edit, exact pitched-event duration edit, single-note-event Delete→rest and exact chord-tone Delete. Existing V4 basic-authoring intents remain the mutation authority; renderer geometry never chooses the target.

### APP-10G — explicit active Staff context

PR #111 / `47076403a2a41a322f7ee28c7595d55555fc05c7` adds presentation-only Staff controls. Staff switching is exact same-part/same-frame semantic selection, preserves active Voice context, creates no history and cannot materialize a missing Voice. New synthetic scores receive a presentation-only exact initial semantic anchor.

### APP-10H — bounded synthetic measure-frame growth

PR #113 / `8eccb176ec9b21e50b0a98ce207deb160a16f220` adds end-only synthetic measure-frame growth through the V4 topology/history path. Effective meter must be proven, every content-bearing staff gains one measure aligned to the same global frame, each new measure starts with Voice 1 + explicit full-measure rest, Voice 2–5 remain explicit, linked TAB owns no measure, and imported MusicXML automatic growth fails closed. Deterministic `frame:1`, `frame:2`, ... identity preserves the admitted lossless MusicXML bridge.

### APP-10I — semantic previous/next measure navigation

PR #115 / `65e58c5a13760121c24a603e071aa72ec13f31d4` adds presentation-only previous/active/next measure controls. Navigation is same-part/same-staff and adjacent-frame only, preserves active Voice context, carries the semantic onset to a containing event where possible, falls back to the exact measure when the active Voice is absent, never materializes a Voice and creates no canonical history revision. Imported MusicXML navigation is admitted from exact frame-bearing semantic context.

### APP-10J — bounded chord-tone authoring

PR #117 / `578203792d43548c5b174ab7bd29da4819b22275` exposes the already-admitted V4 `ADD_CHORD_TONE` primitive through the standalone palette rather than introducing a new chord mutation model.

The browser contract is deliberately narrow:

- one compact `+Tone` action is exposed;
- current selection must resolve exactly to a pitched normal event or one exact note inside that event;
- rests, document/part/staff/measure/voice selections and stale/non-resolving targets fail closed;
- each action adds exactly one fresh note identity using the current palette pitch;
- a single-note event becomes a chord while preserving event onset/duration and original tone identity;
- an existing chord gains exactly one new tone;
- the newly created tone becomes exact `SemanticAddressV3` note selection;
- the action uses the existing `commitBasic -> ADD_CHORD_TONE -> EditorSessionV4` path and creates exactly one canonical history revision;
- APP-10F exact chord-tone Delete remains the complementary removal path;
- imported MusicXML exact chord-tone authoring is admitted and covered by lossless export/re-import;
- renderer DOM/SVG/coordinates/nearest geometry never infer the event or pitch target;
- palette state remains presentation-only; it supplies the requested pitch but cannot mutate score state by itself.

### APP-10K — bounded exact articulation toggles

PR #119 / `9fb9acc93d8121edff2ed97dee26d1213d035966` exposes a deliberately small notation-mark surface on top of the existing `editor-articulation-authoring-v4` path.

The admitted browser profile is:

- compact Staccato, Accent and Tenuto controls only;
- current selection must resolve exactly to a pitched normal event or a note whose exact parent event is resolved semantically;
- rests and non-event selections fail closed;
- new browser-authored specs use `placement:'auto'` and `direction:null`;
- if exactly one articulation of the requested kind already exists, the browser removes that exact existing spec rather than normalizing or guessing its placement;
- if more than one same-kind spec exists, the state is ambiguous and that browser toggle fails closed;
- unsupported articulation kinds cannot be passed through the bounded browser method;
- every accepted add/remove uses the existing `commitArticulation -> EditorSessionV4` path and creates one canonical history revision;
- imported MusicXML articulation add remains inside the admitted lossless projection and is covered by export/re-import;
- renderer DOM/SVG IDs, coordinates, nearest geometry and visual mark position have no authoring authority;
- control pressed/disabled state is derived from current canonical notation semantics and is itself noncanonical.

Core coverage proves Staccato/Accent/Tenuto add/remove, undo/redo, imported MusicXML round-trip, exact removal of an imported-style placed articulation, ambiguous same-kind fail-closed behavior, unsupported-kind rejection and non-pitched selection rejection. WebKit proves articulation on a Guitar chord event, separate articulation state across APP-10H/10I multi-measure navigation, and Piano Staff 2 / Voice 5 isolation while APP-10E/F/G/H/I/J and APP-09B remain in the same exact-head gate.

## Next bounded authoring candidate

APP-10K closes the first compact articulation exposure gap. No APP-10L scope is declared yet. Fresh repository reality must be audited before selecting the next bounded authoring package. Existing ornament, grace and keypad/relation primitives remain candidates, but multi-target workflows require explicit selection contracts and must not be inferred from renderer geometry.

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
