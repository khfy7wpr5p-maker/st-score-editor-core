# APP-11J — Triplet Removal / Unretiming Admission Foundation

Status: **IN_PROGRESS / WORK BRANCH**

APP-11J is an analysis-only foundation. It does not expose score/notation mutation, browser authoring, session history mutation, release authority or SesliTab cutover.

## Purpose

Provide a bounded inverse admission for the APP-11G/H/I straight-three -> 3:2 Triplet path before any destructive Triplet Removal / Unretiming authoring is considered.

The analyzer answers one question only:

> Can this exact current-revision three-event 3:2 Triplet be expanded back to its supported straight written base without inventing Voice/measure topology or consuming unrelated musical material?

## Exact admitted profile

The current analysis may admit only when all of the following are true:

- exactly three explicit current-revision `EventAddressV3` targets are supplied;
- all three targets are distinct, consecutive and stay in one exact part/staff/frame/measure/voice path;
- the current canonical events are contiguous and have equal durations;
- all three events carry one exact `3:2` Triplet notation range: start mark, no middle mark, matching stop mark;
- `restoredWrittenBase = currentTripletDuration * 3 / 2` is one of the existing bounded simple written bases;
- dots, beams and ties are absent from the selected timing surface;
- selected events are not cross-staff;
- the required expansion interval is represented by one exact adjacent neutral rest beginning at the current Triplet group end;
- that rest is large enough to cover the full expansion.

Slur endpoints are not treated as timing coupling by this admission layer.

## Planned result

A successful analysis returns immutable evidence containing:

- exact source document/revision identity;
- selected event ids;
- current Triplet duration and restored written base;
- proposed straight-three onsets and durations;
- current and proposed group end;
- exact growth interval;
- adjacent-rest plan:
  - remove the rest when it exactly equals the required growth; or
  - move its onset forward and shrink it when it is larger;
- `atomicMutationRequired = true`;
- `historyMutationAuthority = false`;
- `rendererCoordinateAuthority = false`.

The analyzer itself never changes the score, notation, selection or history.

## Fail-closed boundaries

APP-11J blocks or rejects:

- stale, duplicate, reordered, cross-scope or wrong-cardinality ranges;
- non-contiguous or already-invalid timing;
- missing/loose/non-3:2 Triplet metadata;
- unsupported restored written bases;
- dots, beams or ties on the selected timing surface;
- selected cross-staff events;
- missing, non-rest, decorated or cross-staff adjacent rest;
- adjacent rest that is too short;
- implicit Voice/measure growth or renderer-derived range inference.

## Explicitly not implemented in APP-11J

- canonical Triplet removal;
- duration/onset mutation;
- Triplet metadata deletion;
- adjacent-rest deletion/shrink mutation;
- `EditorSessionV4` commit/Undo/Redo integration;
- browser/UI controls;
- arbitrary tuplet ratios/cardinalities;
- imported automatic Voice or measure invention;
- physical-device release claims.

Any mutation package must consume this admission evidence or an equivalently strict fresh analysis and must remain one atomic `ScoreDocumentV3 + NotationDocumentV4` history revision.
