# Roadmap

## Stage E0 — Architecture & Safety Foundation

Goal: freeze authority, trust boundaries, package boundaries, stage order and CI invariants before score mutation code exists.

Exit criteria:
- architecture/safety/governance docs present;
- machine-readable authority contract validates;
- no runtime third-party dependencies;
- CI checks repository contracts and tests;
- no production/runtime activation.

## Stage E1 — Canonical ScoreDocument Model

Scope: immutable document snapshots and typed Part/Staff/Measure/Voice/Event/Note/Rest/Chord primitives with deterministic identity validation.

Not included: MusicXML parsing, rendering, UI or AI.

## Stage E2 — Safe MusicXML Import + Semantic Round Trip

Scope: resource-bounded MusicXML subset, explicit unsupported-feature reporting, serializer and semantic equivalence tests.

## Stage E3 — Stable Addressing / Selection

Scope: stable semantic addresses, stale-selection rejection, source/revision correlation and renderer-neutral selection contract.

## Stage E4 — Basic Editing / Transactions

Scope: pitch, duration, add/remove note/rest, accidental, dot; atomic transactions; undo/redo; deterministic validation.

## Stage E5 — Notation Structure

Scope: ties, slurs, beams, tuplets, voices, time/key signatures, clefs and barlines with explicit contract evolution.

## Stage E6 — Renderer Adapters

Scope: presentation-only adapters, initially evaluated for OSMD-class classical score rendering and alphaTab-class notation/TAB rendering. Dependency admission requires separate license/version review.

## Stage E7 — Editor UI Composition

Scope: reusable UI primitives plus ScoreMosaic Teacher Review/Score Editor composition. UI cannot become musical authority.

## Stage E8 — Guitar Workspace Adapter

Scope: string/fret/fingering/voicing derivative state and Guitar TAB Engine integration without upstream authority leakage.

## Stage E9 — Music Intelligence Overlays

Scope: typed advisory Harmony/Fingering/Orchestration analysis overlays. AI remains non-authoritative.

## Development rule

Stages may be prepared in parallel only when they do not weaken an earlier gate. Public/production activation is never implied by stage completion.
