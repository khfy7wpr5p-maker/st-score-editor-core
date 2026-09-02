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

- **SSE-00–07 — COMPLETE / MERGED:** v2 contract/session, grace/articulation/ornament authoring, bounded MusicXML v2, renderer and SesliTab v2 compatibility.
- **SSE-08 — COMPLETE / MERGED:** human-approved V3 staff/part topology contract freeze.
- **SSE-09 — COMPLETE / MERGE CANDIDATE:** bounded V3 topology runtime and authoring.
- **SSE-10 — HUMAN-GATED DESIGN:** cross-staff canonical relation ownership.

## SSE-09 exact capability

- `ScoreDocumentV3`, `NotationDocumentV3`, `SemanticAddressV3`, `RendererRequestV3` additive runtime contracts;
- document-global stable `measureFrames`;
- explicit part ordinal + stable instrument identity;
- standard/percussion content staffs and derivative `tablature-linked` presentation staff;
- guarded V2 -> V3 migration and lossless-only V3 -> V2 downgrade;
- frame-owned time/barline and staff-measure-owned key/clef notation;
- atomic V3 score+notation history and V3 session;
- add/remove/reorder part;
- add/remove/reorder standard/percussion staff;
- add/remove linked TAB presentation staff;
- rename part/instrument display metadata;
- content-staff creation only with effective meter proof and caller-supplied identities for explicit full-frame rests;
- notation-orphan protection, stale target rejection, final-part/final-content-staff protection;
- linked TAB source removal fails closed until the link is explicitly removed;
- V3 renderer uses lossless V2 projection when available and otherwise returns `V3_XML_PENDING`.

## Still fail-closed / gated

- cross-staff relation ownership and editing;
- V3-native topology MusicXML import/export;
- SesliTab V3 product cutover;
- polymeter/non-controlling topology;
- part groups/brackets/braces;
- arbitrary instrument transposition and percussion maps;
- renderer-coordinate authoring, DOM/SVG authority and host dual-write;
- E8-D direct external-engine invocation;
- persistence/network/public-write/production activation;
- `.mxl` container support.

SSE-10 requires a separate approved cross-staff design before canonical cross-staff implementation.
