# P10-4A Score Structure & Instrument Management — Architecture Design

Status: **DESIGN FOR REVIEW — NO PRODUCTION MUTATION AUTHORIZED**

Baseline: `main@40e84d1fb9af4ad370adf99cb0f2e91df33d6e60`

Linear: `SES-31`

## 1. Purpose

P10-4A defines the professional score-structure architecture needed to expose existing part/staff topology safely and to identify which requested instrument/structure features require new versioned model contracts.

This design does **not** create a second topology engine. Repository inspection confirms that bounded part/staff topology mutation already exists in `editor-topology-authoring-v3/v4`, already commits through `EditorSessionV4 / EditorHistoryV4`, and is already reachable from the professional workstation through the generic topology delegation seam.

The first implementation tranche is therefore deliberately small:

> **Professional Staff Reorder V1** — a typed professional operation that exposes the existing `REORDER_STAFF` canonical authority without exposing the generic topology-intent surface.

## 2. Canonical invariants

The following rules are unchanged and apply to every P10-4 tranche:

- `ScoreDocumentV3 + NotationDocumentV4` remain the canonical score pair.
- `EditorSessionV4 / EditorHistoryV4` remain the sole history authority.
- `SemanticAddressV3` remains exact current-revision semantic identity.
- Renderer DOM, SVG, geometry, coordinates, viewport state and render tokens are not authoring authority.
- MusicXML is exchange/projection data, not the canonical editing model.
- One accepted semantic structure action creates exactly one unified history revision.
- A rejected or no-op action creates no history revision and performs no canonical write.
- Unsupported topology transformations fail closed.
- A host may not maintain a parallel part/staff topology tree or dual-write canonical state.
- Release, SesliTab cutover, public-write, deploy and Render authority are outside P10-4A.

## 3. Repository reality inventory

### 3.1 Canonical topology substrate

`packages/score-model-v3/src/index.ts`

Current canonical topology is:

- document-global `MeasureFrameV3[]`;
- ordered `PartV3[]`;
- ordered `StaffV3[]` inside each part;
- one aligned `StaffMeasureV3` per content-bearing staff per frame;
- stable `InstrumentIdentityV3 { id, name, shortName }`;
- staff roles `standard | percussion | tablature-linked`.

Important constraints:

- part and staff ordinals are contiguous projections of canonical order;
- IDs are stable identity and are distinct from ordinal;
- linked TAB owns no canonical measures;
- every content-bearing staff aligns to the global measure-frame sequence;
- the model contains no transposition, staff-group, brace/bracket, percussion-map, polymeter or non-controlling-measure semantics.

### 3.2 Semantic identity

`packages/addressing-v3/src/index.ts`

`SemanticAddressV3` resolves document, frame, part, staff, measure, voice, event, note and grace identities through stable entity IDs plus exact ancestry.

A semantic address is bound to:

- contract version;
- document ID;
- revision ID;
- exact ancestry IDs appropriate to its kind.

Consequences for structure mutation:

- any pre-edit address becomes stale after the accepted direct-child revision;
- stable entity IDs allow surviving entities to be rebound into the new revision;
- reorder does not require identity replacement;
- ordinals and renderer position never substitute for identity;
- stale revision resolution fails closed.

### 3.3 Existing V3 topology mutation authority

`packages/editor-topology-authoring-v3/src/index.ts`

Existing typed canonical operations include:

- `ADD_STANDARD_OR_PERCUSSION_PART`;
- `REMOVE_PART`;
- `REORDER_PART`;
- `ADD_STANDARD_OR_PERCUSSION_STAFF`;
- `REMOVE_CONTENT_STAFF`;
- `REORDER_STAFF`;
- `ADD_LINKED_TAB_STAFF`;
- `REMOVE_LINKED_TAB_STAFF`;
- `RENAME_PART_OR_INSTRUMENT`.

The authority already provides:

- exact current-revision semantic targets;
- caller-supplied identity plans for newly created topology;
- stable-ID-preserving reorder;
- contiguous ordinal normalization;
- effective-meter proof for newly created content staff;
- final-part and final-content-staff protection;
- linked-TAB source protection;
- notation-orphan rejection;
- direct-child revision creation;
- notation rebinding to the new revision.

The operation named `RENAME_PART_OR_INSTRUMENT` changes part name plus instrument display names while preserving the existing instrument ID. It is **not** true instrument reassignment.

### 3.4 V4 topology wrapper

`packages/editor-topology-authoring-v4/src/index.ts`

V4 reuses the V3 topology engine while preserving `NotationDocumentV4` semantics.

