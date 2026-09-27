# P10-2C Exact 4:3 Tuplet Mutation — Architecture Design

Status: **DESIGN FOR REVIEW — NO PRODUCTION MUTATION AUTHORIZED**

Baseline: `main@40e84d1fb9af4ad370adf99cb0f2e91df33d6e60`

Linear: `SES-32`

## 1. Purpose

P10-2C defines one bounded canonical mutation:

> Restore one exact four-event **4:3 tuplet** to four straight written events using fresh P10-2B admission evidence.

This design deliberately does **not** create a generic tuplet mutation engine.

The existing P10-2B analyzer already proves all timing and adjacent-rest facts required for this mutation. P10-2C therefore consumes that evidence rather than re-deriving rhythm rules inside a second implementation.

The existing APP-11J/P10-2 exact 3:2 Triplet mutation path remains unchanged.

## 2. Design classification

This is an **architectural** change because it adds a new canonical mutation authority and session/history entry point.

It is intentionally narrower than “generalized tuplet mutation.”

Authorized design target:

- exact ratio: `4:3`;
- exact cardinality: four selected explicit events;
- exact output: straight four;
- exact timing/rest plan: only what P10-2B admits;
- exact history behavior: one accepted action = one `EditorHistoryV4` revision.

Not authorized:

- arbitrary ratios;
- arbitrary cardinalities;
- nested tuplets;
- mixed 3:2/4:3 generic mutation;
- generalized browser authoring;
- automatic target inference from renderer geometry;
- release/public-write/SesliTab cutover;
- deploy or Render work.

## 3. Canonical invariants

The following remain unchanged:

- `ScoreDocumentV3 + NotationDocumentV4` are the canonical editing pair.
- `EditorSessionV4 / EditorHistoryV4` are the sole history authority.
- `SemanticAddressV3` is exact current-revision identity.
- Renderer DOM, SVG, coordinates, viewport and render tokens are not timing or target authority.
- Event and note stable IDs are preserved by the mutation.
- Existing part/staff/frame/measure/Voice topology is preserved.
- The mutation may change only admitted event timing, owned 4:3 tuplet notation, and the one admitted adjacent neutral rest.
- Unsupported notation/timing coupling fails closed.
- A rejected mutation produces no canonical write and no history revision.
- Browser/product exposure is separate from canonical mutation authority.

## 4. Repository reality

### 4.1 P10-2B read-only 4:3 admission

`packages/editor-generalized-tuplet-admission-v4/src/index.ts`

The existing analyzer:

`analyzeGeneralizedTupletToStraightV4(score, notation, targets, FOUR_TO_THREE_TUPLET_PROFILE_V4)`

admits only:

- exactly four explicit current-revision `EventAddressV3` targets;
- same part/staff/frame/measure/Voice;
- exact current event order;
- exact consecutive timing;
- equal current event duration;
- exact `4:3` tuplet metadata;
- one start mark on event 1;
- no middle marks on events 2 and 3;
- one matching stop mark on event 4;
- supported simple restored written base;
- no selected cross-staff placement;
- no timing-coupled dots;
- no timing-coupled beams;
- no timing-coupled ties;
- no nested/overlapping tuplet marks;
- one immediate adjacent same-Voice neutral rest;
- sufficient adjacent-rest duration;
- exact bounded rational arithmetic.

It already returns:

- `targetEventIds`;
- `restoredWrittenBase`;
- `eventPlans[]` with exact current/proposed onset and duration;
- `requiredGrowthInterval`;
- `restPlan`;
- `balancePolicy`;
- immutable admission status/reason.

Its authority flags remain:

- `canonicalMutationAuthority:false`;
- `historyMutationAuthority:false`;
- `rendererCoordinateAuthority:false`.

P10-2C must not change those P10-2B authority flags.

### 4.2 Existing P10-2 exact 3:2 mutation

`packages/editor-tuplet-unretiming-authoring-v4/src/index.ts`

The existing 3:2 authoring package establishes the correct mutation pattern:

