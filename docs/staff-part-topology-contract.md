# SSE-08 Staff / Part Topology Contract

Status: **HUMAN-APPROVED DESIGN FREEZE / IMPLEMENTATION NOT STARTED**

Date: 2026-09-02

## Purpose

Freeze the next canonical schema required for safe part/staff topology authoring without weakening existing authority rules.

SSE-08 is design only. It does not add part/staff mutation code, cross-staff relations, production activation, persistence, host dual-write, renderer authority or Guitar reverse-write authority.

## Why a new major schema is required

`ScoreDocumentV2` inherits the v1 topology shape:

```text
ScoreDocument
  -> parts[]
    -> staves[]
      -> measures[]
        -> voices[]
```

Current limitations are structural, not cosmetic:

- part order is array position rather than explicit stable ordinal;
- staff identity exists, but staff role/authority semantics do not;
- instrument identity is not canonical;
- aligned measure correspondence across staves/parts is implicit;
- MusicXML serializers use the first staff as a reference measure sequence;
- `MeasureNotation` combines frame-like semantics and staff-local semantics;
- TAB clef exists, but a canonical TAB staff authority model does not;
- adding/removing/reordering parts or staves safely cannot be expressed without defining orphan and alignment rules.

Therefore SSE-09 must not mutate the current 2.0.0 topology directly. The approved topology target is a new major schema.

## Frozen target versions

- `ScoreDocumentV3/3.0.0`
- `NotationDocumentV3/3.0.0`
- `SemanticAddressV3/3.0.0`
- `RendererRequestV3/3.0.0`

V1 and V2 contracts remain unchanged and continue to validate independently.

## Canonical authority

Exactly one versioned score+notation pair is canonical in one editor session.

For a v3 session:

- `ScoreDocumentV3` owns musical structure, topology and musical event identity;
- `NotationDocumentV3` owns same-revision notation semantics;
- MusicXML remains exchange/projection data;
- renderer/DOM/SVG state remains presentation-only;
- SesliTab remains a host/orchestrator with no dual-write authority;
- Guitar string/fret/fingering choices remain derivative evidence;
- a linked tablature staff never becomes a second canonical pitch/event model.

## ScoreDocumentV3 topology

### Document shape

Conceptual frozen shape:

```text
ScoreDocumentV3
  schemaVersion: 3.0.0
  id
  revision
  source
  measureFrames[]
  parts[]
```

### PartV3

Each part has:

- stable `id`;
- explicit positive unique `ordinal`;
- `name`;
- one stable `instrument` identity;
- one or more staves.

Conceptual contract:

```text
PartV3 {
  id
  ordinal
  name
  instrument: InstrumentIdentityV3
  staves: StaffV3[]
}
```

Array order must equal ordinal order. Reordering a part changes only ordinals/order, not IDs or descendant ownership.

### InstrumentIdentityV3

Initial topology profile is deliberately narrow:

```text
InstrumentIdentityV3 {
  id
  name
  shortName
}
```

Rules:

- `id` is stable and globally unique inside the document;
- instrument identity belongs to exactly one part in the initial profile;
- rename does not change instrument ID;
- transposition, MIDI routing, playback patches and arbitrary external instrument metadata are not admitted by SSE-08;
- tablature tuning belongs to the linked TAB staff profile, not to note assignments.

### Staff roles

Frozen finite roles:

```text
StaffRoleV3 =
  | standard
  | percussion
  | tablature-linked
```

`standard` and `percussion` are content-bearing canonical musical staves.

`tablature-linked` is derivative presentation topology. It may not own an independent canonical event stream.

### Content-bearing staff

Conceptual shape:

```text
ContentStaffV3 {
  id
  ordinal
  role: standard | percussion
  measures: StaffMeasureV3[]
}
```

A content staff owns canonical measures/voices/events.

### Linked tablature staff

Conceptual shape:

```text
LinkedTablatureStaffV3 {
  id
  ordinal
  role: tablature-linked
  sourceStaffId
  tabProfile: {
    stringCount
    tuning[]
    capoFret
  }
  measures: []
}
```

Rules:

