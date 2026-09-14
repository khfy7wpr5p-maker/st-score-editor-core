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

The V3/V4 notation contract separates score-structure ownership:

```text
MeasureFrame notation -> time signature, barlines
StaffMeasure notation -> key signature, clef
```

P08-C follows that ownership exactly. It does not place notation structure in renderer state.

### C1 mutation and safety

A key/clef change is notation-only musical structure. Score content (`parts`, `staves`, `voices`, `events`, pitches, durations, measure frames) is not modified. A new ScoreDocumentV3 revision is still created because NotationDocumentV4 is revision-bound and unified EditorHistoryV4 stores a score+notation pair.

- stale measure targets fail closed;
- tablature-linked/non-content staff targets fail closed;
- key signatures are bounded to `fifths = -7..+7`;
- clef sign is bounded to `G | F | C | percussion | TAB`;
- clef line is bounded to `1..5`;
- clef octave change is bounded to `-2..+2`;
- no-op edits fail closed rather than adding empty history revisions;
- revision identity reuse fails closed.

## P08-C2: frame-global time-signature authoring

Time signature is owned by `MeasureFrame`, not by an individual staff measure. An explicit meter declaration also remains effective through subsequent frames until another explicit meter declaration replaces it. P08-C2 therefore treats a meter edit as a propagation-aware structure operation.

### Admission model

For a requested explicit time signature on frame `F`:

```text
current MeasureFrameAddressV3
        -> validate beats / beatType
        -> find F in canonical frame order
        -> compute propagation segment
             F ... frame before next explicit meter
        -> audit every content staff in every affected frame
        -> reject existing voice overlap
        -> reject any event ending after requested nominal measure duration
        -> immutable admission facts
        -> direct-child score revision, score content unchanged
        -> update only F's explicit timeSignature
        -> preserve F's existing barlines
        -> rebind notation
        -> one EditorHistoryV4 commit
        -> exact Undo / Redo
```

The actual notation document stores only the explicit declaration on `F`. The affected-frame list is admission evidence describing where that declaration will be effective; P08-C2 does not duplicate a time-signature entry onto every later frame.

### Timing policy

P08-C2 does **not** silently retime or reflow musical events.

A requested meter is admitted only when:

- every affected frame has a corresponding measure on every content staff;
- every affected measure contains at least one canonical voice;
- existing events in each voice are non-overlapping;
- every event end is less than or equal to the requested nominal measure duration.

Underfilled measures and gaps are permitted by this first profile. Existing onset/duration values remain unchanged. A shorter meter that would place any existing event beyond the new measure boundary fails closed with `METER_TOO_SHORT`.

This separation is intentional: changing a meter declaration is not permission to invent rhythmic redistribution.

### Propagation boundary

The affected segment begins at the target frame and stops immediately before the next subsequent frame with its own explicit non-null time signature. Therefore a change on frame 1 can safely affect frames 1 and 2 while an explicit declaration on frame 3 remains an independent boundary.

### C2 safety

- target must be an exact current-revision `MeasureFrameAddressV3`;
- beats are bounded to `1..32`;
- `beatType` is one of `1,2,4,8,16,32,64`;
- requesting the same direct explicit meter is rejected as `NO_CHANGE`;
- incomplete content-staff frame coverage fails closed;
- pre-existing voice overlap fails closed as `EXISTING_TIMING_INVALID`;
- too-short requested meter fails closed as `METER_TOO_SHORT`;
- admission facts are re-derived before mutation and tampering fails closed;
- revision identity reuse fails closed;
- target frame barlines are preserved;
- canonical score content is not changed;
- renderer geometry/DOM/SVG is never authoring authority.

### Explicit meter removal

Removing an explicit time signature (`null`) is intentionally not part of C2 v1. Removal changes inheritance from a preceding meter and can expand a propagation segment in the opposite direction. That requires a separate admission profile that proves the preceding effective meter and audits the newly inherited segment before mutation.

## Next score-structure work

The next P08-C slice should inspect existing barline/repeat and topology authoring before adding anything new. New work should reuse existing frame/topology authority where possible rather than create a parallel structure engine.
