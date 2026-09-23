# P10-3B Professional Range Delete/Replace Design

Status: **WRITTEN SPEC FROM HUMAN-APPROVED CONVERSATIONAL DESIGN / IMPLEMENTATION NOT AUTHORIZED**

Date: 2026-09-23  
Repository: `khfy7wpr5p-maker/st-score-editor-core`  
Baseline main: `41a531208953cfb68d5bcc4638fbbe1445778e47`  
Target: **P10-3B Professional Range Delete/Replace**

## Purpose

P10-3B adds a bounded professional range-replacement workflow on top of the existing semantic professional-selection, teacher-copy snapshot, canonical score/notation, unified history, and optional workstation composition layers.

The user workflow is:

```text
select source EVENT_SPAN
        -> Copy Range
        -> select destination EVENT_SPAN
        -> Replace
```

The first implementation profile is deliberately bounded. It does not introduce renderer-derived authoring, structural time deletion, cross-measure replacement, relation remapping, a parallel history stack, or production/SesliTab cutover authority.

Delete remains the existing rhythm-preserving Clear-to-REST behavior.

## Authority and non-authority

The following existing authorities remain unchanged:

- `ScoreDocumentV3 + NotationDocumentV4` are canonical.
- `EditorSessionV4 / EditorHistoryV4` are the sole unified history authority.
- `SemanticAddressV3` is exact current-revision semantic identity.
- Professional selection is noncanonical and revision-bound.
- Renderer DOM/SVG identifiers, geometry and coordinates are presentation-only and never determine authoring membership.
- Clipboard/copy snapshot state is noncanonical and history-free.
- Browser controls are command surfaces only.

P10-3B must reuse existing Clear, Copy/Paste foundations and professional-selection contracts rather than introduce parallel canonical, history or selection authorities.

---

# 1. Human-approved user behavior

## 1.1 Selection profile

Replace v1 supports only one contiguous professional `EVENT_SPAN`.

`EVENT_SET` replacement is outside this tranche.

## 1.2 Workflow

The user:

1. selects a source professional range;
2. invokes **Copy Range**;
3. selects a destination professional range;
4. invokes **Replace**.

The copy is an immutable snapshot of the exact source revision.

## 1.3 Exact duration equality

Source and destination must have exactly equal total time extent.

Replace v1 does not:

- stretch source rhythm;
- compress source rhythm;
- shift later events;
- redistribute time outside the destination window.

Event counts may differ when total extent is exactly equal.

Example:

```text
source:       quarter + quarter
destination: eighth + eighth + eighth + eighth
result:       admitted because total exact extent is equal
```

## 1.4 Supported content

Copy/Replace carries:

- NOTE;
- CHORD;
- REST;
- exact event onset relationships inside the copied segment;
- exact duration;
- pitch;
- supported event-local notation;
- supported note-local notation.

Relation-coupled or unsafe-to-remap source or destination semantics fail closed in v1.

## 1.5 Measure/scope bounds

Source and destination:

- remain inside one measure;
- are in the same measure;
- use the same part;
- use the same staff;
- use the same logical Voice ordinal.

No multi-measure, cross-part, cross-staff or cross-Voice Replace is admitted.

## 1.6 New destination identities

Inserted replacement events and notes receive new identities.

P10-3B does not reuse:

- source event/note IDs for destination copies;
- removed destination event/note IDs.

## 1.7 Revision-bound clipboard

The copied snapshot is usable only against the exact revision from which it was created.

Any intervening canonical edit makes the clipboard stale. The user must Copy again.

Selection-only changes do not create a canonical revision and therefore do not by themselves stale the clipboard.

After one successful Replace, the clipboard becomes stale and remains stale even if Undo later returns to the earlier revision.

## 1.8 Destination ownership

Destination events and the local notation owned by those events/notes are removed and replaced by copied source content.

P10-3B does not mix destination-local notation into source content.

## 1.9 Delete remains Clear-to-REST

Delete is not structural time deletion.

Selected pitched content is converted to REST while preserving:

