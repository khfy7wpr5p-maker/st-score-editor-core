# Sibelius-style Editor Expansion Plan

Date: 2026-09-02

Goal: evolve ST Score Editor Core into a renderer-independent general score-authoring core without weakening canonical authority, source immutability or fail-closed validation.

## Completed foundation

The original SEC-NE program and SCORE-SCHEMA-EXPANSION through SSE-07 are COMPLETE / MERGED:

- v2 contract, migration and one canonical v2 session;
- grace-note authoring;
- typed articulation authoring;
- relation-safe ornament authoring;
- bounded MusicXML v2 semantic round trip;
- renderer v2 projection and additive OSMD/alphaTab compatibility;
- SesliTab v2 host facade with no dual-write authority.

The active runtime remains v2.

## SSE-08 — Staff/part topology contract — HUMAN-APPROVED DESIGN FREEZE

SSE-08 is design-only and freezes the next major topology target:

- `ScoreDocumentV3/3.0.0`;
- `NotationDocumentV3/3.0.0`;
- `SemanticAddressV3/3.0.0`;
- `RendererRequestV3/3.0.0`.

### Canonical topology direction

The frozen design introduces document-global stable `measureFrames` as aligned measure-sequence authority. Parts gain explicit ordinals and stable instrument identity. Content-bearing staves are `standard` or `percussion` and own one staff measure per frame.

A `tablature-linked` staff is presentation topology only. It points to a standard source staff in the same part, owns no independent canonical event/note stream, and keeps string/fret/fingering/voicing derivative. TAB glyph hits must resolve to source canonical note/event identities.

V3 notation separates frame-owned time/barline semantics from staff-measure key/clef semantics. V3 addressing adds exact measure-frame identity and keeps stable IDs/revision binding as authority.

V2 -> V3 migration must prove aligned measure count/ordinal/display number and reject conflicting frame-owned notation. No silent repair and no automatic conversion merely because a staff uses TAB clef.

Full design: `docs/staff-part-topology-contract.md`.

## SSE-09 — Staff/part topology implementation — NOT STARTED

After the frozen v3 contract is admitted, bounded implementation may add/remove/reorder parts and standard/percussion staves, add/remove linked TAB presentation staves, and rename part/instrument display names.

Initial content-staff creation must not invent rhythmic content. It may proceed only when every measure frame has enough effective meter evidence to initialize deterministic explicit full-frame rests; otherwise it fails closed.

SSE-09 must prove v3 validators, deterministic migration, exact addressing, atomic history, orphan safety and renderer/MusicXML fail-closed behavior before any v3 session cutover.

## SSE-10 — Cross-staff canonical relation model — SEPARATE GATE

Cross-staff beaming, note relocation, ties/slurs/tuplets/ornaments and ownership are not part of SSE-08. They require separately approved canonical semantics and MusicXML preservation rules.

## Remaining explicit gates

- polymeter/non-controlling topology;
- part groups/brackets/braces;
- arbitrary instrument transposition;
- percussion-map authoring;
- page/system/layout geometry;
- playback/MIDI routing;
- direct external-engine invocation;
- persistence/network/public-write/production activation.

## Completion rule

SSE-08 completion freezes the design only; it does not activate `ScoreDocumentV3`. Implementation authority begins with SSE-09 and remains bounded by the frozen contract and existing source/history/renderer/host safety invariants.