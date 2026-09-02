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
- **SSE-04 — COMPLETE / MERGED:** typed articulation authoring.
- **SSE-05 — COMPLETE / MERGED:** relation-safe ornament authoring.
- **SSE-06 — COMPLETE / MERGED:** bounded isolated MusicXML v2 semantic round trip.
- **SSE-07 — COMPLETE / MERGE CANDIDATE:** renderer + SesliTab v2 compatibility.
- **SSE-08 — HUMAN-GATED DESIGN:** staff/part topology contract.
- **SSE-09 — NOT STARTED:** staff/part topology authoring.
- **SSE-10 — NOT STARTED:** cross-staff canonical relation model.

## SSE-07 exact capability

- v1-compatible v2 pairs continue to emit `V1_COMPATIBLE_XML`;
- representable v2-only pairs emit bounded `V2_SEMANTIC_XML` using the SSE-06 serializer;
- unrepresentable pairs stay fail-closed as `VNEXT_XML_PENDING` with no XML;
- v2 opaque manifest tokens cover normal and grace semantic identities;
- additive OSMD and alphaTab v2 adapters consume only renderable requests;
- exact renderer version/license profiles remain enforced, including ST Rendering Layer OSMD 2.1.2;
- additive SesliTab v2 host owns no parallel score and delegates authoring to one canonical v2 session;
- pointer/keyboard/touch share one semantic path;
- playback remains host-owned and independent from editor admission;
- legacy v1 renderer and SesliTab APIs remain unchanged.

## Still fail-closed / gated

- mixed-version canonical session state;
- arbitrary MusicXML outside bounded profiles and `.mxl`;
- renderer-coordinate authoring, DOM/SVG mutation authority and host dual-write;
- bounded v2 pairs the serializer cannot represent;
- E8-D direct external-engine invocation;
- production/public-write activation;
- staff/part topology implementation before SSE-08 approval;
- cross-staff ownership before its later explicit gate.

SSE-08 is a human-gated design stage; autonomous topology implementation stops here.