- time extent;
- following event positions;
- surrounding measure timeline.

No left-shift or timeline collapse is introduced.

---

# 2. Architecture and component boundaries

## 2.1 Canonical pair and history

P10-3B does not change the canonical architecture:

```text
ScoreDocumentV3 + NotationDocumentV4
            |
            v
      EditorSessionV4
            |
            v
      EditorHistoryV4
```

## 2.2 Range Replace engine

Add a focused engine package:

```text
editor-professional-range-replace-v1
```

Responsibilities:

- validate the current source snapshot and destination selection;
- create read-only admission evidence;
- create a deterministic identity plan;
- produce validated score/notation candidates;
- create a fresh result professional selection.

It does not own history.

## 2.3 Session adapter

Add:

```text
editor-session-professional-range-replace-v1
```

Responsibilities:

- consume the validated P10-3B candidate;
- commit exactly one `EditorHistoryV4` revision;
- refresh renderer request;
- set the current semantic active target;
- return the new professional replacement selection.

## 2.4 Delete reuse

Delete continues to use the existing Professional Clear-to-REST path.

No second delete engine is introduced.

## 2.5 Copy reuse

Use `TeacherCopySnapshotV4` as the snapshot foundation.

P10-3B may add a thin adapter from professional `EVENT_SPAN` selection into the existing teacher span/snapshot contract, but must not create a parallel clipboard content model.

## 2.6 Replace is not Paste

Existing teacher Paste is deliberately bounded to overwrite an explicit neutral REST destination.

Replace has different semantics:

- it targets a real professional `EVENT_SPAN`;
- it removes admitted target content;
- it inserts equal-extent copied content.

Therefore existing `TeacherPasteAdmissionV4` must not be reused as the Replace admission contract.

Shared exact-rational, identity-planning and fail-closed patterns may be reused.

## 2.7 Workstation adapter

Add a thin workstation composition layer:

```text
score-editor-professional-range-replace-workstation-v1
```

It orchestrates:

```text
Copy Range -> transient snapshot
destination EVENT_SPAN -> Replace
```

Clipboard state remains noncanonical and history-free.

## 2.8 Optional composition

P10-3B is a separate optional layer:

```text
P10-1 qualified workstation
        ->
P10-2 optional unretiming composition
        ->
P10-3A optional pitch-transpose composition
        ->
P10-3B optional range-replace composition
```

Proposed browser package:

```text
score-editor-browser-professional-workstation-p10-3b-v1
```

P10-3B must not widen previously-qualified P10-1/P10-2/P10-3A artifacts.

---

# 3. Copy snapshot and admission contract

## 3.1 Snapshot reuse

P10-3B clipboard payload:

```ts
TeacherCopySnapshotV4 | null
```

Professional Copy flow:

```text
Professional EVENT_SPAN
        ->
P10-3B bounded validation
        ->
TeacherEventSpanSelectionV4
        ->
createTeacherCopySnapshotV4(...)
        ->
TeacherCopySnapshotV4
```

No second snapshot schema is introduced.

## 3.2 Copy bounds

The professional Copy adapter admits only:

- `EVENT_SPAN`;
- one measure;
- one part;
- one staff;
- one logical Voice;
- current revision;
- relation-safe content.

`EVENT_SET` Copy-for-Replace is not admitted.

## 3.3 Exact revision check

Replace requires:

```text
snapshot.sourceDocumentId === current score.id
snapshot.sourceRevisionId === current score.revision.id
```

Any canonical edit after Copy makes the snapshot stale.

## 3.4 Dedicated Replace admission

Add a read-only admission contract:

```text
ProfessionalRangeReplaceAdmissionV1
```

It validates but does not mutate.

The admission must prove:

- snapshot envelope is valid;
- source revision is exact-current;
- source is one measure;
- destination is `EVENT_SPAN`;
- destination is one measure;
- source and destination use the same measure;
- source and destination use the same part/staff/Voice;
- source and destination do not share event identities;
- each range forms a safe contiguous canonical time region;
- source and destination exact extents match;
- notation/relation safety is admitted.

