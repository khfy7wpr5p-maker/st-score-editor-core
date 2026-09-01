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

## SEC-SMUFL-KEYPAD-01 — Sibelius-style correction keypad — IMPLEMENTED WITH ONE EXPLICIT LIMITATION

The editor-side keypad program is implemented through SEC-KP-10:

- **SEC-KP-00 — COMPLETE:** fresh-read semantic freeze and capability matrix.
- **SEC-KP-01 — COMPLETE:** framework-neutral keypad action manifest plus verified SMuFL glyph-name metadata; no font assets or raw guessed codepoints.
- **SEC-KP-02 — COMPLETE:** whole/half/quarter/eighth/16th/32nd duration and rest corrections through atomic unified revisions.
- **SEC-KP-03 — COMPLETE:** flat/natural/sharp corrections update canonical pitch alteration plus display accidental atomically.
- **SEC-KP-04 — COMPLETE:** dot counts 0..3 keep canonical effective duration and notation metadata consistent.
- **SEC-KP-05 — BOUNDED COMPLETE:** triplet metadata can be applied only to an explicit three-event range whose canonical timing already proves exact contiguous 3:2 timing. Ordinary event spacing is not silently retimed because E4 has no admitted onset-mutation primitive.
- **SEC-KP-06 — COMPLETE:** tie/slur correction uses explicit revision-bound note endpoints; nearest-note inference is forbidden.
- **SEC-KP-07 — COMPLETE:** repeated keypad edits safely rebind a surviving exact semantic target to the new revision; target loss clears selection; undo/redo still clears selection.
- **SEC-KP-08 — COMPLETE:** browser runtime exposes immutable keypad metadata and a typed bounded local commit surface without network/persistence/production authority.
- **SEC-KP-09 — COMPLETE (EDITOR SIDE):** editor-renderer selection bridge accepts only a current render-request identity plus opaque hit token; renderer coordinates, DOM/SVG ids, renderer objects and foreign semantic addresses are not edit authority.
- **SEC-KP-10 — COMPLETE:** regression matrix, accessibility invariants, architecture/docs synchronization and Rendering Layer JSON2 handoff requirements.

Remaining keypad limitation requiring a separately authorized architectural change:

- creating/removing tuplets when canonical onset/duration retiming is required remains fail-closed until an explicit onset-mutation primitive is admitted into the canonical transaction layer.

The host remains responsible for visual glyph rendering with an admitted SMuFL font such as Bravura. Editor Core does not bundle Bravura, CSS, VexFlow, Smoosic, renderer packages or production UI code.

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