- `sourceStaffId` must resolve to a `standard` staff in the same part;
- source staff identity is stable and explicit; no nearest-staff inference;
- linked TAB staff owns no canonical notes/events/voices;
- rendered TAB note/fret hits resolve back to source canonical note/event identities;
- string/fret/fingering/voicing assignments remain derivative Guitar state;
- tuning/capo are instrument-presentation configuration only and do not grant reverse canonical note authority;
- removing the source staff requires removal/rebinding of its linked TAB staff in the same atomic topology transaction;
- a linked TAB staff cannot link to another linked TAB staff;
- cross-part TAB links are forbidden.

The bounded tuning profile uses conventional integer string numbers `1..stringCount`, one open-pitch per string, unique string numbers, and bounded capo fret. String numbering is explicit; pitch-order inference is forbidden.

## Global aligned measure frames

### Problem solved

Current serializers implicitly use one staff as the reference timeline. V3 makes alignment canonical and explicit.

### MeasureFrameV3

`ScoreDocumentV3.measureFrames` is the single canonical measure-sequence authority for the document.

Conceptual shape:

```text
MeasureFrameV3 {
  id
  ordinal
  displayNumber
}
```

Rules:

- frame IDs are stable;
- frame ordinals are positive, unique and contiguous in the initial profile;
- array order equals frame ordinal order;
- display number belongs to the frame, not independently to each staff measure;
- part/staff reorder never changes frame IDs;
- frame creation/deletion is outside SSE-09 initial part/staff topology scope unless separately admitted.

### StaffMeasureV3

Content-bearing staffs contain one measure per frame:

```text
StaffMeasureV3 {
  id
  frameId
  voices[]
}
```

Rules:

- each content staff has exactly one measure for every current frame;
- every staff measure references exactly one current frame;
- no content staff may contain two measures for the same frame;
- no staff measure may exist outside a frame;
- linked TAB staves contain no independent measures; their visual frame alignment derives from `sourceStaffId`;
- non-controlling/multimetric topology is not admitted by the initial v3 topology profile and must fail closed until separately designed.

This removes the first-staff reference assumption from canonical topology.

## NotationDocumentV3 ownership split

V2 `MeasureNotation` mixes semantics with different ownership. V3 separates them.

### Frame notation

`MeasureFrameNotationV3` owns notation that applies to the aligned controlling frame:

- time signature;
- left/right barline and repeat structure admitted by the bounded profile.

### Staff-measure notation

`StaffMeasureNotationV3` owns staff-local notation:

- key signature;
- clef.

Existing event/note/grace notation semantics continue unchanged in meaning.

Conceptual document:

```text
NotationDocumentV3 {
  contractVersion: 3.0.0
  documentId
  revisionId
  frames[]
  measures[]
  events[]
  notes[]
  graceEvents[]
  graceNotes[]
}
```

All notation remains sparse and revision-bound.

## SemanticAddressV3

V3 keeps explicit ancestry and adds measure-frame identity.

New/changed concepts:

- new `measure-frame` address kind;
- staff-measure and descendants include `frameId` in the exact path;
- part/staff addresses continue to use stable IDs, never ordinals as identity;
- renderer tokens remain opaque projections of exact revision-bound semantic addresses.

A staff/part reorder must preserve IDs, so a selection can be deterministically rebound to the same entity under the new revision. Stale revision addresses still fail closed.

## Migration policy

### V2 -> V3

Migration is deterministic and lossless only for the admitted aligned topology profile.

It must:

1. preserve document, source, revision, part, staff, measure, voice, event, note and grace IDs;
2. assign explicit part ordinals from current canonical array order;
3. create deterministic fresh instrument IDs without colliding with existing entity IDs;
4. derive measure frames by aligned measure ordinal across all content-bearing staves;
5. require matching measure count, ordinal and display number across aligned content staves;
6. reject rather than repair missing/misaligned staff measures;
7. split v2 measure notation into frame-owned and staff-owned notation only when ownership is unambiguous;
8. reject conflicting aligned time/barline semantics;
9. preserve key/clef as staff-local notation;
10. preserve all normal/grace event identity and notation.

