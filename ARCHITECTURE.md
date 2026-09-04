# ST Score Editor Core — Architecture

Status: **SEC-NE and SSE-00–10 are merged. ST-SCORE-EDITOR-APP APP-00–10I are COMPLETE / MERGED. Stage 07 exact semantic-to-render presentation locators are COMPLETE / MERGED. The remaining standalone device/browser release matrix is DEFERRED FOR CURRENT DEVELOPMENT but REQUIRED before release or SesliTab cutover.**

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
        +--> exact selected-note/chord-tone authoring intents
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

`SemanticAddressV3` is revision-bound canonical source identity. MusicXML is exchange/projection data. Browser file handles, recovery state, shell state, active palette/Staff/Voice/measure-navigation choice, viewport state, renderer DOM/SVG/geometry, playback state, export/print state and release-hardening state are noncanonical.

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

The user-facing New workflow admits two explicit product presets:

- `GUITAR_TREBLE`: one standard G-clef staff;
- `PIANO_GRAND_STAFF`: one Piano part with two standard G/F staves.

Both are canonical V4 app documents from creation. The Piano grand-staff preset has admitted renderer/export projection and MusicXML export/re-import coverage. The compact Guitar/Piano selector is presentation state only; it does not become score authority.

### APP-10C — position note entry and Voice targeting

Authoring uses revision-bound insertion positions. Active Voice targeting is bounded to ordinals 1–5. Note entry may only replace/split an exact explicit-rest window; it does not infer timing from renderer coordinates, hidden silence or nearest visual position. Stale insertion positions fail closed.

### APP-10D — missing Voice materialization

A missing Voice 1–5 may be materialized only for a synthetic/new score when the current canonical measure proves exact full-measure coverage. The new Voice starts as one explicit full-measure rest with fresh identities. Imported MusicXML does not receive automatic invented Voices.

### APP-10E — browser authoring surface

The standalone browser runtime exposes a compact authoring workspace with Voice 1–5, pitch C–B, flat/natural/sharp, octave selection, durations from whole through 1/16 and bounded note entry at the selected semantic event time.

Voice materialization and note entry stay in the same `EditorSessionV4` history, so undo/redo remains unified.

### APP-10F — exact selected-note editing

PR #110 / `bc0c094af4a6e7b937882a3b09cfe6fd199f439a` exposes existing V4 semantic authoring primitives through the browser without introducing a second mutation path:

- exact selected note may apply the current palette pitch;
- exact selected pitched event may apply the current palette duration;
- Delete on a single-note event converts that event to an explicit rest;
- Delete on an exact selected chord tone removes only that tone and preserves the remaining event/tone;
- all mutations use unified `EditorSessionV4` history and remain stale-target/fail-closed.

The browser layer does not infer a target from renderer coordinates or geometry.

### APP-10G — explicit active Staff context

PR #111 / `47076403a2a41a322f7ee28c7595d55555fc05c7` adds presentation-only active Staff controls for standard staves in the current part.

Staff switching is admitted only through exact same-part/same-measure-frame semantic identity. It preserves the current active Voice ordinal but cannot materialize that Voice on the target Staff. If the active Voice does not exist there, selection lands on the exact target measure and the user must explicitly invoke the existing Voice materialization action where admitted.

Staff switching creates no canonical history revision. It never uses DOM/SVG coordinates, nearest-staff geometry or pitch inference.

A newly created synthetic Guitar/Piano score receives a presentation-only exact semantic authoring anchor on the first standard staff / first frame / Voice 1 explicit event. This solves blank-score entry without granting renderer-rest hit authority and without creating history.

### APP-10H — bounded synthetic measure-frame growth

PR #113 / `8eccb176ec9b21e50b0a98ce207deb160a16f220` closes the one-frame synthetic-score authoring limit without reviving the legacy structural-authoring model or creating a parallel score authority.