It additionally:

- preserves cross-staff placements by source semantic identity;
- rejects topology mutations that would orphan cross-staff display references;
- supports bounded `APPEND_SYNTHETIC_MEASURE_FRAME`;
- admits automatic frame growth only for synthetic scores;
- requires exact fresh identities for the appended frame and each content staff's new measure/Voice/rest;
- fails closed when effective meter evidence is missing.

No general insert/remove/reorder measure-frame authority exists.

### 3.5 Unified session/history authority

`packages/editor-session-controller-v4/src/index.ts`

`commitSessionTopologyIntentV4`:

1. validates revision identity;
2. executes the V4 topology authority;
3. commits score + notation through `commitEditorHistoryV4`;
4. reselects the result entity through `addressEntityV3` in the new revision;
5. rebuilds the renderer request through the normal session state path.

This establishes the required P10-4 history invariant: one accepted topology action equals one canonical V4 history commit.

### 3.6 App and professional workstation delegation

`packages/score-editor-app-document/src/index.ts`

`commitAppTopologyIntent` delegates to the V4 session authority.

`packages/score-editor-professional-workstation-v1/src/index.ts`

`commitProfessionalWorkstationTopologyV1` delegates to `commitAppTopologyIntent` and clears the noncanonical professional selection.

Therefore the professional workstation already has a generic delegation seam, but it currently lacks narrow typed P10-4 commands for individual professional structure operations.

P10-4 must narrow this seam for product-facing actions rather than expose arbitrary generic topology intents from UI.

### 3.7 Existing score-structure notation authority

`docs/p08c-score-structure-authoring.md` and the corresponding professional packages already separate:

- frame notation: time signature and barlines/repeats;
- staff-measure notation: key signature and clef;
- score topology: parts, staves, aligned frames and their canonical content.

P10-4 must preserve this ownership split.

### 3.8 Renderer projection

`packages/renderer-contract-v4/src/index.ts`

Renderer requests:

- build a manifest from current-revision `SemanticAddressV3` identities;
- project to MusicXML only through admitted lossless downgrade paths;
- return `V4_XML_PENDING` / `CROSS_STAFF_XML_PENDING` rather than silently flatten unsupported state;
- resolve render tokens back to semantic addresses.

A renderer token may change after reorder. Canonical entity identity may not.

### 3.9 MusicXML / interchange reality

The V3/V4 renderer pipeline currently relies on lossless V3→V2 projection before the existing bounded MusicXML path.

The downgrade rejects state that V2 cannot represent losslessly, including:

- linked TAB topology;
- non-standard V3 staff roles;
- custom frame identity that would be discarded;
- instrument metadata that does not match the deterministic V2-derived profile.

Therefore:

- V3-native arbitrary topology MusicXML is not an existing authority;
- topology mutation must never claim round-trip support that the current downgrade cannot prove;
- XML-pending state is a valid fail-closed result;
- imported MusicXML topology does not authorize unsupported mutation;
- automatic measure append on imported MusicXML remains explicitly rejected.

## 4. Authority matrix

| Capability | Canonical write authority | History owner | XML / renderer effect | Current boundary |
|---|---|---|---|---|
| Add part | topology-authoring-v3 via V4 | EditorHistoryV4 | lossless only when downgrade can prove it | meter + identity plan required |
| Remove part | topology-authoring-v3 via V4 | EditorHistoryV4 | reproject surviving topology | final part + orphan checks |
| Reorder part | topology-authoring-v3 via V4 | EditorHistoryV4 | order projection changes, IDs survive | same entity, new ordinal |
| Add content staff | topology-authoring-v3 via V4 | EditorHistoryV4 | may remain XML-compatible if lossless | effective meter + fresh IDs |
| Remove content staff | topology-authoring-v3 via V4 | EditorHistoryV4 | reproject surviving topology | final staff, TAB link, notation/cross-staff orphan checks |
| Reorder staff | topology-authoring-v3 via V4 | EditorHistoryV4 | staff order changes; semantic IDs survive | same part only |
| Linked TAB add/remove | topology-authoring-v3 via V4 | EditorHistoryV4 | XML projection becomes pending | derivative only; no canonical measures |
| Rename part/instrument names | topology-authoring-v3 via V4 | EditorHistoryV4 | may make V2 downgrade unrepresentable | instrument ID unchanged |
| Append measure frame | topology-authoring-v4 | EditorHistoryV4 | synthetic bounded round-trip only | append-only; synthetic source only |
| Key/clef | professional structure notation authority | EditorHistoryV4 | existing notation projection | staff-measure ownership |
| Meter/barlines | professional frame notation authority | EditorHistoryV4 | existing notation projection | frame ownership |
| True instrument assignment | none | none | undefined | new versioned contract required |
| Instrument transposition | none | none | undefined | model has no transposition semantics |
| Staff groups/braces/brackets | none | none | undefined | separate contract required |
| Percussion map | none | none | undefined | model has no percussion-map semantics |
| Polymeter/non-controlling measure | none | none | undefined | conflicts with global aligned-frame model |

