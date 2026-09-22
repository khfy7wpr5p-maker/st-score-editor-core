# P10-2 — Advanced Rhythm & Relations: Bounded Triplet Removal / Unretiming

Status: **WRITTEN SPEC — USER DESIGN APPROVED / IMPLEMENTATION NOT STARTED**

Date: 2026-09-21

Repository: `khfy7wpr5p-maker/st-score-editor-core`

Baseline main: `8e2a42b6e0473027cf9c08eabb5172133600191d`

## 1. Purpose

P10-2 starts from the current mainline APP-11 boundary. APP-11J already provides a read-only, fail-closed admission analysis for converting one exact current-revision three-event 3:2 Triplet back to its supported straight written base. P10-2 must not duplicate or weaken that analyzer.

This tranche productizes the inverse mutation safely:

1. consume fresh APP-11J admission evidence;
2. atomically expand the three selected Triplet events back to their supported straight written timing;
3. remove only the owned Triplet metadata;
4. consume the exact adjacent neutral-rest capacity described by APP-11J;
5. commit the resulting `ScoreDocumentV3 + NotationDocumentV4` pair through the existing unified `EditorSessionV4` history;
6. expose the operation through app/browser authoring using exact semantic event selection;
7. prove one accepted action = one history revision with exact Undo/Redo.

The goal is not general tuplet editing. It is one bounded inverse of the already-qualified APP-11G/H/I 3:2 path.

## 2. Current mainline reality

The following are already present and are treated as fixed dependencies:

- `editor-tuplet-unretiming-admission-v4` with `analyzeTripletToStraightThreeUnretimingV4`;
- APP-11J exact three-event, current-revision admission;
- APP-11G/H/I straight-three -> 3:2 Triplet admission, atomic canonical mutation, session/app/browser productization and history behavior;
- `ScoreDocumentV3 + NotationDocumentV4` as the canonical score pair;
- `EditorSessionV4 / EditorHistoryV4` as the sole history authority;
- `SemanticAddressV3` as current-revision semantic identity;
- P10-1 professional workstation composition merged on main;
- renderer coordinates remain noncanonical;
- production/default/SesliTab cutover remains outside this work.

APP-11J itself remains analysis-only and has no mutation or history authority.

## 3. User-visible outcome

For an explicitly selected exact 3-event 3:2 Triplet that APP-11J admits, the workstation can perform **Remove Triplet / Restore Straight Timing**.

A successful action:

- preserves the three selected event identities;
- restores each selected event to the APP-11J `restoredWrittenBase`;
- restores the exact APP-11J proposed onsets;
- removes the selected events' 3:2 Triplet notation metadata;
- applies the APP-11J adjacent-rest plan atomically;
- creates exactly one new canonical revision;
- creates exactly one `EditorSessionV4` history step;
- leaves the first selected event selected, rebound to the new revision;
- allows one Undo to restore the exact Triplet state;
- allows one Redo to restore the exact straight state.

If any prerequisite no longer holds at execution time, the action fails closed with no canonical or history mutation.

## 4. Architecture

### 4.1 Admission remains the authority

The mutation layer must call `analyzeTripletToStraightThreeUnretimingV4` against the current score, current notation and current revision-bound targets immediately before mutation.

It must not trust stale cached admission objects as mutation authority. A cached admission may be surfaced for UI explanation, but execution must re-analyze fresh current state.

No renderer coordinate, DOM hit rectangle, display order or inferred range can create or repair the target set.

### 4.2 New canonical mutation package

Create a dedicated inverse package rather than combining both directions into the existing forward retiming authoring package.

Planned package:

`packages/editor-tuplet-unretiming-authoring-v4/src/index.ts`

Primary API:

`executeTripletToStraightThreeUnretimingV4(score, notation, intent, options)`

Planned intent:

```ts
{
  version: '1.0.0',
  type: 'UNRETIMING_TRIPLET_TO_STRAIGHT_THREE',
  targets: readonly EventAddressV3[]
}
```

Planned options:

```ts
{
  nextRevisionId: string
}
```

The package owns one atomic score+notation mutation only after APP-11J returns `admitted: true`.

### 4.3 Canonical event mutation

For the three admitted target events, copy APP-11J's planned values exactly:

- `eventPlans[n].proposedOnset`
- `eventPlans[n].proposedDuration`

Do not recalculate an alternative timeline after admission except for independent validation.

Event ids, note ids, chord membership, Voice id, measure id, staff id, frame id and part id remain unchanged.

No new Voice or measure may be invented.

### 4.4 Triplet notation removal

For exactly the three admitted selected events:

