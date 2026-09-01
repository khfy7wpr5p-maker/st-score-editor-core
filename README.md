# ST Score Editor Core

Security-first shared semantic score-editing core for ScoreMosaic and MusicXML-to-Guitar-TAB-Engine.

## Current status

The architecture is implemented through **Stage E8-C — Read-only Guitar Result Evidence**. In addition, the bounded **SEC-SMUFL-KEYPAD-01 existing-score correction program** is implemented through SEC-KP-10 on top of the existing E4/E5/E7 foundations, without changing E8 authority.

E8 has three bounded foundations:

- **E8-A** freezes Guitar Workspace output as derivative-only and revision-bound.
- **E8-B** generates engine-safe MusicXML and the `sourceEventId` → canonical semantic source map during the same deterministic traversal.
- **E8-C** accepts only bounded `CanonicalTabResult 2.0.0` JSON, re-derives the current E8-B projection, cross-validates source facts against the current canonical revision, and exposes only immutable derivative guitar evidence.

The external Guitar TAB Engine is still **not invoked by this repository**. E8-C validates result artifacts supplied by a host/test boundary; it does not create network/service authority and cannot mutate the canonical score.

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
- E8-B — Deterministic Guitar MusicXML + Source-map Projection
- E8-C — Read-only CanonicalTabResult Evidence

## Correction keypad program

The framework-neutral keypad is designed for **existing-score correction**, not unrestricted Sibelius-style note entry or page layout.

Implemented keypad groups:

- whole/half/quarter/eighth/16th/32nd duration correction;
- equivalent rest correction, including atomic note/chord → requested rest duration;
- flat/natural/sharp canonical pitch alteration plus matching accidental-display metadata;
- 0–3 augmentation dots with canonical duration consistency;
- explicit-range triplet metadata when the selected three events already have exact canonical 3:2 timing;
- explicit-endpoint tie and slur create/remove;
- deterministic selection continuity after safe keypad edits;
- bounded browser keypad manifest and commit entry point.

Every keypad action is identified by a stable semantic `actionId`. Optional SMuFL glyph names and host primitive hints are presentation metadata only. Editor Core includes no Bravura font binary, raw guessed glyph codepoints, CSS, VexFlow or Smoosic dependency. Every action and group has an accessible label key independent of glyph availability.

A single keypad press commits one unified score+notation revision or none. Stale selection, inconsistent duration/dot state, ambiguous advanced targets and invalid actions fail closed.

### Bounded triplet limitation

The current E4 score-command set has no admitted onset-mutation primitive. Therefore Editor Core does **not** silently transform ordinary note spacing into triplet timing and does not remove an existing triplet when removal would require canonical retiming. `tuplet.triplet` v1 is admitted only for an explicit three-event range whose canonical durations/onsets already prove exact contiguous 3:2 timing. Expanding onset-mutation authority requires a separately reviewed additive contract.

## Editor ↔ renderer exact-selection bridge

The editor-side bridge contract is `ST_EDITOR_RENDERER_SELECTION_BRIDGE/1.0.0-draft`.

```text
Editor Core
  -> revision-bound RenderRequest + opaque manifest
Rendering Layer
  -> exact visual hit test, presentation only
Host bridge
  -> current document/revision + renderer family + opaque manifest token
Editor Core
  -> verify envelope
  -> re-resolve opaque token against current canonical manifest
  -> SemanticAddress + SelectionSnapshot
```

The bridge does not accept renderer-supplied `SemanticAddress`, `ScoreNoteRef`, screen/page/SVG coordinates, DOM/SVG ids, renderer objects or glyph identities as canonical edit identity. Unknown/stale/mismatched hits fail closed. The browser-safe runtime exposes the same selection-only boundary as `selectRendererHit(session, externalHitEnvelope)` and resolves it only against that session's current render request. Integration requirements for the companion rendering-layer program are frozen in `docs/st-score-rendering-layer-json2-integration-requirements.json`.

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
validated editor intent / keypad action
        ├─ ordinary score intent → E4 transaction
        ├─ ordinary notation intent → E7-E1 transaction
        └─ keypad composite → validated unified score+notation revision
        ↓
accepted unified revision
        ↓
score + notation history
        ↓
