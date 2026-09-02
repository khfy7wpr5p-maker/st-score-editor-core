# Roadmap

## Current source of truth

This file records repository reality. Planned or human-gated capability is not production capability.

## Completed bounded program

- **E0–E7-H — COMPLETE**
- **E8-A/B/C — IMPLEMENTED**
- **E8-D — HUMAN-GATED / NOT AUTHORIZED**
- **SEC-KP-00–10 — COMPLETE**
- **SEC-NE-00–07 — COMPLETE / MERGED** within documented bounded profiles.
- **SEC-NE-XML-ROUNDTRIP — COMPLETE / MERGED.**
- **SEC-NE-08 — COMPLETE / MERGED:** derivative Guitar/TAB authoring companion.
- **SEC-NE-09 — COMPLETE / MERGED:** single-session SesliTab host integration.

## SCORE-SCHEMA-EXPANSION

- **SSE-00 — IN PROGRESS / DESIGN BRANCH:** vNext public contract design; no runtime schema change.
- **SSE-01 — HUMAN-GATED PENDING VNEXT CONTRACT APPROVAL:** dual-version types, validators and migration substrate.
- **SSE-02 — NOT STARTED:** canonical session v2 cutover without parallel mutable authorities.
- **SSE-03 — NOT STARTED:** grace-note authoring.
- **SSE-04 — NOT STARTED:** articulation authoring.
- **SSE-05 — NOT STARTED:** ornament authoring.
- **SSE-06 — NOT STARTED:** vNext MusicXML semantic round trip.
- **SSE-07 — NOT STARTED:** renderer + SesliTab compatibility for new semantic address kinds.
- **SSE-08 — HUMAN-GATED DESIGN:** whole staff/part topology contract.
- **SSE-09 — NOT STARTED:** staff/part topology authoring.
- **SSE-10 — NOT STARTED:** cross-staff canonical relation model.

### SSE-00 design decision

The vNext candidate does not weaken v1 timing rules. Grace notes are canonical but live in voice-owned `graceGroups` anchored to an exact normal event; they are not zero-duration `Voice.events` and do not consume normal measure occupancy.

Articulations and ornaments extend typed event-level notation. Unsupported external semantics fail closed rather than being stored as arbitrary `other-*` strings.

Proposed public versions are `ScoreDocumentV2 2.0.0` and `NotationDocumentV2 2.0.0`. Existing 1.0.0 runtime behavior remains unchanged until later approval and implementation.

## Migration gate

v1 -> v2 must be deterministic and lossless. v2 -> v1 is permitted only when every v2-only semantic is empty; otherwise a typed `DOWNGRADE_UNREPRESENTABLE` result is required.

No editor session may hold parallel mutable v1 and v2 canonical states.

## Still fail-closed

- v2 schema input to current v1 runtime validators;
- schema-absent grace/articulation/ornament authoring on main;
- silent v2 -> v1 data loss;
- reverse Guitar/TAB write into canonical score;
- stale result/address reuse;
- renderer-coordinate authoring;
- host dual-write;
- production activation by merge.

`ScoreDocument` 1.0.0 remains current canonical runtime authority until an approved v2 cutover stage is merged.