## 3.5 Source/destination overlap

Source and destination may be adjacent but may not share events.

Any intersection of source and destination event IDs fails closed.

## 3.6 Exact rational time

All timing comparison uses exact rational arithmetic.

No floating-point approximate equality is allowed for Replace extent.

## 3.7 Contiguous time region

Source and destination must each represent a continuous canonical time window.

Implicit gaps, timing overlap or ambiguous occupancy inside either selected span fail closed.

## 3.8 Admission remains read-only

The admission records bounded evidence such as:

- source revision;
- source/destination event IDs;
- source/destination measure;
- part/staff/Voice scope;
- exact source extent;
- exact destination extent;
- destination start;
- event/note counts;
- destination note IDs to be removed;
- identity-allocation requirement.

It has:

```text
canonicalMutationAuthority = false
historyMutationAuthority = false
```

---

# 4. Canonical mutation and identity allocation

## 4.1 Identity plan

Create a separate read-only plan:

```text
ProfessionalRangeReplaceIdentityPlanV1
```

It includes:

- document ID;
- source revision ID;
- next revision ID;
- destination start/stop identity;
- source event -> new destination event mappings;
- source note -> new destination note mappings;
- event/note counts;
- collision evidence.

It does not mutate canonical state.

## 4.2 New identity rule

Example:

```text
source:
s1 s2

destination:
d1 d2

result:
source remains s1 s2
replacement becomes r1 r2
d1 d2 are removed
```

Neither source IDs nor removed destination IDs are reused for replacement identities.

## 4.3 Deterministic IDs

New IDs are deterministic from bounded semantic context, following the established paste identity-planning pattern.

Inputs may include:

- document ID;
- current revision ID;
- destination range identity;
- next revision ID;
- source event/note provenance;
- deterministic event/note index.

Suggested public prefixes:

```text
replace-event:<deterministic-hash>
replace-note:<deterministic-hash>
```

All existing and planned IDs are checked for collisions before mutation.

Any collision fails closed.

## 4.4 Mutation sequence

The authoring engine:

1. validates the current score/notation pair;
2. revalidates admission;
3. revalidates identity plan;
4. clones the canonical score candidate;
5. resolves the exact destination measure/Voice;
6. proves the target range still matches admission;
7. removes the exact destination events;
8. creates source-derived replacement events with new IDs;
9. places them at destination-relative onsets;
10. sets a fresh direct-child revision;
11. validates with `createScoreDocumentV3(...)`.

No partial canonical mutation is exposed.

## 4.5 Timing placement

For each source event:

```text
newOnset =
destinationStart
+ source.onsetFromSegmentOrigin
```

Source durations are preserved exactly.

Pitch is preserved exactly.

No later event is shifted.

## 4.6 Exact target application

The destination plan must apply exactly once.

If expected destination membership, order, measure, Voice or revision differs at execution time, mutation fails with a target-plan error.

## 4.7 Fresh revision

Result revision:

```text
revision.id = nextRevisionId
revision.parentId = currentRevisionId
```

The next revision ID must be fresh and must not reuse current or immediate-parent revision identity.

The engine itself remains:

```text
historyMutationAuthority = false
```

---

# 5. Notation ownership, remap and fail-closed policy

## 5.1 V1 matrix

| Notation / relation | Source behavior | Destination behavior |
|---|---|---|
| accidental | COPY | REMOVE |
| dots | COPY | REMOVE |
| articulation | COPY | REMOVE |
| simple ornament | COPY | REMOVE |
| single-note tremolo | COPY | REMOVE |
| beam | REJECT | REJECT |
| tuplet | REJECT | REJECT |
| tie | REJECT | REJECT |
| slur | REJECT | REJECT |
| spanning tremolo | REJECT | REJECT |
| wavy-line ornament | REJECT | REJECT |
| grace group anchored to event | REJECT | REJECT |
| cross-staff placement | REJECT | REJECT |
| measure/frame notation | NOT COPIED | PRESERVE |

## 5.2 Source-local notation

