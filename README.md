# ST Score Editor Core

Security-first shared semantic score-editing core for ScoreMosaic and MusicXML-to-Guitar-TAB-Engine.

## Current status

The architecture is implemented through **Stage E8-A — Guitar Workspace Authority Contract**.

Stages **E7-G** and **E7-H** remain bounded repository/browser integration work only. E8-A adds the first Guitar Workspace boundary without connecting the external engine yet:

- Guitar string/fret/fingering/voicing/reduction state is derivative only.
- External engine output cannot mutate the canonical score.
- Every future engine source event must map to a current revision-bound canonical `event` or `note` address.
- Stale, duplicate or ambiguous source mappings fail closed.

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
- E8-A — Guitar Workspace Authority + Source-map Contract

The next safe E8 substage is a deterministic **MusicXML + source-map projection**. Full Guitar TAB Engine result integration remains unimplemented.

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

## Guitar Workspace boundary

E8-A introduces `guitar-workspace-contract` and the revision-bound `GuitarWorkspaceSourceMap`.

The reviewed Guitar TAB Engine reference is `khfy7wpr5p-maker/musicxml-to-guitar-tab-engine` at main SHA `93abe9735a4ed70ad8362ac24ec39869ea34607f`. Its reviewed canonical result is `CanonicalTabResult` schema `2.0.0`, and its polyphonic source identities use:

```text
<partId>:measure:<measureIndex>:note:<sourceOrder>
```

Because ST's MusicXML serializer does not embed internal entity IDs into MusicXML `<note>` elements, a future adapter must generate MusicXML and the source map together from one deterministic traversal. E8-A freezes that requirement but deliberately does not implement the adapter yet.

Guitar output may be displayed, reviewed or used as advisory evidence. It cannot write backwards into `ScoreDocument`; any canonical change must still enter through the ordinary semantic-selection and typed-transaction path.

## Renderer and browser boundary

Renderer packages are not installed into this core repository. Product hosts supply the exact admitted versions:

- `opensheetmusicdisplay@2.1.1` — BSD-3-Clause — classical score host target
- `@coderline/alphatab@1.8.4` — MPL-2.0 — guitar/TAB host target

Renderers cannot mutate canonical state or authorize edits from DOM/SVG ids or coordinates. Hit tokens are checked against a manifest re-derived from the current canonical revision.

E7-H produces the deterministic browser artifact:

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
8. Stale selections, intents, render requests, notation snapshots and Guitar Workspace source maps fail closed.
9. Undo/redo clears selection and restores score+notation together.
10. AI/OMR and Guitar TAB engine output remain evidence/advice/derivative state only.
11. No production/public-write/live-AI-edit authority is granted by repository merges.
12. ScoreMosaic and Guitar TAB authority ownership may not be changed implicitly by adapter work.

## Installed dependencies

Runtime:
- `saxes@6.0.0` — ISC — bounded XML parser only
- `xmlchars@2.2.0` — MIT — exact support pin

Build-only:
- `typescript@6.0.3` — Apache-2.0 — exact pin
- `esbuild@0.28.2` — MIT — browser bundling only

E8-A adds **no dependency**. No UI framework, renderer package, persistence SDK, network service or AI/model dependency is installed in core through E8-A.

See `DEPENDENCIES.md`, `ARCHITECTURE.md`, `SAFETY.md`, `ROADMAP.md`, `DEVELOPMENT_GOVERNANCE.md`, `docs/guitar-workspace-authority-contract.md`, and `contracts/`.
