# Roadmap

## Current source of truth

This file records merged/in-progress/not-started repository reality. Planned stages are not production capability.

## Core and correction baseline

- **E0–E7-H — COMPLETE**
- **E8-A/B/C — IMPLEMENTED**
- **E8-D — HUMAN-GATED / NOT AUTHORIZED**
- **SEC-KP-00–10 — COMPLETE**

## SEC-NE — Sibelius-style authoring expansion

### Complete / merged

- **SEC-NE-00–05 — COMPLETE / MERGED** within their documented bounded profiles.
- **SEC-NE-06 — COMPLETE / MERGED:** measure/voice structural authoring plus relation-safe fresh-ID copy/paste.

### SEC-NE-06 exact capability

`editor-structural-authoring`:

- add measure after an exact current measure;
- new measure starts with one fresh empty voice;
- remove only a fully empty non-last measure with no measure-notation orphan;
- add an empty voice;
- remove only an empty non-last voice;
- deterministic sibling ordinal normalization;
- globally fresh canonical identities;
- same-revision notation rebind or reject.

`editor-copy-paste`:

- exact current source voice → exact empty target voice;
- explicit fresh mapping for every event and note identity;
- preserve onset/duration/pitch and admitted safe notation;
- reject beam/tuplet/tie/slur-coupled source material;
- reject nonempty targets;
- independently validate target timing after paste;
- require current safe 04B1 evidence for MusicXML-derived target measures.

Existing `notation-commands` remain the authority for time/key/clef/barline changes.

### Next dependency order

1. **SEC-NE-07 — NOT STARTED:** advanced authoring representable by current contracts; public-schema expansion remains human-gated.
2. **SEC-NE-XML-ROUNDTRIP — HARDENING CONTINUES:** golden semantic equivalence for all admitted capabilities.
3. **SEC-NE-08 — NOT STARTED:** guitar/TAB authoring composition.
4. **SEC-NE-09 — NOT STARTED:** SesliTab product integration.

## Separate topology gate

Whole staff/part add/remove is not admitted by SEC-NE-06 v1. Before it can be authorized the architecture must freeze cross-staff measure correspondence, measure-count/alignment rules, part/staff notation ownership and removal semantics. No geometry or renderer inference may fill those gaps.

## Still fail-closed

- pickup/non-controlling implicit-gap authoring;
- cross-measure retiming;
- unsupported relation-coupled retiming/copy;
- whole staff/part topology mutation;
- renderer-coordinate structural authority;
- host dual-write;
- production/public-write activation by merge.

## Authority rules

`ScoreDocument` remains canonical; notation stays same-revision sidecar authority for notation semantics; MusicXML/evidence is not live editor state; renderer/host state is not canonical; OMR/AI is advisory; Guitar state remains derivative unless separately admitted.
