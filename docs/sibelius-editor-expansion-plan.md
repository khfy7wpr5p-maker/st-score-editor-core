# Sibelius-style Editor Expansion Plan

Date: 2026-09-02

Goal: evolve ST Score Editor Core into a renderer-independent general score-authoring core without weakening canonical authority, source immutability or fail-closed validation.

## Completed foundation

The original SEC-NE program and bounded MusicXML work are COMPLETE / MERGED. The approved SCORE-SCHEMA-EXPANSION program has moved the canonical editor session to v2 and implemented:

- **SSE-00–02 — COMPLETE / MERGED:** vNext contract, dual-version substrate and one canonical v2 session/history/render/selection state;
- **SSE-03 — COMPLETE / MERGED:** canonical grace-note authoring;
- **SSE-04 — COMPLETE / MERGED:** typed articulation authoring;
- **SSE-05 — COMPLETE / MERGED:** relation-safe ornament authoring;
- **SSE-06 — COMPLETE / MERGED:** bounded isolated MusicXML v2 semantic round trip;
- **SSE-07 — COMPLETE / MERGE CANDIDATE:** renderer + SesliTab v2 compatibility.

The earlier statement that grace notes, articulations and ornaments required a future schema is historical: that schema design was approved at SSE-00 and is implemented as `ScoreDocumentV2` / `NotationDocumentV2` 2.0.0.

## Current MusicXML and renderer capability

SSE-06 provides a separate v2 parser/importer/serializer without widening legacy v1 acceptance. SSE-07 connects that proven projection to `renderer-contract-v2` while preserving lossless v1 compatibility where available.

Renderer requests now distinguish:

- `V1_COMPATIBLE_XML` for lossless v1 projection;
- `V2_SEMANTIC_XML` for bounded representable v2-only semantics;
- `VNEXT_XML_PENDING` for canonical pairs that the bounded v2 serializer still cannot represent.

Opaque tokens remain revision-bound semantic identities, including grace-group/event/note targets. Additive OSMD and alphaTab v2 adapters reject pending requests before renderer load rather than guessing or losing semantics.

## SesliTab v2 compatibility

`seslitab-editor-host-v2` wraps exactly one canonical v2 editor session. It exposes v2 render-token selection, admitted grace/articulation/ornament edits and unified undo/redo through editor-owned semantic paths.

Pointer, keyboard and touch are provenance only; they do not create separate mutation authority. Host dual-write, renderer mutation authority and DOM/SVG coordinate mutation authority remain forbidden. Playback remains host-owned and edit admission does not independently disable playback.

## Human-gated next sequence

### SSE-08 — Staff/part topology contract — HUMAN-GATED DESIGN

Freeze part/staff identity lifecycle, aligned-measure correspondence, notation ownership, instrument/TAB staff semantics, migration, source-map and renderer impacts before authoring is implemented.

No topology implementation should start until this design is explicitly approved.

### SSE-09 — Staff/part topology authoring — NOT STARTED

Only after SSE-08 approval.

### SSE-10 — Cross-staff canonical relation model — NOT STARTED

Requires separately approved ownership, editing and MusicXML-preservation rules.

## Completion rule

Autonomous work is complete through SSE-07 on this merge candidate. Public schema breaks beyond the approved v2 contract, whole staff/part topology authority, cross-staff ownership, direct external-engine invocation and production/public-write activation remain explicit human gates.