# Safety and Trust Boundaries

## Mandatory controls

The active versioned score remains canonical; notation is same-document/same-revision; source identity is immutable; stale targets fail closed; unsupported or ambiguous semantics are never guessed; renderer/host coordinates never become mutation authority; accepted mutations create one direct-child revision or none; production/public-write is never activated by merge.

## V2 safety remains active

Grace, articulation and ornament semantics remain explicitly versioned in V2. Bounded MusicXML, renderer projection, opaque tokens, SesliTab no-dual-write and playback/edit-admission separation remain unchanged.

## SSE-09 V3 topology safety

V3 topology authoring is admitted only through the frozen SSE-08 model.

- `measureFrames` are explicit aligned-measure authority; first-staff inference is not canonical.
- V2 -> V3 migration rejects measure misalignment and frame-level notation conflicts rather than repairing them.
- Part/staff IDs remain stable while ordinals are normalized after reorder.
- New topology identities are caller-supplied and globally validated for collisions.
- New standard/percussion staff content is not copied from neighboring staffs. Effective frame meter must be known; only then is one explicit full-frame rest initialized for each frame.
- Missing meter is a veto.
- Removing the final part or final content-bearing staff is forbidden.
- Any removal that would orphan event/note/grace/staff-measure notation rejects.
- Linked TAB owns no canonical measures/events/notes and can reference only a standard staff in the same part.
- A linked TAB source staff cannot be removed by implicit cascade; the link must be explicitly removed first.
- String/fret/fingering/voicing remains derivative Guitar state.
- V3 history stores one atomic score+notation snapshot and accepts only direct-child commits.
- V3 session migration is one-way at session creation; parallel mutable V2/V3 authority is forbidden.

## Renderer / MusicXML safety

V3 renderer projection is lossless-only. When a V3 pair can safely use the proven V2 projection it may emit `V2_COMPATIBLE_XML`. If topology metadata would be lost or the bounded MusicXML serializer cannot represent the pair, the renderer request remains `V3_XML_PENDING` with no XML.

A projection gap does not roll back or alter a valid canonical topology edit. It only blocks lossy renderer output. SSE-09 does not claim V3-native topology MusicXML round trip.

## Product boundary

SSE-09 adds no SesliTab V3 product cutover, network/persistence/server revision authority, publication or production write authority. Existing product hosts remain noncanonical.

## Human gates

Human approval remains required before cross-staff canonical ownership, polymeter/non-controlling topology, part groups, arbitrary transposition/percussion maps, V3-native topology exchange if it expands semantics materially, material dependency/license risk, AI/renderer/host canonical authority, E8-D invocation, or production/public-write activation.

## Next gate

SSE-10 is the explicit cross-staff design gate. No cross-staff note relocation, beam, tie, slur, tuplet or ornament ownership is admitted by SSE-09.
