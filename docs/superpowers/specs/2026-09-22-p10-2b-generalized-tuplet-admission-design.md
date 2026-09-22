# P10-2B — Generalized Tuplet Admission Foundation Design

Status: **DESIGN SPEC / READ-ONLY ADMISSION ONLY / NO GENERALIZED MUTATION AUTHORITY**

Date: 2026-09-22  
Repository: `khfy7wpr5p-maker/st-score-editor-core`  
Baseline main: `cb82b4c8903a140b85f58fec147c1ee5b2f966a0`

## 1. Purpose

P10-2B extends the editor's tuplet understanding beyond the already-qualified 3:2 Triplet path without silently widening existing mutation authority.

The first tranche adds a separate read-only admission analyzer for one broader profile only:

- **4:3 tuplet**
- **exactly four explicit events**
- **exact rational timing**
- **same part/staff/frame/measure/Voice**
- **fail closed when timing, topology or notation safety cannot be proved**

The analyzer answers one question:

> Can this exact current-revision four-event 4:3 tuplet be restored to supported straight written timing without inventing topology, moving unrelated musical material or weakening existing safety contracts?

This tranche does not perform canonical mutation.

## 2. Current repository reality

The following are fixed dependencies and must remain true:

- PR #194 is merged on `main`.
- P10-2 bounded 3:2 Triplet removal/unretiming is an optional professional-workstation capability.
- `editor-tuplet-unretiming-admission-v4` / APP-11J remains the read-only authority for the exact 3-event 3:2 inverse profile.
- P10-2 mutation consumes fresh APP-11J evidence immediately before mutation.
- `ScoreDocumentV3 + NotationDocumentV4` remain the canonical pair.
- `EditorSessionV4 / EditorHistoryV4` remain the sole history authority.
- `SemanticAddressV3` remains the current-revision semantic targeting authority.
- renderer/DOM/SVG coordinates are not canonical timing authority.
- arbitrary tuplet mutation remains unsupported.
- production/default/public-write/SesliTab cutover remains outside P10-2B authority.

P10-2B must not modify APP-11J semantics in order to gain broader tuplet coverage.

## 3. Chosen scope

### 3.1 First generalized profile

The only newly admitted generalized profile is:

```text
actualNotes = 4
normalNotes = 3
target cardinality = 4
```

The selected four events must represent one exact 4:3 tuplet range.

The design intentionally does not add 5:4, 6:4, 7:4 or arbitrary ratios in the first tranche.

### 3.2 Why 4:3 first

4:3 is the smallest cardinality increase beyond the existing 3-event path and exercises the generalized design without requiring arbitrary ratio support.

It provides evidence for:

- variable target cardinality;
- ratio-driven exact rational reconstruction;
- generalized start/middle/stop tuplet boundary validation;
- rest-capacity analysis over a larger group;
- imported MusicXML identity preservation.

It does not require a public mutation surface.

## 4. Architecture

Create a separate package rather than widening APP-11J:

`packages/editor-generalized-tuplet-admission-v4/src/index.ts`

Planned primary API:

`analyzeGeneralizedTupletToStraightV4(score, notation, targets, profile)`

Planned profile for this tranche:

```ts
{
  version: '1.0.0',
  actualNotes: 4,
  normalNotes: 3,
  targetCardinality: 4
}
```

The package owns analysis only.

It has:

- canonical mutation authority: **false**
- history mutation authority: **false**
- renderer-coordinate authority: **false**
- automatic topology repair authority: **false**

APP-11J remains unchanged and continues to serve the qualified 3:2 inverse path.

## 5. Target contract

The analyzer requires exactly four explicit current-revision `EventAddressV3` targets.

All four must:

- resolve successfully against the current `ScoreDocumentV3`;
- be event addresses;
- be distinct;
- remain in the supplied order;
- be consecutive in one Voice;
- belong to the same part;
- belong to the same staff;
- belong to the same frame;
- belong to the same measure;
- belong to the same Voice.

The analyzer must not:

- sort targets;
- infer missing targets;
- repair target order;
- infer a range from renderer geometry;
- cross a measure boundary;
- create a Voice;
- create or extend a measure.

Stale revision-bound addresses are rejected.

## 6. Exact 4:3 notation contract

Each selected event must carry matching `TupletSpec` metadata with:

- `actualNotes: 4`
- `normalNotes: 3`

Boundary marks must form exactly one range:

```text
event 1 -> one start mark
event 2 -> no tuplet boundary mark
event 3 -> no tuplet boundary mark
event 4 -> one matching stop mark
```

