# P08-A — Professional Selection Foundation

## Purpose

P08 shifts the product priority from optional audio expansion back to the notation workstation itself. The first professional-workstation gap is selection: Sibelius-class editing requires stable semantic selections that can span more than one measure and can represent explicit discontiguous targets without turning renderer geometry into authoring authority.

P08-A is selection-only. It creates no score/notation mutation and no EditorSessionV4 history revision.

## Canonical boundary

```text
pointer / keyboard / host intent
        -> exact current-revision SemanticAddressV3 event endpoints
        -> editor-professional-selection-v1
        -> immutable EVENT_SPAN or EVENT_SET
        -> later P08 authoring command
```

Canonical authority remains:

```text
ScoreDocumentV3 + NotationDocumentV4
        -> EditorSessionV4 history authority
```

Selection is noncanonical presentation/interaction state.

## EVENT_SPAN

`EVENT_SPAN` accepts two exact current-revision event addresses and resolves the canonical logical Voice order across measure boundaries.

First-version scope is intentionally bounded:

- one part;
- one content staff;
- one logical Voice ordinal;
- two distinct exact event endpoints;
- any number of canonical events between the endpoints;
- forward or backward anchor/focus is accepted;
- exposed `targets` are always normalized into canonical score order;
- renderer coordinates are never consulted.

This gives future Shift-selection a deterministic semantic substrate without requiring a renderer-derived range.

## EVENT_SET

`EVENT_SET` accepts two or more exact explicitly chosen event addresses.

First-version scope:

- one part;
- one content staff;
- one logical Voice ordinal;
- duplicate events fail closed;
- discontiguous events are allowed;
- the first explicit input remains `primary`;
- exposed `targets` are normalized into canonical score order.

This gives future Ctrl/Cmd/touch multi-select a bounded substrate for bulk authoring.

## Why Voice ordinal rather than Voice id

Canonical Voice ids are measure-local. Professional selections need to cross measure boundaries, so P08-A follows the existing logical-Voice model: the selection remains in one staff and one canonical Voice ordinal while the concrete Voice id may change from measure to measure.

## Safety invariants

- all addresses must resolve against the exact current revision;
- stale addresses fail closed;
- linked tablature presentation staves cannot own canonical selection descendants;
- mixed staff/part selections fail closed;
- mixed logical Voice ordinals fail closed;
- selection creation mutates nothing;
- selection creation creates no history;
- renderer DOM/SVG/geometry is not evidence;
- selection target ordering is canonical and deterministic.

## Explicitly not included in P08-A

- measure/system/page selection;
- cross-staff selection;
- mixed-Voice bulk selection;
- lasso geometry admission;
- automatic renderer-derived range inference;
- transpose/delete/copy/paste mutations;
- score-structure mutations;
- layout/engraving mutations.

Those are later P08 stages and must consume this semantic foundation rather than invent a second selection authority.

## Next stage

P08-B will add bounded bulk authoring operations over admitted professional selections. The first mutation candidates are semitone/diatonic transpose and selection delete/replacement, with one accepted user action producing exactly one EditorSessionV4 history revision and exact Undo.