Admitted source-local notation is cloned to the new replacement event/note identities.

The original source content and notation remain unchanged.

## 5.3 Destination-local notation

Local notation owned by removed destination events/notes is removed with those identities.

P10-3B does not mix destination-local notation into replacement content.

## 5.4 Measure/frame notation remains

Replace does not copy or delete:

- time signature;
- key signature;
- clef;
- barlines/repeats;
- frame-level notation.

## 5.5 Relation safety

Any unsupported relation affecting source or destination causes the entire Replace to fail closed.

No relation is silently dropped, flattened, repaired or guessed.

Even when both endpoints appear within the selected range, relation remapping remains outside v1 unless separately admitted in a future tranche.

## 5.6 Final notation validation

The candidate `NotationDocumentV4` must resolve entirely against the candidate `ScoreDocumentV3`.

No notation entry may target:

- a removed event;
- a removed note;
- a stale revision;
- an incorrect newly-generated identity.

Final acceptance requires a valid canonical score/notation pair.

---

# 6. Result selection and SemanticAddress rebinding

## 6.1 Replacement content remains selected

After successful Replace, the new inserted replacement span becomes the current professional selection.

Removed destination IDs cannot be rebound because they no longer exist.

## 6.2 Fresh semantic addresses

New replacement addresses are derived from the result score using canonical addressing.

P10-3B does not construct new semantic addresses by manually rewriting old destination address fields.

## 6.3 Fresh ProfessionalSelectionV1

The new result selection is built with the existing professional selection validator.

For a forward destination selection:

```text
anchor = first inserted event
focus  = last inserted event
```

For a backward destination selection:

```text
anchor = last inserted event
focus  = first inserted event
```

Destination selection direction is preserved.

## 6.4 Cardinality may change

Result selection covers all inserted events, even when replacement cardinality differs from destination cardinality.

## 6.5 Scope must remain valid

All new replacement events must resolve in the admitted part/staff/Voice/measure scope.

If a valid fresh professional selection cannot be built, the Replace candidate is not committed.

## 6.6 Session active target

The session semantic selection becomes the active target/focus derived from the result professional selection using existing professional-selection behavior.

Renderer/DOM state never becomes selection authority.

---

# 7. One action / one history revision / Undo-Redo

## 7.1 Atomic history rule

One accepted Replace action creates exactly one `EditorHistoryV4` revision.

Score mutation, notation mutation, identity replacement and result-selection creation are not separate history operations.

## 7.2 Single history commit

The session adapter calls `commitEditorHistoryV4(...)` exactly once for an accepted Replace.

Expected result contract includes:

```text
historyCommitCount = 1
historyAuthority = EditorHistoryV4
```

## 7.3 Exact Undo

Undo restores the exact pre-Replace snapshot:

```text
ScoreDocumentV3 before Replace
+
NotationDocumentV4 before Replace
```

Therefore removed destination event/note identities and their notation return exactly.

No inverse Replace algorithm is implemented for Undo.

## 7.4 Exact Redo

Redo restores the already-recorded post-Replace snapshot.

The Replace engine is not rerun during Redo.

Generated event/note identities therefore return exactly as first committed.

## 7.5 Failed Replace has zero history side effect

Any rejected or invalid Replace leaves:

- past unchanged;
- present unchanged;
- future unchanged.

## 7.6 Undo/Redo professional selection

Professional selection is noncanonical.

History navigation clears professional range selection rather than attempting speculative selection recovery across revisions.

This matches the existing professional workstation history-navigation behavior.

## 7.7 Clipboard stale latch

Once any canonical mutation occurs after Copy, the P10-3B clipboard becomes stale.

Undo does not reactivate it.

The user must Copy again before another Replace.

## 7.8 Standard future invalidation

If the user performs:

```text
Replace -> Undo -> another edit
```

the old Redo future is cleared by normal `EditorHistoryV4` behavior.

No P10-3B-specific history stack exists.

---

# 8. Browser/UI controls and optional P10-3B composition

## 8.1 Separate optional browser layer

Add:

