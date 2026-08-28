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

### E7-A — UI Authority Contract — COMPLETE
UI/browser/DOM/renderer state frozen as non-authoritative.

### E7-B — Framework-neutral Editor Shell — COMPLETE
Toolbar, parts, score viewport, inspector and status view-model composition without a UI-framework dependency.

### E7-C — Secure Selection + Inspector — COMPLETE
Opaque renderer token → semantic selection → canonical read-only inspector.

### E7-D — Basic Score Editing Intents — COMPLETE
Runtime-validated pitch/duration/note-rest/chord-tone UI intents delegated exclusively to E4 transactions.

### E7-E1 — Atomic Notation Transactions — COMPLETE
Typed bounded notation mutations with a new unified score revision and notation rebinding.

### E7-E2 — Notation Editing Intents — COMPLETE
Runtime-validated notation palette/inspector intents with deterministic semantic target derivation only.

### E7-F — Undo/Redo, Accessibility and UX Safety — COMPLETE
Implemented:
- unified score+notation history;
- fail-closed notation rebinding after score edits;
- selection invalidation on revision navigation;
- typed keyboard/accessibility requests;
- accessible status announcements;
- presentation-only dirty/persisted indicator;
- immutable session controller composing render → select → inspect → edit → history → re-render.

### E7-G — ScoreMosaic Browser Host Runtime — COMPLETE
Repository-only ScoreMosaic integration and visual composition with no network, persistence, renderer, server-revision, approval, publication or production authority.

### E7-H — Browser-safe Runtime Bundle — COMPLETE
Implemented:
- deterministic IIFE browser artifact at `dist/browser/st-score-editor-core.runtime.js`;
- ES2022 target and frozen `STScoreEditorCoreRuntime` global;
- bundled admitted runtime dependencies with no external browser imports;
- exact build-only `esbuild@0.28.2` admission for browser bundling only;
- CI/contracts/tests that lock packaging and authority invariants.

## Stage E8 — Guitar Workspace Adapter

### E8-A — Guitar Workspace Authority Contract — CURRENT
Scope:
- guitar string/fret/fingering/voicing/reduction state is derivative only;
- external engine output has no canonical score mutation authority;
- revision-bound `GuitarWorkspaceSourceMap` maps engine source identities to canonical `event` / `note` semantic addresses;
- stale, duplicate, ambiguous or unsupported mappings fail closed;
- external reference is `CanonicalTabResult 2.0.0` from `musicxml-to-guitar-tab-engine`;
- no engine integration, production activation or new dependency is introduced.

### E8-B — Deterministic MusicXML + Source-map Projection — NEXT SAFE GATE
Planned scope:
- create engine-bound MusicXML and its source map in the same deterministic traversal;
- prove each emitted MusicXML `<note>` source order maps to exactly one canonical event/note identity;
- start with a narrow admitted Guitar Workspace source scope;
- fail closed on unsupported multipart/staff/notation semantics rather than guessing;
- still no reverse canonical write authority.

### Later E8 work — NOT AUTHORIZED BY E8-A ALONE
Possible later work may include:
- validated `CanonicalTabResult 2.0.0` result ingestion;
- derivative string/fret/fingering/shape view models;
- Guitar TAB workspace review UX;
- typed requests that can propose ordinary canonical editor intents without bypassing E4/E7-E1.

Any change to ScoreMosaic vs Guitar TAB authority ownership remains human-gated by `DEVELOPMENT_GOVERNANCE.md`.

## Stage E9 — Music Intelligence Overlays

Typed advisory Harmony/Fingering/Orchestration analysis overlays. AI remains non-authoritative.

## Development rule

Every stage preserves the E0 authority baseline. A green repository/CI state never implies public deployment, production activation, user-data ingestion, public write APIs or live AI edit authority.
