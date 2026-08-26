# ST Score Editor Core

Security-first shared semantic score-editing core for ScoreMosaic and MusicXML-to-Guitar-TAB-Engine.

## Current status

- **Stage E0 — Architecture & Safety Foundation: MERGED / main CI verified**
- **Stage E1 — Canonical ScoreDocument Model: implementation under review**

E1 defines the renderer-neutral `ScoreDocument 1.0.0` hierarchy:

```text
ScoreDocument
  -> Part
  -> Staff
  -> Measure
  -> Voice
  -> Event
       ├─ Note
       ├─ Rest
       └─ Chord
```

The model uses stable entity IDs, exact source SHA-256 identity, canonical rational onset/duration, strict field admission, global duplicate-ID rejection, sibling ordinal checks, ordered voice events, detached immutable snapshots, and fail-closed runtime validation.

This repository remains renderer-independent and product-independent. It owns score-domain identities, bounded edit contracts, validation boundaries, revision semantics, and stable adapters. It does **not** grant authority to browsers, renderers, OMR/AI output, or downstream guitar services.

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

## Dependencies

Runtime dependencies: **none**.

Stage E1 admits only exact `typescript@6.0.3` as a build/dev dependency. Renderer candidates remain unadmitted. See `DEPENDENCIES.md`.

See `ARCHITECTURE.md`, `SAFETY.md`, `ROADMAP.md`, `DEVELOPMENT_GOVERNANCE.md`, and `contracts/`.
