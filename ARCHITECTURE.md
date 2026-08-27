# ST Score Editor Core — Architecture

Status: Stage E7-A — UI authority contract

## 1. Purpose

ST Score Editor Core is the shared semantic editing layer between symbolic score data and product-specific user interfaces. It is not an engraving engine, OMR engine, guitar optimizer, AI model host, or publication authority.

## 2. Layering

```text
External symbolic input
  -> import/safety boundary
  -> ScoreDocument
  -> semantic addressing
  -> typed EditCommand / NotationCommand
  -> atomic transaction
  -> validation
  -> accepted immutable revision
  -> serializer / typed adapter
  -> renderer adapters (presentation only)
  -> editor UI (presentation + command intent only)
```

Product composition remains outside core authority:

```text
ScoreMosaic
  -> Teacher Review / Score Editor host
  -> ST Score Editor Core
  -> OSMD host adapter

MusicXML-to-Guitar-TAB-Engine
  -> Guitar Workspace host
  -> ST Score Editor Core
  -> alphaTab host adapter
```

## 3. Implemented package boundaries through E6

- `score-model`: immutable canonical score snapshots.
- `musicxml`: bounded safe import and deterministic serialization.
- `addressing`: revision-bound semantic identities.
- `commands`: typed bounded score mutations.
- `history`: immutable transaction history and undo/redo.
- `notation-structure`: revision-bound notation semantics.
- `renderer-contract`: presentation-only renderer requests and secure hit tokens.
- `renderer-osmd`: host-injected OSMD 2.1.1 adapter.
- `renderer-alphatab`: host-injected alphaTab 1.8.4 adapter.

Planned E7 packages:

- `editor-ui-contract`: UI state, editor intents and authority-safe boundaries.
- `editor-shell`: framework-neutral editor composition state.
- `editor-selection`: renderer-token to semantic-selection bridge.
- `notation-commands`: typed notation mutations.
- `editor-accessibility`: keyboard/focus/status semantics.

Product UI composition stays outside authoritative score state.

## 4. Identity model

Renderer coordinates are unstable and forbidden as authoritative mutation addresses. A selected score entity resolves through the revision-bound semantic chain:

```text
documentId
partId
staffId
measureId
voiceId
eventId
noteId
```

DOM ids, SVG ids, pixel coordinates, glyph ids and renderer-local objects can only help locate an opaque E6 render token. The token itself is revalidated against a manifest re-derived from the current canonical revision before a semantic address is returned.

## 5. Source policy

Original source bytes are immutable. A source hash/identity is recorded at import. Editing produces derived semantic revisions; it never rewrites source bytes in place.

For ScoreMosaic, an approved/validated upstream symbolic artifact is the production handoff target. Raw OMR candidates are not automatically authoritative input.

For Guitar TAB, derivative string/fret/fingering state cannot mutate upstream note pitch/onset/duration authority unless an explicit score edit is separately issued.

## 6. Edit transaction model

Every accepted score edit follows:

```text
current revision
  -> stable semantic target
  -> typed bounded command
  -> precondition checks
  -> deterministic transform
  -> validation
  -> accept whole revision OR reject without partial state
```

UI event handlers never mutate `ScoreDocument` or `NotationDocument` directly.

## 7. Renderer boundary

Renderers may receive generated MusicXML and return presentation events. They may not choose authoritative identity, mutate canonical state, infer accepted edits from coordinates alone, become the source of truth for musical semantics, or bypass validation.

## 8. E7 UI authority boundary

The UI may own only ephemeral presentation state such as:

- active tool;
- viewport/zoom;
- hover state;
- keyboard focus;
- open/closed inspector sections;
- pending form text before validation;
- transient error/status presentation.

The UI may not own authoritative musical state. In particular, toolbar selection, inspector fields, browser state, DOM/SVG state, renderer objects, drag geometry and keyboard shortcuts cannot independently authorize or commit a musical edit.

The accepted flow is:

```text
browser event
  -> renderer hit token (when applicable)
  -> E6 token validation
  -> E3 SemanticAddress / SelectionSnapshot
  -> typed editor intent
  -> E4/E7 command transaction
  -> deterministic validation
  -> immutable accepted revision
  -> re-render
```

If the revision changes before intent execution, the selection/intent is stale and fails closed. No automatic re-targeting is allowed.

## 9. AI/analysis boundary

AI specialists may classify, rank, explain or propose. They may not create authoritative edits, silently repair score state, bypass deterministic validation, or present uncalibrated scores as probabilities.

## 10. Stage map

- E0 — architecture, safety, governance, CI foundation. COMPLETE.
- E1 — canonical ScoreDocument model. COMPLETE.
- E2 — MusicXML safe import + semantic round trip. COMPLETE.
- E3 — stable selection/addressing. COMPLETE.
- E4 — atomic edit commands + transaction + undo/redo. COMPLETE.
- E5 — canonical notation structures and notation-aware export. COMPLETE.
- E6 — presentation-only renderer adapters. COMPLETE.
- E7-A — UI authority contract and documentation synchronization. CURRENT.
- E7-B — framework-neutral editor shell.
- E7-C — renderer selection + inspector.
- E7-D — basic score editing UI intents.
- E7-E1 — typed notation command transaction core.
- E7-E2 — notation editing intents/palette model.
- E7-F — undo/redo UX, accessibility and safety state.
- E7-G — ScoreMosaic product integration. HUMAN GATE.
- E8 — guitar/TAB editing adapter.
- E9 — advisory Music Intelligence overlays.

Each stage must preserve the E0 authority boundary and cannot imply production activation.