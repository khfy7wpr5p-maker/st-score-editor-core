# Sibelius-style editor expansion plan

Date: 2026-09-02

Goal: evolve ST Score Editor Core from bounded existing-score correction into a general-purpose score-authoring core without changing canonical authority, renderer boundaries, source immutability, or production/public-write policy.

## Architectural rule

```text
MusicXML import/export
        ↕
Canonical ScoreDocument
        ↕
Typed edit / authoring operations
        ↕
Unified revision + history
        ↕
RenderRequest / selection bridge
        ↕
Presentation-only renderer
```

MusicXML, SVG, DOM, OSMD, alphaTab, VexFlow, Smoosic and host UI state are never canonical edit authority.

## Program

### SEC-NE-00 — External editor taxonomy — COMPLETE ON WORK BRANCH

Reference Smoosic and the already reviewed notation ecosystem as technical taxonomy. No new runtime dependency and no source-copy requirement.

### SEC-NE-01 — Rest-slot note entry — IMPLEMENTED ON WORK BRANCH

Add a bounded authoring primitive that writes a note into an exact selected rest while preserving represented time.

Acceptance:

- exact current `EventAddress` required;
- target must be a rest;
- exact-duration replacement supported;
- shorter note atomically creates a trailing rest;
- no note may exceed selected rest duration;
- all new ids must be fresh;
- stale targets fail closed;
- one immutable revision or none;
- no renderer/UI/network authority added.

### SEC-NE-02 — Editor note-entry intent + browser surface

Expose the primitive through framework-neutral typed intent and browser runtime entry points.

Requirements:

- selection must resolve to the current canonical rest;
- duration/pitch/keypad state is semantic input only;
- host-generated ids remain bounded and validated;
- successful edit returns a new render request;
- mobile/keyboard/pointer UI must call the same semantic entry point.

### SEC-NE-03 — Cursor and insertion-position contract

Define a canonical insertion position independent of SVG coordinates.

Candidate identity:

```text
InsertionPosition {
  documentId
  revisionId
  partId
  staffId
  measureId
  voiceId
  onset
}
```

Renderer coordinates may locate a candidate, but Editor Core must validate/resolve it against the current score revision before authoring.

### SEC-NE-04 — Measure timing and gap authority

Before arbitrary insertion, canonical measure timing must be explicit enough to prove whether an insertion fits.

Required work:

- explicit measure duration/meter relationship;
- exact voice occupancy calculation;
- deterministic gap model;
- overlap rejection;
- rest materialization policy;
- pickup/incomplete measure handling;
- multi-voice rules.

No free insertion should be admitted before this contract is complete.

### SEC-NE-05 — Onset mutation / retiming

Introduce separately reviewed onset mutation only after notation coupling is frozen.

Required invariants:

- event ordering remains canonical;
- no invalid overlap in a voice;
- tuplets are retimed atomically with canonical events;
- ties/slurs/beams and notation metadata cannot silently become stale;
- unified score+notation history remains one transaction;
- stale selection/insertion positions fail closed.

This stage also unlocks ordinary triplet creation/removal currently blocked by the correction keypad.

### SEC-NE-06 — Structural score authoring

Add bounded operations for:

- add/remove measure;
- add/remove voice;
- add/remove staff where admitted;
- add/remove part/instrument where admitted;
- barline/time/key/clef authoring with explicit scope;
- copy/paste with fresh semantic identities.

Each structural operation requires deterministic identity creation and rollback-safe validation.

### SEC-NE-07 — Advanced note entry

Add:

- chord entry at insertion position;
- grace notes;
- tuplets with real retiming;
- articulations/ornaments;
- ties/slurs during entry;
- enharmonic spelling policy;
- transposition;
- multi-measure paste.

### SEC-NE-08 — Guitar authoring surface

Compose canonical notation entry with Guitar Workspace evidence:

- standard notation remains canonical;
- string/fret assignments remain derivative unless separately admitted;
- TAB can propose fingering/voicing without bypassing canonical score edits;
- guitar-specific entry can request ordinary Editor Core intents.

### SEC-NE-09 — Product integration

Host integration order:

1. ST Score Editor Core
2. ST Score Rendering Layer
3. SesliTab Guitar Reader
4. Guitar Workspace / TAB evidence

The host orchestrates. It does not create a second canonical model or dual-write score state.

## Explicitly not part of SEC-NE-01

- arbitrary event onset movement;
- measure length inference;
- automatic voice creation;
- unrestricted note insertion into occupied time;
- Smoosic/VexFlow dependency;
- renderer-owned edits;
- production/public-write activation.

## Completion evidence per stage

Every stage should record:

- exact base/head SHA;
- tests/checks and CI status;
- changed public contracts;
- dependency/license changes;
- known limitations;
- runtime/production authority change (`false` unless separately authorized).
