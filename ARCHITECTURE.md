# ST Score Editor Core — Architecture

Status: **Implemented through Stage E8-C. The additive SEC-SMUFL-KEYPAD-01 existing-score correction program is implemented through SEC-KP-09/10 without changing E8 authority. Direct external-engine invocation remains unauthorized.**

## 1. Purpose

ST Score Editor Core is the shared semantic editing layer between symbolic score data and product-specific user interfaces. It is not an engraving engine, OMR engine, guitar optimizer, AI model host, persistence service, external-engine runner, publication authority or full Sibelius-style page-layout/note-entry application.

## 2. Authority flow

```text
External symbolic input
  -> safe import boundary
  -> immutable ScoreDocument
  -> revision-bound semantic addressing
  -> typed score / notation intent or typed keypad action
  -> atomic validation
  -> accepted unified score+notation revision
  -> presentation/rendering surfaces
```

Renderer, browser, DOM/SVG/coordinate state, glyphs, Guitar TAB result data and UI state never become canonical score authority.

Guitar Workspace remains a separate derivative-only path:

```text
ScoreDocument + NotationDocument (same revision)
  -> E8-B deterministic projection
       ├─ engine-safe MusicXML
       └─ sourceEventId -> canonical event/note source map
  -> host-supplied CanonicalTabResult 2.0.0 JSON artifact
  -> E8-C bounded validation against current canonical facts
  -> immutable derivative GuitarWorkspaceResult
  -X-> no reverse canonical mutation authority
```

## 3. Implemented package layers

Core symbolic and safety layers:

- `score-model` — immutable canonical score snapshots.
- `musicxml` — bounded safe import and deterministic notation serialization.
- `addressing` — revision/ancestry-bound semantic identities.
- `commands` — typed bounded score mutations.
- `history` — immutable history primitives.
- `notation-structure` — revision-bound notation semantics.
- `notation-commands` — atomic notation transactions.

Renderer/editor boundary:

- `renderer-contract`, `renderer-osmd`, `renderer-alphatab` — presentation-only render surfaces.
- `editor-ui-contract`, `editor-shell`, `editor-selection` — framework-neutral non-authoritative editor surface.
- `editor-score-intents`, `editor-notation-intents` — runtime-validated typed intents.
- `editor-history`, `editor-accessibility`, `editor-session-safety`, `editor-session-controller` — revision/history/UX composition.
- `browser-runtime` — bounded host-injected browser-safe editor runtime.
- `editor-keypad` — framework-neutral keypad action/SMuFL presentation descriptor contract.
- `editor-keypad-execution` — atomic duration/rest/accidental/dot correction orchestration.
- `editor-keypad-advanced` — explicit-range triplet and explicit-endpoint tie/slur corrections.
- `editor-renderer-selection-bridge` — editor-side exact-hit envelope validation and opaque-token resolution contract.

Guitar Workspace boundary:

- `guitar-workspace-contract` — derivative-only authority profile plus revision-bound source mapping.
- `guitar-workspace-projection` — deterministic engine MusicXML + source-map projection.
- `guitar-workspace-result` — bounded JSON-string ingestion plus exact current-revision result evidence validation.

## 4. Unified revision model

The editor authoritative state is:

```text
EditorRevisionSnapshot
  ├─ ScoreDocument(revision R)
  └─ NotationDocument(revision R)
```

The two documents must share exact document and revision identity. Ordinary score and notation edits retain their existing transaction paths. A keypad action may compose score and notation changes, but acceptance still produces exactly one unified next revision or none. Partial authoritative commits are forbidden.

## 5. Selection and renderer boundary

Editor Core creates a revision-bound `RenderRequest` containing canonical MusicXML plus an opaque manifest mapping tokens to revision-bound `SemanticAddress` values. Renderers may perform visual hit testing but do not own the semantic mapping.

The SEC-KP-09 bridge freezes the external return envelope to:

- bridge contract version;
- `documentId`;
- `revisionId`;
- renderer family;
- render-request contract version;
- render-manifest contract version;
- opaque hit token.

The bridge rejects extra fields. A renderer therefore cannot submit `SemanticAddress`, `ScoreNoteRef`, coordinates, DOM/SVG ids, renderer objects or glyph identity as an edit target. Editor Core validates the envelope and delegates the token to the existing canonical manifest resolver, which re-derives the current manifest and produces the `SelectionSnapshot` and inspector.

Stale, unknown, renderer-mismatched or path-mismatched hits fail closed. Ambiguous or absent visual hits must result in no token rather than nearest-note inference.

## 6. Correction keypad semantics

The keypad mode is `EXISTING_SCORE_CORRECTION`. Its semantic authority is the stable `actionId`; SMuFL glyph-name metadata and host primitive hints are presentation-only.

Implemented simple actions:

- whole/half/quarter/eighth/16th/32nd durations;
- equivalent rests, including atomic note/chord → rest+duration;
- flat/natural/sharp correction, atomically changing canonical `Pitch.alter` and display accidental metadata without enharmonic respelling guesses;
- augmentation dots 0–3, with canonical duration adjusted consistently with notation metadata.

One simple keypad press is validated against the current selection and current score/notation revision. Where both E4 score and E7-E1 notation candidates are required, both are validated from the same base and same next revision before one unified result is exposed.

### 6.1 Advanced explicit targets

`tuplet.triplet` requires `EVENT_RANGE` with exactly three revision-bound event addresses. The range must be consecutive, inside one exact measure voice, and already carry canonical timing that proves an equal-duration contiguous 3:2 tuplet for an admitted written base. Tuplet metadata cannot substitute for canonical timing.

`tie.edit` and `slur.edit` require an explicit `NOTE_PAIR`. Tie v1 additionally requires exact pitch equality and consecutive canonical events in the same logical voice. Slur v1 requires an explicit forward endpoint but need not be adjacent or same pitch. Exact-pair create/remove is one notation transaction and one unified revision.

### 6.2 Bounded triplet limitation

E4 currently has no onset-mutation command. Therefore:

- ordinary spacing is not silently retimed into a triplet;
- triplet removal or transformation that would require canonical onset/duration retiming is not implemented;
- an already-present tuplet state that requires retiming fails closed.

Adding onset-mutation authority would expand the canonical command surface and requires a separate reviewed additive contract; it is not hidden inside SEC-KP-05.

## 7. Selection continuity

Successful ordinary score/notation commits retain their pre-keypad behavior and clear selection. Keypad commits use a bounded continuity rule:

1. never reuse the old revision-bound `SemanticAddress`;
2. retain only the stable entity id as a re-resolution key;
3. resolve it against the accepted new canonical score;
4. require the same semantic kind;
5. create a fresh address, snapshot and inspector for the new revision;
6. clear selection if the identity is gone or changed kind.

Note-level selection therefore clears after note→rest replacement. Undo/redo always clears selection.

## 8. Keypad presentation and accessibility

Every keypad group and action has an accessible label key independent of glyph availability. Optional SMuFL glyph names are a small verified presentation subset; raw guessed PUA codepoints are not part of the contract. Bravura, VexFlow, Smoosic, CSS and renderer packages are not bundled into Editor Core.

A missing glyph or font cannot change the action id, target or mutation semantics.

## 9. MusicXML boundary

Canonical E2 import/serialize/re-import semantic round-trip remains supported for the admitted import subset. E5 serializer output includes the admitted notation structures used by the keypad, including dots, accidentals, ties, slurs and tuplets.

Advanced notation import still fails closed. This architecture therefore distinguishes:

- canonical subset semantic round-trip — supported and regression-tested;
- advanced keypad notation export semantics — supported and regression-tested;
- advanced notation import round-trip — not claimed.

## 10. Guitar Workspace external reference

Reviewed external repository:

