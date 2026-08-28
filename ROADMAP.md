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

### E8-B — Deterministic MusicXML + Source-map Projection — CURRENT
Implemented:
- engine-safe MusicXML and source map are created in the same deterministic canonical traversal;
- exactly one part and one/two staves admitted initially;
- external source IDs use `P1:measure:<measureIndex>:note:<sourceOrder>`;
- source order increments only for emitted MusicXML `<note>` elements;
- canonical notes/chord tones map to canonical `note` addresses and rests to canonical `event` addresses;
- exact canonical pitch and timing are preserved;
- multi-voice/staff layout uses deterministic `backup` / `forward` cursor operations;
- tie start/stop source facts are preserved;
- engine-unsupported presentation notation is omitted without changing canonical state;
- multipart, staff 3+, stale notation, missing/conflicting meter, same-voice overlap and out-of-measure events fail closed;
- external engine invocation/result ingestion remains disabled.

### E8-C — Read-only CanonicalTabResult Ingestion — NEXT SAFE GATE
Planned scope:
- runtime-exact validation of the reviewed `CanonicalTabResult 2.0.0` surface needed by the workspace;
- require result provenance to match the E8-B projection/source map;
- map external note dispositions / selected string-fret positions back only to derivative canonical targets;
- reject unknown source IDs, stale revisions, impossible string/fret values and incompatible result contracts;
- create immutable read-only Guitar Workspace result state;
- still no direct canonical mutation or production authority.

### Later E8 work — SEPARATELY BOUNDED
Possible later work may include:
- fingering/shape/barre view models;
- Guitar TAB workspace review UX;
- typed proposal requests that can eventually enter ordinary canonical editor intents without bypassing E4/E7-E1.

Any change to ScoreMosaic vs Guitar TAB authority ownership remains human-gated by `DEVELOPMENT_GOVERNANCE.md`.

## Stage E9 — Music Intelligence Overlays

Typed advisory Harmony/Fingering/Orchestration analysis overlays. AI remains non-authoritative.

## Development rule

Every stage preserves the E0 authority baseline. A green repository/CI state never implies public deployment, production activation, user-data ingestion, public write APIs or live AI edit authority.
