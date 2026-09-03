# ST Score Editor Core — Architecture

Status: **SEC-NE and SSE-00–09 are merged. SSE-10 cross-staff presentation is a DESIGN CANDIDATE / HUMAN REVIEW REQUIRED; runtime is not started.**

## Canonical authority

A session owns exactly one versioned canonical score+notation pair. V2 and V3 runtime contracts remain supported. MusicXML is exchange/projection data. Renderer, DOM/SVG, SesliTab host state and Guitar derivative state remain noncanonical.

## Current V3 topology

`ScoreDocumentV3` owns document-global `measureFrames`, explicit part/staff topology, stable instrument identity and source musical ownership. Standard/percussion staffs own measures/voices/events. Linked TAB remains derivative presentation only.

`SemanticAddressV3` already identifies source part, staff, frame, measure, voice, event and note exactly. SSE-10 therefore does not propose a new score address kind.

## SSE-10 design conclusion

A Sibelius-style cross-staff note remains owned by its original canonical source voice/staff. Only its **display staff** changes.

Proposed future pair:

```text
ScoreDocumentV3/3.0.0
        +
NotationDocumentV4/4.0.0
```

V4 notation would retain all V3 notation and add:

```text
crossStaffPlacements[]
  -> source: EventAddressV3
  -> displayStaffId
```

The initial profile is event-level, not split-note geometry. A pitched normal `note` or `chord` event may be displayed on a distinct standard staff in the same part. Source part/staff/frame/measure/voice, pitch, timing and identity do not change.

## Relation ownership

Existing beams, ties, slurs, tuplets and ornaments remain owned by source canonical event/note notation.

A beam may become visually cross-staff when events in one existing source voice have different display-staff assignments. SSE-10 does not admit a new beam relation between independent source voices/staffs.

Likewise, visual placement does not widen current tie/slur/tuplet/spanning-ornament authoring scopes. Renderer geometry is presentation only.

## Migration candidate

Notation V3 -> V4 is deterministic: preserve all V3 semantics and initialize `crossStaffPlacements=[]`.

V4 -> V3 is lossless-only and requires an empty placement collection. Flattening placement by moving canonical events to another staff is forbidden.

## Renderer / MusicXML boundary

Current MusicXML projection derives `<staff>` from canonical source-staff streams and cannot prove lossless source/display separation for a non-empty cross-staff placement set.

Therefore the candidate requires non-empty placements to remain pending/fail-closed until a separate V4 MusicXML projection contract exists. Import may not infer source ownership from nearest staff, first occurrence, beam appearance or reused voice ordinal.

## Topology boundary

A future V4-aware topology transaction must reject removal of a source or display staff when that would orphan a placement, unless placement removal is explicitly included in the admitted atomic transaction. Reorder remains ID-stable and must not retarget by proximity.

Current SSE-09 runtime is unchanged by this design PR.

## Product boundary

SSE-10 does not activate SesliTab V4 integration, persistence, network/server revisions, publication or production write authority. Playback pitch/timing is unchanged by cross-staff display.

## Human gate

The full design is `docs/cross-staff-relation-contract.md` and `.json`. It must be explicitly human-approved before the contract is frozen or any SSE-10 runtime implementation starts.