- preserve dots, beams, articulations and ornaments only insofar as APP-11J already admitted them;
- set owned `notation.tuplet` to `null`;
- preserve unrelated note notation such as accidentals and slurs;
- preserve unrelated notation on all other events.

APP-11J already blocks dots, beams and ties on the selected timing surface, so the mutation package must not introduce new rewrite authority for them.

### 4.5 Adjacent-rest balance

The mutation must execute the exact `restPlan` returned by fresh APP-11J analysis.

Two admitted actions exist:

1. `REMOVE_ADJACENT_REST`
   - remove exactly the admitted adjacent rest event;
   - remove any corresponding neutral event-notation entry if present;
   - no unrelated event may move.

2. `SHRINK_ADJACENT_REST_FORWARD`
   - preserve the rest event id;
   - set onset and duration exactly to the admitted proposed values;
   - preserve neutrality;
   - no other event may move.

No fallback residual-rest creation exists in the inverse direction. If the admitted rest plan cannot be executed exactly, fail closed.

### 4.6 Result validation

After constructing the candidate:

- validate the candidate through `createScoreDocumentV3`;
- rebuild notation through `createNotationDocumentV4`;
- verify the three selected events have the expected straight onsets/durations;
- verify Triplet metadata is absent on the selected events;
- verify the adjacent-rest result exactly matches the plan;
- verify current Voice occupancy is valid;
- verify no unrelated canonical ids or topology changed.

Any mismatch produces `RESULT_INVALID` and returns no partial mutation.

## 5. Session and application integration

Create a dedicated session wrapper:

`packages/editor-session-tuplet-unretiming-v4/src/index.ts`

Primary API:

`commitSessionTripletToStraightThreeV4(session, intent, options)`

Contract:

- execute one canonical unretiming result;
- call `commitEditorHistoryV4` exactly once;
- rebind selection to the first target event in the new revision;
- rebuild `RendererRequestV4` from the resulting canonical pair;
- status code: `TRIPLET_UNRETIMING_COMMITTED`.

Create the app-document wrapper:

`packages/score-editor-app-tuplet-unretiming/src/index.ts`

It must preserve title/origin/saved-revision semantics and set dirty state using the same policy as the forward APP-11I wrapper.

## 6. Browser authoring

Add a bounded browser authoring surface following the existing triplet-retiming authoring pattern.

The browser layer may:

- capture exactly three explicit current-revision semantic event targets;
- expose an availability/explanation state from APP-11J;
- request the unretiming commit through the app/session layer;
- refresh rendering and selection from canonical state.

The browser layer may not:

- infer three targets from renderer geometry;
- silently reorder targets;
- synthesize missing targets;
- auto-select neighboring events;
- mutate notation or timing directly;
- own history;
- bypass APP-11J.

Initial UI wording may use **Remove Triplet** with a secondary status/explanation such as **Restore straight timing**.

The operation is unavailable when APP-11J does not admit the exact current selection.

## 7. History semantics

One accepted browser action must produce exactly one history revision.

Required sequence:

```text
Triplet state T
  -> Remove Triplet
Straight state S
  -> Undo
Triplet state T exactly
  -> Redo
Straight state S exactly
```

The exact score+notation pair must be restored by history navigation. Undo/Redo must not rerun admission or reconstruct the mutation heuristically.

A rejected action creates zero history entries.

## 8. Round-trip invariant

The highest-value integration regression starts from a supported straight profile and uses the production forward path first:

```text
supported straight three events
  -> APP-11H/I forward retiming
qualified 3:2 Triplet
  -> P10-2 inverse unretiming
supported straight three events
```

For the supported inverse profile, the final musical timing and Triplet-owned notation must equal the original straight profile.

Identity/topology invariants:

- selected event ids unchanged;
- note ids unchanged;
- part/staff/frame/measure/Voice topology unchanged;
- no unrelated event timing changes;
- no unrelated notation changes.

If the forward path created a residual rest, inverse support is admitted only when the current Triplet plus adjacent rest satisfies APP-11J's exact inverse profile. P10-2 does not special-case provenance.

## 9. Fail-closed boundaries

P10-2 does not broaden APP-11J. It remains blocked for:

- stale semantic targets;
- wrong cardinality;
- duplicate or reordered/nonconsecutive targets;
- cross-part/staff/frame/measure/Voice ranges;
- invalid current occupancy;
- missing or malformed Triplet notation;
- tuplets other than exact 3:2;
- unsupported restored written bases;
- dots on selected timing events;
- beams on selected timing events;
- ties on selected timing notes;
- selected cross-staff events;
- missing/non-neutral/cross-staff adjacent rest;
- insufficient adjacent-rest capacity;
- renderer-derived range inference;
- automatic Voice invention;
- automatic measure growth;
- arbitrary imported topology repair.