1. validate score + notation;
2. parse one bounded intent;
3. require a fresh next revision ID;
4. run the read-only admission fresh;
5. reject if admission is not admitted;
6. copy exact event timing plans;
7. execute the exact admitted rest plan;
8. remove only owned tuplet metadata;
9. preserve unrelated notation;
10. build a direct-child score revision;
11. rebind notation to the new revision;
12. validate exact output against the admitted plan;
13. return a current-revision semantic selection.

P10-2C should reuse this **architecture pattern**, not widen this existing 3:2 package.

### 4.3 Existing unified history pattern

`packages/editor-session-tuplet-unretiming-v4/src/index.ts`

The current 3:2 session wrapper:

- calls canonical authoring once;
- commits score + notation via `commitEditorHistoryV4`;
- keeps one unified history;
- selects the rebound result event;
- rebuilds the renderer request;
- creates one status result.

P10-2C requires the same history architecture in a separate session wrapper.

## 5. Architecture decision

### 5.1 Selected approach

Create a separate exact-4:3 mutation authority:

`packages/editor-four-to-three-tuplet-unretiming-authoring-v4/src/index.ts`

and a separate session wrapper:

`packages/editor-session-four-to-three-tuplet-unretiming-v4/src/index.ts`

Data flow:

```text
four current-revision EventAddressV3 targets
        |
        v
exact 4:3 mutation intent parser
        |
        v
fresh P10-2B read-only admission
        |
        +---- blocked -> no canonical write
        |
        v
copy admitted eventPlans + restPlan exactly
        |
        v
remove owned 4:3 tuplet metadata only
        |
        v
validate direct-child ScoreDocumentV3 + NotationDocumentV4
        |
        v
validate result matches admission evidence
        |
        v
session wrapper
        |
        v
one EditorHistoryV4 revision + rebuilt renderer request
```

### 5.2 Why the 3:2 authoring package is not widened

The existing package name and intent are explicitly 3:2:

- `editor-tuplet-unretiming-authoring-v4`;
- `UNRETIMING_TRIPLET_TO_STRAIGHT_THREE`;
- three targets;
- APP-11J admission.

Widening it to 4:3 would:

- change an already-qualified contract;
- mix two different admission authorities;
- make future arbitrary-ratio growth easier to introduce accidentally;
- increase regression blast radius.

The 3:2 package remains unchanged.

### 5.3 Why no generic ratio/cardinality engine is created

P10-2B proves only one newly admitted profile: exact 4:3 with four targets.

A generic engine accepting `actualNotes`, `normalNotes` or arbitrary target count would imply mutation authority not supported by current admission evidence.

Therefore P10-2C public mutation interfaces must contain no generic ratio parameter.

## 6. Public mutation contract

### 6.1 Version

```ts
export const FOUR_TO_THREE_TUPLET_UNRETIMING_AUTHORING_V4_VERSION = '1.0.0' as const;
```

### 6.2 Intent

```ts
export interface UnretimingFourToThreeToStraightFourIntentV4 {
  readonly version: typeof FOUR_TO_THREE_TUPLET_UNRETIMING_AUTHORING_V4_VERSION;
  readonly type: 'UNRETIMING_FOUR_TO_THREE_TO_STRAIGHT_FOUR';
  readonly targets: readonly EventAddressV3[];
}
```

Intent rules:

- exact object keys only;
- version must equal `1.0.0`;
- type must equal `UNRETIMING_FOUR_TO_THREE_TO_STRAIGHT_FOUR`;
- targets must contain exactly four entries;
- no profile parameter;
- no ratio parameter;
- no cardinality parameter;
- no rest policy parameter;
- no renderer token/coordinate parameter.

### 6.3 Options

```ts
export interface FourToThreeTupletUnretimingAuthoringV4Options {
  readonly nextRevisionId: string;
}
```

The revision ID must:

- satisfy the existing stable ID format;
- differ from current revision ID;
- differ from current parent revision ID.

### 6.4 Result

