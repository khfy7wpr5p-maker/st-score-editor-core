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
- **SSE-04 — COMPLETE / MERGED:** typed articulation authoring for normal/grace events.
- **SSE-05 — COMPLETE / MERGE CANDIDATE:** relation-safe ornament authoring.
- **SSE-06 — NEXT:** vNext MusicXML semantic round trip.
- **SSE-07 — NOT STARTED:** renderer + SesliTab v2 compatibility.
- **SSE-08 — HUMAN-GATED DESIGN:** staff/part topology contract.
- **SSE-09 — NOT STARTED:** staff/part topology authoring.
- **SSE-10 — NOT STARTED:** cross-staff canonical relation model.

## SSE-05 exact capability

- simple ornaments and single-note tremolo on exact normal/grace events;
- local add/toggle/remove cannot write spanning endpoints;
- atomic two-note tremolo relation create/remove;
- atomic wavy-line start/continue/stop chain create/remove;
- spanning relations restricted to exact normal pitched events in one measure/voice;
- unique strictly increasing canonical target order;
- rest, cross-scope and grace-spanning relation rejection;
- relation-number collision protection;
- same-revision notation + direct-child score revision;
- atomic score+notation history and deterministic post-edit selection;
- stale address rejection;
- v2-only ornament MusicXML remains fail-closed until SSE-06.

## Still fail-closed

- mixed-version session state;
- one-endpoint or ambiguous spanning ornament mutation;
- stale/reversed/cross-scope/rest relation targets;
- silent notation loss;
- v2-only MusicXML projection before SSE-06;
- renderer-coordinate authoring and host dual-write;
- E8-D external engine invocation;
- production/public-write activation.

Staff/part topology and cross-staff remain separately human-gated at SSE-08+.