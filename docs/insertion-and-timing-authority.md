# Insertion and Timing Authority

Status: current-reality contract through SEC-NE-04B2.

## Core rule

Writable musical time is a canonical semantic fact, never a renderer-coordinate fact.

A host gesture may propose a location, but authoring requires a current revision-bound `InsertionPosition` plus independent canonical timing/evidence validation.

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

Stale positions are invalid.

## SEC-NE-04A timing veto

`editor-measure-timing` remains the first write-admission layer. It derives current effective meter and exact target-voice intervals and classifies a requested window as:

- `EXPLICIT_REST_SLOT` — directly authoring-safe for existing explicit-rest entry;
- `BLOCKED_PITCHED` — rejected;
- `OUTSIDE_MEASURE` — rejected;
- `IMPLICIT_GAP_UNADMITTED` — not directly writable;
- `MIXED_UNADMITTED` — rejected.

## SEC-NE-04B1 evidence

`MusicXmlMeasureSemanticsDocument` is revision-bound evidence for source measure/staff provenance, `implicit`, `non-controlling`, meter declaration/inheritance and exact cursor operations.

It does not independently mutate or authorize a gap.

## SEC-NE-04B2 bounded materialization authority

04B2 does not change the meaning of `IMPLICIT_GAP_UNADMITTED`. Instead, a separate assessment may decide whether one specific target-voice implicit gap can be represented canonically as an explicit rest.

`assessImplicitGapMaterialization` requires:

1. current independently validated 04B1 evidence;
2. current same-revision notation;
3. current `InsertionPosition`;
4. current 04A classification exactly `IMPLICIT_GAP_UNADMITTED`;
5. requested window fully contained in one exact target-voice implicit gap;
6. 04B1 effective meter equal to 04A effective meter;
7. source `implicit` not `yes`;
8. source `non-controlling` not `yes`.

Absent/no `implicit` and `non-controlling` values form the first conservative normal-measure profile. Explicit `yes` is blocked.

### Deterministic transformation

If admitted:

```text
one target-voice implicit gap [start,end)
  -> one fresh canonical rest
       onset = start
       duration = end - start
```

The entire containing gap is materialized, not just the requested sub-window. This prevents arbitrary partial segmentation and makes the result deterministic.

No existing event onset, duration, pitch or ID is changed. Other implicit gaps remain untouched. A second voice cannot establish or erase silence in the target voice.

The final candidate must pass canonical `ScoreDocument` validation.

### Composition with explicit-rest entry

After the materialized score is rebound to same-revision notation, 04A sees the new rest as an ordinary `EXPLICIT_REST_SLOT`. Existing 04C semantics may then be composed on that explicit representation.

04B2 itself remains low-level and does not directly create a pitched note or expose a browser/session cursor-write API.

## Still blocked

- pickup / MusicXML `implicit="yes"` gaps;
- non-controlling/multimetric measures;
- unknown or mismatched meter evidence;
- stale/missing evidence;
- windows touching pitched or explicit-rest events;
- windows crossing measure boundaries;
- renderer geometry and nearest-target inference;
- cross-voice gap inference;
- arbitrary onset mutation.

## History and revision safety

A materialization result is one direct child score revision. When exposed through editor composition it must use same-revision notation rebinding and unified history. Undo/redo restores the exact prior/future snapshots.

Old measure evidence is stale after the mutation and must not be replayed as current evidence.

## SEC-NE-05 boundary

Moving or retiming existing events is a separate authority expansion. 04B2 may add one rest into proven empty target-voice time, but may not shift any existing onset.
