# SCORE-SCHEMA-EXPANSION Program

Status: **SSE-07 COMPLETE / MERGE CANDIDATE**

The vNext contract frozen by SSE-00 is implemented through renderer and SesliTab v2 compatibility. Staff/part topology remains a separate human-gated design at SSE-08.

## Mission

Extend ST Score Editor Core beyond `ScoreDocument` / `NotationDocument` 1.0.0 without weakening canonical authority, revision binding, source immutability, unified history, MusicXML safety, renderer isolation, Guitar derivative authority or SesliTab no-dual-write rules.

Expansion sequence:

1. grace notes;
2. articulations;
3. ornaments;
4. MusicXML v2 round trip;
5. renderer/SesliTab v2 identity compatibility;
6. later staff/part topology and cross-staff relations behind separate gates.

## Non-negotiable invariants

- one versioned `ScoreDocument` is canonical musical authority in a session;
- notation is same-document, same-revision and same-version;
- no parallel mutable v1/v2 canonical pair;
- renderer, DOM/SVG and SesliTab host state remain noncanonical;
- MusicXML is exchange/projection data, not live mutable editor state;
- source identity remains immutable/auditable;
- stale addresses/sidecars fail closed;
- score + notation mutation remains one atomic history commit;
- v2 -> v1 downgrade rejects semantic loss;
- unsupported MusicXML semantics reject rather than disappear;
- no new runtime dependency is required by SSE-00–07;
- production/public-write activation remains a separate gate.

## Frozen vNext model

### ScoreDocumentV2 2.0.0

Normal `Voice.events` retain timed semantics. `VoiceV2.graceGroups` contains canonical non-occupancy grace material anchored to exact normal events. Grace events have stable IDs, written duration and normalized playback metadata without normal timeline onset/duration.

### NotationDocumentV2 2.0.0

Event notation adds finite typed `articulations[]` and `ornaments[]`; grace event/note notation uses dedicated semantic targets. Default notation is represented sparsely.

### SemanticAddressV2 2.0.0

The v2 address space contains normal ancestry plus `grace-group`, `grace-event` and `grace-note`. All editor/renderer selection authority stays revision-bound.

## Stage status

- **SSE-00 — COMPLETE / MERGED:** vNext contract freeze and approval.
- **SSE-01 — COMPLETE / MERGED:** v2 score/address/notation substrate and guarded migrations.
- **SSE-02 — COMPLETE / MERGED:** one canonical v2 session/history/render/selection state.
- **SSE-03 — COMPLETE / MERGED:** canonical grace authoring.
- **SSE-04 — COMPLETE / MERGED:** typed articulation authoring for normal/grace events.
- **SSE-05 — COMPLETE / MERGED:** local ornaments and atomic bounded tremolo/wavy-line relations.
- **SSE-06 — COMPLETE / MERGED:** isolated bounded MusicXML v2 import/export round trip.
- **SSE-07 — COMPLETE / MERGE CANDIDATE:** renderer projection and additive SesliTab v2 compatibility.
- **SSE-08 — HUMAN-GATED DESIGN:** staff/part topology contract.
- **SSE-09 — NOT STARTED:** topology authoring after SSE-08 approval.
- **SSE-10 — NOT STARTED:** cross-staff canonical relation model.

## SSE-06 MusicXML architecture

SSE-06 keeps every legacy v1 MusicXML parser/importer unchanged. `packages/musicxml-v2` owns a separate bounded safe parser plus `serializeNotationMusicXmlV2` and `importNotationMusicXmlV2`.

The importer validates original v2 input, derives a noncanonical v1-compatible timed projection, reuses the existing proven v1 notation importer, migrates once to v2 and then rebinds grace/articulation/ornament semantics from the original parsed tree. The internal projection never becomes canonical and the final score retains the original MusicXML source identity.

Unsupported XML, broken relations, source mismatches and ambiguous grace placement/playback combinations fail closed.

## SSE-07 renderer / SesliTab compatibility

`renderer-contract-v2` now uses three explicit projection outcomes:

- `V1_COMPATIBLE_XML` when the v2 pair can be downgraded losslessly to the proven v1 serializer;
- `V2_SEMANTIC_XML` when v2-only semantics are present and the bounded SSE-06 serializer can represent them;
- `VNEXT_XML_PENDING` with `musicXml = null` when the bounded v2 serializer cannot represent the canonical pair.

Opaque render tokens remain revision-bound semantic addresses, including grace-group/event/note identities. Additive `renderWithOsmdV2` and `renderWithAlphaTabV2` consume renderable v2 requests without changing legacy adapter APIs. Pending requests fail before renderer load.

`seslitab-editor-host-v2` wraps exactly one canonical `EditorSessionStateV2`. Pointer, keyboard and touch use the same semantic token/edit paths; host dual-write, renderer mutation authority and DOM-coordinate mutation authority remain forbidden. Playback remains host-owned and editor admission does not control playback.

## Migration policy

### v1 -> v2

Lossless and deterministic for the admitted v1 semantic set. Normal timed events and identity ancestry are preserved; v2-only arrays begin empty.

### v2 -> v1

Allowed only when v2-only content is empty. Any grace group, articulation, ornament or grace notation rejects with `DOWNGRADE_UNREPRESENTABLE`. Silent discard is forbidden.

## Compatibility strategy

1. keep v1 validation/import stable — complete;
2. prove deterministic dual-version migration — complete;
3. cut one session to one v2 pair — complete;
4. add grace/articulation/ornament authoring — complete;
5. prove bounded v2 MusicXML round trip without widening v1 — complete;
6. wire renderer/SesliTab to the proven v2 projection while retaining opaque semantic identity — complete on this merge candidate.

## Definition of done

The schema-expansion program through SSE-07 is complete on this merge candidate without authority drift. Staff/part topology and cross-staff remain separate later gates and require explicit approval before canonical topology implementation.