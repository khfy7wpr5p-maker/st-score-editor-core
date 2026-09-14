# P08-C — Score Structure Authoring

P08-C extends the professional workstation from event-level editing into explicit score-structure notation while preserving ScoreDocumentV3 + NotationDocumentV4 authority boundaries.

## P08-C1: staff-local key signature and clef

The first structure-authoring slice supports:

- `SET_KEY_SIGNATURE` on one current-revision content staff measure;
- `SET_CLEF` on one current-revision content staff measure;
- removal of an explicit key signature or clef by setting the value to `null`;
- exact preservation of the other staff-measure notation field;
- one notation edit = one direct-child score revision + one `EditorHistoryV4` commit;
- exact Undo/Redo of the whole score + notation snapshot.

### Ownership

The V3/V4 notation contract already separates score-structure ownership:

```text
MeasureFrame notation -> time signature, barlines
StaffMeasure notation -> key signature, clef
```

P08-C1 follows that ownership exactly. It does not place key/clef state in ScoreDocumentV3 and does not invent renderer-owned structure state.

### Mutation model

A key/clef change is notation-only musical structure. Score content (`parts`, `staves`, `voices`, `events`, pitches, durations, measure frames) is not modified. A new ScoreDocumentV3 revision is still created because NotationDocumentV4 is revision-bound and unified EditorHistoryV4 stores a score+notation pair.

All surviving notation targets are rebound to the direct-child revision before validation.

### Safety

- stale measure targets fail closed;
- tablature-linked/non-content staff targets fail closed;
- key signatures are bounded to `fifths = -7..+7`;
- clef sign is bounded to `G | F | C | percussion | TAB`;
- clef line is bounded to `1..5`;
- clef octave change is bounded to `-2..+2`;
- no-op edits fail closed rather than adding empty history revisions;
- revision identity reuse fails closed;
- renderer geometry/DOM/SVG is never authoring authority.

## Time signatures are intentionally separate

`SET_TIME_SIGNATURE` is not included in P08-C1. Time signature belongs to document-global `MeasureFrame` notation and can affect rhythmic validity across every content staff sharing that frame. It therefore requires a separate P08-C2 admission step that proves existing measure timing remains valid or explicitly defines a safe reflow policy. A notation-only meter symbol change must not silently create rhythmically contradictory canonical content.
