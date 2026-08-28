# ST Score Editor Core — Architecture

Status: **Implemented through Stage E8-C. Guitar Workspace source projection and read-only result evidence are implemented; direct external-engine invocation is not authorized.**

## 1. Purpose

ST Score Editor Core is the shared semantic editing layer between symbolic score data and product-specific user interfaces. It is not an engraving engine, OMR engine, guitar optimizer, AI model host, persistence service, external-engine runner, or publication authority.

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

Guitar Workspace path through E8-C:
ScoreDocument + NotationDocument (same revision)
  -> E8-B deterministic projection
       ├─ engine-safe MusicXML
       └─ sourceEventId -> canonical event/note source map
  -> host-supplied CanonicalTabResult 2.0.0 JSON artifact
  -> E8-C bounded JSON parse
  -> current E8-B projection re-derived internally
  -> exact source/policy/group/decision/disposition/shape verification
  -> immutable derivative GuitarWorkspaceResult
  -X-> no reverse canonical mutation authority
```

Browser, renderer, Guitar TAB result data and UI do not become score authority anywhere in this flow.

## 3. Implemented package layers

Core symbolic and safety layers:

- `score-model` — immutable canonical score snapshots.
- `musicxml` — bounded safe import and deterministic full notation serialization.
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

The two documents must share exact document and revision identity. Score and notation edits create new unified revisions through admitted transactions. Stale notation/selection/render/Guitar Workspace evidence is rejected rather than re-targeted silently.

E8-C does not trust an externally supplied projection object. It re-derives the E8-B projection from the current `ScoreDocument + NotationDocument` pair every time result evidence is accepted.

## 5. Selection and renderer boundary

Renderer/browser hits are resolved through opaque render tokens to revision-bound `SemanticAddress` values. DOM ids, SVG ids, glyph objects, coordinates and drag geometry are never authoritative edit identities.

## 6. Editor intent boundary

Score editor intents support pitch, duration, note/rest replacement and chord-tone add/remove. Notation intents support time/key/clef/barline, dots/beams/tuplets, accidental display, ties and slurs.

A Guitar Workspace result may eventually be used to create a user-visible proposal, but string/fret/fingering/shape data itself is never a canonical edit command. Any canonical mutation must still enter the existing semantic-selection plus E4/E7-E1 typed transaction path.

## 7. Guitar Workspace external reference

Reviewed external repository:

- `khfy7wpr5p-maker/musicxml-to-guitar-tab-engine`
- reviewed main SHA: `93abe9735a4ed70ad8362ac24ec39869ea34607f`
- result document: `CanonicalTabResult 2.0.0`
- source model: `PolyphonicSourceModel 1.0.0`
- source event identity: `<partId>:measure:<measureIndex>:note:<sourceOrder>`
- final-selection policy: `STATIC_ATTACK_PATH_LEXICOGRAPHIC_1.0` / version `1.0.0`

The external result does not carry ST `documentId`, ST `revisionId`, or an ST projection hash. Therefore source ids alone are insufficient proof that a result belongs to the current score revision.

## 8. E8-B projection profile

E8-B admits exactly one canonical part, one/two staves, at most 2,000 measures, at most 50,000 source note/rest events and divisions at most 16,384. Exact canonical pitch/timing and tie facts are preserved. Deterministic `backup` / `forward` operations represent multiple voices/staves. Unsupported engine notation is omitted only from the engine-specific projection; canonical state and the normal E5 serializer remain unchanged.

E8-B does not call the external engine.

## 9. E8-C result-evidence boundary

E8-C accepts only a bounded JSON string (maximum 16 MiB). Arbitrary JavaScript object graphs are not accepted at the result boundary, preventing accessors/proxies/shared object identity from becoming part of the trust surface.

After JSON parsing, E8-C requires exact root and nested contract field sets and verifies current engine/source/policy identities. It then re-derives the E8-B projection from the current canonical revision and checks the returned source model against current facts:

- measure identity/order/number/divisions/time signature;
- source event identity/order;
- note/rest type;
- voice/staff;
- onset/duration;
- pitch spelling/MIDI;
- tie start/stop;
- chord-with-previous source fact;
- exact simultaneous attack groups;
- exact arrangement-decision order and complete note coverage;
- exact disposition order and decision linkage;
- target pitch octave-shift rules;
- selected string/fret round-trip under admitted tuning;
- duplicate simultaneous string rejection;
- exact required selected-shape coverage;
- finger and barre invariants;
- physical status `PLAYABLE_WITHIN_POLICY`.

Any mismatch fails closed. Output retains only immutable derivative evidence bound to the current ST document/revision and canonical note addresses.

A `teacherReviewStatus` value is copied as evidence only. `APPROVED` does not authorize score mutation, publication or persistence.

## 10. History and revision changes

Undo/redo operate on unified score+notation snapshots and clear selection on revision navigation. Guitar Workspace source maps, projections and result evidence must be re-derived/revalidated after any canonical revision change. A result produced for an older score is rejected if its source facts no longer match the current revision.

## 11. Renderer integration targets

- OSMD `2.1.1`, BSD-3-Clause — host-injected classical score target.
- alphaTab `1.8.4`, MPL-2.0 — host-injected guitar/TAB presentation target.

Neither renderer is canonical authority. alphaTab presentation remains separate from Guitar TAB Engine result evidence.

## 12. External engine invocation gate

Direct invocation of `musicxml-to-guitar-tab-engine` is **not implemented or authorized in core**. A future E8-D must separately freeze the host boundary, exact engine version/provenance, resource budgets, cancellation/timeout ownership, request/result size limits and stale-revision behavior.

No E8-C code creates network, process, package-install, persistence or production authority.

## 13. Browser, AI and product boundaries

E7 browser packaging remains non-networked and non-persistent inside core. AI specialists remain advisory only. ScoreMosaic and Guitar TAB remain separate product authority domains.

## 14. Stage status

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
- E8-B — COMPLETE — deterministic engine MusicXML + source-map projection
- **E8-C — CURRENT — read-only current-revision CanonicalTabResult evidence**
- E8-D — HUMAN-GATED / NOT AUTHORIZED — direct host invocation boundary
- E9 — Music Intelligence overlays — later stage

Production activation, public write APIs, live AI edit authority and direct external-engine invocation still require separate authorization. Any change to ScoreMosaic vs Guitar TAB authority ownership is human-gated by `DEVELOPMENT_GOVERNANCE.md`.
