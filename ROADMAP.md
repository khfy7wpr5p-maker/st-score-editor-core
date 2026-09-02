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
- **SSE-07 — COMPLETE / MERGED:** renderer + SesliTab v2 compatibility.
- **SSE-08 — HUMAN-APPROVED DESIGN FREEZE / MERGE CANDIDATE:** staff/part topology contract for v3.
- **SSE-09 — NOT STARTED:** staff/part topology implementation against the frozen v3 contract.
- **SSE-10 — NOT STARTED:** cross-staff canonical relation model.

## SSE-08 frozen design

- next topology target is `ScoreDocumentV3/3.0.0 + NotationDocumentV3/3.0.0`;
- parts gain explicit stable ordinals and stable instrument identity;
- document-global `measureFrames` become the aligned measure-sequence authority;
- content staffs are `standard` or `percussion` and own exactly one staff measure per frame;
- `tablature-linked` staff is derivative presentation linked to a standard source staff and owns no independent event/note stream;
- linked TAB string/fret/fingering assignments remain derivative Guitar state;
- v3 notation splits frame-owned time/barline semantics from staff-measure key/clef semantics;
- `SemanticAddressV3` adds explicit measure-frame identity while preserving ID-based, revision-bound targeting;
- v2 -> v3 migration rejects misaligned measures or conflicting frame-owned notation rather than repairing silently;
- v3 -> v2 downgrade remains lossless-only;
- initial SSE-09 content-staff creation may proceed only when full-frame explicit rest initialization is provable from effective meter evidence.

Full contract: `docs/staff-part-topology-contract.md`.

## Still fail-closed / gated

- mixed-version canonical session state;
- arbitrary MusicXML outside bounded profiles and `.mxl`;
- renderer-coordinate authoring, DOM/SVG mutation authority and host dual-write;
- bounded v2 pairs the serializer cannot represent;
- v3 topology runtime before SSE-09 implementation and validation;
- TAB as independent canonical pitch/event authority;
- polymeter/non-controlling topology in the initial v3 profile;
- cross-staff ownership before SSE-10 approval;
- E8-D direct external-engine invocation;
- production/public-write activation.

SSE-08 freezes design only. No v3 runtime/schema implementation is activated by this stage.