# Sibelius-style Editor Expansion Plan

Date: 2026-09-02

Goal: evolve ST Score Editor Core into a renderer-independent general score-authoring core without weakening canonical authority, source immutability or fail-closed validation.

## Completed foundation

The original SEC-NE program and its bounded MusicXML round-trip work are COMPLETE / MERGED. The approved SCORE-SCHEMA-EXPANSION program has subsequently moved the canonical editor session to v2 and implemented:

- **SSE-00–02 — COMPLETE / MERGED:** vNext contract, dual-version substrate and one canonical v2 session/history/render/selection state;
- **SSE-03 — COMPLETE / MERGED:** canonical grace-note authoring;
- **SSE-04 — COMPLETE / MERGED:** typed articulation authoring;
- **SSE-05 — COMPLETE / MERGED:** relation-safe ornament authoring;
- **SSE-06 — COMPLETE / MERGE CANDIDATE:** bounded isolated MusicXML v2 semantic round trip.

The earlier statement that grace notes, articulations and ornaments required a future schema is historical: that schema design was approved at SSE-00 and is now implemented as `ScoreDocumentV2` / `NotationDocumentV2` 2.0.0.

## Current MusicXML capability

SSE-06 adds a separate v2 parser/importer/serializer rather than widening legacy v1 acceptance. The admitted round trip preserves canonical grace note/rest/chord semantics, bounded grace playback/written-value notation, typed articulations, simple ornaments, single/spanning tremolo and numbered wavy-line relations. Unsupported or ambiguous forms reject rather than disappear.

MusicXML remains exchange/projection data; it never becomes live editor authority. The internal v1-compatible timed projection used by the v2 importer is noncanonical and exists only to reuse the proven timed-score importer.

## Next autonomous stage

### SSE-07 — Renderer + SesliTab v2 compatibility — NEXT

Connect the proven v2 projection to the product rendering boundary without giving renderer or host state mutation authority. Required work includes:

- v2-only renderer request projection instead of permanent `VNEXT_XML_PENDING` where the bounded v2 serializer can represent the pair;
- opaque token coverage for normal and grace address kinds;
- exact revision-bound hit/selection continuity after rerender;
- pointer/keyboard/touch convergence on editor-owned semantic intents;
- playback/edit-admission separation;
- no SesliTab host dual-write;
- fail-closed behavior for stale/mismatched renderer requests and unsupported projection profiles.

SSE-07 must not broaden canonical score authority or silently downgrade v2 semantics.

## Later human-gated sequence

### SSE-08 — Staff/part topology contract — HUMAN-GATED DESIGN

Freeze part/staff identity lifecycle, aligned-measure correspondence, notation ownership, instrument/TAB staff semantics, migration, source-map and renderer impacts before authoring is implemented.

### SSE-09 — Staff/part topology authoring — NOT STARTED

Only after SSE-08 approval.

### SSE-10 — Cross-staff canonical relation model — NOT STARTED

Requires separately approved ownership, editing and MusicXML-preservation rules.

## Completion rule

Autonomous work may continue through SSE-07 under existing authority invariants. Public schema breaks beyond the approved v2 contract, whole staff/part topology authority, cross-staff ownership, direct external-engine invocation and production/public-write activation remain explicit human gates.