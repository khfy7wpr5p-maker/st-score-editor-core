# P08-C — Score Structure Authoring

P08-C extends the professional workstation from event-level editing into explicit score-structure notation while preserving ScoreDocumentV3 + NotationDocumentV4 authority boundaries.

## Ownership

The V3/V4 notation contract separates score-structure ownership:

```text
MeasureFrame notation -> time signature, barlines
StaffMeasure notation -> key signature, clef
Score topology -> parts, staves, measure frames and their canonical content
```

P08-C follows that ownership exactly. Renderer geometry/DOM/SVG never owns score structure.

## P08-C1: staff-local key signature and clef

P08-C1 supports:

- `SET_KEY_SIGNATURE` on one current-revision content staff measure;
- `SET_CLEF` on one current-revision content staff measure;
- removal of an explicit key signature or clef by setting the value to `null`;
- exact preservation of the other staff-measure notation field;
- one notation edit = one direct-child score revision + one `EditorHistoryV4` commit;
- exact Undo/Redo of the whole score + notation snapshot.

A key/clef change is notation-only musical structure. Score content is not modified. Surviving notation addresses are rebound to the direct-child revision before validation.

Safety includes stale/non-content targets, key bounds `-7..+7`, admitted clef sign/line/octave ranges, no-op rejection, and revision-identity protection.

## P08-C2: frame-global time-signature authoring

Time signature is owned by `MeasureFrame`. An explicit meter declaration remains effective through subsequent frames until another explicit meter declaration replaces it. C2 therefore treats a meter edit as propagation-aware structure authoring.

```text
current MeasureFrameAddressV3
        -> validate beats / beatType
        -> compute propagation segment
             target ... frame before next explicit meter
        -> audit every content staff and voice in every affected frame
        -> reject existing overlap
        -> reject event ends beyond requested nominal measure duration
        -> immutable admission
        -> direct-child score revision, score content unchanged
        -> update only target frame's explicit timeSignature
        -> preserve target frame barlines
        -> rebind notation
        -> one EditorHistoryV4 commit
        -> exact Undo / Redo
```

C2 does not silently retime or reflow events. Underfilled measures/gaps are permitted, but a shorter meter that would place existing content beyond the new boundary fails closed. Explicit meter removal remains deferred because removal changes inherited-meter scope and requires a separate preceding-meter admission profile.

## P08-C3: frame-owned barline and repeat authoring

P08-C3 fills the remaining `MeasureFrame` notation editing gap for barlines and repeat marks.

Supported operation:

```text
current MeasureFrameAddressV3
        -> validate bounded barline array
        -> at most one LEFT + one RIGHT entry
        -> validate style and repeat direction enum
        -> canonicalize LEFT before RIGHT
        -> reject no-op
        -> direct-child score revision, score content unchanged
        -> replace only target frame barlines
        -> preserve target frame timeSignature exactly
        -> rebind notation
        -> one EditorHistoryV4 commit
        -> exact Undo / Redo
```

Admitted barline styles are the notation-contract values:

`regular | light-light | light-heavy | heavy-light | heavy-heavy | dashed | dotted | none`

Repeat values remain `forward | backward | null`. An empty array explicitly clears the target frame's barlines/repeat marks.

C3 deliberately does not invent an additional cross-frame repeat-pair authority. Repeat marks are stored using the existing frame notation contract and exported through the existing MusicXML notation path. Higher-level playback/navigation semantics can interpret those marks separately without mutating canonical notation ownership.

### C3 safety

- target must be an exact current-revision `MeasureFrameAddressV3`;
- maximum two entries, with unique `left` / `right` locations;
- invalid styles/repeat values fail closed;
- input order is normalized to left then right for deterministic state;
- requesting the current explicit barline state is `NO_CHANGE`;
- target frame time signature is preserved;
- all surviving notation addresses are rebound to the new revision;
- score musical content is unchanged;
- one accepted action produces one history revision.

## Existing topology authority reused

P08-C inspection confirmed that part/staff topology is already implemented rather than missing:

- add/remove/reorder part;
- add/remove/reorder content staff;
- add/remove linked TAB staff;
- rename part/instrument;
- synthetic measure-frame append in V4;
- orphan and meter-evidence protections.

Those operations already flow through the V4 topology/session history path. P08-C must reuse that authority instead of creating a parallel part/staff engine.

## Next score-structure work

After C3, the next highest-leverage step is to expose/audit the existing topology capabilities through the professional workstation interaction layer, then address any specific missing measure/topology operation only after proving it is not already covered by `editor-topology-authoring-v3/v4`.