## 5. P10-4 gap matrix

### 5.1 Add/remove/reorder staff

Classification: **EXISTING_AUTHORITY_REUSABLE**

Reason:

- the canonical engine already exists;
- V4 already protects cross-staff relations;
- history is already unified;
- IDs already survive reorder;
- missing work is typed professional exposure and UI admission, not model invention.

### 5.2 Add/remove/reorder part

Classification: **EXISTING_AUTHORITY_REUSABLE**

Reason:

- the canonical operations already exist;
- reorder semantics are deterministic;
- add/remove have explicit identity/orphan rules;
- missing work is product-facing typed professional exposure.

These operations should be split into separate implementation tranches rather than exposed as one generic topology command.

### 5.3 Instrument assignment

Classification: **NEW_VERSIONED_AUTHORITY_REQUIRED**

Current `InstrumentIdentityV3` only models stable ID and display names.

`RENAME_PART_OR_INSTRUMENT` does not replace the instrument identity and does not define:

- instrument catalog identity;
- family;
- written/concert pitch relationship;
- playback patch;
- clef defaults;
- staff-count defaults;
- MusicXML score-instrument mapping.

P10-4A does not choose a replacement schema. True assignment must receive its own architecture contract before implementation.

### 5.4 Transposing instruments

Classification: **BLOCKED_BY_MODEL_CONTRACT**

The current canonical model contains no transposition field and no written-pitch/concert-pitch authority.

A transposing-instrument design must first define:

- what canonical pitch means;
- written vs sounding pitch;
- import/export mapping;
- key-signature behavior;
- transpose display modes;
- playback/audition consequences;
- whether instrument reassignment rewrites canonical pitch or only changes projection.

No such behavior may be inferred from part names.

### 5.5 Staff groups

Classification: **DEFERRED_SEPARATE_CONTRACT**

The model has no canonical group entity, group ID, membership, nesting or ordering semantics.

### 5.6 Braces / brackets

Classification: **DEFERRED_SEPARATE_CONTRACT**

These may overlap engraving and semantic staff grouping. They must not be stored as renderer geometry. A separate contract must decide whether they are canonical group semantics, layout metadata, or both.

### 5.7 Percussion maps

Classification: **BLOCKED_BY_MODEL_CONTRACT**

A `percussion` staff role exists, but there is no canonical pitch-to-instrument map, notehead mapping, playback mapping or MusicXML percussion-instrument identity model.

### 5.8 Stronger measure topology

Classification: **EXISTING_AUTHORITY_NEEDS_BOUNDED_EXTENSION**

Existing authority supports append-only aligned synthetic measure growth.

Not yet admitted:

- insert frame;
- remove frame;
- reorder frame;
- imported-score automatic growth;
- arbitrary Voice invention/reflow;
- cross-frame content redistribution.

Each must receive a separate profile with timing/orphan/identity rules.

### 5.9 Polymeter / non-controlling measures

Classification: **BLOCKED_BY_MODEL_CONTRACT**

`ScoreDocumentV3.measureFrames[]` is a global aligned sequence and each content staff must own exactly one measure per frame.

Polymeter/non-controlling measures require a different alignment contract and cannot be added as a small mutation to the current model.

## 6. Architecture decision

### 6.1 Selected approach: operation-specific professional adapters

P10-4 will expose one bounded operation at a time through typed professional adapters that delegate to existing canonical V4 topology authority.

For each admitted operation:

```text
professional UI / command
        |
        v
typed P10-4 adapter
        |
        v
current-revision SemanticAddressV3 + bounded parameters
        |
        v
existing editor-topology-authoring-v4
        |
        v
EditorSessionV4 / EditorHistoryV4
        |
        v
renderer request rebuilt from new canonical revision
```

The adapter may add stricter product-level admission such as no-op rejection, but it must not duplicate the topology mutation algorithm.

### 6.2 Rejected approach: expose generic topology intent directly

The generic `commitProfessionalWorkstationTopologyV1` seam is useful internally but too broad as a product API.

Direct UI exposure would:

- make unrelated topology operations reachable from one untyped surface;
- make it harder to audit per-operation safety;
- encourage capability growth without explicit design gates;
- blur product admission with low-level canonical mutation.

It remains an internal delegation seam, not the P10-4 user-facing contract.

### 6.3 Rejected approach: expand the score model before reusing current authority

Changing `ScoreDocumentV3` now for instrument/transposition/grouping would mix several independent contracts and increase migration/interchange risk.

P10-4 first reuses proven topology. New model versions are introduced only when a specific missing semantic capability requires them.

## 7. First implementation tranche — Professional Staff Reorder V1

### 7.1 Goal

Expose one deterministic staff-reorder action through the professional workstation without exposing generic topology mutation.

### 7.2 Admitted input

The action consumes:

- one exact current-revision `StaffAddressV3`;
- one integer `toIndex`;
- one fresh direct-child revision ID supplied through the existing revision option contract.

The target staff remains in its current part. Cross-part movement is not part of reorder.

### 7.3 Admitted staff roles

V1 admits any existing `StaffV3` role within the current part:

- `standard`;
- `percussion`;
- `tablature-linked`.

Reason: existing canonical `REORDER_STAFF` already preserves these identities and does not reinterpret content ownership.

A later UI may choose to present linked TAB moves differently, but the canonical V1 contract does not invent a second role-specific reorder algorithm.

### 7.4 Identity contract

On accepted reorder:

- document ID is unchanged;
- part ID is unchanged;
- moved staff ID is unchanged;
- all other staff IDs are unchanged;
- measure, Voice, event, note and grace IDs are unchanged;
- linked TAB `sourceStaffId` is unchanged;
- cross-staff source and display staff IDs are unchanged;
- only staff order and contiguous staff ordinals change;
- revision ID changes exactly once.

No fresh topology entity IDs are created.

### 7.5 Semantic-address lifetime

The input address must resolve against the current revision.

After commit:

- the input address is stale by design;
- the moved staff is rebound using its stable staff ID;
- session selection becomes the moved staff's new current-revision `StaffAddressV3`;
- noncanonical professional range selection is cleared;
- no coordinate- or ordinal-based target repair is permitted.

### 7.6 Admission

The typed professional adapter must reject:

- stale target;
- target that does not resolve to a staff;
- `toIndex < 0`;
- `toIndex >= currentPart.staves.length`;
- `toIndex` equal to the target's current index;
- invalid/reused next revision identity.

No-op rejection is intentionally stricter than the generic low-level topology seam so a product action cannot create meaningless history revisions.

### 7.7 Mutation

The typed adapter delegates the accepted action to the existing V4 topology authority as exactly:

- intent type: `REORDER_STAFF`;
- target: the admitted current-revision `StaffAddressV3`;
- `toIndex`: the admitted destination index.

The adapter must not clone or reimplement the reorder algorithm.

### 7.8 Cross-staff behavior

Reorder changes staff order only.

Existing V4 behavior remains authoritative:

- cross-staff source event identity is unchanged;
- cross-staff display staff identity is unchanged;
- placement survives reorder by stable staff ID;
- a renderer's changed vertical location is presentation only.

### 7.9 History and Undo/Redo

Accepted action:

- produces one direct-child score revision;
- commits one score + notation snapshot through `EditorHistoryV4`;
- adds exactly one history entry;
- clears redo history according to existing history semantics.

Rejected/no-op action:

- creates no revision;
- creates no history entry;
- leaves score, notation, selection and render state unchanged except for any existing noncanonical error reporting surface.

Undo restores the exact pre-reorder canonical pair.

Redo restores the exact post-reorder canonical pair.

### 7.10 MusicXML / renderer behavior

The reorder action does not grant new interchange capability.

For a score already inside the admitted lossless MusicXML profile:

- export must represent the new staff order;
- re-import regression must preserve the admitted order/identity semantics supported by the existing importer.

For a score already outside the lossless profile:

- projection remains fail-closed;
- the operation must not flatten linked TAB, custom instrument metadata or other unsupported state merely to regain XML output.

Renderer requirements:

- render request revision must equal the new canonical revision;
- manifest addresses must reference the new revision;
- the moved staff remains discoverable by stable semantic ID;
- no test may treat previous render token or coordinate as canonical identity.

### 7.11 Browser/product exposure

The first product UI should expose bounded staff movement, not an arbitrary destination editor.

Admitted controls:

- **Move staff up**
- **Move staff down**

Each control derives a bounded adjacent `toIndex` from the current canonical staff order and then invokes the typed professional staff-reorder action.

