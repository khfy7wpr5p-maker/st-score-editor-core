# ST Score Editor Core — Architecture

Status: **Core remains implemented through E8-C. SEC-SMUFL-KEYPAD-01 is complete through SEC-KP-10. SEC-NE is COMPLETE / MERGED through SEC-NE-05 for bounded insertion, legal-gap materialization and fail-closed onset retiming. Structural and advanced authoring remain later stages.**

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
typed bounded edit / authoring / retiming primitive
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

SEC-NE authoring:

- `editor-note-entry` — SEC-NE-01 selected-rest entry;
- session/browser composition — SEC-NE-02;
- `editor-insertion-position` — SEC-NE-03;
- `editor-measure-timing` — SEC-NE-04A timing/occupancy veto;
- `editor-position-note-entry` — SEC-NE-04C explicit-rest position mutation;
- `musicxml-measure-semantics` / `importMusicXmlWithMeasureSemantics` — SEC-NE-04B1 evidence;
- `editor-implicit-gap-materialization` — SEC-NE-04B2 conservative legal-gap rest materialization;
- `editor-event-retiming` — SEC-NE-05 relation-safe single-event onset movement;
- `editor-triplet-retiming` — SEC-NE-05 atomic current 3:2 triplet-group movement.

Editor/render boundary remains presentation-only and uses semantic selection/history/session/browser packages without granting renderer authority.

## 5. Unified revision model

Authoritative editor history stores same-revision score + notation snapshots. Accepted mutations create one direct child revision or none. Partial commits are forbidden.

Revision-bound evidence used for an authoring decision must validate against the exact current score revision. Old `SelectionSnapshot`, `InsertionPosition`, RenderRequest or measure evidence cannot be replayed as current authority.

## 6. Bounded note-entry and legal-gap authoring

SEC-NE-01/02 provide exact selected-rest entry and unified composition. SEC-NE-03 defines semantic cursor identity. SEC-NE-04A independently derives effective meter and exact target-voice occupancy. SEC-NE-04C writes only inside one explicit rest.

SEC-NE-04B1 adds evidence authority, not mutation authority. It preserves admitted MusicXML meter, `implicit`, `non-controlling` and exact `backup`/`forward` cursor evidence.

SEC-NE-04B2 may convert one independently proven normal-measure target-voice implicit gap into one fresh explicit rest. Pickup/implicit and non-controlling measures remain fail-closed.

## 7. SEC-NE-05 onset mutation / retiming — COMPLETE / MERGED

### 7.1 Single-event authority

`editor-event-retiming` exposes `MOVE_EVENT/1.0.0`.

The target must be one exact current `EventAddress` and remain inside the same measure/voice. The primitive changes only canonical onset and preserves event/note IDs, duration and pitch. Canonical event order is rebuilt deterministically.

Before acceptance:

- current notation is revalidated;
- target beam/tuplet/tie/slur coupling causes rejection;
- crossing another relation-coupled event causes rejection;
- MusicXML-derived scores require current 04B1 measure evidence;
- `implicit="yes"`, `non-controlling="yes"` and unknown-meter MusicXML measures reject;
- the candidate notation is rebound to the candidate revision;
- SEC-NE-04A re-analyzes the complete target voice and vetoes overlap/overflow.

This is real canonical onset authority, but deliberately not unrestricted geometric drag authority.

### 7.2 Atomic current 3:2 triplet authority

`editor-triplet-retiming` exposes `MOVE_TRIPLET_GROUP/1.0.0`.

The admitted profile is exactly the current keypad-supported 3:2 three-event triplet:

- exactly three distinct consecutive events in one measure/voice;
- equal canonical durations;
- current canonical contiguity;
- all three carry `actualNotes=3`, `normalNotes=2`;
- first has one start boundary, middle no boundary, third matching stop boundary;
- no beam coupling in v1;
- no tie/slur coupling in v1.

The operation accepts one new group start onset, derives the second and third onsets from existing equal durations, and creates one atomic child revision. Partial triplet retiming is impossible. Final whole-voice timing is independently revalidated by 04A.

### 7.3 Coupling policy

The frozen 05 policy is fail-closed:

- relation-free single events may move;
- an existing admitted 3:2 triplet may move only as its exact atomic group;
- independently moving beamed, tied, slurred or tupletted members is forbidden;
- relation meaning is never inferred from nearest event, coordinates or new event order;
- broader relation-aware retiming requires a later explicit contract.

## 8. Remaining authoring gates

### SEC-NE-06 — NOT STARTED
Structural score authoring. Measure/voice changes come first; staff/part changes require separately bounded admission. Removal cannot orphan notation or relation targets.

### SEC-NE-07 — NOT STARTED
Advanced note/notation authoring. Reuse existing correction-keypad semantics instead of duplicating notation meaning where possible.

### SEC-NE-XML-ROUNDTRIP — HARDENING CONTINUES
Broader golden preservation/equivalence coverage for newly admitted measure, retiming, structural and advanced semantics.

### SEC-NE-08 / 09 — NOT STARTED
Guitar/TAB authoring composition and SesliTab product integration.

## 9. MusicXML boundary

MusicXML is exchange/projection data, not live editor state. An importer must import a semantic, preserve it as bounded evidence, or reject it. Silent destructive loss is forbidden where musical meaning or authoring safety changes.

Retiming does not reinterpret raw XML. For MusicXML-derived scores, it consumes only current validated 04B1 measure evidence and independent canonical timing.

`.mxl` remains unadmitted.

## 10. Dependencies

Runtime remains `saxes@6.0.0` and `xmlchars@2.2.0`; build-only remains `typescript@6.0.3` and `esbuild@0.28.2`. SEC-NE-05 adds no third-party dependency.

## 11. Non-negotiable invariants

1. `ScoreDocument` is the single musical edit authority.
2. MusicXML and sidecar evidence are not live edit state.
3. Renderer/browser/DOM/SVG/coordinate state is never canonical authority.
4. Current revision validation is mandatory.
5. Stale selection/insertion/evidence fails closed.
6. Timing/overlap/measure safety is an independent veto.
7. Relation-coupled notation cannot be silently damaged by reorder/retiming.
8. Partial tuplets are never independently retimed.
9. Partial authoritative commits are forbidden.
10. Source identity remains immutable.
11. No production/public-write/direct-engine authority is granted by merge.
12. No new runtime dependency is admitted implicitly.

## 12. Current status

- E0–E7-H — COMPLETE
- E8-A/B/C — IMPLEMENTED; E8-D HUMAN-GATED
- SEC-KP-00–10 — COMPLETE
- SEC-NE-00/01/02/03/04A/04C/04B1/04B2/05 — COMPLETE / MERGED
- SEC-NE-06/07/08/09 — NOT STARTED
