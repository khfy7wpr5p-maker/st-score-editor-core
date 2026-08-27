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

### E7-F — Undo/Redo, Accessibility and UX Safety — CURRENT FINAL AUTONOMOUS GATE
Scope:
- unified score+notation history;
- fail-closed notation rebinding after score edits;
- selection invalidation on revision navigation;
- typed keyboard/accessibility requests;
- accessible status announcements;
- presentation-only dirty/persisted indicator;
- immutable session controller composing render → select → inspect → edit → history → re-render.

### E7-G — ScoreMosaic Product Integration — HUMAN GATE / NOT AUTHORIZED
Future scope may include product-specific layout, Teacher Review composition, OMR/source comparison and approval UX. This stage must not begin from E7-F completion alone.

## Later stages

### E8 — Guitar Workspace Adapter
String/fret/fingering/voicing derivative state and Guitar TAB Engine integration without upstream authority leakage.

### E9 — Music Intelligence Overlays
Typed advisory Harmony/Fingering/Orchestration analysis overlays. AI remains non-authoritative.

## Development rule

Every stage preserves the E0 authority baseline. A green repository/CI state never implies public deployment, production activation, user-data ingestion, public write APIs or live AI edit authority.
