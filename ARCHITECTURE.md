# ST Score Editor Core — Architecture

Status: **Implemented through Stage E8-A. Guitar Workspace state is derivative-only; external engine integration is not yet implemented.**

## 1. Purpose

ST Score Editor Core is the shared semantic editing layer between symbolic score data and product-specific user interfaces. It is not an engraving engine, OMR engine, guitar optimizer, AI model host, persistence service, or publication authority.

## 2. Authority flow

```text
External symbolic input
  -> safe import boundary
  -> immutable ScoreDocument
  -> revision-bound semantic addressing
  -> typed score / notation intent
  -> atomic transaction
  -> deterministic validation
  -> accepted unified score+notation revision
  -> MusicXML serializer
  -> presentation-only renderer request
  -> editor shell / inspector
  -> host-injected browser runtime
  -> deterministic browser bundle

Future Guitar Workspace path (E8):
canonical revision
  -> deterministic MusicXML + source-map projection
  -> external Guitar TAB engine
  -> derivative guitar result only
  -X-> no reverse canonical mutation authority
```

The browser, renderer, Guitar TAB engine and UI do not become score authority anywhere in this flow.

## 3. Implemented package layers

Core symbolic and safety layers:

- `score-model` — immutable canonical score snapshots.
- `musicxml` — bounded safe import and deterministic serialization.
- `addressing` — revision/ancestry-bound semantic identities.
- `commands` — typed bounded score mutations.
- `history` — original score-only immutable history primitive.
- `notation-structure` — revision-bound notation semantics.
- `notation-commands` — atomic notation transactions.

Renderer boundary:

- `renderer-contract` — revision-bound requests and opaque hit manifest.
- `renderer-osmd` — host-injected OSMD 2.1.1 adapter.
- `renderer-alphatab` — host-injected alphaTab 1.8.4 adapter.

Editor boundary:

- `editor-ui-contract` — non-authoritative ephemeral UI state.
- `editor-shell` — framework-neutral toolbar/parts/score/inspector/status view model.
- `editor-selection` — render token → SemanticAddress → SelectionSnapshot → inspector.
- `editor-score-intents` — runtime-validated score editing intents delegated to E4.
- `editor-notation-intents` — runtime-validated notation intents delegated to E7-E1.
- `editor-history` — unified ScoreDocument + NotationDocument revision snapshots.
- `editor-accessibility` — typed keyboard/focus/status semantics.
- `editor-session-safety` — undo/redo selection invalidation and presentation-only dirty/status state.
- `editor-session-controller` — immutable end-to-end core session composition.
- `browser-runtime` — host-injected browser-safe surface exposing only admitted core session operations.

Guitar Workspace boundary:

- `guitar-workspace-contract` — derivative-only authority profile plus revision-bound external-source → canonical semantic address mapping.

Browser packaging:

- artifact: `dist/browser/st-score-editor-core.runtime.js`;
- manifest: `dist/browser/st-score-editor-core.runtime.manifest.json`;
- format: IIFE;
- target: ES2022;
- global: `STScoreEditorCoreRuntime`;
- external browser imports: forbidden;
- remote browser fetch: not required.

## 4. Unified revision model

The editor authoritative state is a pair:

```text
EditorRevisionSnapshot
  ├─ ScoreDocument(revision R)
  └─ NotationDocument(revision R)
```

The two documents must share exact document and revision identity.

A score edit creates a new ScoreDocument revision. Existing notation is rebound only if every referenced measure/event/note still exists with the expected semantic kind. If a notation target disappeared, the operation fails closed rather than silently discarding notation.

A notation edit also creates a new ScoreDocument revision even if pitch/onset/duration did not change. This keeps score semantics, notation metadata, renderer manifests, selections and undo/redo on one revision lineage.

Guitar Workspace source maps are bound to that same canonical document/revision identity. They become stale after a canonical revision change and may not be silently re-targeted.

## 5. Selection and renderer boundary

A renderer hit is not an edit target by itself:

```text
renderer/browser hit
  -> opaque render token
  -> manifest re-derived from current canonical revision
  -> exact token/address verification
  -> SemanticAddress
  -> SelectionSnapshot
```

DOM ids, SVG ids, glyph objects, x/y coordinates and drag geometry are never authoritative.

## 6. Editor intent boundary

Score editor intents support:

- pitch;
- duration;
- note/rest replacement;
- chord tone add/remove.

Notation editor intents support:

