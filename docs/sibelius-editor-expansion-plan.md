# Sibelius-style Editor Expansion Plan

Date: 2026-09-02

Goal: evolve ST Score Editor Core into a renderer-independent general score-authoring core without weakening canonical authority, source immutability or fail-closed validation.

## Completed foundation

The original SEC-NE program and SCORE-SCHEMA-EXPANSION through SSE-08 are COMPLETE / MERGED. SSE-09 bounded V3 staff/part topology runtime is implemented on this merge candidate.

Completed foundation includes:

- v2 contract, migration and one canonical v2 session;
- grace-note authoring;
- typed articulation authoring;
- relation-safe ornament authoring;
- bounded MusicXML v2 semantic round trip;
- renderer v2 projection and additive OSMD/alphaTab compatibility;
- SesliTab v2 host facade with no dual-write authority;
- human-approved SSE-08 V3 staff/part topology contract.

V2 sessions remain supported. SSE-09 adds a separate V3 session contract; one session owns exactly one versioned canonical score+notation pair and never keeps mutable V2 and V3 canonical copies in parallel.

## SSE-09 — Staff/part topology implementation — COMPLETE / MERGE CANDIDATE

Implemented contracts:

- `ScoreDocumentV3/3.0.0`;
- `NotationDocumentV3/3.0.0`;
- `SemanticAddressV3/3.0.0`;
- `RendererRequestV3/3.0.0`;
- guarded V2 -> V3 migration and lossless-only V3 -> V2 downgrade;
- atomic V3 score+notation history and V3 session.

### Canonical topology

The V3 runtime uses document-global stable `measureFrames` as aligned measure-sequence authority. Parts have explicit contiguous ordinals and stable instrument identity. Content-bearing staves are `standard` or `percussion` and own exactly one staff measure per frame.

A `tablature-linked` staff is presentation topology only. It references a same-part standard source staff, owns no independent canonical measure/voice/event/note stream, and does not make string/fret/fingering/voicing canonical.

V3 notation owns time/barlines at frame level and key/clef at staff-measure level. V3 addressing includes exact measure-frame identity and remains revision-bound.

### Bounded topology authoring

SSE-09 implements:

- add/remove/reorder part;
- add/remove/reorder standard or percussion staff;
- add/remove linked TAB presentation staff;
- rename part/instrument display metadata.

Content-staff creation does not copy or infer rhythm from another staff. Every frame must have effective meter evidence, and the caller supplies fresh identities for deterministic explicit full-frame rest initialization. Missing meter fails closed.

Removal rejects notation orphaning, stale targets, final-part/final-content-staff deletion, and linked-TAB source removal while the link exists. No implicit cascade or nearest-target retargeting is admitted.

### Renderer and MusicXML boundary

`RendererRequestV3` reuses the existing renderer projection only when a V3 pair can be downgraded and serialized without semantic loss. Otherwise it returns `V3_XML_PENDING` with `musicXml: null`.

SSE-09 does not claim V3-native topology MusicXML import/export and does not cut the SesliTab product runtime over to V3. Existing SesliTab v2 integration remains current until a separately admitted integration stage.

## SSE-10 — Cross-staff canonical relation model — HUMAN-GATED DESIGN

Cross-staff beaming, note relocation, ties/slurs/tuplets/ornaments and ownership are not admitted by SSE-09. They require a separately approved canonical relation and preservation contract before implementation.

## Remaining explicit gates

- V3-native topology MusicXML import/export;
- SesliTab V3 product cutover;
- polymeter/non-controlling topology;
- part groups/brackets/braces;
- arbitrary instrument transposition;
- percussion-map authoring;
- page/system/layout geometry;
- playback/MIDI routing;
- direct external-engine invocation;
- persistence/network/public-write/production activation;
- `.mxl` container support.

## Completion rule

SSE-09 completion means the bounded V3 topology core is implemented and validated. It does not authorize cross-staff semantics, V3 product cutover, V3-native topology MusicXML, persistence/network or production/public-write authority.
