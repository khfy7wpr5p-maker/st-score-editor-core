# ST Score Editor Core — Architecture

Status: **SEC-NE and SSE-00–10 are merged. ST-SCORE-EDITOR-APP APP-00–10E are COMPLETE / MERGED. Stage 07 exact semantic-to-render presentation locators are COMPLETE / MERGED. The remaining standalone device/browser release matrix is DEFERRED FOR CURRENT DEVELOPMENT but REQUIRED before release or SesliTab cutover.**

## Product architecture

```text
Standalone HTML / Browser Shell
        |
        +--> Guitar / Piano New-score selector (presentation state)
        +--> APP-10E authoring palette
        |      +--> Voice 1–5
        |      +--> pitch / accidental / octave / duration
        |      +--> bounded note entry
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

`SemanticAddressV3` is revision-bound canonical source identity. MusicXML is exchange/projection data. Browser file handles, recovery state, shell state, active palette/Voice choice, viewport state, renderer DOM/SVG/geometry, playback state, export/print state and release-hardening state are noncanonical.

Host/UI/playback/export/print/hardening layers cannot dual-write canonical score state. Canonical edits continue only through `EditorSessionV4` validation and unified V4 history.

## APP-01–08 product substrate

APP-01 owns document lifecycle. APP-02 composes admitted V4 authoring in one history. APP-03 provides the standalone browser bundle/shell. APP-04 provides bounded `.musicxml/.xml` local file workflow. APP-05 provides bounded browser-local recovery. APP-06 provides guarded renderer interaction and presentation-only viewport navigation. APP-07 provides revision-bound local playback. APP-08 provides noncanonical MusicXML export and exact-current-revision browser print/PDF handoff.

Cross-staff presentation preserves original source ownership. Non-empty cross-staff placements still remain `CROSS_STAFF_XML_PENDING` with `musicXml = null`.

## APP-09 / APP-09B presentation hardening

APP-09 automated hardening remains presentation/recovery only. It provides dynamic viewport sizing, safe-area support, coarse-pointer target sizing, accessibility semantics, best-effort recovery lifecycle handling and the standalone bundle budget without canonical/history authority.

APP-09B resolved the physical iPhone renderer interaction blocker without weakening the renderer boundary. Interactive OSMD runs with `autoResize:false`; resize/orientation/`visualViewport` lifecycle requests a controlled render of the exact current revision so the renderer rebuilds its live SVG and ownership index. This rerender is presentation-only and creates no canonical revision.

Physical iPhone Safari evidence proved note selection and portrait → landscape → portrait selection after the permanent policy. That evidence is not equivalent to completion of the full release matrix.

## APP-10 standalone authoring workspace

### APP-10A/B — admitted score starts

The user-facing New workflow admits two explicit product presets:

- `GUITAR_TREBLE`: one standard G-clef staff;
- `PIANO_GRAND_STAFF`: one Piano part with two standard G/F staves.

Both are canonical V4 app documents from creation. The Piano grand-staff preset has admitted renderer/export projection and MusicXML export/re-import coverage. The compact Guitar/Piano selector is presentation state only; it does not become score authority.

### APP-10C — position note entry and Voice targeting

Authoring uses revision-bound insertion positions. Active Voice targeting is bounded to ordinals 1–5. Note entry may only replace/split an exact explicit-rest window; it does not infer timing from renderer coordinates, hidden silence or nearest visual position. Stale insertion positions fail closed.

### APP-10D — missing Voice materialization

A missing Voice 1–5 may be materialized only for a synthetic/new score when the current canonical measure proves exact full-measure coverage. The new Voice starts as one explicit full-measure rest with fresh identities. Imported MusicXML does not receive automatic invented Voices.

### APP-10E — browser authoring surface

The standalone browser runtime exposes a compact authoring workspace with:

- Voice 1–5;
- pitch C–B;
- flat / natural / sharp;
- octave selection;
- durations from whole through 1/16;
- bounded note entry at the selected semantic event time.

Voice materialization and note entry stay in the same `EditorSessionV4` history, so undo/redo remains unified. WebKit regression covers Guitar Voice-5 authoring and Piano lower-staff isolation.

## Stage 07 semantic ↔ renderer presentation identity

Stage 07, merged through PR #108 / `9429116bd5c92d4db4c4edbb21b307c6c74c2391`, completes the exact reverse presentation lookup needed for issue/score synchronization:

```text
Renderer hit direction:
ScoreNoteRef
   -> opaque current-revision manifest token
   -> SemanticAddressV3
   -> editor-owned selection

Presentation lookup direction:
SemanticAddressV3
   -> exact current-revision ScoreNoteRef or ScoreMeasureRef
   -> renderer highlight/cursor locator
```

The reverse lookup is read-only. It does not select, edit or append history merely by resolving a locator. Non-note targets abstain from note highlighting while their exact measure locator may still be available. Stale presentation identity remains fail-closed.

Neither direction accepts DOM/SVG identifiers, renderer coordinates, nearest-note distance, pitch guessing or radius heuristics as canonical evidence.

## Release gate status

```text
manualDeviceValidationRequired = true
standaloneReleaseGatePassed = false
seslitabCutoverAuthorized = false
```

Device validation is currently deferred while authoring-workspace development continues. Before release, the required practical matrix must be completed and recorded. Current required targets are real iPhone Safari, Android Chrome, Windows Edge, Windows Chrome and Windows Firefox; real iPad Safari remains a deferred secondary validation target. Existing iPhone evidence is partial and does not by itself close the gate.

## Remaining gates

Manual device/browser validation, SesliTab V4 cutover, `.mxl`, V4-native cross-staff MusicXML, unsupported advanced cross-staff scopes, direct PDF-byte generation, cloud/server revision authority, public-write/production activation and E8-D direct external-engine invocation remain gated.