```text
score-editor-browser-professional-workstation-p10-3b-v1
```

and a separate optional artifact, proposed as:

```text
st-score-editor-p10-3b-workstation.js
```

P10-3B does not replace P10-1, P10-2 or P10-3A artifacts.

## 8.2 New controls

Expose two explicit professional commands:

- **Copy Range**
- **Replace**

Existing Clear, Paste, Insert and Transpose commands retain their meanings.

Replace never aliases the existing neutral-REST Paste operation.

## 8.3 Browser state

P10-3B browser state includes at least:

- clipboard available;
- clipboard current;
- clipboard stale;
- copied event count;
- copied note count;
- can Copy for Replace;
- can attempt Replace;
- last error.

## 8.4 Control enablement

**Copy Range** is enabled only when a current professional `EVENT_SPAN` is available.

`EVENT_SET` does not enable Copy-for-Replace.

**Replace** is enabled only when:

- a current non-stale snapshot exists;
- a current destination `EVENT_SPAN` exists.

Deeper semantic admission remains engine-owned.

UI enablement is not authority.

## 8.5 Desktop and mobile

Desktop and mobile invoke the same semantic controller commands.

Suggested controller surface:

```text
copyProfessionalRangeForReplace()
replaceProfessionalRange()
```

No mobile-specific mutation path exists.

## 8.6 Touch target

Visible P10-3B controls preserve the existing minimum 44 x 44 px touch-target contract.

## 8.7 DOM non-authority

DOM order, SVG geometry, renderer node identity or coordinate membership may not determine Copy or Replace target membership.

Targets come only from exact current-revision semantic selection.

## 8.8 Capability profile

The optional P10-3B profile must report bounded truth such as:

```text
p10_3bWorkstationComposition = true
professionalRangeCopyAvailable = true
professionalRangeReplaceAvailable = true

canonicalAuthority = false
historyAuthority = EditorHistoryV4

rendererCoordinateAuthority = false
domAuthoringAuthority = false

p10_1QualifiedBasePreserved = true
p10_2QualifiedBasePreserved = true
p10_3aQualifiedBasePreserved = true

productionDefault = false
productionReleaseAuthorized = false
seslitabCutoverAuthorized = false
```

## 8.9 Bundle-budget strategy

P10-3B gets its own bounded optional artifact budget.

Existing qualified P10-1/P10-2/P10-3A byte budgets remain unchanged.

The exact P10-3B byte ceiling is not invented in advance. It is frozen during implementation qualification from the first real production build with bounded headroom, then enforced as a regression gate.

---

# 9. Error and status model

## 9.1 Structured fail-closed errors

P10-3B must expose bounded semantic error codes covering at least:

```text
INVALID_COPY_SNAPSHOT
CLIPBOARD_STALE
SELECTION_KIND_UNSUPPORTED
SELECTION_STALE_OR_TAMPERED

SOURCE_MEASURE_UNSUPPORTED
DESTINATION_MEASURE_UNSUPPORTED
SCOPE_MISMATCH
SOURCE_DESTINATION_OVERLAP

SOURCE_TIMING_INVALID
DESTINATION_TIMING_INVALID
REPLACE_EXTENT_MISMATCH

SOURCE_RELATION_UNSUPPORTED
DESTINATION_RELATION_UNSUPPORTED

INVALID_REVISION_ID
ID_COLLISION
IDENTITY_PLAN_STALE_OR_INVALID

ADMISSION_STALE_OR_TAMPERED
TARGET_PLAN_INVALID

RESULT_INVALID
NOTATION_RESULT_INVALID
RESULT_SELECTION_INVALID
```

Any such failure has zero canonical/history side effect.

## 9.2 User-facing messages

Browser/UI surfaces concise actionable messages and does not expose internal stacks, semantic IDs or revision IDs.

Examples:

