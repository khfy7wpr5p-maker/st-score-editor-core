# Sibelius-style Editor Expansion Plan

Date: 2026-09-02

Goal: evolve ST Score Editor Core into a renderer-independent general score-authoring core without weakening canonical authority, source immutability or fail-closed validation.

## Completed autonomous authoring foundation

SEC-NE-00 through SEC-NE-06 are COMPLETE / MERGED within their bounded contracts.

## SEC-NE-07 — COMPLETE / MERGED for current public schemas

`editor-advanced-authoring/1.0.0` composes existing canonical edit commands with same-revision notation safety and independent timing validation.

Implemented/reused capability:

- pitch mutation;
- rest ↔ note replacement;
- chord tone add/remove;
- duration change with 04A timing veto;
- duration rejection when written dots/beams/tuplet metadata would be silently desynchronized;
- notation orphan prevention after entity-changing score edits;
- current safe 04B1 measure evidence for MusicXML-derived duration edits;
- existing notation commands for accidentals, dots, beams, meter/key/clef/barlines;
- existing explicit-target advanced keypad semantics for current 3:2 triplets, ties and slurs;
- SEC-NE-05 for admitted relation-safe movement;
- SEC-NE-06 fresh-ID copy/paste for relation-free content.

No duplicate score or notation semantics were introduced.

## Human-gated advanced schema program

The following cannot be implemented correctly without changing public schemas:

- grace-note canonical identity/timing;
- articulations;
- ornaments.

A future schema version must define validation, MusicXML import/export mapping, round-trip semantics, renderer contract impact and migration/compatibility. Whole staff/part topology likewise requires a separately frozen structural contract.

## Next autonomous sequence

### SEC-NE-XML-ROUNDTRIP — NEXT

Create first-party synthetic golden fixtures and semantic-equivalence regression covering admitted MusicXML and current score/notation editing. Focus on preservation, not byte identity. Unsupported forms must reject rather than disappear.

### SEC-NE-08 — NOT STARTED

Compose Guitar Workspace/TAB proposals with generic Editor Core authoring. Standard notation remains canonical. Guitar string/fret/fingering stays derivative unless separately admitted; no guitar-specific bypass of timing/history/identity safety.

### SEC-NE-09 — NOT STARTED

Compose SesliTab around one Editor Core canonical state, one presentation renderer path and revision-bound semantic hit/selection state. No host dual-write and no playback lock caused merely by incomplete OMR when playable canonical content exists.

## Completion rule

Autonomous work may complete current-contract capabilities and hardening. Public schema breaks, whole staff/part topology authority, direct external-engine invocation and production/public-write activation remain explicit human gates.
