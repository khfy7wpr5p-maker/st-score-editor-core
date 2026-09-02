# ST Score Editor Core — Architecture

Status: **SEC-NE and SSE-00–07 are merged. SSE-08 freezes the next staff/part topology contract as design only; runtime implementation is not started.**

## Current canonical authority

Each active v2 editor session owns exactly one `ScoreDocumentV2 + NotationDocumentV2` pair. MusicXML remains exchange/projection data. Renderer, DOM/SVG state and SesliTab host state remain noncanonical.

SSE-08 does not change that runtime authority. It defines the approved target for a future v3 cutover.

## Existing SSE-07 renderer projection

```text
canonical v2 score + notation
        |
try lossless v2 -> v1 downgrade
   | success                  | unrepresentable
V1_COMPATIBLE_XML             v
                       serializeNotationMusicXmlV2
                          | success          | unsupported
                     V2_SEMANTIC_XML      VNEXT_XML_PENDING
                          |
               exact renderer profile
                          |
                 OSMD / alphaTab adapter
```

Opaque renderer tokens remain revision-bound semantic identities. SesliTab v2 remains a facade over one canonical v2 session with no host dual-write.

## SSE-08 topology problem

The current v1/v2 nested shape stores measures under each staff and does not define an explicit aligned measure entity. Serializers therefore use one staff as a reference sequence and locate other staff measures by ordinal. Part order is also implicit array order, and no canonical staff-role/instrument/TAB ownership contract exists.

Those limitations make safe part/staff authoring a schema problem rather than a local command problem.

## Frozen v3 topology direction

The approved design target is:

- `ScoreDocumentV3/3.0.0`;
- `NotationDocumentV3/3.0.0`;
- `SemanticAddressV3/3.0.0`;
- `RendererRequestV3/3.0.0`.

Conceptually:

```text
ScoreDocumentV3
  -> measureFrames[]          # global aligned measure sequence
  -> parts[]
       -> explicit ordinal
       -> stable instrument identity
       -> staves[]
            -> standard/percussion content staff
                 -> StaffMeasureV3(frameId)[]
            -> tablature-linked presentation staff
                 -> sourceStaffId
                 -> no independent canonical event stream
```

`measureFrames` become the sole aligned measure-sequence authority. Content-bearing staffs contain exactly one staff measure per current frame. Linked TAB presentation derives alignment and note identity from its source standard staff.

## Notation ownership in v3

V3 separates notation ownership that is mixed in current `MeasureNotation`:

- measure-frame notation owns controlling time signature and bounded barline/repeat structure;
- staff-measure notation owns key signature and clef;
- event/note/grace notation retains its current semantic meaning.

All notation remains sparse, same-document and same-revision.

## TAB authority

`tablature-linked` is presentation topology, not a second musical model.

- it must reference a standard staff in the same part;
- it cannot own independent voices/events/notes;
- rendered TAB note/fret hits resolve back to source canonical note/event identities;
- tuning/capo may configure the presentation profile;
- string/fret/fingering/voicing assignments remain derivative Guitar state;
- deleting a source staff requires atomic handling of linked TAB topology.

This preserves the existing standard-notation canonical boundary.

## V3 migration gate

V2 -> V3 migration is lossless only when current staff measures can be proven aligned. It must preserve existing entity IDs, create deterministic fresh frame/instrument identities, and reject missing/misaligned measures or conflicting frame-owned notation rather than repair them.

V3 -> V2 downgrade is lossless-only and rejects any v3 topology that cannot be represented without semantic loss, including linked TAB staff.

## SSE-09 implementation boundary

SSE-09 may implement bounded add/remove/reorder part/staff operations only against the frozen v3 contract. Initial content-staff creation must not invent rhythmic content: it requires enough effective meter evidence to create deterministic explicit full-frame rests or must fail closed.

Cross-staff relation ownership, polymeter/non-controlling topology, part groups, arbitrary instrument transposition, layout geometry, playback routing, persistence/network and production activation remain outside this design.

Full contract: `docs/staff-part-topology-contract.md`.