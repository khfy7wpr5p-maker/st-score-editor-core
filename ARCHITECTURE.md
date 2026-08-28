# ST Score Editor Core — Architecture

Status: **Implemented through Stage E8-B. Guitar Workspace authority and deterministic source projection are implemented; external engine result ingestion is not.**

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
  -> presentation/rendering surfaces

Guitar Workspace path through E8-B:
ScoreDocument + NotationDocument (same revision)
  -> E8-B deterministic projection
       ├─ engine-safe MusicXML
       └─ sourceEventId -> canonical event/note source map
  -> future external Guitar TAB engine gate
  -> future derivative result gate
  -X-> no reverse canonical mutation authority
```

Browser, renderer, Guitar TAB engine data and UI do not become score authority anywhere in this flow.

## 3. Implemented package layers

Core symbolic and safety layers:

- `score-model` — immutable canonical score snapshots.
- `musicxml` — bounded safe import and deterministic full notation serialization.
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
- `guitar-workspace-projection` — deterministic engine MusicXML + source-map projection from one/two-staff canonical source state.

## 4. Unified revision model

The editor authoritative state is:

```text
EditorRevisionSnapshot
  ├─ ScoreDocument(revision R)
  └─ NotationDocument(revision R)
```

The two documents must share exact document and revision identity.

A score edit creates a new ScoreDocument revision. Existing notation is rebound only if every referenced measure/event/note still exists with the expected semantic kind. If a notation target disappeared, the operation fails closed.

A notation edit also creates a new ScoreDocument revision even if pitch/onset/duration did not change. This keeps score semantics, notation metadata, renderer manifests, selections and undo/redo on one revision lineage.

Guitar Workspace source maps and projections are bound to that same canonical document/revision identity. They become stale after any canonical revision change and may not be silently re-targeted.

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

Score editor intents support pitch, duration, note/rest replacement and chord-tone add/remove. Notation intents support time/key/clef/barline, dots/beams/tuplets, accidental display, ties and slurs.

Untrusted UI intent objects use exact-field runtime validation. Stale selections and stale notation fail closed; automatic re-targeting is forbidden.

A future Guitar Workspace suggestion may only request one of the ordinary validated edit paths. String/fret/fingering data itself is never a canonical edit command.

## 7. Guitar Workspace authority and source identity

The reviewed Guitar TAB Engine reference is:

- repository: `khfy7wpr5p-maker/musicxml-to-guitar-tab-engine`;
- reviewed main SHA: `93abe9735a4ed70ad8362ac24ec39869ea34607f`;
- `CanonicalTabResult` schema: `2.0.0`;
- polyphonic source model: `1.0.0`.

Its deterministic source event identity is:

```text
<partId>:measure:<measureIndex>:note:<sourceOrder>
```

ST core semantic IDs are intentionally not embedded in MusicXML `<note>` elements. E8-A therefore introduced a one-to-one, revision-bound `GuitarWorkspaceSourceMap` from external source IDs to canonical `note`/`event` addresses.

E8-B removes the remaining reconstruction ambiguity by generating engine MusicXML and source-map entries in the same traversal. Each emitted source `<note>` receives its external `sourceEventId` at emission time and is paired immediately with its canonical target.

## 8. E8-B projection profile

The initial projection admits:

- exactly one canonical part;
- one or two canonical staves;
- at most 2,000 measures;
- at most 50,000 emitted source notes/rests;
- deterministic engine part id `P1`;
- divisions at most 16,384;
- exact canonical pitch and rational timing;
- deterministic `forward` and `backup` cursor operations;
- canonical chord events encoded with `<chord/>` on later tones;
- rest source events;
- tie start/stop source facts;
- active time signature from the revision-bound notation document.

The projection fails closed on multipart input, staff 3+, misaligned staves, missing/conflicting meter, stale notation, same-voice overlap, events outside the active measure and unrepresentable timing.

The external engine's current semantic profile does not model all ST notation. E8-B therefore omits key signature, clef, barline/repeat, accidental-display metadata, dots, beams, tuplets/time-modification markers and slurs from the **engine-specific** MusicXML projection. Canonical pitch/timing remain exact, canonical state is unchanged, and the normal E5 full notation serializer remains separate.

E8-B does not call the engine and does not ingest an engine result.

## 9. History and UX safety

Undo/redo operate on unified score+notation snapshots. Revision navigation invalidates current selection rather than carrying a stale target into another revision. A new commit after undo clears the redo branch.

Dirty/persisted indicators are presentation only. Guitar Workspace projection/result state must be recomputed or revalidated after canonical revision changes.

## 10. Accessibility boundary

The framework-neutral accessibility model defines five focus regions:

```text
toolbar → parts → score → inspector → status
```

Keyboard input maps only to typed accessibility/navigation requests; raw keyboard input never becomes a musical command directly.

## 11. Renderer integration targets

- OSMD `2.1.1`, BSD-3-Clause — host-injected classical score target.
- alphaTab `1.8.4`, MPL-2.0 — host-injected guitar/TAB presentation target.

These packages are not installed into core. Product hosts own exact renderer pin/lock. alphaTab rendering remains separate from the Guitar TAB Engine source/result boundary.

## 12. Browser, AI and product boundaries

The E7-G browser host runtime and E7-H browser bundle remain non-networked and non-persistent inside core and grant no renderer mutation, server-revision, approval, publication or production authority.

AI specialists may classify, rank, explain or propose. They cannot mutate score state or bypass deterministic edit transactions.

ScoreMosaic and Guitar TAB remain separate product authority domains. E8-A/E8-B preserve that boundary: Guitar Workspace data is derivative and cannot flow backwards into canonical authority.

## 13. Stage status

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
- E7-G — COMPLETE
- E7-H — COMPLETE
- E8-A — COMPLETE — Guitar Workspace derivative authority + source-map contract
- **E8-B — CURRENT — deterministic engine MusicXML + source-map projection**
- E8-C — next safe gate: read-only validated `CanonicalTabResult 2.0.0` ingestion
- E9 — Music Intelligence overlays — later stage

Production activation, public write APIs and live AI edit authority still require separate authorization. Any change to ScoreMosaic vs Guitar TAB authority ownership is human-gated by `DEVELOPMENT_GOVERNANCE.md`.
