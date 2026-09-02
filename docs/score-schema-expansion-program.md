# SCORE-SCHEMA-EXPANSION Program

Status: **SSE-00 CONTRACT DESIGN / DOCUMENTATION ONLY**

Base runtime: `main` at `df8402ab7ba29e4a05e7d09be24ba006c71830c3`.

## Mission

Extend ST Score Editor Core beyond the bounded `ScoreDocument` / `NotationDocument` 1.0.0 capability without weakening the existing canonical-authority, revision, source-immutability, undo/redo, MusicXML, renderer, Guitar Workspace or SesliTab boundaries.

The first expansion targets semantics that were intentionally left human-gated by SEC-NE:

1. grace notes;
2. articulations;
3. ornaments;
4. later, whole staff/part topology and cross-staff relationships.

SSE-00 does **not** change a runtime schema or activate a new public write path. It freezes the design and migration rules that a later implementation PR must follow.

## Non-negotiable invariants

- `ScoreDocument` remains the only canonical musical edit authority.
- `NotationDocument` remains same-revision notation authority.
- Renderer, DOM/SVG geometry and SesliTab host state remain noncanonical.
- MusicXML remains exchange/projection data, never live editor state.
- Source identity remains immutable and auditable.
- Old semantic addresses and sidecars fail closed after revision change.
- Undo/redo is one atomic editor history across score + notation mutation.
- No v2 feature may be represented by hidden/unversioned fields in a v1 document.
- v2 -> v1 downgrade must reject when a v2-only semantic would be lost.
- No new runtime dependency is required by this program design.
- Production/public-write activation remains a separate gate.

## Why grace notes require canonical score expansion

Current timed `ScoreEvent` values require a non-negative onset and a **positive duration**. Measure timing, ordering and authoring logic depend on those invariants.

A grace note is not a zero-duration timed event. MusicXML likewise represents a grace note without a `<duration>` element. Forcing a grace note into `Voice.events` with `duration=0`, a fake onset or a renderer-only attachment would either violate current validation or create a second authority model.

The vNext design therefore places grace material in canonical voice-owned `graceGroups`, anchored to an exact normal event in the same voice while remaining outside the normal measure-occupancy timeline.

## Why articulations and ornaments belong to notation

Articulations and ornaments normally modify the written/performed interpretation of an existing attack rather than create a new canonical pitch/onset identity. They therefore extend event-level notation rather than the normal timed event model.

The design keeps typed finite vocabularies and rejects unsupported semantics rather than storing arbitrary strings that could silently change meaning.

## Program stages

### SSE-00 — Contract freeze

Deliverables:

- this program;
- vNext schema design;
- machine-readable stage/gate manifest;
- migration and downgrade policy;
- MusicXML mapping policy;
- explicit authority and compatibility rules.

Runtime schema change: **none**.

### SSE-01 — Dual-version substrate

Planned after explicit approval of the vNext contract:

- add `ScoreDocumentV2` and `NotationDocumentV2` validators/types without deleting v1 support;
- add lossless v1 -> v2 migrators;
- add guarded v2 -> v1 downgrade with `DOWNGRADE_UNREPRESENTABLE` on any v2-only semantic;
- add v2 semantic address kinds for grace group/event/note identity;
- no new authoring command yet.

### SSE-02 — Canonical session v2 cutover

- Editor session/history/render request composition accepts the approved v2 canonical model;
- v1 input may migrate explicitly at the boundary;
- no parallel mutable v1/v2 authorities inside one session;
- stale v1/v2 sidecars cannot be mixed;
- SEC-NE regressions must remain green.

### SSE-03 — Grace note authoring

- add/remove grace group;
- add/remove/reorder grace event;
- pitch/chord/rest grace content within the frozen model;
- anchor deletion/move protection;
- exact-address selection and renderer manifest identity;
- atomic history and deterministic fresh IDs;
- no measure occupancy consumption by grace events.

