# P08-B — Professional Bulk Authoring

## P08-B1: cross-measure octave transpose

P08-B consumes the professional selection foundation in real authoring operations. P08-B1 admits octave transpose over a contiguous professional `EVENT_SPAN`.

The span path deliberately reuses the proven P02 teacher bulk-transpose implementation:

```text
Professional EVENT_SPAN
        -> exact-current-revision revalidation
        -> exact target-set equality check
        -> TeacherEventSpanSelectionV4 adapter
        -> TeacherOctaveTranspose admission
        -> TeacherOctaveTranspose authoring
        -> one direct-child ScoreDocumentV3 revision
        -> one EditorHistoryV4 commit
        -> exact Undo / Redo
```

This avoids creating a second contiguous-span pitch mutation authority.

## P08-B2: discontiguous event-set octave transpose

P08-B2 extends the same public professional octave-transpose API to explicit discontiguous `EVENT_SET` selections.

```text
Professional EVENT_SET
        -> exact-current-revision revalidation
        -> preserve explicit primary target
        -> exact selected EventAddressV3 list only
        -> relation-safety admission
        -> exact note/chord pitch plans
        -> mutate only admitted note ids
        -> one direct-child ScoreDocumentV3 revision
        -> notation rebind
        -> one EditorHistoryV4 commit
        -> exact Undo / Redo
```

Events between selected targets are never inferred, selected, or modified. This is the semantic substrate required for future Ctrl/Cmd/touch multi-select editing.

### Supported in B1 + B2

- contiguous cross-measure `EVENT_SPAN`;
- explicit discontiguous `EVENT_SET`;
- forward or backward span anchor/focus;
- stable event-set primary target;
- note and chord pitches;
- selected REST events remain unchanged;
- unselected intervening NOTE/CHORD/REST events remain unchanged;
- octave deltas `-2`, `-1`, `+1`, `+2`;
- step and alter preserved while octave changes;
- notation is rebound to the direct-child revision;
- one accepted bulk action creates exactly one unified V4 history commit;
- exact Undo and Redo restore whole score + notation snapshots.

### Relation-safety rules

For contiguous spans, the established P02 teacher admission remains authoritative. For discontiguous sets, P08-B2 applies the equivalent bounded safety profile directly to the exact selected event list:

- stale or tampered selection fails closed;
- duplicate/mixed-scope selection is already rejected by P08-A;
- tied selected notes fail closed until tie relation closure is implemented;
- grace-anchored selected events fail closed until grace relation closure is implemented;
- canonical pitch range is enforced;
- current/immediate-parent revision identity reuse fails closed;
- every admitted note plan must apply exactly once to the same event/note/source pitch;
- notation semantic addresses must all rebind after the mutation;
- no renderer geometry is used as authoring evidence.

### Authority

`ScoreDocumentV3 + NotationDocumentV4` remain canonical. Professional selection is noncanonical interaction state. Candidate authoring has no history authority; the session adapter commits the direct-child candidate through `EditorHistoryV4`, producing one unified history step.

## P10-3A continuation — key-aware professional pitch transpose

P10-3A now extends this same semantic range substrate without changing P08-B octave-transpose authority. A separate `editor-professional-pitch-transpose-v1` engine supports key-aware semitone `±1..±12` and diatonic `±1..±7` operations over both `EVENT_SPAN` and `EVENT_SET`.

The engine resolves effective key signature staff-locally, preserves exact selected membership, updates canonical pitch and explicit accidental metadata atomically, and commits only through `EditorHistoryV4`. Tie relation closure remains **fail-closed** and grace relation closure remains **fail-closed**. Renderer geometry and DOM order remain non-authoritative.

The browser/product surface is deliberately an optional P10-3A composition so the previously qualified P10-1/P10-2 artifacts remain unchanged.

## Next P08-B work

Professional semitone/diatonic transpose is now implemented in P10-3A. The next separate bulk-edit tranche may address bounded delete/replace behavior over the same `EVENT_SPAN` / `EVENT_SET` contracts; relation closure must still be added only where it can be proven safe.
