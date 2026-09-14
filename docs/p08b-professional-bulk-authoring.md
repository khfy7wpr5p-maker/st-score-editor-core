# P08-B — Professional Bulk Authoring

## P08-B1: cross-measure octave transpose

P08-B begins consuming the professional selection foundation in real authoring operations. The first admitted operation is octave transpose over a contiguous professional `EVENT_SPAN`.

The implementation deliberately reuses the proven P02 teacher bulk-transpose path:

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

This avoids creating a second pitch mutation authority.

### Supported in B1

- cross-measure contiguous `EVENT_SPAN`;
- forward or backward professional anchor/focus;
- note and chord pitches;
- REST events inside the span remain unchanged;
- octave deltas `-2`, `-1`, `+1`, `+2` inherited from the proven admission profile;
- step and alter preserved while octave changes;
- notation is rebound to the direct-child revision;
- one accepted bulk action creates exactly one unified V4 history commit;
- exact Undo and Redo restore whole score + notation snapshots.

### Existing safety rules intentionally inherited

- stale or tampered selection fails closed;
- exact professional target ids must equal the teacher-span target ids;
- Voice gaps / unsupported span topology fail closed;
- tied selected notes fail closed until relation closure is implemented;
- grace-anchored selected events fail closed until grace relation closure is implemented;
- canonical pitch range is enforced;
- current/immediate-parent revision identity reuse fails closed;
- no renderer geometry is used as authoring evidence.

### EVENT_SET

Discontiguous `EVENT_SET` selections are intentionally **not** coerced into a contiguous span. P08-B1 returns `SELECTION_KIND_UNSUPPORTED` rather than silently transposing intervening events.

P08-B2 will add dedicated discontiguous bulk-operation relation closure. This is necessary before Ctrl/Cmd-style multi-selection can safely mutate isolated notes without affecting events between them.

### Authority

`ScoreDocumentV3 + NotationDocumentV4` remain canonical. The professional selection is noncanonical interaction state. Candidate authoring has no history authority; the session adapter commits the direct-child candidate through `EditorHistoryV4`, producing one unified history step.
