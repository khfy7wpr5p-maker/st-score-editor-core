# ST Score Editor Core — Architecture

Status: **Core remains implemented through E8-C. SEC-SMUFL-KEYPAD-01 is complete through SEC-KP-10. SEC-NE is COMPLETE / MERGED through 04A/04C/04B1 and the bounded 04B2 legal implicit-gap materialization stage. Canonical onset mutation and direct external-engine invocation remain unadmitted.**

## 1. Purpose

ST Score Editor Core is the renderer-independent semantic editing authority between symbolic score evidence and product UI. It is not an engraving engine, OMR recognizer, guitar optimizer, persistence service, publication authority or renderer-owned editor model.

## 2. Canonical authority flow

```text
MusicXML / OMR evidence
        ↓
safe import adapters
        ↓
Canonical ScoreDocument
 + same-revision NotationDocument / admitted evidence
        ↓
SemanticAddress / SelectionSnapshot / InsertionPosition
        ↓
04A exact timing + 04B1 measure semantics
        ↓
typed bounded edit / authoring primitive
        ↓
independent validation
        ↓
atomic child revision or no mutation
        ↓
unified score+notation history
        ↓
RenderRequest + opaque manifest
        ↓
ST Score Rendering Layer / SesliTab UI
```

`ScoreDocument` is the single musical edit authority. MusicXML, sidecar evidence, renderer objects, SVG/DOM state, coordinates, Guitar Workspace results and host UI state cannot independently authorize a mutation.

## 3. Authority boundaries

### Editor Core
Owns canonical score semantics, stable semantic identity, admitted edit/authoring primitives, revision lineage/history, MusicXML adapters and validation.

### ST Score Rendering Layer
Presentation/hit testing only. It may return opaque hit tokens for an exact current `RenderRequest`; it may not create or mutate canonical state.

### SesliTab
Host/orchestrator only. It may not create a second canonical score model or dual-write score state.

### OMR Correction Engine / Guitar Workspace
Evidence/proposals only. Original source evidence remains immutable; derivative guitar state may not bypass generic Editor Core authoring.

## 4. Implemented package layers

Core:

- `score-model` — immutable canonical snapshots;
- `musicxml` — bounded MusicXML parsing/import/export;
- `musicxml-measure-semantics` — 04B1 revision-bound source measure/time evidence;
- `addressing` — revision-bound semantic identity;
- `commands`, `history`, `notation-structure`, `notation-commands` — bounded mutation/history/notation foundations.

Editor/render boundary:

- `renderer-contract`, renderer adapters — presentation-only;
- `editor-ui-contract`, `editor-shell`, `editor-selection` — non-authoritative UI/selection;
- editor intents/history/session/browser runtime — unified composition;
- keypad and renderer-selection bridge — existing-score correction / opaque-hit composition.

SEC-NE authoring:

- `editor-note-entry` — SEC-NE-01 selected-rest entry;
- session/browser composition — SEC-NE-02;
- `editor-insertion-position` — SEC-NE-03;
- `editor-measure-timing` — SEC-NE-04A timing/occupancy veto;
- `editor-position-note-entry` — SEC-NE-04C explicit-rest position mutation;
- `musicxml-measure-semantics` / `importMusicXmlWithMeasureSemantics` — SEC-NE-04B1 evidence;
- `editor-implicit-gap-materialization` — SEC-NE-04B2 conservative implicit-silence assessment/materialization.

## 5. Unified revision model

Authoritative editor history stores same-revision score + notation snapshots. Accepted mutations create one direct child revision or none. Partial commits are forbidden.

Revision-bound evidence used for an authoring decision must validate against the exact current score revision. Old `SelectionSnapshot`, `InsertionPosition`, RenderRequest or measure evidence cannot be replayed as current authority.

## 6. SEC-NE explicit-rest authoring

### SEC-NE-01 / 02 — COMPLETE / MERGED
Exact selected rest → note, with bounded trailing-rest split and unified session/history/browser composition.

### SEC-NE-03 — COMPLETE / MERGED
`InsertionPosition` is semantic cursor state bound to document/revision/part/staff/measure/voice/onset. It is never a renderer coordinate.

### SEC-NE-04A — COMPLETE / MERGED
`editor-measure-timing` validates same-revision notation, derives effective meter and exact measure duration, calculates target-voice occupancy, rejects overlap/overflow and classifies windows as:

- `EXPLICIT_REST_SLOT`;
- `BLOCKED_PITCHED`;
- `OUTSIDE_MEASURE`;
- `IMPLICIT_GAP_UNADMITTED`;
- `MIXED_UNADMITTED`.

Only `EXPLICIT_REST_SLOT` is directly writable by 04C.

### SEC-NE-04C — COMPLETE / MERGED
Low-level position note entry inside one admitted explicit rest. Supports rest start/middle/end, exact fill and deterministic leading/trailing rest splits. Existing unrelated event onsets are not moved. No parallel cursor-position browser/session API was added.

## 7. SEC-NE-04B1 measure evidence — COMPLETE / MERGED

`importMusicXmlWithMeasureSemantics` returns same-revision score, notation and `MusicXmlMeasureSemanticsDocument`.

The evidence records canonical measure/staff target, source part/measure/staff provenance, `implicit`, `non-controlling`, declared/effective meter chain and exact-rational `backup`/`forward` cursor operations.