The new `APPEND_SYNTHETIC_MEASURE_FRAME` topology intent lives in the current V4 topology path and is committed through `EditorSessionV4` as exactly one canonical history revision. Its admission profile is deliberately narrow:

- only NEW/synthetic scores are exposed by the browser workflow;
- append is end-only; middle insertion, reorder and measure deletion remain outside scope;
- the revision-bound document target must be current;
- effective meter must be proven from canonical notation inheritance before a frame is created;
- one document-global frame is appended and every content-bearing standard/percussion staff receives exactly one `StaffMeasureV3` aligned to that frame;
- each new measure starts with Voice 1 plus one explicit full-measure rest at onset zero;
- Voice 2–5 remain explicit APP-10D materialization and are never invented by measure append;
- tablature-linked staves keep the existing ownership contract and receive no owned measure;
- imported MusicXML automatic growth fails closed;
- renderer DOM/SVG/coordinates/nearest visual timing provide no identity or timing authority.

The admitted synthetic MusicXML bridge requires deterministic frame identity. APP-10H therefore preserves the sequence `frame:1`, `frame:2`, ... and the core rejects a custom/non-lossless next frame identity. This keeps the existing lossless V3→V2 MusicXML projection available instead of silently degrading to a pending projection.

After the one canonical append commit, the browser may move selection to the exact new explicit-rest `SemanticAddressV3`; that navigation is presentation-only and creates no second history revision. Undo/redo therefore reverses/restores the append through the same V4 history used by Voice creation, note entry and selected-note editing.

Core regression covers Guitar/Piano alignment, full-measure rests, undo/redo, stale target, missing meter evidence, imported-score fail-closed behavior, deterministic frame identity and Piano two-measure MusicXML export/re-import. WebKit additionally covers Guitar measure growth followed by APP-10F pitch/duration/delete, and Piano frame growth followed by Staff 2 → Voice 5 → note entry → Staff 1 isolation. APP-10E/F/G and APP-09B renderer/orientation regressions remain in the same exact-head gate.

### APP-10I — semantic previous/next measure navigation

PR #115 / `65e58c5a13760121c24a603e071aa72ec13f31d4` adds a presentation-only multi-measure authoring context without introducing a new mutation authority.

The browser exposes compact previous / active measure / next controls. Navigation derives its target only from the current revision's `SemanticAddressV3` selection and canonical `measureFrames` ordering:

- target is the immediately adjacent global measure frame only;
- part and Staff identity are preserved exactly;
- active Voice 1–5 remains presentation state and is preserved across navigation;
- when the active Voice exists in the target measure, the current semantic onset is carried to the exact containing canonical event where available;
- when the active Voice does not exist in the target measure, selection falls back to that exact measure; navigation never materializes the missing Voice;
- the existing explicit Voice action remains the only admitted route to synthetic missing-Voice materialization;
- navigation itself calls exact semantic selection and creates no canonical history revision;
- imported MusicXML may use measure navigation after the user has an exact frame-bearing semantic selection;
- document/part/staff-only selection has no frame context and fails closed rather than guessing;
- renderer DOM/SVG IDs, coordinates, nearest geometry and pitch inference have no navigation authority.

WebKit proves Guitar M3→M2→edit→M3 with history changing only for actual edits, and Piano Staff 2 + Voice 5 navigation from a frame where Voice 5 exists to an adjacent measure where it does not. The target safely becomes the exact Staff 2 measure, Voice 5 is not invented, and only a later explicit Voice 5 action materializes it under the existing APP-10D rules. APP-10E/F/G/H and APP-09B renderer/orientation regressions remain in the same exact-head gate.

## Next bounded authoring candidate

APP-10I closes the basic multi-measure semantic navigation gap. No APP-10J scope is declared yet. Fresh repository reality must be audited before selecting the next bounded authoring package; existing semantic capabilities should be reused rather than duplicated, and planned capability must not be documented as implemented.

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