The start and stop mark numbers must match.

The analyzer fails closed for:

- missing tuplet metadata;
- inconsistent ratios across the selected events;
- extra start/stop marks;
- mismatched boundary numbers;
- overlapping or nested tuplet ownership on the selected timing surface.

No attempt is made to normalize malformed imported notation.

## 7. Timing model

Canonical onset and duration remain authoritative.

The selected events must:

- have equal current durations;
- be canonically contiguous;
- not overlap the preceding Voice event;
- not overlap the following Voice event in their current state.

For a valid 4:3 group:

`restoredWrittenBase = currentTupletDuration * 4 / 3`

The calculation must use exact rational arithmetic only.

The restored written base must belong to the existing bounded simple written-base family already used by APP-11J:

- 1/1
- 1/2
- 1/4
- 1/8
- 1/16
- 1/32

No floating-point timing authority is introduced.

Any arithmetic overflow, invalid rational, unsupported written base or non-exact reconstruction fails closed.

## 8. Proposed analysis evidence

A successful admission should return immutable evidence containing at least:

- analyzer version;
- source document id;
- source revision id;
- profile ratio;
- exact target event ids;
- current tuplet duration;
- restored written base;
- current group onset;
- current group end;
- proposed group end;
- one event plan per selected event;
- required growth interval;
- next event id/onset if present;
- coupling reasons;
- adjacent-rest plan if required;
- `atomicMutationRequired = true`;
- `canonicalMutationAuthority = false`;
- `historyMutationAuthority = false`;
- `rendererCoordinateAuthority = false`;
- `admitted`;
- structured reason.

The event plans are evidence only. No score or notation object is mutated.

## 9. Event plans

For four admitted events, proposed straight timing is derived from the first current onset plus the restored written base:

```text
event 1 onset = group onset
event 2 onset = group onset + 1 * restoredWrittenBase
event 3 onset = group onset + 2 * restoredWrittenBase
event 4 onset = group onset + 3 * restoredWrittenBase

each proposed duration = restoredWrittenBase
```

The proposed group end is:

`group onset + 4 * restoredWrittenBase`

The analyzer must preserve the existing event ids and note ids in its evidence.

## 10. Adjacent-rest capacity

If restoring straight timing extends the selected group beyond its current group end, the growth interval must be covered by one exact adjacent neutral rest beginning at the current group end.

The rest must:

- be the immediate next event in the same Voice;
- begin exactly at current group end;
- be a rest event;
- have neutral event notation;
- have no cross-staff placement;
- have enough duration to cover the required growth.

The evidence may describe only two future-safe balance actions:

- `REMOVE_ADJACENT_REST` when the rest is consumed exactly;
- `SHRINK_ADJACENT_REST_FORWARD` when residual rest capacity remains.

P10-2B does not execute either action.

No new residual rest may be invented.

## 11. Timing-coupled notation boundaries

The first tranche fails closed when selected timing is coupled to unsupported notation.

Block when any selected event/note has:

- dots;
- beams;
- ties;
- cross-staff placement;
- nested or overlapping tuplet semantics.

Slurs remain non-timing semantics for this admission tranche and do not by themselves block admission.

Articulations, ornaments and accidentals remain observationally preserved because this tranche performs no mutation.

## 12. Imported MusicXML contract

Imported MusicXML is valid input only when the canonical and notation documents already represent an exact supported 4:3 profile.

Admission must preserve identity evidence:

- event ids remain unchanged;
- note ids remain unchanged;
- part/staff/frame/measure/Voice path remains unchanged.

The analyzer must not repair imported Voice structure, infer missing measure capacity or rewrite imported tuplet markup.

Imported identity-preservation tests must demonstrate that analysis does not replace or reorder canonical events.

## 13. Fail-closed reasons

The implementation plan should define stable structured reasons covering at least:

- wrong target cardinality;
- stale target;
- non-event target;
- duplicate target;
- reordered or nonconsecutive target;
- cross-part target;
- cross-staff target;
- cross-frame target;
- cross-measure target;
- cross-Voice target;
- invalid current occupancy;
- unsupported tuplet ratio;
- malformed tuplet boundary marks;
- unsupported written base;
- timing-coupled dots;
- timing-coupled beams;
- timing-coupled ties;
- cross-staff coupling;
- nested/overlapping tuplet coupling;
- missing adjacent neutral rest;
- insufficient adjacent-rest capacity;
- arithmetic failure.

The exact public reason names will be frozen in the implementation plan/tests.

## 14. Explicit non-goals

