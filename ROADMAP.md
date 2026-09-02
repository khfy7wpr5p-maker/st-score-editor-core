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
- **SSE-03 — COMPLETE / MERGED:** canonical grace-note authoring.
- **SSE-04 — COMPLETE / MERGE CANDIDATE:** typed articulation authoring for normal/grace events.
- **SSE-05 — NEXT:** ornament authoring.
- **SSE-06 — NOT STARTED:** vNext MusicXML semantic round trip.
- **SSE-07 — NOT STARTED:** renderer + SesliTab v2 compatibility.
- **SSE-08 — HUMAN-GATED DESIGN:** staff/part topology contract.
- **SSE-09 — NOT STARTED:** staff/part topology authoring.
- **SSE-10 — NOT STARTED:** cross-staff canonical relation model.

## SSE-04 exact capability

- exact current normal-event or grace-event targets only;
- typed `SET_ARTICULATIONS`, `TOGGLE_ARTICULATION`, `REMOVE_ARTICULATION`;
- finite frozen articulation vocabulary;
- placement and strong-accent direction validation;
- duplicate articulation rejection;
- score musical content unchanged apart from direct-child revision lineage;
- same-revision notation update;
- atomic score+notation history and deterministic post-edit selection;
- stale target rejection;
- v2-only articulation MusicXML remains fail-closed until SSE-06.

## Still fail-closed

- mixed-version session state;
- stale articulation targets or invalid/duplicate articulation semantics;
- silent notation loss;
- ornament authoring before SSE-05;
- v2-only MusicXML projection before SSE-06;
- renderer-coordinate authoring and host dual-write;
- E8-D external engine invocation;
- production/public-write activation.

Staff/part topology and cross-staff remain separately human-gated at SSE-08+.