- time signature;
- key signature;
- clef;
- barline/repeat;
- dots;
- beams;
- tuplets;
- accidental display;
- ties;
- slurs.

Untrusted UI intent objects use exact-field runtime validation. Unknown UI/DOM/coordinate fields fail before transaction creation. Stale selections and stale notation fail closed; automatic re-targeting is forbidden.

A future Guitar Workspace suggestion may only request one of these ordinary validated edit paths. String/fret/fingering data itself is never a canonical edit command.

## 7. Guitar Workspace source identity boundary

The reviewed Guitar TAB Engine reference is:

- repository: `khfy7wpr5p-maker/musicxml-to-guitar-tab-engine`;
- reviewed main SHA: `93abe9735a4ed70ad8362ac24ec39869ea34607f`;
- `CanonicalTabResult` schema: `2.0.0`;
- polyphonic source model: `1.0.0`.

Its deterministic source event identity is:

```text
<partId>:measure:<measureIndex>:note:<sourceOrder>
```

ST core semantic IDs are intentionally not serialized into MusicXML `<note>` elements. Therefore engine output may not be matched back to canonical state by coordinates, renderer objects, pitch-only heuristics or later best-effort searching.

E8-A requires a `GuitarWorkspaceSourceMap` created for the exact canonical revision. Every external source event identity maps to one canonical `note` or `event` semantic address. Duplicate source IDs, duplicate canonical targets, stale revisions, unknown fields and unsupported target kinds fail closed.

E8-A does not yet create the MusicXML/source-map projection or ingest engine output. Those remain later bounded stages.

## 8. History and UX safety

Undo/redo operate on unified score+notation snapshots. A revision navigation invalidates the current selection instead of carrying a stale target into another revision. A new commit after undo clears the redo branch.

Dirty/persisted revision indicators are presentation only. E8-A still grants no persistence authority.

Derivative Guitar Workspace data must be recomputed/rebound through an admitted future projection after canonical revision navigation; it may not silently survive as authoritative state.

## 9. Accessibility boundary

The framework-neutral accessibility model defines five focus regions:

```text
toolbar → parts → score → inspector → status
```

Keyboard input maps only to typed accessibility/navigation requests such as `REQUEST_UNDO` and `REQUEST_REDO`; raw keyboard input never becomes a musical command directly. Error status can be represented as an assertive announcement and ordinary status as polite output.

## 10. Renderer integration targets

- OSMD `2.1.1`, BSD-3-Clause — host-injected classical score target.
- alphaTab `1.8.4`, MPL-2.0 — host-injected guitar/TAB presentation target.

These packages are not installed into core. Product hosts own exact renderer pin/lock and satisfy the adapter profile.

alphaTab presentation is separate from the future Guitar TAB Engine result adapter. Neither renderer state nor engine state owns the canonical score.

## 11. Browser, AI and product boundaries

The E7-G browser host runtime and E7-H browser bundle are bounded integration surfaces. They are explicitly non-networked and non-persistent inside core, and they grant no renderer mutation, server-revision, approval, publication or production authority.

AI specialists may classify, rank, explain or propose. They cannot mutate score state or bypass the deterministic edit path.

ScoreMosaic and Guitar TAB remain separate product authority domains. E8-A explicitly preserves that ownership boundary: Guitar Workspace state is derivative and cannot flow backwards into ScoreMosaic/canonical authority.

## 12. Stage status

- E0 — COMPLETE
- E1 — COMPLETE
- E2 — COMPLETE
- E3 — COMPLETE
- E4 — COMPLETE
- E5 — COMPLETE
- E6 — COMPLETE
- E7-A — COMPLETE
- E7-B — COMPLETE
- E7-C — COMPLETE
- E7-D — COMPLETE
- E7-E1 — COMPLETE
- E7-E2 — COMPLETE
- E7-F — COMPLETE
- E7-G — COMPLETE — repository-only ScoreMosaic browser host runtime
- E7-H — COMPLETE — browser-safe runtime bundle
- **E8-A — CURRENT — Guitar Workspace derivative authority + source-map contract**
- E8-B — next safe gate: deterministic MusicXML + source-map projection
- E8 later work — engine result adapter / workspace UX, separately bounded
- E9 — Music Intelligence overlays — later stage

Production activation, public write APIs and live AI edit authority still require separate authorization. Any change to ScoreMosaic vs Guitar TAB authority ownership is human-gated by `DEVELOPMENT_GOVERNANCE.md`.