- `khfy7wpr5p-maker/musicxml-to-guitar-tab-engine`
- reviewed main SHA: `93abe9735a4ed70ad8362ac24ec39869ea34607f`
- result document: `CanonicalTabResult 2.0.0`
- source model: `PolyphonicSourceModel 1.0.0`
- source event identity: `<partId>:measure:<measureIndex>:note:<sourceOrder>`
- final-selection policy: `STATIC_ATTACK_PATH_LEXICOGRAPHIC_1.0` / version `1.0.0`

The external result does not carry ST `documentId`, ST `revisionId`, or an ST projection hash. Source ids alone are insufficient proof that a result belongs to the current score revision; E8-C re-derives the current projection before accepting evidence.

## 11. E8-B/E8-C safety profile

E8-B admits exactly one canonical part, one/two staves, at most 2,000 measures, at most 50,000 source note/rest events and divisions at most 16,384. Exact canonical pitch/timing and tie facts are preserved. E8-B does not call the external engine.

E8-C accepts only a bounded JSON string and verifies current source facts, simultaneous groups, arrangement decisions, note dispositions and selected-shape invariants before retaining immutable derivative evidence. Teacher review state remains evidence only.

## 12. History and revision changes

Undo/redo operate on unified score+notation snapshots and clear selection on revision navigation. Guitar Workspace source maps, projections and result evidence must be re-derived/revalidated after any canonical revision change. Keypad selection continuity is a post-commit re-resolution rule and does not weaken stale-address rejection.

## 13. Renderer integration targets

- OSMD `2.1.1`, BSD-3-Clause — host-injected classical score target.
- alphaTab `1.8.4`, MPL-2.0 — host-injected guitar/TAB presentation target.

Neither renderer is canonical authority. alphaTab presentation remains separate from Guitar TAB Engine result evidence.

The renderer-layer consumer contract for the next repository is documented in `docs/st-score-rendering-layer-json2-integration-requirements.json`; this repository does not import or implement `st-score-rendering-layer`.

## 14. External engine invocation gate

Direct invocation of `musicxml-to-guitar-tab-engine` is **not implemented or authorized in core**. A future host invocation boundary must separately freeze exact engine version/provenance, resource budgets, cancellation/timeout ownership, request/result size limits and stale-revision behavior.

No keypad or renderer-bridge code creates network, process, persistence or production authority.

## 15. Browser, AI and product boundaries

Browser packaging remains non-networked and non-persistent inside core. The browser runtime exposes the keypad manifest and bounded keypad commit result but owns no renderer, server revision, approval, publication or production authority. AI specialists remain advisory only. ScoreMosaic, Rendering Layer and Guitar TAB remain separate product authority domains.

## 16. Stage/status summary

Core architectural stages:

- E0 through E7-H — COMPLETE
- E8-A — COMPLETE
- E8-B — COMPLETE
- **E8-C — CURRENT**
- E8-D — HUMAN-GATED / NOT AUTHORIZED
- E9 — later

Correction keypad program:

- SEC-KP-00 — COMPLETE — fresh-read + semantic freeze
- SEC-KP-01 — COMPLETE — framework-neutral keypad + SMuFL metadata
- SEC-KP-02 — COMPLETE — duration/rest
- SEC-KP-03 — COMPLETE — accidentals
- SEC-KP-04 — COMPLETE — dots
- SEC-KP-05 — COMPLETE WITH BOUNDED LIMITATION — explicit exact-3:2 triplet admission; retiming/removal that requires onset mutation remains blocked
- SEC-KP-06 — COMPLETE — explicit tie/slur endpoints
- SEC-KP-07 — COMPLETE — safe keypad selection continuity
- SEC-KP-08 — COMPLETE — bounded browser runtime exposure
- SEC-KP-09 — editor-side bridge contract in final PR-E
- SEC-KP-10 — regression/accessibility/docs/consumer handoff in final PR-E

Production activation, public write APIs, live AI edit authority, canonical onset-authority expansion and direct external-engine invocation remain separately human-gated.
