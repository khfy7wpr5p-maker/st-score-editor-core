# ST Score Editor Core

Security-first shared semantic score-editing core for ScoreMosaic and MusicXML-to-Guitar-TAB-Engine.

## Current status

**Stage E0 — Architecture & Safety Foundation: implementation in progress**

This repository is deliberately renderer-independent and product-independent. It owns score-domain identities, bounded edit contracts, validation boundaries, revision semantics, and stable adapters. It does **not** grant authority to browsers, renderers, OMR/AI output, or downstream guitar services.

## Planned architecture

```text
MusicXML / approved symbolic input
        ↓
Safe import boundary
        ↓
ST Score Document Model
        ↓
Stable semantic addressing
        ↓
Bounded edit commands
        ↓
Validation + transaction/revision boundary
        ↓
MusicXML serialization / typed downstream state
        ↓
Renderer adapters (presentation only)
   ├─ OSMD-class score renderer
   └─ alphaTab-class guitar/TAB renderer
```

Product adapters are separate:

```text
ST Score Editor Core
   ├─ ScoreMosaic Teacher Review / Score Editor
   └─ Guitar TAB Workspace

Analysis adapters are advisory-only:
   ├─ Harmonic AI
   ├─ Fingering AI
   └─ Orchestration AI
```

## Non-negotiable rules

1. Source bytes and source identity are immutable.
2. Renderer glyphs, coordinates, DOM/SVG state, and browser selection are never musical authority.
3. Edits target stable semantic identities and use typed, bounded commands.
4. Every accepted edit is validated before authoritative serialization.
5. Undo/redo and revision history operate on explicit transactions, not renderer state.
6. AI/OMR output is evidence only and cannot directly mutate authoritative score state.
7. ScoreMosaic authority and Guitar TAB derivative authority remain separate.
8. Unsupported or ambiguous operations fail closed.
9. No third-party renderer or model is added before license, provenance, version, and compatibility review.
10. Production integration is separately gated; repository implementation does not imply activation.

See `ARCHITECTURE.md`, `SAFETY.md`, `ROADMAP.md`, `DEVELOPMENT_GOVERNANCE.md`, and `contracts/`.
