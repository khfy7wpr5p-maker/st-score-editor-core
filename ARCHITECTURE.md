# ST Score Editor Core — Architecture

Status: **Implemented through Stage E7-F. E7-G is a human gate.**

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
```

The browser, renderer and UI do not become score authority anywhere in this flow.

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

## 7. History and UX safety

Undo/redo operate on unified score+notation snapshots. A revision navigation invalidates the current selection instead of carrying a stale target into another revision. A new commit after undo clears the redo branch.

Dirty/persisted revision indicators are presentation only. Core E7-F does not persist data and grants no persistence authority.

## 8. Accessibility boundary

The framework-neutral accessibility model defines five focus regions:

```text
toolbar → parts → score → inspector → status
```

Keyboard input maps only to typed accessibility/navigation requests such as `REQUEST_UNDO` and `REQUEST_REDO`; raw keyboard input never becomes a musical command directly. Error status can be represented as an assertive announcement and ordinary status as polite output.

## 9. Renderer integration targets

- OSMD `2.1.1`, BSD-3-Clause — host-injected classical score target.
- alphaTab `1.8.4`, MPL-2.0 — host-injected guitar/TAB target.

These packages are not installed into core. Product hosts own exact renderer pin/lock and satisfy the adapter profile.

## 10. AI and product boundaries

AI specialists may classify, rank, explain or propose. They cannot mutate score state or bypass the deterministic edit path.

ScoreMosaic and Guitar TAB remain separate product authority domains. E7-F does not activate either product integration.

## 11. Stage status

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
- E7-F — CURRENT / final autonomous core gate
- **E7-G — ScoreMosaic product integration — HUMAN GATE / NOT AUTHORIZED**
- E8 — guitar/TAB editing adapter — later gate
- E9 — Music Intelligence overlays — later gate

Production activation, public write APIs, live AI edit authority and ScoreMosaic product composition require separate authorization.
