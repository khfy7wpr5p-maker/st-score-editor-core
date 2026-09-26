# P10-4A Score Structure & Instrument Management — Inventory / Design Plan

> **Execution mode:** Superpowers-style architecture-first planning. This tranche is read-only inventory and written design only. Do not implement structural production mutations from this plan.

## Goal

Establish the smallest deterministic architecture contract required for professional score structure and instrument management without introducing a second canonical model, hidden topology authority, renderer-derived authoring, or history divergence.

## Baseline

Current mainline evidence:

- main: `f068b253ba03ef5c2ed7d7e60f7a8d499d466e0b`;
- P10-2B read-only 4:3 admission: merged/qualified for recorded analysis scope;
- P10-3A professional pitch transpose: merged/qualified;
- P10-3B professional range Copy/Replace: merged through PR #198;
- PR #202 exact head `534ba3526d0d12976b24c4c853c073aa9d74c1b6`: Sonar Quality Gate PASS, 0 new issues, 0 security hotspots, 0.0% PR duplication, Node 18/20/22 and retained professional WebKit gates PASS.

Canonical invariants remain:

- `ScoreDocumentV3 + NotationDocumentV4` are the canonical pair;
- `EditorSessionV4 / EditorHistoryV4` are the sole history authority;
- `SemanticAddressV3` is exact current-revision semantic identity;
- renderer DOM/SVG/coordinates are presentation only;
- one accepted semantic edit creates one unified history revision unless a separately versioned transaction contract explicitly says otherwise;
- unsupported topology transformations fail closed.

## Task 1 — Repository Reality Inventory

Read only. Produce an evidence matrix for every current code path that can create, delete, reorder, rename, or reinterpret:

- part;
- staff;
- frame / measure topology;
- Voice membership;
- clef / key / meter structure;
- instrument / transposition metadata;
- MusicXML part-list and staff projection;
- renderer staff / part projection.

For each authority record:

1. package/file/export;
2. input semantic identity;
3. canonical fields written;
4. revision/history owner;
5. validation/admission layer;
6. Undo/Redo behavior;
7. MusicXML import/export effect;
8. renderer effect;
9. current fail-closed boundaries;
10. retained tests.

No implementation changes are allowed in Task 1.

## Task 2 — Gap Matrix

Classify each P10-4 target as one of:

- `EXISTING_AUTHORITY_REUSABLE`;
- `EXISTING_AUTHORITY_NEEDS_BOUNDED_EXTENSION`;
- `NEW_VERSIONED_AUTHORITY_REQUIRED`;
- `BLOCKED_BY_MODEL_CONTRACT`;
- `DEFERRED_SEPARATE_CONTRACT`.

Targets:

- add/remove/reorder staff;
- add/remove/reorder part;
- instrument assignment;
- transposing instruments;
- staff groups;
- braces/brackets;
- percussion maps;
- stronger measure topology;
- polymeter / non-controlling measures.

The gap matrix must name the exact reason for every blocked/deferred item.

## Task 3 — Written Architecture Contract

Before code, define:

### Identity

- which IDs survive reorder;
- which operations require fresh IDs;
- how current-revision `SemanticAddressV3` becomes stale after structural mutation;
- how selection is rebound or cleared.

### History

- one accepted structure action = one `EditorHistoryV4` revision;
- exact Undo/Redo of the complete canonical pair;
- no browser/controller dual-write.

### Topology

- deterministic ordering rules;
- deletion preconditions;
- behavior for non-empty staff/part deletion;
- Voice/measure propagation rules;
- fail-closed behavior where topology semantics are not proven.

### Instrument assignment

- canonical location of instrument metadata;
- transposition semantics;
- concert/written pitch boundary;
- renderer/playback consequences;
- no automatic pitch rewrite unless separately specified.

### Interchange

- MusicXML part-list/staves/instrument projection;
- unsupported round-trip behavior must be explicit, never silent loss;
- imported topology must not authorize unsupported editor mutation.

### Presentation

- renderer consumes canonical structure;
- renderer staff order/coordinates cannot become mutation evidence;
- viewport/layout remains noncanonical.

## Task 4 — First Implementation Tranche Proposal

After Tasks 1–3, propose exactly one smallest implementation tranche. Prefer an operation with:

- clear deterministic topology semantics;
- bounded blast radius;
- exact Undo/Redo;
- strong existing model support;
- straightforward MusicXML/renderer regression evidence.

Do not combine staff, part, instrument, grouping, percussion, and polymeter mutation into one implementation tranche.

## Task 5 — TDD / Verification Plan

For the proposed tranche, write RED tests before production code. The plan must cover:

- happy path;
- stale semantic target;
- invalid topology;
- no-side-effect rejection;
- exact one-history-revision semantics;
- exact Undo/Redo;
- unrelated part/staff/Voice preservation;
- MusicXML projection;
- renderer regression;
- repository reality assertions;
- Node 18/20/22;
- relevant retained WebKit gates;
- Sonar Quality Gate.

Physical-device evidence remains separate and cannot be inferred from WebKit.

## Non-goals

This P10-4A plan does not authorize:

- production structural mutation;
- generalized tuplet mutation;
- broader P10-3 range mutation;
- polymeter/non-controlling measure implementation;
- percussion-map implementation;
- production release/public-write;
- SesliTab cutover;
- Render service creation or deployment.

## Acceptance

P10-4A inventory/design is complete only when:

1. repository inventory is traceable to current main;
2. gap matrix covers all listed P10-4 targets;
3. written identity/history/topology/instrument/interchange/presentation contracts are explicit;
4. one smallest first implementation tranche is selected with rationale;
5. TDD/verification plan exists;
6. no production source code changed;
7. the plan is presented for separate approval before implementation.
