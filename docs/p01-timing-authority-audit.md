# P01 — V4 Timing Authority Coverage Audit

Status: **VERIFIED ON WORK BRANCH**

This audit records the current product/session timing mutation call graph and the bounded hardening performed after P00. It does not claim release readiness or physical-device validation.

## Canonical product path

The current standalone/app document path is:

`ScoreEditorAppDocument -> EditorSessionV4 -> bounded authoring primitive -> ScoreDocumentV3 + NotationDocumentV4 -> EditorHistoryV4`

For existing-event duration and dot changes the supported product routes are:

1. Basic duration
   - `commitAppBasicAuthoringIntent`
   - `commitSessionBasicAuthoringIntentV4`
   - `executeBasicAuthoringV4`
   - `executeRhythmAuthoringV4`
   - `analyzeEventDurationMutationV4`

2. Keypad Duration / Rest / Dot
   - `commitAppKeypadAction`
   - `commitSessionKeypadActionV4`
   - `executeSafeEditorKeypadActionV4`
   - duration-changing cases use `executeRhythmAuthoringV4`
   - `executeRhythmAuthoringV4` uses `analyzeEventDurationMutationV4`

A same-duration keypad operation may delegate to the older V4 keypad primitive only when the effective canonical duration is not changing. This preserves bounded rest conversion / notation behavior without creating an independent timing mutation.

## Internal primitive boundary

`editor-keypad-execution-v4` still contains the older direct `durationDots` mutation primitive. Repository search shows the product/session controller does not call that timing primitive directly: `EditorSessionV4` calls `executeSafeEditorKeypadActionV4`.

Therefore this primitive is treated as an internal implementation dependency, not as a product/SDK timing authority. P06 public SDK work must not expose it as an independent supported mutation surface. Removing/refactoring it now would mix keypad advanced-action migration with P01 timing hardening and is not justified by a current product-path regression.

## Existing timing safety evidence

APP-11A tests already prove:

- deterministic contraction analysis;
- exact next-event-boundary growth;
- overlap rejection;
- rejection of already-invalid overlapping Voice timing;
- dotted notation blocking unless atomic dot rewrite is explicitly owned;
- beam, tuplet and tie timing coupling fail-closed;
- invalid duration rejection;
- stale revision-bound target rejection;
- bounded synthetic trailing growth;
- synthetic measure overrun rejection;
- missing effective meter rejection;
- imported/MusicXML trailing growth fail-closed when pickup/non-controlling measure evidence is unavailable.

APP-11B tests already prove:

- Basic duration contraction creates a deterministic explicit residual rest;
- growth consumes/shrinks only adjacent explicit rest;
- keypad dot edits use the shared rhythm authority;
- full adjacent-rest consumption is one edit and Undo restores the prior exact pair;
- same-duration rest conversion does not invent timing;
- growth into pitched occupancy fails closed through both Basic and keypad product paths;
- non-timing keypad actions continue through the existing bounded V4 primitive.

## P01 gap discovered: immediate-parent revision identity reuse

Older V4 session authoring paths accepted a `nextRevisionId` that differed from the current revision but could equal the current revision's immediate `parentId`.

That is inconsistent with newer authoring packages such as topology, position note entry and tuple-retiming authoring, which reject both current and immediate-parent revision identity reuse. Reusing the immediate parent identity can create a revision identity sequence such as `A -> B -> A`, which is incompatible with a reliable revision-addressed editing model even when `EditorHistoryV4` still sees a direct-child parent link.

### Hardening

`EditorSessionV4` now rejects immediate-parent revision identity reuse before any canonical session write through:

- Basic authoring;
- Grace authoring;
- Articulation authoring;
- Ornament authoring;
- Keypad authoring;
- Cross-staff authoring;
- Topology authoring.

The lower-level package-specific current-revision validation remains intact; this session guard only closes the missing immediate-parent reuse condition at the unified product history boundary.

### Regression evidence

`test/p01-session-revision-reuse-hardening.test.mjs` proves that immediate-parent revision reuse is rejected before:

- Basic `SET_EVENT_DURATION`;
- timing-safe keypad `duration.half`.

Both tests also assert that the original `EditorHistoryV4` and event duration remain unchanged after rejection.

Exact code/test head `d41aa380ff37b39debf661a9ae33b30529967f6d` passed repository validation, TypeScript build and the full retained test chain on Node 18, Node 20 and Node 22 in CI run `34043634869`.

## Imported pickup / non-controlling measure boundary

P01 does not invent imported pickup semantics. Current APP-11A behavior is explicitly fail-closed for trailing MusicXML duration growth when pickup/non-controlling measure evidence is not represented in the admission contract (`BLOCKED_TRAILING_EXPANSION_SOURCE_UNPROVEN`).

Growth up to an exact next canonical event boundary remains admitted because that occupancy is proven directly and does not require inferred measure-end semantics.

This is an explicit supported/unsupported boundary, not a release claim that imported pickup semantics are fully modeled.

## Audit conclusion

For the current `ScoreEditorAppDocument -> EditorSessionV4` product surface, existing-event duration/dot changes converge on the shared APP-11 rhythm authority. The discovered session revision-identity reuse gap is patched and regression-tested. Imported trailing pickup/non-controlling semantics remain intentionally fail-closed.

Remaining related work belongs to later bounded packages rather than a hidden timing bypass:

- canonical Triplet Removal / Unretiming mutation after APP-11J admission closeout;
- broader imported pickup/non-controlling measure evidence if product requirements demand trailing growth there;
- P06 SDK allowlist must expose only the safe session/application mutation surface;
- physical-device validation remains a release gate, not a P01 code-completeness signal.