P10-2B does not implement:

- generalized tuplet mutation;
- generalized session history commits;
- generalized browser authoring;
- generalized workstation buttons;
- arbitrary tuplet ratios;
- 5:4 or 7:4 admission;
- nested tuplets;
- overlapping tuplets;
- beam authoring;
- tie-aware retiming rewrite;
- dot-aware retiming rewrite;
- cross-staff retiming;
- automatic Voice creation;
- automatic measure growth;
- renderer-derived selection authority;
- production/default/public-write activation;
- SesliTab cutover.

A later mutation tranche requires a separate design approval.

## 15. Test strategy

### 15.1 Positive admission

Tests must prove admission for exact four-event 4:3 examples across supported written bases where the required adjacent rest is sufficient.

At least one case must use imported MusicXML-derived identity.

### 15.2 Target safety

Tests must reject:

- stale `SemanticAddressV3`;
- 3 or 5 targets;
- duplicate targets;
- reordered targets;
- nonconsecutive targets;
- cross-part/staff/frame/measure/Voice selections.

### 15.3 Timing and notation safety

Tests must reject:

- unequal current durations;
- non-contiguous events;
- invalid overlap;
- malformed 4:3 metadata;
- unsupported ratio;
- unsupported written base;
- dots;
- beams;
- ties;
- cross-staff placement;
- nested/overlapping tuplets.

### 15.4 Rest capacity

Tests must distinguish:

- exact adjacent rest capacity;
- larger adjacent rest capacity;
- missing adjacent rest;
- decorated/non-neutral adjacent rest;
- insufficient adjacent rest.

### 15.5 Identity and immutability

Tests must prove:

- score input is unchanged;
- notation input is unchanged;
- event ids remain unchanged in evidence;
- note ids remain unchanged;
- topology remains unchanged;
- no renderer or history dependency exists.

## 16. SonarQube baseline contract

P10-2B runs alongside SonarQube Cloud Automatic Analysis.

Current handoff baseline:

- Automatic Analysis active;
- Quality Gate: not yet computed;
- 14 open security findings;
- security rating D.

Repository checks have found no `sonar-project.properties`, no `SONAR_TOKEN` usage and no duplicate repository Sonar scanner path.

P10-2B must not add any duplicate scanner or token path while Automatic Analysis remains active.

Before fixing or suppressing a Sonar issue, record:

- rule/key;
- severity;
- file;
- line;
- issue type;
- new-code vs overall-code;
- runtime/test/build scope;
- classification;
- rationale.

Allowed classifications:

- `TRUE_POSITIVE_FIX`
- `REVIEW_REQUIRED`
- `FALSE_POSITIVE_CANDIDATE`
- `ACCEPTED_RISK_CANDIDATE`

Every true positive fix requires root-cause analysis and a regression test where technically applicable.

No Sonar PASS may be claimed unless SonarQube Cloud itself reports a passing Quality Gate.

## 17. Qualification requirements

Before any future implementation branch can be called qualified, fresh evidence is required for the exact head:

- full repository tests;
- new P10-2B admission tests;
- Node 18/20/22 CI;
- APP-09B WebKit;
- P08-E4 WebKit;
- P10-1 workstation WebKit;
- P10-1 renderer qualification WebKit;
- P10-2 Triplet Unretiming WebKit;
- truthful Sonar Automatic Analysis status.

A green CI run is not equivalent to a Sonar Quality Gate PASS.

Physical iPhone/Safari validation remains a separate release/cutover gate.

## 18. Safety invariants

The following remain non-negotiable:

- canonical timing comes from `ScoreDocumentV3`, never SVG/DOM geometry;
- notation metadata does not replace canonical timing;
- only current-revision semantic addresses are valid targets;
- no hidden target repair;
- no topology invention;
- no measure growth;
- no Voice invention;
- exact rational arithmetic only;
- analysis is immutable;
- mutation authority remains false;
- history authority remains false;
- renderer-coordinate authority remains false;
- imported identities are preserved;
- uncertainty returns a structured fail-closed reason.

## 19. Next step after this spec

After human review and approval of this written spec:

1. write a Superpowers implementation plan at  
   `docs/superpowers/plans/2026-09-22-p10-2b-generalized-tuplet-admission.md`;
2. define exact interfaces and stable reason names;
3. map RED tests to every admitted/rejected profile;
4. implement through RED -> GREEN TDD only after plan approval;
5. stop before merge/release/cutover for a separate human decision.

Generalized tuplet mutation remains outside this plan and requires separate explicit design approval.
