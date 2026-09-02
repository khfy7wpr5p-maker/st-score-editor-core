# Roadmap

## Current source of truth

This file records merged/in-progress/not-started repository reality. Planned capability is not production capability.

## Baseline

- **E0–E7-H — COMPLETE**
- **E8-A/B/C — IMPLEMENTED**
- **E8-D — HUMAN-GATED / NOT AUTHORIZED**
- **SEC-KP-00–10 — COMPLETE**
- **SEC-NE-00–06 — COMPLETE / MERGED** within documented bounded profiles.
- **SEC-NE-07 — COMPLETE / MERGED** for semantics representable by current public score/notation contracts.

## SEC-NE-07 exact capability

`editor-advanced-authoring` composes existing canonical edit transactions with stronger authoring safety:

- canonical pitch changes;
- rest ↔ note replacement where command preconditions hold;
- chord tone add/remove;
- duration mutation only when event notation is not dotted/beamed/tupletted and independent 04A timing remains valid;
- notation-orphan prevention after canonical entity replacement/removal;
- current safe 04B1 evidence required for MusicXML-derived duration mutation.

Existing `notation-commands` and `editor-keypad-advanced` remain the authority for accidentals, dots, beams, current 3:2 tuplets, explicit ties and slurs. No duplicate notation state is introduced.

## Human-gated public-schema expansion

The following requested advanced semantics are not fields in `ScoreDocument` / `NotationDocument` 1.0.0 and therefore are not autonomously invented:

- grace-note identity/timing model;
- articulations;
- ornaments.

Whole staff/part topology also remains separately gated. These require explicit public contract design/approval before canonical implementation.

## Next autonomous sequence

1. **SEC-NE-XML-ROUNDTRIP — NEXT:** golden semantic-equivalence hardening for admitted import/edit/export/re-import capabilities.
2. **SEC-NE-08 — NOT STARTED:** guitar/TAB authoring composition.
3. **SEC-NE-09 — NOT STARTED:** SesliTab product integration.

## Still fail-closed

- schema-absent grace/articulation/ornament semantics;
- whole staff/part topology mutation;
- pickup/non-controlling implicit-gap authoring;
- cross-measure or unsupported relation-coupled retiming;
- relation-coupled copy/paste;
- renderer-coordinate authoring;
- host dual-write;
- production/public-write activation by merge.

`ScoreDocument` remains canonical; notation is same-revision sidecar authority; renderer/host state is noncanonical; source evidence remains immutable.
