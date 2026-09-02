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
- **SSE-02 — COMPLETE / MERGE CANDIDATE:** v2-native session/history/render/selection cutover.
- **SSE-03 — NEXT:** grace-note authoring.
- **SSE-04 — NOT STARTED:** articulation authoring.
- **SSE-05 — NOT STARTED:** ornament authoring.
- **SSE-06 — NOT STARTED:** vNext MusicXML semantic round trip.
- **SSE-07 — NOT STARTED:** renderer + SesliTab v2 compatibility.
- **SSE-08 — HUMAN-GATED DESIGN:** staff/part topology contract.
- **SSE-09 — NOT STARTED:** staff/part topology authoring.
- **SSE-10 — NOT STARTED:** cross-staff canonical relation model.

## SSE-02 exact capability

- v1 score+notation may migrate once at a v2-session creation boundary;
- a v2 session contains only one v2 score+notation authority pair;
- mixed versions reject;
- v2 history is atomic and direct-child revision bound;
- notation rebinding covers normal and grace semantic targets;
- v2 render manifests contain all v2 entity identities;
- v2-only content cannot silently downgrade to v1 MusicXML: it is marked `VNEXT_XML_PENDING` with no lossy XML;
- normal/grace semantic targets are selectable through opaque v2 render tokens;
- no v2 authoring mutation is opened by SSE-02 itself.

## Still fail-closed

- mixed-version session state;
- disappearing notation targets;
- v2 -> v1 semantic loss;
- grace/articulation/ornament authoring before their own stages;
- v2-only MusicXML projection before SSE-06;
- renderer-coordinate authoring and host dual-write;
- E8-D external engine invocation;
- production/public-write activation.

Staff/part topology and cross-staff remain separately human-gated at SSE-08+.