Slurs remain non-timing semantics for this bounded admission and must be preserved.

## 10. Explicit non-goals

This tranche does not implement:

- arbitrary tuplet ratios;
- arbitrary tuplet cardinalities;
- nested tuplets;
- generalized tuplet editing;
- beam authoring;
- tie-aware retiming rewrite;
- dot-aware retiming rewrite;
- cross-staff retiming;
- renderer-coordinate mutation authority;
- automatic imported Voice/measure repair;
- production/default rollout;
- public-write activation;
- SesliTab cutover.

Beam authoring and broader relation work remain later P10-2 tranches after this inverse mutation is independently qualified.

## 11. Test strategy

### 11.1 Canonical mutation tests

Add dedicated tests for:

- exact eighth-note-class Triplet -> straight restoration;
- `REMOVE_ADJACENT_REST`;
- `SHRINK_ADJACENT_REST_FORWARD`;
- mixed note/chord/rest selected events where APP-11J admits;
- imported MusicXML source preservation;
- preservation of articulation/ornament/accidental/slur semantics;
- stale target rejection;
- invalid/fresh revision-id validation;
- APP-11J block reasons propagated without mutation;
- no partial mutation when result validation fails.

### 11.2 Round-trip tests

Use the existing forward authoring path to create the Triplet, then inverse it.

Prove:

- straight -> Triplet -> straight timing equivalence;
- forward-created/extended rest state is correctly consumed only when APP-11J admits it;
- canonical identities/topology are preserved.

### 11.3 Session/app tests

Prove:

- exactly one history commit;
- Undo restores exact pre-unretiming Triplet score+notation;
- Redo restores exact post-unretiming straight score+notation;
- rejected execution creates zero history entries;
- app metadata and dirty semantics remain correct.

### 11.4 Browser/WebKit tests

Prove:

- exact three-event semantic selection enables the command only when admitted;
- command creates one canonical revision;
- renderer updates from canonical state;
- Undo/Redo updates renderer and semantic selection;
- stale selection after another revision fails closed;
- no console errors;
- existing APP-09B/P08/P09/P10-1 browser regressions remain green.

## 12. Qualification gates

A P10-2 implementation PR is reviewable only after all of the following are fresh on the exact head:

- Node 18/20/22 CI green;
- full repository test suite green;
- new P10-2 unit/integration tests green;
- new P10-2 WebKit regression green;
- APP-09B preview WebKit regression green;
- P08-E4 professional artifact WebKit green;
- P10-1 professional workstation WebKit green;
- renderer qualification regression green;
- branch self-review or fresh independent review recorded;
- Sonar status reported truthfully, including `SONAR_INTEGRATION_PENDING` if integration remains unavailable.

Physical iPhone/Safari validation is required before any later release/cutover claim, but it is not permission to perform production/default/SesliTab cutover.

## 13. Safety and authority invariants

The following remain non-negotiable:

- one canonical `ScoreDocumentV3 + NotationDocumentV4` pair;
- one unified `EditorHistoryV4`;
- current-revision `SemanticAddressV3` only;
- admission is fresh and fail-closed;
- mutation is atomic;
- renderer has no canonical mutation authority;
- keyboard has no independent canonical document authority;
- audio has no canonical/history authority;
- no hidden network authority;
- no production/default/public-write/SesliTab cutover without a separate explicit human decision.

## 14. Planned implementation decomposition

The implementation plan should remain small and sequential:

1. canonical inverse authoring package + RED/GREEN unit tests;
2. round-trip invariants against existing APP-11H forward authoring;
3. session + app wrappers + exact history tests;
4. browser authoring integration;
5. professional-workstation composition exposure;
6. WebKit regression;
7. docs/productization capability matrices;
8. exact-head full qualification and final review.

Each task must use TDD and frequent commits. No task may broaden the admitted musical profile merely to make a test pass.

## 15. Completion definition for this tranche

This P10-2 tranche is complete only when a supported exact 3:2 Triplet can be removed through the real browser/workstation path and:

- the canonical timing becomes the supported straight written timing;
- Triplet-owned notation is removed;
- the adjacent neutral rest is consumed exactly according to APP-11J;
- one action creates one history revision;
- Undo restores the exact Triplet pair;
- Redo restores the exact straight pair;
- all fail-closed boundaries remain enforced;
- all exact-head qualification gates pass.

Completion of this tranche does **not** imply general tuplet support, general rhythm completion, production release readiness or SesliTab cutover authority.
