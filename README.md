# ST Score Editor Core

Security-first, renderer-independent semantic score-editing platform for the standalone and embeddable ST Score Editor.

## Project goal

Build a professional, reusable notation editor with strong desktop/mobile workflows, exact semantic editing, unified Undo/Redo, MusicXML interchange, renderer independence, optional audio audition and a versioned host SDK. The long-term direction is a commercially licensable score editor in the professional notation-workstation problem space.

SesliTab is not an architectural dependency. Any SesliTab integration/cutover is a separate explicit product decision.

## Current source of truth

Current main: `e281d52881aaad0fade574a944251b12ea752038`.

Latest merged product milestones:

- P08-E4 professional browser artifact: PR #187 / merge `0adabbdc426f8481196ee41cce5c9b2bbff2768e`.
- Qualified Violin default-editor integration: PR #176 / merge `e281d52881aaad0fade574a944251b12ea752038`.

## Current reality

- **Canonical semantic core:** `ScoreDocumentV3 + NotationDocumentV4` with `EditorSessionV4 / EditorHistoryV4` as the sole history authority.
- **Semantic identity:** `SemanticAddressV3` remains exact current-revision authoring identity.
- **APP authoring stack:** note/chord/Voice/staff/measure editing, safe rhythm mutation, relation authoring, selected-note editing, articulations, ornaments and accidentals are present within bounded contracts.
- **Renderer boundary:** renderer DOM/SVG/geometry is presentation-only and never canonical authoring authority.
- **P06/P07:** public SDK/audio integration and non-blocking audition behavior exist in the merged default product path; stale/non-note audio requests fail closed.
- **Default-editor audio:** Grand Piano and Violin are qualified; Grand Piano remains default; Classical Guitar remains suspended.
- **P08-A–D:** professional semantic selection, professional range transforms, score-structure authoring and unified workstation controller are merged.
- **P08-E1–E3:** browser professional bridge, responsive range toolbar and semantic structure inspector are merged.
- **P08-E4:** separate `STScoreEditorProfessionalApp` artifact is merged and automatically qualified.

## P08-E4 qualification

The professional artifact is independent from the default `STScoreEditorApp` bundle.

```text
STScoreEditorProfessionalApp
  -> semantic professional range toolbar
  -> semantic structure inspector
  -> existing canonical mutation engines
  -> EditorHistoryV4
```

Qualification:

- measured bundle: **599,398 bytes**;
- max: **615,000 bytes**;
- budget revision: `P08-E4-QUALIFIED-1`;
- default app ceiling remains **542,720 bytes / `P06-AUDIO-V010-1`**;
- Node 18 / 20 / 22 exact-head CI: PASS;
- dedicated professional WebKit regression: PASS;
- retained APP-10/11, APP-09B renderer/rerender and P05 paste/render/undo regressions: PASS.

Physical iPhone/Safari qualification is still open in **Issue #188**. Automated WebKit is not physical-device evidence.

The professional artifact currently does **not** bundle or integrate the audio host: `audioEngineBundled=false`, `audioHostIntegrated=false`.

## Canonical authority

```text
pointer / touch / keyboard / host intent
        -> semantic target / authoring intent
        -> bounded admission when required
        -> canonical mutation primitive
        -> ScoreDocumentV3 + NotationDocumentV4
        -> EditorSessionV4 / EditorHistoryV4
```

Noncanonical state includes renderer geometry, DOM/SVG ids, viewport state, transient range capture, file/recovery UI, playback/audio state, export state and rollout flags.

## Audio status

- Grand Piano: qualified and default in the merged default-editor audition path.
- Violin: qualified and merged through PR #176 / Audio Engine v0.1.2.
- Classical Guitar: suspended; do not automatically reactivate.
- Piano/Violin selector state is host-only and cannot mutate canonical score/history/renderer state.
- P08-E4 professional artifact has no bundled/integrated audio host yet.

## Next autonomous development action

**P09-A — Fast Entry / Keyboard Workstation inventory and gap matrix.**

Before adding code, inspect and map the existing keypad, browser keyboard, note insertion, selected-note editing, duration/rest/dot, semantic navigation, Undo/Redo, professional selection and SDK paths. Identify what is reusable and what is genuinely missing.

Do not create a second note-entry or rhythm engine. Any later keyboard command layer must route to existing canonical primitives, fail closed on stale semantic targets, avoid hijacking text fields, preserve mobile behavior and keep one accepted authoring command = one unified history revision.

Conditional continuation after P09-A proves real gaps:

1. **P09-B:** bounded keyboard command-intent contract.
2. **P09-C:** focus-safe browser keyboard adapter.
3. **P09-D:** fast-entry workflow qualification with exact Undo and dedicated WebKit regression.

See `ARCHITECTURE.md` and `ROADMAP.md` for the current continuation contract.

## Current gated boundaries

- no renderer-coordinate or DOM/SVG authoring;
- no stale revision reuse;
- no unproven topology/timing invention;
- no unqualified audio instrument activation;
- no automatic Classical Guitar reactivation;
- no production exposure of the professional artifact before physical qualification + explicit authorization;
- no SesliTab cutover without explicit authorization.

## Validation rule

Implementation PRs must pass exact-head Node 18/20/22 plus the retained browser/renderer/P05 regressions. Professional/shared browser changes must also preserve the P08-E4 dedicated WebKit gate. Shared audio-host changes must preserve the audio admission/composition regressions.

Automated browser tests are regression evidence only and never substitute for explicit physical-device confirmation.
