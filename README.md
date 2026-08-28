# ST Score Editor Core

Security-first shared semantic score-editing core for ScoreMosaic and MusicXML-to-Guitar-TAB-Engine.

## Current status

The core architecture is implemented through **Stage E7-H**.

Stages **E7-G** and **E7-H** are complete as bounded repository/browser integration work only:

- E7-G authorizes the repository-only ScoreMosaic browser host runtime and visual composition boundary.
- E7-H packages that runtime into a deterministic browser-safe bundle without adding network, persistence, publication, approval or server-revision authority.

Completed layers:

- E0 — Architecture & Safety Foundation
- E1 — Canonical ScoreDocument Model
- E2 — Safe MusicXML Import & Semantic Round Trip
- E3 — Stable Semantic Addressing & Selection
- E4 — Atomic Score Edit Transactions & Score History
- E5 — Canonical Notation Structure / MusicXML Export
- E6 — Presentation-only OSMD / alphaTab Host Adapters
- E7-A — UI Authority Contract
- E7-B — Framework-neutral Editor Shell
- E7-C — Secure Renderer Selection & Canonical Inspector
- E7-D — Typed Basic Score Editing Intents
- E7-E1 — Atomic Notation Transactions
- E7-E2 — Typed Notation Palette / Inspector Intents
- E7-F — Unified Score+Notation History, Accessibility and Session Safety
- E7-G — Browser Host Runtime for ScoreMosaic
- E7-H — Browser-safe Runtime Bundle

The next planned major stage is **E8 — Guitar Workspace Adapter**. Any change to ScoreMosaic/Guitar TAB authority ownership remains human-gated by governance.

## Secure editor flow

```text
Canonical score + notation revision
        ↓
RenderRequest + opaque hit manifest
        ↓
Host renderer (presentation only)
        ↓
opaque hit token
        ↓
SemanticAddress + SelectionSnapshot
        ↓
read-only canonical inspector
        ↓
validated editor intent
        ├─ score intent → E4 transaction
        └─ notation intent → E7-E1 transaction
        ↓
accepted unified revision
        ↓
score + notation history
        ↓
new RenderRequest
```

Undo/redo restore score and notation together. Revision navigation clears selection rather than silently re-targeting it.

The notation layer currently models:

```text
Measure: time signature · key signature · clef · barline/repeat
Event:   dots · beams · tuplets
Note:    accidental display · ties · slurs
```

Advanced notation **MusicXML import** remains deliberately fail-closed where E2 does not yet model the source semantics. E5/E7 authoring and export do not imply complete advanced MusicXML import coverage.

## Renderer and browser boundary

Renderer packages are not installed into this core repository. Product hosts supply the exact admitted versions:

- `opensheetmusicdisplay@2.1.1` — BSD-3-Clause — classical score host target
- `@coderline/alphatab@1.8.4` — MPL-2.0 — guitar/TAB host target

Renderers cannot mutate canonical state or authorize edits from DOM/SVG ids or coordinates. Hit tokens are checked against a manifest re-derived from the current canonical revision.

E7-H also produces the deterministic browser artifact:

- `dist/browser/st-score-editor-core.runtime.js`
- global: `STScoreEditorCoreRuntime`
- format: IIFE, target: ES2022
- no external browser imports
- no remote fetch requirement

The browser runtime is host-injected and remains non-authoritative. It introduces no network, persistence, server-revision, approval or publication capability.

## UI and accessibility boundary

The editor shell is framework-neutral. Toolbar, viewport, hover, focus, inspector drafts and dirty indicators are presentation state only.

Keyboard gestures produce typed editor/accessibility requests. They never become score commands directly. Undo/redo requests navigate already accepted immutable revisions; score/notation edits still require semantic selection and typed transactions.

## Non-negotiable rules

1. Source bytes and source identity are immutable.
2. MusicXML is an exchange format, not direct editor state.
3. Renderer/browser/DOM/SVG/coordinate state is never musical authority.
4. Edits require current semantic identity and typed bounded commands.
5. Transactions are atomic and validated before acceptance.
6. Score and notation revisions remain aligned in the editor history.
7. Notation metadata may not be silently discarded when a score edit removes its target.
8. Stale selections, intents, render requests and notation snapshots fail closed.
9. Undo/redo clears selection and restores score+notation together.
10. AI/OMR output remains evidence/advice only.
11. No production/public-write/live-AI-edit authority is granted by repository merges.
12. E7-G/E7-H authorization is bounded to repository/browser composition and packaging; it does not authorize production activation.

## Installed dependencies

Runtime:
- `saxes@6.0.0` — ISC — bounded XML parser only
- `xmlchars@2.2.0` — MIT — exact support pin

Build-only:
- `typescript@6.0.3` — Apache-2.0 — exact pin
- `esbuild@0.28.2` — MIT — browser bundling only

No UI framework, renderer package, persistence SDK, network service or AI/model dependency is installed in core through E7-H.

See `DEPENDENCIES.md`, `ARCHITECTURE.md`, `SAFETY.md`, `ROADMAP.md`, `DEVELOPMENT_GOVERNANCE.md`, and `contracts/`.
