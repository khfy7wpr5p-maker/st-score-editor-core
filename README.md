# ST Score Editor Core

Security-first shared semantic score-editing core for ScoreMosaic and MusicXML-to-Guitar-TAB-Engine.

## Current status

- **E0 — Architecture & Safety Foundation: MERGED**
- **E1 — Canonical ScoreDocument Model: MERGED**
- **E2 — Safe MusicXML Import & Semantic Round Trip: MERGED**
- **E3 — Stable Semantic Addressing & Selection: MERGED**
- **E4 — Atomic Edit Transactions & Undo/Redo: MERGED**
- **E5 — Canonical Notation Structure: MERGED**
- **E6 — Presentation-only Renderer Adapters: implementation under review**

The renderer-neutral canonical hierarchy remains:

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

A revision-bound notation sidecar adds the current authoring/export structures without making renderer state authoritative:

```text
Measure: time signature · key signature · clef · barline/repeat
Event:   dots · beams · tuplets
Note:    accidental display · ties · slurs
```

## Architecture

```text
Untrusted MusicXML
        ↓
Bounded single-pass XML safety boundary
        ↓
Canonical ScoreDocument
        ↓
Revision + ancestry bound semantic addresses
        ↓
Typed atomic edit transaction
        ↓
Canonical validation
        ↓
Immutable revision history / undo / redo
        ↓
Notation sidecar
        ↓
Canonical MusicXML export
        ↓
Revision-bound RenderRequest + opaque hit manifest
        ↓
Presentation-only host adapter
   ├─ OSMD 2.1.1 target → ScoreMosaic
   └─ alphaTab 1.8.4 target → Guitar TAB workspace
```

Renderer packages are deliberately **not installed into the core repository**. The product host supplies the exact admitted renderer version and the adapter verifies its package/version/license profile. This keeps renderer dependency trees at the product boundary and prevents renderer/browser state from becoming score authority.

## Product boundaries

```text
ST Score Editor Core
   ├─ ScoreMosaic Teacher Review / Score Editor
   └─ Guitar TAB Workspace

Analysis adapters remain advisory-only:
   ├─ Harmonic AI
   ├─ Fingering AI
   └─ Orchestration AI
```

## Non-negotiable rules

1. Source bytes and source identity are immutable.
2. Renderer glyphs, coordinates, DOM/SVG state, and browser selection are never musical authority.
3. Edits target stable semantic identities and use typed, bounded commands.
4. Every accepted edit is validated before authoritative serialization.
5. Multi-command edits are atomic; failure never returns a partially authoritative document.
6. Undo/redo operate on immutable revision snapshots and explicit lineage.
7. AI/OMR output is evidence only and cannot directly mutate authoritative score state.
8. ScoreMosaic authority and Guitar TAB derivative authority remain separate.
9. Unsupported or ambiguous operations fail closed.
10. Third-party renderer integration requires exact version, license and provenance review.
11. Renderer hit tokens are checked against a manifest re-derived from the current canonical revision; a browser cannot remap them to another valid score entity.
12. Production integration is separately gated; repository implementation does not imply activation.

## Dependencies and integration targets

Installed runtime dependencies remain intentionally narrow:

- `saxes@6.0.0` — XML parser only, ISC
- `xmlchars@2.2.0` — exact support pin, MIT

Build-only:

- `typescript@6.0.3` — exact pin, Apache-2.0

E6 host integration targets:

- `opensheetmusicdisplay@2.1.1` — BSD-3-Clause — host-injected, not a core dependency
- `@coderline/alphatab@1.8.4` — MPL-2.0 — host-injected, not a core dependency

Verovio remains unadmitted. AI/model, UI framework, network service and production activation dependencies are not admitted through E6.

See `DEPENDENCIES.md`, `ARCHITECTURE.md`, `SAFETY.md`, `ROADMAP.md`, `DEVELOPMENT_GOVERNANCE.md`, and `contracts/`.
