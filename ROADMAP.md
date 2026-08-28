# Roadmap

## Completed core stages

- **E0 — Architecture & Safety Foundation:** authority/trust boundaries, governance and CI baseline.
- **E1 — Canonical ScoreDocument:** immutable Part/Staff/Measure/Voice/Event/Note/Rest/Chord model.
- **E2 — Safe MusicXML Import + Semantic Round Trip:** resource-bounded parser, explicit unsupported semantics, serializer/equivalence tests.
- **E3 — Stable Addressing / Selection:** revision/ancestry-bound semantic addresses and stale-selection rejection.
- **E4 — Score Editing / Transactions:** typed bounded score commands, atomic validation, immutable revisions and score history.
- **E5 — Notation Structure:** time/key/clef/barline, dots/beams/tuplets, accidentals/ties/slurs plus MusicXML export.
- **E6 — Renderer Adapters:** presentation-only host integrations for OSMD 2.1.1 and alphaTab 1.8.4.

## Stage E7 — Editor Core / UI Boundary

- **E7-A — UI Authority Contract — COMPLETE**
- **E7-B — Framework-neutral Editor Shell — COMPLETE**
- **E7-C — Secure Selection + Inspector — COMPLETE**
- **E7-D — Basic Score Editing Intents — COMPLETE**
- **E7-E1 — Atomic Notation Transactions — COMPLETE**
- **E7-E2 — Notation Editing Intents — COMPLETE**
- **E7-F — Undo/Redo, Accessibility and UX Safety — COMPLETE**
- **E7-G — ScoreMosaic Browser Host Runtime — COMPLETE**
- **E7-H — Browser-safe Runtime Bundle — COMPLETE**

E7 remains bounded to repository/browser composition. Production/public-write/live-AI authority is not granted.

## Stage E8 — Guitar Workspace Adapter

### E8-A — Guitar Workspace Authority Contract — COMPLETE
Implemented:
- guitar string/fret/fingering/voicing/reduction state is derivative only;
- external engine output has no canonical score mutation authority;
- revision-bound `GuitarWorkspaceSourceMap` maps engine source identities to canonical `event` / `note` semantic addresses;
- stale, duplicate, ambiguous or unsupported mappings fail closed;
- external reference is `CanonicalTabResult 2.0.0` from `musicxml-to-guitar-tab-engine`;
- no engine integration, production activation or new dependency.

### E8-B — Deterministic MusicXML + Source-map Projection — COMPLETE
Implemented:
- engine-safe MusicXML and source map are created in the same deterministic canonical traversal;
- exactly one part and one/two staves admitted initially;
- external source IDs use `P1:measure:<measureIndex>:note:<sourceOrder>`;
- source order increments only for emitted MusicXML `<note>` elements;
- canonical notes/chord tones map to canonical `note` addresses and rests to canonical `event` addresses;
- exact canonical pitch/timing and tie source facts are preserved;
- deterministic multi-voice/staff `backup` / `forward` cursor operations;
- unsupported engine notation omitted without changing canonical state;
- unsupported/stale source structures fail closed;
- no external engine invocation.

### E8-C — Read-only CanonicalTabResult Evidence — CURRENT
Implemented:
- bounded JSON-string ingestion only;
- exact `CanonicalTabResult 2.0.0` document/source/guitar/policy contract identities;
- no caller-supplied projection object is trusted;
- current E8-B projection is re-derived internally before acceptance;
- result measure/event source facts must match current canonical pitch, timing, voice/staff, tie, chord and source-order facts;
- exact simultaneous-group count/order/membership;
- exact arrangement-decision source coverage/order;
- exact note-disposition source order and decision consistency;
- selected string/fret must round-trip to target MIDI under the admitted six-string tuning;
- exact required selected-shape coverage plus finger/barre/playability invariants;
- output is immutable, read-only, derivative Guitar Workspace evidence;
- teacher review state is evidence only and grants no mutation authority;
- no direct external-engine invocation, production activation, persistence or public write authority.

### E8-D — Host Invocation Boundary — HUMAN-GATED / NOT AUTHORIZED
The next architectural question is how a product host may invoke `musicxml-to-guitar-tab-engine` and return a bounded `CanonicalTabResult 2.0.0` artifact to E8-C.

Before implementation, freeze:
- local package vs service/process boundary;
- exact engine version/provenance pin;
- timeout/cancellation/resource-budget ownership;
- maximum request/result sizes;
- no implicit network authority inside core;
- no raw engine object graph crossing into E8-C;
- canonical revision changed while engine runs → result rejected/recomputed;
- errors remain typed/non-authoritative;
- no production activation by repository merge.

`directExternalEngineInvocation` remains an explicit human gate and is currently unauthorized.

### Later E8 work — SEPARATELY BOUNDED
Possible later work may include:
- Guitar Workspace view models;
- fingering/shape/barre inspector UX;
- explicit proposal requests that may enter ordinary canonical editor intents without bypassing E4/E7-E1.

Any change to ScoreMosaic vs Guitar TAB authority ownership remains human-gated by `DEVELOPMENT_GOVERNANCE.md`.

## Stage E9 — Music Intelligence Overlays

Typed advisory Harmony/Fingering/Orchestration analysis overlays. AI remains non-authoritative.

## Development rule

Every stage preserves the E0 authority baseline. A green repository/CI state never implies public deployment, production activation, user-data ingestion, public write APIs, live AI edit authority or external-engine invocation authority.