### SSE-04 — Articulation authoring

- typed event-level articulation set/toggle/remove;
- duplicate/conflicting articulation validation;
- regular and grace-event notation targets;
- renderer-independent semantic commands;
- MusicXML mapping for the admitted articulation subset.

### SSE-05 — Ornament authoring

- typed simple ornaments;
- accidental marks where admitted;
- numbered/relationship-aware wavy-line and tremolo forms only after explicit relation validation;
- no arbitrary `other-ornament` fallback in the canonical contract.

### SSE-06 — MusicXML vNext round trip

- bounded import/export of admitted grace/articulation/ornament semantics;
- serializer -> importer golden semantic equivalence;
- legacy v1 import profiles remain fail-closed for v2-only semantics;
- unsupported MusicXML attributes/forms reject rather than disappear.

### SSE-07 — Renderer and SesliTab compatibility

- opaque renderer token identity for new address kinds;
- selection continuity after rerender;
- pointer/keyboard/touch convergence;
- playback remains separate from edit admission;
- no host dual-write;
- Guitar Workspace derivative-only boundary remains intact.

### SSE-08 — Staff/part topology contract

Design gate before implementation:

- part/staff identity lifecycle;
- aligned-measure correspondence across staves;
- notation ownership during topology edits;
- instrument/TAB staff semantics;
- copy/delete safety;
- source-map and renderer impact.

### SSE-09 — Staff/part topology authoring

Only after SSE-08 contract approval:

- add/remove/reorder part/staff;
- deterministic measure population;
- atomic notation/history updates;
- no orphaned cross-staff or derivative evidence.

### SSE-10 — Cross-staff relation model

- explicit source/target staff relation ownership;
- beam/voice/notation coupling rules;
- MusicXML preservation;
- renderer projection only after canonical relation validation.

## Migration policy

### v1 -> v2

Must be lossless and deterministic:

- every v1 voice receives `graceGroups: []`;
- every v1 event notation receives empty `articulations` and `ornaments`;
- v2 grace-notation collections begin empty;
- document/revision/source identity is preserved exactly unless the migration itself is committed as a new editor revision by an explicit migration operation.

The migration API must distinguish **schema conversion** from **musical edit**. Pure conversion must not pretend the musical source changed.

### v2 -> v1

Allowed only if all v2-only content is empty. Otherwise fail with a typed downgrade error. Never silently discard grace notes, articulations, ornaments, topology relations or future v2 semantics.

## Compatibility strategy

A big-bang replacement of v1 is forbidden.

Implementation must:

1. keep v1 validation stable while v2 is introduced;
2. prove deterministic migration;
3. cut a session over to one schema version at a time;
4. prevent mixed-version notation/score pairs;
5. preserve existing SEC-NE tests;
6. only then expose v2 authoring publicly.

## MusicXML reference alignment

The design follows MusicXML 4.0 semantics:

- grace notes are `<note>` values with `<grace>` and no normal `<duration>`;
- `<grace>` may carry slash and playback timing attributes;
- articulations live under `<notations><articulations>`;
- ornaments live under `<notations><ornaments>`.

Source-specific representation is normalized into typed canonical/notation contracts. Unsupported external forms remain explicit rejection cases.

## Human gates after SSE-00

SSE-00 may merge as documentation because it changes no runtime schema.

Before SSE-01/SSE-02 implementation changes public versioned score/notation contracts, the frozen vNext contract itself must be explicitly accepted. Later production/public-write activation remains separately gated even after all implementation tests pass.

## Definition of done for the expansion

The expansion is not complete merely because fields exist. Completion requires:

- validators and migrations;
- authoring commands;
- addressing/selection/history safety;
- MusicXML semantic round trip;
- renderer/SesliTab compatibility;
- downgrade-loss protection;
- current-reality documentation;
- full Node 18/20/22 CI;
- no authority drift.