- extent mismatch: "Kaynak ve hedef aralığın toplam süresi aynı olmalıdır."
- stale clipboard: "Nota değiştiği için kopyalanan aralık artık güncel değil. Yeniden kopyalayın."
- unsupported relation: "Bu aralık güvenli şekilde değiştirilemeyen bağlı nota işaretleri içeriyor."
- source/destination overlap: "Kaynak ve hedef aralık birbiriyle çakışamaz."

## 9.3 Copy success

Copy creates no history revision.

Successful Copy browser state:

```text
clipboardAvailable = true
clipboardCurrent = true
lastError = null
```

Copy does not require a canonical `EditorSessionV4.status` change.

## 9.4 Failed new Copy clears prior Replace clipboard

If the user attempts to Copy a new professional range and that Copy fails, the previous P10-3B clipboard is not retained as silently usable content.

This prevents the user from believing the failed new source was copied while accidentally replacing from older content.

## 9.5 Replace success

Successful commit status:

```text
PROFESSIONAL_RANGE_REPLACE_EDIT_COMMITTED
```

Browser-facing text may simply report that the range was replaced.

The clipboard then becomes stale.

## 9.6 Failed Replace

On failed Replace:

- score unchanged;
- notation unchanged;
- history unchanged;
- destination professional selection remains;
- clipboard remains available/current if failure itself did not arise from staleness.

This allows the user to choose a different destination without unnecessarily copying the source again.

## 9.7 Clipboard states

P10-3B exposes exactly:

```text
EMPTY
CURRENT
STALE
```

Undo never transitions `STALE -> CURRENT`.

New successful Copy transitions to `CURRENT`.

Document replacement/disposal clears the clipboard to `EMPTY`.

## 9.8 Error state is noncanonical

`lastError` is browser/controller state only.

It does not enter:

- `ScoreDocumentV3`;
- `NotationDocumentV4`;
- `EditorHistoryV4`.

---

# 10. Automated tests, WebKit, bundle budgets, Sonar and closeout

## 10.1 Focused test matrix

P10-3B automated tests must prove at least:

- Copy only from current `EVENT_SPAN`;
- one-measure source/destination bounds;
- same-measure/same-part/same-staff/same-Voice scope;
- exact revision-bound snapshot;
- stale clipboard rejection;
- source/destination overlap rejection;
- exact rational extent equality;
- 2 -> 4 and 4 -> 2 event-cardinality replacement with equal extent;
- source identity/content preservation;
- removal of destination event/note identities;
- new collision-free replacement identities;
- exact destination-relative onset placement;
- unchanged later events;
- local supported notation copy;
- destination-local notation removal;
- measure/frame notation preservation;
- beam/tuplet/tie/slur/grace/cross-staff/spanning relation fail-closed;
- fresh result semantic addresses;
- full replacement `EVENT_SPAN` result selection;
- FORWARD/BACKWARD direction preservation;
- one Replace = one history revision;
- exact Undo;
- exact Redo with original generated replacement IDs;
- zero side effect on failure;
- clipboard stale latch after mutation;
- Undo does not revive clipboard;
- existing Teacher Paste/Insert, Clear and Transpose semantics remain unchanged.

Implementation work must follow focused RED -> minimal implementation -> GREEN cycles.

## 10.2 Full repository CI

Exact implementation head must pass repository build/tests on:

- Node 18;
- Node 20;
- Node 22.

Focused P10-3B success alone is insufficient.

## 10.3 Dedicated WebKit regression

Add a dedicated WebKit qualification script, proposed:

```text
scripts/p10-3b-webkit-professional-range-replace-regression.mjs
```

and a separate GitHub Actions gate.

Use the existing iPhone-like automated profile:

```text
viewport: 390 x 844
deviceScaleFactor: 3
hasTouch: true
isMobile: true
browser: WebKit
```

The dedicated scenario must exercise:

```text
open MusicXML
-> capture source EVENT_SPAN
-> Copy Range
-> capture destination EVENT_SPAN
-> Replace
-> verify canonical replacement content
-> verify fresh result selection
-> verify one history increment
-> Undo
-> verify exact pre-Replace score+notation
-> Redo
-> verify exact post-Replace score+notation and IDs
```

It must also cover:

