# Roadmap

## Current source of truth

This file records merged/in-progress/not-started repository reality. Planned capability is not production capability.

## Baseline

- **E0–E7-H — COMPLETE**
- **E8-A/B/C — IMPLEMENTED**
- **E8-D — HUMAN-GATED / NOT AUTHORIZED**
- **SEC-KP-00–10 — COMPLETE**
- **SEC-NE-00–07 — COMPLETE / MERGED** within documented bounded profiles.
- **SEC-NE-XML-ROUNDTRIP — COMPLETE / MERGED.**
- **SEC-NE-08 — COMPLETE / MERGE CANDIDATE:** derivative Guitar/TAB authoring composition.

## SEC-NE-08 exact capability

`editor-guitar-authoring/1.0.0` requires an exact-current E8-C validated `CanonicalTabResult` and exposes only revision-bound derivative guitar annotations.

- standard score remains canonical;
- string/fret/finger/shape and KEEP/OMIT are derivative views;
- teacher review state does not grant canonical write authority;
- canonical score changes use existing Editor Core typed authoring only;
- an accepted canonical edit deterministically invalidates the old guitar result as `REQUIRES_RECOMPUTE`;
- replay of the old result against the new revision fails current source-fact validation;
- direct external engine invocation remains E8-D human-gated.

## Human-gated public/schema boundaries

- grace-note identity/timing model;
- articulations;
- ornaments;
- whole staff/part topology with cross-staff rules;
- E8-D direct external engine invocation;
- production/public-write activation.

## Next autonomous sequence

1. **SEC-NE-09 — NEXT:** SesliTab product integration around one canonical editor state.

## Still fail-closed

- reverse write from Guitar/TAB result into canonical score;
- stale guitar result reuse after a canonical revision change;
- renderer-coordinate authoring;
- host dual-write;
- unsupported/schema-absent notation semantics;
- production/public-write activation by merge.

`ScoreDocument` remains canonical; guitar state remains derivative-only; renderer/host state remains noncanonical; source evidence remains immutable.