```ts
export interface FourToThreeTupletUnretimingAuthoringV4Result {
  readonly version: typeof FOUR_TO_THREE_TUPLET_UNRETIMING_AUTHORING_V4_VERSION;
  readonly score: Readonly<ScoreDocumentV3>;
  readonly notation: Readonly<NotationDocumentV4>;
  readonly selection: EventAddressV3;
  readonly admission: Readonly<GeneralizedTupletAdmissionV4>;
}
```

The returned admission must be the **fresh admission used for this mutation**.

## 7. Mutation entry point

Primary API:

```ts
export const executeFourToThreeTupletToStraightFourUnretimingV4 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  rawIntent: unknown,
  options: FourToThreeTupletUnretimingAuthoringV4Options
): Readonly<FourToThreeTupletUnretimingAuthoringV4Result>;
```

Required sequence:

1. validate `ScoreDocumentV3`;
2. validate `NotationDocumentV4`;
3. parse exact intent;
4. validate fresh revision ID;
5. call `analyzeGeneralizedTupletToStraightV4` with:
   - current score;
   - current notation;
   - exact four targets;
   - `FOUR_TO_THREE_TUPLET_PROFILE_V4`;
6. reject unless `admission.admitted === true`;
7. apply only the fresh admission evidence;
8. validate canonical output;
9. return immutable result.

The mutation function must not accept previously cached admission evidence as an input.

This prevents stale read-only evidence from being replayed after another edit.

## 8. Error contract

Proposed error codes:

```ts
export type FourToThreeTupletUnretimingAuthoringV4ErrorCode =
  | 'INVALID_INTENT'
  | 'INVALID_REVISION_ID'
  | 'TIMING_NOT_ADMITTED'
  | 'TARGET_PATH_INVALID'
  | 'RESULT_INVALID';
```

### INVALID_INTENT

Used for:

- extra/missing intent keys;
- wrong version;
- wrong type;
- target count other than four;
- malformed target array.

### INVALID_REVISION_ID

Used when next revision ID is not a valid fresh direct-child identifier.

### TIMING_NOT_ADMITTED

Used when fresh P10-2B analysis returns `admitted:false`.

The error details must preserve:

- P10-2B `reason`;
- `couplingReasons`.

The mutation package must not translate a blocked P10-2B condition into an implicit repair.

### TARGET_PATH_INVALID

Used when a target/rest that was freshly admitted unexpectedly cannot be found during the same mutation execution.

### RESULT_INVALID

Used when the proposed canonical result cannot be validated or differs from the admission evidence.

## 9. Exact timing mutation

For every `admission.eventPlans` entry:

- locate the event by stable event ID in the admitted Voice;
- verify the event still exists;
- set onset to `plan.proposedOnset`;
- set duration to `plan.proposedDuration`;
- preserve event kind;
- preserve event ID;
- preserve note/chord/rest content;
- preserve note IDs;
- preserve pitch;
- preserve every unrelated event field.

The authoring package must not recompute:

- restored written duration;
- proposed onset sequence;
- growth interval;
- adjacent-rest capacity.

Those values come only from fresh P10-2B evidence.

## 10. Adjacent-rest mutation

P10-2B currently admits exactly two rest actions.

### 10.1 REMOVE_ADJACENT_REST

The mutation must verify the rest still matches:

- exact event ID;
- kind `rest`;
- exact current onset;
- exact current duration.

Then:

- delete exactly that rest event;
- delete its event-notation entry if present.

No other rest may be redistributed.

### 10.2 SHRINK_ADJACENT_REST_FORWARD

The mutation must verify the same current rest facts.

Then update exactly:

- onset = `restPlan.proposedOnset`;
- duration = `restPlan.proposedDuration`.

The rest ID remains unchanged.

No rest split is created.

No new residual rest ID is created.

### 10.3 No alternative balancing

The mutation must not:

- consume a preceding rest;
- search another Voice;
- search another measure;
- split multiple rests;
- grow the measure;
- move a pitched following event;
- invent a Voice;
- invent a frame;
- infer free space from rendering.

## 11. Tuplet notation mutation

For each of the four admitted target events:

- read its current `EventNotationV2`;
- preserve dots/beams/articulations/ornaments fields exactly as present;
- set only `tuplet:null`.

In practice, P10-2B already rejects timing-coupled dots and beams, but the authoring package still must preserve whatever unrelated admitted notation remains.

If the resulting event notation is neutral:

- the notation entry may be removed using the same normalization behavior as the existing 3:2 authoring package.

If it contains unrelated admitted notation such as articulation or ornament:

- retain the entry;
- remove only the owned 4:3 tuplet field.

## 12. Note-level notation

P10-2B rejects selected note ties but permits unrelated note-level notation such as slurs.

Therefore P10-2C must preserve all `notation.notes` entries unchanged except revision rebinding.

Examples that must survive:

- accidental metadata;
- slur start/stop;
- any other currently admitted non-timing-coupled note notation.

No note notation is created merely because the tuplet is removed.

## 13. Cross-staff and relations

P10-2B rejects any selected event that owns a cross-staff placement.

Therefore P10-2C does not implement cross-staff timing rewrite.

Unrelated cross-staff placements elsewhere in the document:

- remain unchanged;
- are rebound to the new revision through stable semantic IDs.

P10-2C must not widen P10-2B relation admission rules.

## 14. Identity contract

On accepted mutation:

Unchanged stable identities:

- document ID;
- part ID;
- staff ID;
- frame ID;
- measure ID;
- Voice ID;
- all four target event IDs;
- all target note/chord note IDs;
- unrelated event IDs;
- shrunk adjacent rest ID.

Potentially removed identity:

- only the adjacent rest event ID when fresh admission action is `REMOVE_ADJACENT_REST`.

Changed identity:

- revision ID only.

No selected event or note is replaced.

## 15. Revision contract

The resulting score revision must be:

```ts
{
  id: options.nextRevisionId,
  parentId: score.revision.id
}
```

The resulting notation must have:

- same document ID;
- new revision ID;
- all surviving semantic addresses rebound to the new revision.

The original score and notation inputs remain immutable.

## 16. Result validation

After constructing the candidate result, the mutation authority must validate all of the following.

For each event plan:

- event exists;
- kind is unchanged;
- event ID is unchanged;
- onset exactly equals `proposedOnset`;
- duration exactly equals `proposedDuration`;
- its tuplet notation is absent.

For `REMOVE_ADJACENT_REST`:

- the admitted rest ID no longer resolves;
- no notation entry remains for that deleted rest.

For `SHRINK_ADJACENT_REST_FORWARD`:

- rest ID still resolves;
- kind is rest;
- onset exactly equals admitted proposed onset;
- duration exactly equals admitted proposed duration.

Also require:

- all unrelated stable IDs are preserved;
- no topology changed;
- output score passes `createScoreDocumentV3`;
- output notation passes `createNotationDocumentV4`.

Any mismatch is `RESULT_INVALID`.

## 17. Selection contract

After accepted mutation, selection is:

- the first admitted target event;
- rebound by stable event ID into the new revision.

The selection must not be inferred from:

- event index after mutation;
- DOM node;
- renderer token;
- screen coordinates.

## 18. Session/history contract

New session package:

`packages/editor-session-four-to-three-tuplet-unretiming-v4/src/index.ts`

Primary API:

```ts
export const commitSessionFourToThreeTupletToStraightFourV4 = (
  session: EditorSessionStateV4,
  intent: unknown,
  options: FourToThreeTupletUnretimingAuthoringV4Options
): Readonly<EditorSessionStateV4>;
```

Required behavior:

1. read `session.history.present`;
2. call exact-4:3 canonical mutation once;
3. commit returned score + notation with `commitEditorHistoryV4`;
4. preserve one unified history;
5. set returned current-revision event selection;
6. rebuild renderer request using existing session renderer profile;
7. expose a bounded status code.

Suggested status:

`FOUR_TO_THREE_TUPLET_UNRETIMING_COMMITTED`

Suggested message:

`Atomic 4:3 tuplet to straight-four unretiming committed in the unified V4 history.`

## 19. History invariants