Migration must not silently create a TAB staff from a TAB clef. A v2 staff with TAB clef remains a normal migrated content staff unless an explicit later topology operation converts/adds linked TAB presentation under the frozen rules.

### V3 -> V2

Downgrade is allowed only when lossless:

- no linked TAB staff;
- topology can be represented as existing nested part/staff measures;
- frame notation can be duplicated into v2 per-staff measure notation without conflict;
- no v3-only topology metadata would be discarded.

Otherwise downgrade rejects with an exact semantic-loss path.

## SSE-09 initial topology authoring scope

After this contract is implemented, the first bounded topology operations may include:

- add standard/percussion part;
- remove part;
- reorder part;
- add standard/percussion staff to an existing part;
- remove content staff;
- reorder staff;
- add/remove a linked TAB presentation staff;
- rename part/instrument display names.

Every operation must be one atomic score+notation history transaction and produce one direct-child score revision.

### Add content staff safety

The initial authoring implementation must not invent rhythmic content.

A content staff may be added only when every frame has enough effective meter evidence to create deterministic explicit full-frame rest content under the admitted timing model. If that proof is unavailable, the operation fails closed rather than creating ambiguous empty musical measures.

### Removal safety

Removal rejects if it would orphan:

- notation targets;
- semantic selection that cannot be deterministically rebound or cleared under the operation policy;
- grace anchors/relations outside the removed subtree;
- renderer/source-map/evidence contracts that require a current target and are not invalidated atomically;
- linked TAB source references;
- future cross-staff relations once such relations exist.

No implicit nearest-part/staff retargeting is allowed.

## MusicXML policy

V3 MusicXML import/export is a separate future implementation step.

Frozen rules:

- MusicXML part/staff numbering is projection data, never canonical identity;
- canonical part/staff/frame IDs must survive internal editing independent of MusicXML numbering;
- imported staff alignment must explicitly prove frame correspondence;
- unsupported multimetric/non-controlling topology rejects in the initial v3 profile;
- linked TAB staff cannot be silently emitted without the derivative TAB projection required to represent it;
- if full TAB semantics cannot be represented from canonical + admitted derivative evidence, export/render must fail closed rather than duplicate or invent note authority.

## Renderer / SesliTab policy

Renderer and SesliTab remain noncanonical.

- renderer manifests use v3 semantic addresses;
- part/staff reorder may change presentation order but never entity identity;
- linked TAB glyph hits map to source canonical event/note tokens;
- DOM/SVG coordinates never become topology mutation targets;
- product host cannot maintain a parallel part/staff tree and dual-write it back into Editor Core;
- playback admission remains independent from editor/topology admission.

## Guitar boundary

The existing Guitar Workspace remains derivative.

SSE-08 does not authorize:

- canonical string/fret assignment;
- canonical fingering/voicing state;
- direct external engine invocation;
- reverse write from Guitar results into canonical score state.

A linked TAB staff only defines where derivative TAB presentation belongs and which canonical standard staff it derives from.

## Explicitly out of scope

- cross-staff beaming, stem ownership or note relocation;
- cross-staff ties/slurs/tuplets/ornaments;
- polymeter/non-controlling measure topology;
- part groups/brackets/braces;
- arbitrary instrument transposition model;
- percussion-map authoring;
- layout/page/system geometry;
- playback/MIDI routing;
- `.mxl` support;
- persistence/network/public-write activation.

These require separate contracts.

## Implementation gate after SSE-08

SSE-08 completion means the topology contract is frozen and documented. It does **not** mean v3 topology is implemented.

SSE-09 implementation may begin only against this frozen contract and must prove:

- validators and deterministic v2<->v3 migration guards;
- exact v3 addressing;
- atomic history;
- orphan-safe part/staff operations;
- frame alignment invariants;
- linked TAB derivative authority;
- renderer/MusicXML fail-closed behavior;
- full Node 18/20/22 CI.

Any change that grants TAB canonical pitch authority, admits cross-staff ownership, weakens source immutability, creates host/renderer canonical authority or activates production remains a separate human gate.