The evidence validator independently checks cursor arithmetic, source-measure uniqueness and meter inheritance consistency. Legacy `importMusicXml` still rejects these newly meaningful semantics rather than silently dropping them. Short measure length alone is not pickup proof.

## 8. SEC-NE-04B2 legal implicit silence — COMPLETE / MERGED

04B2 introduces a **separate conservative admission layer**. It does not change 04A classifications and does not infer writable time from geometry or spacing alone.

### 8.1 Assessment requirements

`assessImplicitGapMaterialization` requires:

1. current valid 04B1 measure evidence;
2. current revision-bound `InsertionPosition`;
3. current same-revision notation;
4. a positive requested duration;
5. 04A classification exactly `IMPLICIT_GAP_UNADMITTED` for the target voice/window;
6. exact 04B1 evidence for the same canonical part/staff/measure;
7. non-null 04B1 effective meter equal to the independent 04A timing meter;
8. source measure `implicit` not `yes`;
9. source measure `non-controlling` not `yes`;
10. requested window fully contained in one exact target-voice implicit-gap interval.

MusicXML 4.0 defaults absent `implicit` and `non-controlling` attributes to `no`; therefore absent/no values may enter this conservative normal-measure profile. Explicit `yes` remains blocked.

### 8.2 Materialization rule

If admitted, `executeImplicitGapMaterialization` represents the **entire containing target-voice gap** as exactly one fresh canonical rest:

```text
implicit gap [G0, G1)
        ↓
rest(id=fresh, onset=G0, duration=G1-G0)
```

No existing event ID, onset, duration or pitch is changed. Other implicit gaps remain implicit. Cross-voice occupation neither proves nor disproves silence in the target voice; admission is exact-target-voice.

The candidate must pass canonical `ScoreDocument` validation and becomes one direct child revision or no mutation.

### 8.3 Composition boundary

04B2 is low-level. It does not directly create a pitched note and does not expose a new browser/session cursor API.

After same-revision notation rebinding, the materialized rest becomes an ordinary 04A `EXPLICIT_REST_SLOT`; existing 04C authoring semantics can then be composed without introducing another score model or renderer authority.

Undo/redo composition is proven through existing unified history. A future product-level one-gesture composition must preserve one semantic command path and must not create hidden dual-write state.

### 8.4 Intentionally blocked

- `implicit="yes"` measures, including pickup/mid-measure-repeat-like cases;
- `non-controlling="yes"` multimetric measures;
- unknown/mismatched meter evidence;
- stale/missing measure evidence;
- explicit-rest/pitched/mixed/outside-measure windows;
- cross-voice inference;
- renderer-coordinate inference;
- arbitrary onset movement.

## 9. Remaining authoring gates

### SEC-NE-05 — NOT STARTED
Canonical onset movement/retiming. Must freeze exact overlap/measure validation and tie/slur/beam/tuplet coupling; tuplets retime atomically.

### SEC-NE-06 — NOT STARTED
Structural score authoring.

### SEC-NE-07 — NOT STARTED
Advanced note/notation authoring.

### SEC-NE-XML-ROUNDTRIP — HARDENING CONTINUES
Broader golden preservation/equivalence coverage for newly admitted measure semantics and future authoring.

### SEC-NE-08 / 09 — NOT STARTED
Guitar/TAB authoring composition and SesliTab product integration.

## 10. MusicXML boundary

MusicXML is exchange/projection data, not live editor state. An importer must import a semantic, preserve it as bounded evidence, or reject it. Silent destructive loss is forbidden where musical meaning or authoring safety changes.

04B2 relies only on admitted current 04B1 evidence and independent 04A canonical timing; it does not re-interpret raw XML in the mutation primitive. `.mxl` remains unadmitted.

## 11. Renderer / host / Guitar boundary

Renderer packages remain presentation-only. SesliTab remains orchestration-only. Guitar Workspace remains derivative-only. Direct external-engine invocation remains human-gated.

## 12. Dependencies

Runtime remains `saxes@6.0.0` and `xmlchars@2.2.0`; build-only remains `typescript@6.0.3` and `esbuild@0.28.2`. SEC-NE-04B2 adds no third-party dependency.

## 13. Non-negotiable invariants

1. `ScoreDocument` is the single musical edit authority.
2. MusicXML and sidecar evidence are not live edit state.
3. Evidence cannot mutate canonical state by itself.
4. Renderer/browser/DOM/SVG/coordinate state is never canonical authority.
5. Current revision validation is mandatory.
6. Stale selection/insertion/evidence fails closed.
7. Timing/overlap/measure safety is an independent veto.
8. 04B2 may only materialize a proven target-voice gap; it may not move existing events.
9. Partial authoritative commits are forbidden.
10. Source identity remains immutable.
11. No production/public-write/direct-engine authority is granted by merge.
12. No new runtime dependency is admitted implicitly.

## 14. Current status

- E0–E7-H — COMPLETE
- E8-A/B/C — IMPLEMENTED; E8-D HUMAN-GATED
- SEC-KP-00–10 — COMPLETE
- SEC-NE-00/01/02/03/04A/04C/04B1/04B2 — COMPLETE / MERGED
- SEC-NE-05/06/07/08/09 — NOT STARTED