Accepted action:

- exactly one new history entry;
- exactly one direct-child revision;
- one canonical score+notation pair.

Undo:

- restores exact pre-mutation 4:3 score;
- restores exact pre-mutation 4:3 notation;
- restores removed/shrunk rest exactly;
- restores exact tuplet marks.

Redo:

- restores exact straight-four score;
- restores exact straight-four notation;
- restores exact admitted rest result.

Rejected action:

- does not call history commit;
- does not alter past/present/future.

## 20. Imported MusicXML

P10-2B already proves read-only admission on imported MusicXML 4:3 content while preserving event and note identity.

P10-2C should therefore be source-format neutral at the canonical layer:

- do not reject solely because `score.source.format === 'musicxml'`;
- require the same fresh P10-2B admission;
- preserve `score.source` metadata;
- mutate canonical score/notation only.

P10-2C does **not** create new MusicXML parsing rules.

Qualification should later verify that an admitted imported 4:3 fixture:

1. mutates successfully;
2. preserves event/note identity;
3. exports through the existing renderer/interchange path if the resulting canonical state is already representable;
4. does not silently flatten unsupported state.

## 21. Renderer boundary

Canonical mutation does not manipulate renderer state directly.

The session wrapper rebuilds a renderer request from the committed canonical pair.

Requirements:

- renderer request revision equals new canonical revision;
- manifest semantic addresses are current-revision;
- old render tokens are stale;
- no renderer coordinate participates in target order or timing arithmetic.

If a resulting canonical state is not representable by current MusicXML projection, the renderer must remain fail-closed rather than changing the canonical mutation.

## 22. Browser/product boundary

Browser/product exposure is **not part of this first SES-32 spec**.

Reason:

- Linear SES-32 acceptance explicitly requires browser/product exposure to be designed separately;
- core mutation/history should qualify before a new workstation action is introduced;
- current optional workstation artifact lineage must not be widened silently.

A later product design may define:

- explicit four-event selection/capture;
- availability state from fresh P10-2B analysis;
- a visible “Remove 4:3 Tuplet” / “Restore straight timing” command;
- optional workstation composition;
- dedicated WebKit gate.

None of that is authorized by this spec.

## 23. Existing 3:2 authority preservation

The following must remain byte/behavior compatible unless separately justified:

- `editor-tuplet-unretiming-admission-v4`;
- `editor-tuplet-unretiming-authoring-v4`;
- `editor-session-tuplet-unretiming-v4`;
- P10-2 browser unretiming path;
- P10-2 workstation artifact.

P10-2C must not:

- redirect 3:2 intents into the new package;
- change 3:2 intent shape;
- change 3:2 error semantics;
- change 3:2 artifact budget;
- alter existing APP-11J admission behavior.

## 24. Fail-closed inheritance

Fresh P10-2B rejection remains authoritative for:

- wrong cardinality;
- stale target;
- wrong target kind;
- duplicate target;
- reordered/nonconsecutive target;
- cross-scope target;
- invalid current timing;
- unsupported tuplet profile;
- malformed tuplet boundary;
- nested/overlapping tuplet;
- unsupported written base;
- dots;
- beams;
- ties;
- selected cross-staff placement;
- missing adjacent rest;
- insufficient rest capacity;
- bounded arithmetic failure.

P10-2C does not add automatic repair for any of these.

## 25. Verification contract for later implementation

The implementation plan must begin RED and prove the following.

### 25.1 Canonical happy path

- exact 4:3 eighth example becomes four straight eighths;
- exact event IDs survive;
- exact note IDs survive;
- exact part/staff/frame/measure/Voice topology survives;
- owned 4:3 metadata disappears;
- original inputs remain unchanged;
- result revision is one direct child;
- selection rebounds to first event.

### 25.2 Rest removal

- exactly consumed adjacent rest is deleted;
- no other event moves except according to the admitted four event plans;
- deleted rest notation is removed;
- no residual rest is invented.

### 25.3 Rest shrink

- larger rest keeps same ID;
- onset/duration match admission evidence exactly;
- no new rest is created.

