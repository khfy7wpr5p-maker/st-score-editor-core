# SCORE-SCHEMA-EXPANSION Program

Status: **SSE-01 COMPLETE / MERGE CANDIDATE**

The vNext contract frozen by SSE-00 has been explicitly approved. SSE-01 implements the additive dual-version substrate; it does not yet cut the editor session from v1 to v2.

## Mission

Extend ST Score Editor Core beyond `ScoreDocument` / `NotationDocument` 1.0.0 without weakening canonical authority, revision binding, source immutability, unified history, MusicXML safety, renderer isolation, Guitar derivative authority or SesliTab no-dual-write rules.

Initial expansion sequence:

1. grace notes;
2. articulations;
3. ornaments;
4. MusicXML v2 round trip;
5. renderer/SesliTab v2 identity compatibility;
6. later staff/part topology and cross-staff relations behind a separate design gate.

## Non-negotiable invariants

- one versioned `ScoreDocument` is canonical musical authority in a session;
- notation must be same-document, same-revision and same-version;
- no parallel mutable v1/v2 canonical pair in one editor session;
- renderer, DOM/SVG and SesliTab host state remain noncanonical;
- MusicXML is exchange/projection data, not live mutable editor state;
- source identity remains immutable/auditable;
- stale addresses/sidecars fail closed;
- score + notation mutation remains one atomic history commit;
- no v2 feature may be hidden in v1 fields;
- v2 -> v1 downgrade rejects on semantic loss;
- no new runtime dependency is required through SSE-01;
- production/public-write activation remains a separate gate.

## Frozen vNext model

### ScoreDocumentV2 2.0.0

Normal `Voice.events` retain current timed semantics. `VoiceV2.graceGroups` contains canonical non-occupancy grace material anchored to an exact normal event in the same voice. Grace events have stable IDs, written duration and normalized playback metadata, but no normal timeline onset/duration.

### NotationDocumentV2 2.0.0

Event notation adds typed finite `articulations[]` and `ornaments[]`; grace event/note notation uses dedicated v2 semantic targets. Unsupported arbitrary `other-*` forms are not canonical fallbacks.

### SemanticAddressV2 2.0.0

The v2 address space contains normal ancestry plus `grace-group`, `grace-event` and `grace-note`. V1 address unions remain unchanged.

## Stage status

### SSE-00 — Contract freeze — COMPLETE / MERGED

Delivered the versioning, grace authority, notation vocabulary, migration, MusicXML and compatibility design. The contract was explicitly approved before SSE-01 implementation.

### SSE-01 — Dual-version substrate — COMPLETE / MERGE CANDIDATE

Implemented:

- `score-model-v2` validator/types;
- `addressing-v2` exact revision-bound grace identity;
- `notation-structure-v2` typed articulation/ornament and grace notation substrate;
- deterministic v1 -> v2 migration;
- guarded v2 -> v1 downgrade with `DOWNGRADE_UNREPRESENTABLE` and exact loss paths;
- regression coverage proving v1 validators remain fail-closed for v2 input.

No v2 authoring command or session cutover is introduced in SSE-01.

### SSE-02 — Canonical session v2 cutover — NEXT

Required:

- one v2-native editor session/history/render pair;
- explicit v1 input migration at the session boundary;
- no mixed-version score/notation pair;
- no parallel mutable v1/v2 state;
- stale v1/v2 sidecars fail closed;
- all SEC-NE regressions stay green.

### SSE-03 — Grace note authoring — NOT STARTED

Add/remove grace group, add/remove/reorder grace events, pitch/chord/rest grace content, anchor deletion/move protection, exact-address selection, atomic history and deterministic fresh IDs. Grace events never consume normal measure occupancy.

### SSE-04 — Articulation authoring — NOT STARTED

Typed set/toggle/remove for normal and grace events, duplicate/conflict validation and renderer-independent semantic commands.

### SSE-05 — Ornament authoring — NOT STARTED

Typed simple ornaments plus relation-validated tremolo/wavy-line forms. No arbitrary `other-ornament` fallback.

### SSE-06 — MusicXML vNext round trip — NOT STARTED

Bounded import/export of admitted grace/articulation/ornament semantics with serializer -> importer golden equivalence. Legacy v1 importers remain fail-closed for v2-only semantics.

### SSE-07 — Renderer and SesliTab compatibility — NOT STARTED

Opaque tokens for new v2 address kinds, selection continuity after rerender, pointer/keyboard/touch convergence, playback/edit-admission separation and no host dual-write.

### SSE-08 — Staff/part topology contract — HUMAN-GATED DESIGN

Must freeze part/staff identity lifecycle, aligned-measure correspondence, notation ownership, instrument/TAB staff semantics and source-map/renderer impacts before implementation.

### SSE-09 — Staff/part topology authoring — NOT STARTED

Only after SSE-08 approval.

### SSE-10 — Cross-staff relation model — NOT STARTED

Requires explicit canonical cross-staff ownership and MusicXML preservation rules.

## Migration policy

### v1 -> v2

Lossless and deterministic:

- document/revision/source identity preserved;
- normal timed events unchanged;
- `VoiceV2.graceGroups = []`;
- event articulations/ornaments = `[]`;
- grace notation arrays = `[]`;
- address ancestry preserved under explicit v2 contract version.

Pure schema conversion is not a musical edit.

### v2 -> v1

Allowed only when all v2-only content is empty. Any grace group, articulation, ornament or grace notation rejects with `DOWNGRADE_UNREPRESENTABLE` and exact affected paths. Silent discard is forbidden.

## Compatibility strategy

1. keep v1 validation stable;
2. prove deterministic dual-version migration — completed in SSE-01;
3. cut one session to one v2 pair — SSE-02;
4. expose v2 authoring only after cutover;
5. prove MusicXML round trip;
6. prove renderer/SesliTab identity compatibility.

## Definition of done

The expansion is complete only after validators/migrations, v2 session/history, authoring commands, addressing/selection safety, MusicXML semantic round trip, renderer/SesliTab compatibility, downgrade-loss protection, current-reality docs and full Node 18/20/22 CI are all complete without authority drift.