Why adjacent movement first:

- it avoids free-form index entry;
- it is accessible by keyboard and touch;
- it is easy to disable at top/bottom boundaries;
- repeated actions still produce explicit auditable history revisions;
- no drag/drop geometry becomes authoring evidence.

Drag-and-drop reorder is explicitly outside V1 because pointer geometry must not become canonical target/order authority.

### 7.12 Accessibility

Controls must:

- be real buttons;
- expose explicit accessible names;
- be disabled when movement is impossible;
- preserve keyboard operation;
- meet the existing professional UI touch-target contract;
- not require drag/drop.

### 7.13 Error behavior

The professional surface must expose bounded deterministic errors and never silently repair the target.

At minimum the implementation plan must distinguish:

- no current document/selection context;
- stale staff target;
- destination out of range;
- no-op destination;
- canonical topology rejection;
- invalid next revision identity.

Existing lower-level error codes may be wrapped, but their cause must not be discarded.

## 8. Verification contract for Professional Staff Reorder V1

The later implementation plan must begin with RED tests and must prove all of the following.

### 8.1 Core/workstation behavior

- moving a middle staff up changes order and contiguous ordinals only;
- moving a middle staff down changes order and contiguous ordinals only;
- all stable semantic entity IDs survive;
- unrelated parts are byte/deep-equal except for revision rebinding where applicable;
- staff measures, Voices, events and notes are preserved;
- linked TAB source linkage survives;
- cross-staff placements survive;
- professional selection is cleared;
- session selection rebounds to the moved staff at the new revision.

### 8.2 Rejection behavior

- stale target rejects with no side effects;
- invalid index rejects with no side effects;
- top/bottom UI commands disable rather than synthesize invalid movement;
- no-op target index rejects with no history mutation;
- reused revision identity rejects;
- malformed/non-staff semantic input is not accepted by the typed surface.

### 8.3 History

- exactly one accepted reorder adds one history revision;
- Undo restores the exact prior pair;
- Redo restores the exact reordered pair;
- rejection preserves past/present/future history exactly.

### 8.4 Renderer/interchange

- current render request uses the new revision;
- semantic manifest resolves the moved staff through stable identity;
- standard lossless fixture remains renderable/exportable;
- staff order is reflected in admitted MusicXML projection;
- imported round-trip regression preserves the admitted staff order;
- an XML-pending fixture remains XML-pending rather than being flattened;
- no renderer token/DOM coordinate is used as reorder input.

### 8.5 Repository gates

Fresh verification must include:

- focused unit/contract tests;
- relevant professional workstation tests;
- relevant V4 topology/cross-staff tests;
- renderer qualification;
- Node 18 / 20 / 22 CI;
- P10-1 professional workstation WebKit;
- P10-1 renderer qualification WebKit;
- P08-E4 professional artifact WebKit;
- APP-09B preview regression;
- any new P10-4 staff-reorder WebKit gate;
- Sonar Quality Gate when the implementation reaches PR review.

Physical-device qualification remains separate from WebKit and is not implied by these checks.

## 9. Deferred contracts

The following do not enter the Professional Staff Reorder V1 implementation plan:

- part add/remove/reorder UI;
- staff add/remove UI;
- linked TAB creation/removal UI;
- instrument assignment;
- written/concert pitch semantics;
- arbitrary transposing instruments;
- staff groups;
- braces/brackets;
- percussion maps;
- measure insert/remove/reorder;
- imported automatic measure growth;
- polymeter/non-controlling measures;
- drag/drop staff reorder;
- playback/MIDI instrument routing;
- release/public-write/SesliTab cutover.

Each deferred capability requires its own bounded design gate.

## 10. Acceptance for P10-4A design

This architecture design is acceptable when all of the following are true:

1. current repository authority is identified without inventing a second topology engine;
2. every requested P10-4 target is classified in the gap matrix;
3. identity, history, topology, interchange and renderer boundaries are explicit;
4. true instrument assignment is distinguished from current instrument-name rename;
5. transposition remains blocked until canonical pitch semantics are designed;
6. the first implementation tranche is exactly Professional Staff Reorder V1;
7. V1 delegates to existing `REORDER_STAFF` authority;
8. V1 rejects no-op history churn;
9. UI admission is adjacent move up/down, not drag/drop;
10. no production code, test, deploy, Render or merge action is authorized by this document.

## 11. Next gate

After human review and approval of this written spec, create a **separate TDD implementation plan** for Professional Staff Reorder V1.

The plan must not expand into the deferred P10-4 contracts above.