- 44 px touch targets;
- stale clipboard behavior;
- extent-mismatch failure with no history mutation;
- no console errors;
- no page errors.

## 10.4 Retained WebKit gates

P10-3B qualification must retain relevant existing gates, including:

- APP-09B renderer/layout regression;
- P08-E4 professional artifact regression;
- P10-1 professional workstation regression;
- P10-2 unretiming regression;
- P10-3A pitch-transpose regression;
- dedicated P10-3B range-replace regression.

## 10.5 Bundle budget

P10-3B ships a separate optional artifact, proposed contract:

```text
ST_SCORE_EDITOR_P10_3B_PROFESSIONAL_WORKSTATION_BUNDLE
```

Existing P10-1/P10-2/P10-3A budgets are retained unchanged.

P10-3B's own maximum byte budget is frozen only after measuring the real production artifact during implementation qualification.

## 10.6 SonarQube

Keep the existing repository ruling:

- SonarQube Cloud Automatic Analysis remains the Sonar integration.
- Do not add `sonar-project.properties`.
- Do not add a duplicate GitHub Actions Sonar scanner.
- Do not add/request `SONAR_TOKEN` merely to duplicate Automatic Analysis.
- Do not use `//NOSONAR` or global exclusions to suppress findings.
- Do not claim Quality Gate PASS until the SonarQube Cloud service itself reports PASS.

If Sonar remains unavailable/not computed, closeout must report that truth and may not claim fully-qualified Sonar status.

## 10.7 Physical-device boundary

Automated WebKit is regression evidence, not physical-device evidence.

P10-3B optional artifact begins with:

```text
physicalDeviceValidationRequired = true
physicalDeviceValidationPassed = false
```

Implementation or merge does not by itself authorize production/public-write/SesliTab cutover.

## 10.8 Closeout evidence

Before P10-3B implementation closeout, record:

- exact implementation head SHA;
- focused P10-3B test PASS;
- full Node 18/20/22 PASS;
- retained WebKit PASS;
- dedicated P10-3B WebKit PASS;
- P10-3B artifact byte size;
- frozen P10-3B budget;
- live Sonar status;
- whole-branch diff/self-review;
- no unresolved contract placeholder/TODO;
- ROADMAP reality update;
- productization Markdown/JSON update;
- relevant architecture/design references update;
- repository-reality regression evidence;
- `productionDefault = false`;
- `productionReleaseAuthorized = false`;
- `seslitabCutoverAuthorized = false`.

---

# Package / file direction for implementation planning

The written design anticipates, but does not yet authorize implementation of, a package map broadly shaped as follows:

```text
packages/editor-professional-range-replace-v1/
packages/editor-session-professional-range-replace-v1/
packages/score-editor-professional-range-replace-workstation-v1/
packages/score-editor-browser-professional-workstation-p10-3b-v1/
```

Expected qualification additions include dedicated focused tests, a P10-3B WebKit script/workflow, optional artifact build support and repository-reality documentation tests.

Exact file/task sequencing belongs to the separately human-approved implementation plan.

---

# Explicit non-goals

P10-3B v1 does not authorize:

- `EVENT_SET` Replace;
- cross-measure Replace;
- cross-part/staff/Voice Replace;
- structural time deletion;
- timeline left-shift;
- duration stretch/compress;
- relation remapping for beams, tuplets, ties, slurs, grace, cross-staff, spanning tremolo or wavy lines;
- renderer/DOM-derived target membership;
- parallel clipboard canonical state;
- parallel history;
- production-default cutover;
- public-write cutover;
- SesliTab cutover.

---

# Design completion gate

Sections 1-10 above are the written form of the human-approved conversational P10-3B design.

This file authorizes only the next review gate: human review of the written design spec.

It does **not** authorize:

- implementation-plan execution;
- production implementation;
- merge;
- release;
- production/public-write cutover;
- SesliTab cutover.

After human approval of this written spec, the next allowed step is to use the planning workflow to produce a detailed implementation plan. That plan must itself be presented for explicit human approval before implementation begins.
