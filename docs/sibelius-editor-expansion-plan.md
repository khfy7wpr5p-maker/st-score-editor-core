# Sibelius-style Editor Expansion Plan

Date: 2026-09-02

Goal: evolve ST Score Editor Core from bounded correction into a general-purpose score-authoring core without changing canonical authority, renderer independence, source immutability or production/public-write policy.

## Architectural rule

```text
MusicXML import/export
        ↕
Canonical ScoreDocument + revision-bound notation/evidence
        ↕
SemanticAddress / Selection / InsertionPosition
        ↕
Timing validation + typed edit/authoring intent
        ↕
Atomic canonical revision
        ↕
Unified score+notation history
        ↕
RenderRequest / opaque selection bridge
        ↕
Presentation-only renderer / host
```

MusicXML, SVG, DOM, OSMD, alphaTab, VexFlow, Smoosic and host UI state are never canonical edit authority.

## Completed foundation

### SEC-NE-00 — COMPLETE
External editor taxonomy; external editor repositories remain reference-only unless separately admitted.

### SEC-NE-01 — COMPLETE / MERGED
Exact selected-rest note entry, including bounded trailing-rest split.

### SEC-NE-02 — COMPLETE / MERGED
Selected-rest entry composed through unified history/session/browser flow with accepted-revision RenderRequest regeneration.

### SEC-NE-03 — COMPLETE / MERGED
Revision-bound canonical `InsertionPosition`; renderer coordinates are non-authoritative.

### SEC-NE-04A — COMPLETE / MERGED
Read-only exact measure timing/occupancy analysis. Only a full requested window inside one explicit rest is authoring-safe.

### SEC-NE-04C — COMPLETE / MERGED
Low-level revision-bound position note entry inside one admitted explicit rest. Supports rest start/middle/end, exact fill and deterministic leading/trailing rest splits. No second cursor-position session/browser API was introduced.

### SEC-NE-04B1 — COMPLETE / MERGED

**Goal achieved:** preserve sufficient bounded MusicXML measure/time semantics as additive revision-bound evidence without breaking `ScoreDocument` or `NotationDocument` 1.0.0.

Implemented:

- additive `musicxml-measure-semantics` evidence contract;
- additive `importMusicXmlWithMeasureSemantics` import surface;
- simple unnumbered time-signature import within existing notation range;
- time-signature declaration, inheritance and change evidence;
- independent preservation of MusicXML measure `implicit` and `non-controlling` yes/no evidence;
- exact rational `backup` / `forward` cursor-operation evidence;
- canonical measure-address binding plus source part/measure/staff provenance;
- short measures are never inferred to be pickups;
- ambiguous/unsupported time forms fail closed;
- parser leaf hardening prevents hidden nested semantics in `beats` / `beat-type`;
- legacy `importMusicXml` remains the E2 score-only profile and continues to reject the newly admitted semantics instead of silently dropping them.

04B1 is **evidence-only**. It does not make implicit gaps writable and does not materialize rests.

## Next autonomous sequence

### SEC-NE-04B2 — NOT STARTED

**Dependency:** SEC-NE-04B1 complete.

**Goal:** deterministic rest materialization and writable-gap admission only for proven legal implicit silence.

Required:

- derive legal measure span from admitted 04B1 evidence;
- prove silence for the exact target voice;
- no cross-voice false proof;
- deterministic explicit-rest materialization;
- no overlap;
- one unified history transaction;
- no renderer-coordinate inference;
- fail closed when evidence is missing, ambiguous, stale, non-controlling in an unsafe way, or insufficient to establish legal writable time.

Until 04B2 completes, `IMPLICIT_GAP_UNADMITTED` remains non-writable.

### SEC-NE-05 — NOT STARTED

Canonical onset mutation / retiming authority. Requires typed movement contract, exact overlap/measure-boundary validation, frozen tie/slur/beam/tuplet coupling, atomic tuplet retiming and revision-safe selection/insertion handling.

### SEC-NE-06 — NOT STARTED

Structural authoring: add/remove measures/voices and later bounded staff/part operations; set time/key/clef/barline; copy/paste with fresh identities.

### SEC-NE-07 — NOT STARTED

Advanced authoring: chord entry, grace notes, true tuplets, tie/slur during entry, articulations/ornaments, enharmonic spelling, transposition and multi-measure paste.

### SEC-NE-XML-ROUNDTRIP — BOUNDED SUBSET EXISTS / HARDENING CONTINUES

E2 semantic round trip exists for its admitted subset. Newly admitted 04B1 measure/time evidence now requires golden preservation/export/re-import hardening before any broader round-trip claim is made.

### SEC-NE-08 — NOT STARTED

Guitar/TAB authoring composition. Standard notation remains canonical; fingering/string/fret remains derivative unless separately admitted.

### SEC-NE-09 — NOT STARTED

SesliTab integration. Host orchestration may not create dual-write score state. Mobile/pointer/keyboard interaction must resolve to the same semantic command paths.

## Still not admitted

- implicit-gap authoring before 04B2;
- arbitrary event onset movement;
- automatic voice creation;
- unrestricted insertion into occupied time;
- pickup inference from spacing/measure length alone;
- renderer-coordinate gap authority;
- public cursor-position session/browser mutation path from 04C;
- Smoosic/VexFlow runtime dependency;
- renderer-owned edits;
- host dual-write state;
- production/public-write activation by merge.

## Definition of done

Each stage records exact base/head/merge SHA, CI/test evidence, contracts changed, dependency/license state, limitations, current-reality documentation, and explicit authority-change status.