### 25.4 Unrelated notation preservation

Prove preservation of admitted examples such as:

- articulation on selected event;
- ornament on selected event;
- accidental note notation;
- slur across selected notes;
- notation on unrelated following event.

### 25.5 Fail closed

Each P10-2B blocked reason must propagate as `TIMING_NOT_ADMITTED` with the original reason preserved.

At minimum focused mutation tests must include:

- stale target;
- reordered target list;
- wrong ratio;
- malformed boundary;
- dots;
- beams;
- ties;
- cross-staff selected event;
- insufficient rest;
- invalid revision ID.

### 25.6 Result tamper/mismatch defense

Tests must prove mutation refuses or detects:

- missing admitted event;
- changed admitted rest;
- incomplete rest plan;
- candidate validation failure;
- output timing not equal to admission evidence;
- retained owned tuplet metadata.

### 25.7 Session/history

- one accepted action = one history revision;
- rejection = zero history revision;
- exact Undo;
- exact Redo;
- renderer request revision updates;
- returned selection is current-revision.

### 25.8 Imported MusicXML regression

- imported exact 4:3 fixture admits and mutates;
- event/note identities survive;
- `score.source` remains unchanged;
- existing representable export path remains representable;
- no new parser behavior is introduced.

### 25.9 Retained 3:2 regression

Run existing:

- P10-2 canonical authoring tests;
- P10-2 roundtrip tests;
- P10-2 browser tests;
- P10-2 workstation tests;
- P10-2 WebKit gate.

These are mandatory because P10-2C must not weaken the qualified 3:2 path.

## 26. Naming decision

Use explicit “four-to-three” naming for the mutation package and API.

Reason:

- P10-2B package is called generalized because it is an analysis framework with a profile argument;
- P10-2C mutation authority is **not generalized**;
- explicit package naming prevents future consumers from assuming arbitrary ratio mutation is available.

Recommended names:

- `editor-four-to-three-tuplet-unretiming-authoring-v4`;
- `editor-session-four-to-three-tuplet-unretiming-v4`;
- `executeFourToThreeTupletToStraightFourUnretimingV4`;
- `commitSessionFourToThreeTupletToStraightFourV4`.

## 27. Deferred contracts

The following remain separate design gates:

- browser control and capture UX;
- optional workstation composition;
- artifact budget;
- WebKit product gate;
- 5:4 mutation;
- 6:4 mutation;
- arbitrary `n:m`;
- nested tuplets;
- multiple simultaneous tuplet groups;
- cross-staff selected tuplet mutation;
- dot-aware tuplet unretiming;
- beam-aware tuplet unretiming;
- tie-aware tuplet unretiming;
- measure-crossing tuplet mutation;
- rest balancing across more than one event;
- automatic measure growth;
- production/default release;
- public write;
- SesliTab cutover;
- Render/deploy changes.

## 28. Acceptance criteria for this architecture spec

This design is acceptable when all are true:

1. exact 4:3 scope is explicit;
2. P10-2B remains read-only;
3. fresh P10-2B evidence is mandatory inside mutation execution;
4. no rhythm/rest math is independently re-derived in the mutation package;
5. event/note/topology identity preservation is explicit;
6. only owned 4:3 tuplet metadata is removed;
7. exact admitted rest action is atomic with event timing;
8. unsupported coupling inherits fail-closed P10-2B behavior;
9. one accepted action maps to one `EditorHistoryV4` revision;
10. exact Undo/Redo is required;
11. renderer coordinates remain non-authoritative;
12. imported MusicXML canonical mutation is source-format neutral and bounded by the same admission;
13. existing APP-11J/P10-2 3:2 authority is unchanged;
14. arbitrary ratios/cardinalities remain unauthorized;
15. browser/product exposure remains a separate future gate.

## 29. Next gate

After explicit human approval of this written spec:

- create a separate TDD implementation plan for **core + session only**;
- do not add browser/product exposure to that implementation plan;
- do not begin production implementation until the plan itself is reviewed and execution is separately approved.
