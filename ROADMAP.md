# Roadmap

## Current source of truth

Repository reality only; planned capability is not production capability.

## Completed baseline

- **E0–E7-H — COMPLETE**
- **E8-A/B/C — IMPLEMENTED**
- **E8-D — HUMAN-GATED / NOT AUTHORIZED**
- **SEC-KP-00–10 — COMPLETE**
- **SEC-NE-00–09 + XML ROUNDTRIP — COMPLETE / MERGED** within documented bounded profiles.

## SCORE-SCHEMA-EXPANSION

- **SSE-00 — COMPLETE / MERGED:** approved vNext contract.
- **SSE-01 — COMPLETE / MERGED:** dual-version substrate and guarded migration.
- **SSE-02 — COMPLETE / MERGED:** single canonical v2 session/history/render/selection cutover.
- **SSE-03 — COMPLETE / MERGE CANDIDATE:** canonical grace-note authoring.
- **SSE-04 — NEXT:** articulation authoring.
- **SSE-05 — NOT STARTED:** ornament authoring.
- **SSE-06 — NOT STARTED:** vNext MusicXML semantic round trip.
- **SSE-07 — NOT STARTED:** renderer + SesliTab v2 compatibility.
- **SSE-08 — HUMAN-GATED DESIGN:** staff/part topology contract.
- **SSE-09 — NOT STARTED:** staff/part topology authoring.
- **SSE-10 — NOT STARTED:** cross-staff canonical relation model.

## SSE-03 exact capability

- exact normal-event anchor create/remove grace group;
- note/rest/chord grace event insertion;
- remove/reorder grace event;
- replacement preserving grace-event identity;
- exact grace-note/chord-tone pitch edit;
- normal timed occupancy invariant;
- fresh canonical entity/revision validation;
- stale address rejection;
- explicit final-event/group removal rule;
- grace notation orphan protection;
- atomic score+notation history and deterministic post-edit selection.

## Still fail-closed

- mixed-version session state;
- grace anchor orphaning or stale targets;
- silent notation loss;
- articulation/ornament authoring before their own stages;
- v2-only MusicXML projection before SSE-06;
- renderer-coordinate authoring and host dual-write;
- E8-D external engine invocation;
- production/public-write activation.

Staff/part topology and cross-staff remain separately human-gated at SSE-08+.
