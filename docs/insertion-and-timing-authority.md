# Insertion and Timing Authority

Status: current-reality contract through SEC-NE-04B1.

## Core rule

Writable musical time is a canonical semantic fact, never a renderer-coordinate fact.

A host may use screen/page/SVG/DOM position to propose where the user pointed, but authoring can proceed only after conversion to a current revision-bound `InsertionPosition` and independent canonical timing admission.

## InsertionPosition

```text
InsertionPosition {
  contractVersion
  documentId
  revisionId
  partId
  staffId
  measureId
  voiceId
  onset
}
```

A stale position is invalid and cannot be replayed on a newer revision.

## SEC-NE-04A timing admission

`editor-measure-timing` remains the write-admission authority for position-based note entry. It validates same-revision notation, derives effective meter and exact measure duration, computes target-voice occupancy, rejects overlap/overflow and classifies requested windows as:

- `EXPLICIT_REST_SLOT` — authoring-safe only when the entire requested duration is inside one explicit rest;
- `BLOCKED_PITCHED` — rejected;
- `OUTSIDE_MEASURE` — rejected;
- `IMPLICIT_GAP_UNADMITTED` — rejected;
- `MIXED_UNADMITTED` — rejected.

## SEC-NE-04C mutation rule

`editor-position-note-entry` may mutate only after 04A admits the exact full window as `EXPLICIT_REST_SLOT`.

Supported split shapes:

- note + trailing rest at rest start;
- leading rest + note + trailing rest in the middle;
- leading rest + note at rest end;
- note only for exact rest fill.

The final candidate must pass canonical `ScoreDocument` validation. Other event onsets remain unchanged.

04C remains low-level; there is no second public cursor-position session/browser mutation API.

## SEC-NE-04B1 evidence rule

SEC-NE-04B1 now preserves additional **measure evidence**, but deliberately does not change 04A authoring admission.

`MusicXmlMeasureSemanticsDocument` is revision-bound and records, per canonical measure/staff target:

- source part/measure/staff provenance;
- source `implicit` yes/no/null;
- source `non-controlling` yes/no/null;
- declared/effective time signature and declaration/inheritance status;
- ordered exact-rational `backup` / `forward` cursor operations.

This evidence may be used by later validators, but cannot independently mutate the score or make a gap writable.

Important distinctions:

- `implicit="yes"` is preserved evidence, not automatic pickup authority;
- `non-controlling="yes"` is preserved independently and must not be treated as pickup/incomplete evidence;
- short measure length alone is never pickup proof;
- missing or stale evidence fails closed;
- legacy `importMusicXml` still rejects 04B1-only semantics rather than silently losing them.

## Why implicit gaps remain blocked

Even after 04B1, an apparent empty span does not yet prove legal writable silence. SEC-NE-04B2 must combine admitted measure semantics with exact per-voice occupancy and a bounded legal-span rule.

No renderer geometry, event-spacing heuristic, measure-length heuristic or cross-voice inference may bypass 04B2.

## SEC-NE-04B2 gate

04B2 must prove all of the following before an implicit gap can become writable:

- the exact target measure has sufficient current 04B1 semantics evidence;
- the legal measure span is known under the admitted profile;
- the exact target voice is silent across the requested interval;
- no conflicting occupation exists in that voice;
- the requested interval is not excluded by pickup/incomplete/non-controlling semantics;
- deterministic explicit rests can be materialized without changing unrelated event onsets;
- the materialization and note entry can commit through one unified history transaction.

Until then, `IMPLICIT_GAP_UNADMITTED` remains fail-closed.

## History and rendering composition

When an accepted primitive becomes an editor operation:

```text
accepted ScoreDocument child revision
  -> same-revision notation/evidence rebind/update where admitted
  -> unified history commit
  -> new revision-bound RenderRequest
```

Old `SelectionSnapshot`, `InsertionPosition`, RenderRequest and revision-bound evidence are never reused as current authority.

## Future onset authority

SEC-NE-05 is a separate authority expansion. It must freeze exact overlap/measure validation and tie/slur/beam/tuplet coupling before any existing event can be moved or retimed.
