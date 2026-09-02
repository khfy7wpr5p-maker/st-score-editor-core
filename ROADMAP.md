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
- **SSE-05 — COMPLETE / MERGED:** relation-safe ornament authoring.
- **SSE-06 — COMPLETE / MERGE CANDIDATE:** bounded isolated MusicXML v2 semantic round trip.
- **SSE-07 — NEXT:** renderer + SesliTab v2 compatibility.
- **SSE-08 — HUMAN-GATED DESIGN:** staff/part topology contract.
- **SSE-09 — NOT STARTED:** staff/part topology authoring.
- **SSE-10 — NOT STARTED:** cross-staff canonical relation model.

## SSE-06 exact capability

- separate safe MusicXML v2 parser using existing processing budgets;
- no widening of legacy v1 parser/importer profiles;
- v2 serializer/importer for canonical grace note/rest/chord semantics;
- bounded grace written value, slash/playback, dots/beams and grace-note notation;
- normal/grace typed articulation round trip;
- simple ornament + accidental-mark round trip;
- single and numbered spanning tremolo round trip;
- numbered wavy-line start/continue/stop round trip;
- original MusicXML source identity preserved on final canonical import result;
- sparse notation preserved rather than materializing default entries;
- serializer -> importer semantic-equivalence regression;
- legacy notation importer proven fail-closed for v2-only XML;
- unsupported ambiguous grace placement/playback rejected rather than silently changed.

## Still fail-closed / pending

- mixed-version session state;
- arbitrary external MusicXML forms outside the bounded profile;
- `.mxl` container support;
- silent v2 -> v1 semantic loss;
- renderer use of v2 MusicXML before SSE-07 integration (`VNEXT_XML_PENDING` may remain on v2-only render requests);
- renderer-coordinate authoring and host dual-write;
- E8-D external engine invocation;
- production/public-write activation.

Staff/part topology and cross-staff remain separately human-gated at SSE-08+.