new RenderRequest
```

Ordinary score/notation commits retain their existing selection-clearing behavior. Successful keypad commits may deterministically re-resolve the exact surviving entity against the new revision; old `SemanticAddress` values are never reused. Undo/redo clears selection and restores score+notation together.

## Guitar Workspace boundary

The reviewed Guitar TAB Engine reference is `khfy7wpr5p-maker/musicxml-to-guitar-tab-engine` at main SHA `93abe9735a4ed70ad8362ac24ec39869ea34607f`. Its reviewed canonical result is `CanonicalTabResult` schema `2.0.0`; its polyphonic source identities use:

```text
<partId>:measure:<measureIndex>:note:<sourceOrder>
```

E8-B emits a narrow MusicXML source-fact profile with exactly one part (`P1`), one/two staves, exact canonical pitch/onset/duration, deterministic voice/staff cursor operations, chord markers, rests and tie start/stop facts. At emission time each external source id is paired with a current canonical semantic address.

E8-C does **not** trust `sourceEventId` alone. `CanonicalTabResult 2.0.0` does not carry ST `documentId`, ST `revisionId`, or a projection hash, so the result adapter re-derives the current projection and verifies exact source, timing, arrangement, disposition and selected-shape facts. A reported teacher review state remains evidence only and grants no canonical mutation authority.

## Renderer and browser boundary

Renderer packages are not installed into this core repository. Product hosts supply the exact admitted versions:

- `opensheetmusicdisplay@2.1.1` — BSD-3-Clause — classical score host target
- `@coderline/alphatab@1.8.4` — MPL-2.0 — guitar/TAB host target

Renderers cannot mutate canonical state or authorize edits from DOM/SVG ids or coordinates.

E7-H produces the deterministic browser artifact:

- `dist/browser/st-score-editor-core.runtime.js`
- global: `STScoreEditorCoreRuntime`
- format: IIFE, target: ES2022
- no external browser imports
- no remote fetch requirement

The browser runtime exposes a frozen keypad manifest, bounded `commitKeypadAction`, and selection-only `selectRendererHit` bridge while remaining non-authoritative and introducing no network, persistence, server-revision, approval or publication capability.

## MusicXML verification scope

Canonical E2 import/serialize/re-import semantic round-trip remains tested for the admitted import subset. E5/keypad notation export tests cover dots, accidental display, ties, slurs and tuplets. **Advanced notation import remains intentionally fail-closed**, so the repository does not claim a round-trip capability for unsupported advanced notation syntax.

## Non-negotiable rules

1. Source bytes and source identity are immutable.
2. MusicXML is an exchange/projection format, not direct editor state.
3. Renderer/browser/DOM/SVG/coordinate/glyph state is never musical authority.
4. Edits require current semantic identity and typed bounded commands/actions.
5. Transactions are atomic and validated before acceptance.
6. One keypad user action produces one unified score+notation revision or none.
7. Score and notation revisions remain aligned in editor history.
8. Notation metadata may not be silently discarded when a score edit removes its target.
9. Stale selections, intents, render requests, notation snapshots and Guitar Workspace evidence fail closed.
10. Undo/redo clears selection and restores score+notation together.
11. AI/OMR and Guitar TAB engine output remain evidence/advice/derivative state only.
12. No production/public-write/live-AI/direct-engine-invocation authority is granted by repository merges.
13. ScoreMosaic, Rendering Layer and Guitar TAB authority ownership may not be changed implicitly by adapter work.

## Installed dependencies

Runtime:
- `saxes@6.0.0` — ISC — bounded XML parser only
- `xmlchars@2.2.0` — MIT — exact support pin

Build-only:
- `typescript@6.0.3` — Apache-2.0 — exact pin
- `esbuild@0.28.2` — MIT — browser bundling only

The correction keypad and editor-side renderer bridge add **no dependency**. No UI framework, renderer package, font binary, persistence SDK, network service or AI/model dependency is installed by these packages.

See `DEPENDENCIES.md`, `ARCHITECTURE.md`, `SAFETY.md`, `ROADMAP.md`, `DEVELOPMENT_GOVERNANCE.md`, `docs/keypad-current-reality.md`, `docs/keypad-capability-matrix.json`, `docs/keypad-final-regression-matrix.json`, `docs/st-score-rendering-layer-json2-integration-requirements.json`, `docs/guitar-workspace-authority-contract.md`, `docs/guitar-workspace-projection-contract.md`, `docs/guitar-workspace-result-evidence-contract.md`, and `contracts/`.
