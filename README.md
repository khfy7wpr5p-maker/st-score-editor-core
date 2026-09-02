# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for ST score products.

## Current reality

The repository currently contains three distinct capability lines that must not be conflated:

1. **Core architecture E0–E8-C** — canonical score model, safe MusicXML subset, semantic addressing, atomic edits/history, notation sidecar, renderer/browser contracts and read-only Guitar Workspace evidence.
2. **SEC-SMUFL-KEYPAD-01** — existing-score correction keypad, complete through SEC-KP-10 with one explicit onset-retiming limitation.
3. **SEC-NE Sibelius-style note-entry expansion** — complete through SEC-NE-04A and SEC-NE-04C for bounded explicit-rest authoring only.

### SEC-NE merged state

- **SEC-NE-01 — COMPLETE / MERGED:** an exact selected rest can be replaced by a note; a shorter note may create a trailing rest atomically.
- **SEC-NE-02 — COMPLETE / MERGED:** selected-rest note entry is composed through unified score+notation history, RenderRequest regeneration and the bounded browser runtime.
- **SEC-NE-03 — COMPLETE / MERGED:** canonical `InsertionPosition` is revision-bound semantic state, never an SVG/DOM coordinate.
- **SEC-NE-04A — COMPLETE / MERGED:** exact measure timing/occupancy analysis, overlap/overflow rejection and explicit-rest-only insertion admission.
- **SEC-NE-04C — COMPLETE / MERGED:** low-level position note-entry primitive for a window fully contained inside one explicit rest. It may produce leading rest + note + trailing rest and composes safely with unified history and revision-bound rendering.

SEC-NE-04C intentionally remains a low-level primitive. The existing SEC-NE-02 selected-rest browser/session surface remains the public bounded note-entry path; no second cursor-entry browser/session API was introduced by 04C.

### Not started yet

- **SEC-NE-04B1:** MusicXML time/pickup/incomplete-measure evidence.
- **SEC-NE-04B2:** deterministic materialization/admission of proven legal implicit silence.
- **SEC-NE-05:** canonical onset movement/retiming.
- **SEC-NE-06:** structural authoring.
- **SEC-NE-07:** advanced note entry/notation authoring.
- **SEC-NE-08:** guitar/TAB authoring composition.
- **SEC-NE-09:** SesliTab product integration.

Therefore this repository does **not** yet support unrestricted free insertion, arbitrary note dragging/retiming, automatic voice creation, general triplet creation/removal, or renderer-coordinate gap authoring.

## Canonical authority

```text
MusicXML / OMR evidence
        ↓
safe import adapters
        ↓
Canonical ScoreDocument
        ↓
SemanticAddress / Selection / InsertionPosition
        ↓
Measure timing + typed edit/authoring intent
        ↓
atomic validated revision
        ↓
unified score+notation history
        ↓
RenderRequest + opaque manifest
        ↓
ST Score Rendering Layer / product UI
```

Non-negotiable rules:

- `ScoreDocument` is the single musical edit authority.
- MusicXML is exchange/projection data, not live editor state.
- SVG/DOM/VexFlow/OSMD/alphaTab object graphs and screen coordinates are not canonical identity.
- Every mutation validates the current revision and fails closed on stale/ambiguous input.
- Score and notation changes are composed through one revision history when exposed as editor operations.
- Renderer resize/reflow/mobile DOM changes may not change semantic identity.
- Guitar fingering/voicing and OMR/AI output remain derivative/advisory unless separately admitted.
- Original source bytes and source identity remain immutable.

## Measure timing and note-entry safety

`editor-measure-timing` resolves the effective time signature by inheritance and derives exact rational measure/voice occupancy. It rejects overlap and measure overflow.

Current position-entry admission classes include:

- `EXPLICIT_REST_SLOT` — the only authoring-safe class today;
- `BLOCKED_PITCHED`;
- `OUTSIDE_MEASURE`;
- `IMPLICIT_GAP_UNADMITTED`;
- `MIXED_UNADMITTED`.

An apparent empty span between events is **not** writable merely because it looks empty. Pickup/incomplete-measure semantics are not yet sufficient canonical authoring evidence; SEC-NE-04B1/04B2 must be completed first.

## Correction keypad

The keypad remains an **existing-score correction** surface. Implemented groups include duration/rest correction, accidentals, augmentation dots, bounded explicit 3:2 tuplet metadata, explicit tie/slur endpoints, selection continuity and browser keypad exposure.

The canonical command set still lacks general onset mutation. Therefore ordinary spacing is not silently retimed into a triplet and removal/transformation that requires retiming remains fail-closed until SEC-NE-05.

## MusicXML boundary

The base importer intentionally supports a bounded subset. Unsupported musical semantics must be rejected or explicitly preserved; they must not be silently discarded when doing so would change musical meaning.

Canonical E2 import/serialize/re-import semantic round-trip remains tested for the admitted subset. Advanced notation import remains intentionally fail-closed where unsupported.

Current explicit limit relevant to authoring: time/pickup/incomplete-measure evidence required for legal implicit-gap authoring is not yet admitted through SEC-NE-04B1.

## Renderer and browser boundary

Renderer packages are presentation-only and are not canonical score authority. Product hosts currently target admitted OSMD/alphaTab profiles; Editor Core owns semantic identities and revision-bound opaque hit manifests.

The browser runtime is non-networked and non-persistent inside core. It does not own server revision, approval, publication or production authority.

## Guitar Workspace boundary

E8-B emits deterministic engine-safe MusicXML and a current canonical source map. E8-C accepts only bounded host/test-supplied `CanonicalTabResult 2.0.0` evidence and revalidates it against the current canonical revision.

The external Guitar TAB engine is not invoked by this repository. Direct invocation remains human-gated.

## Installed dependencies

Runtime:

- `saxes@6.0.0` — ISC — bounded XML parsing only.
- `xmlchars@2.2.0` — MIT — parser support dependency.

Build-only:

- `typescript@6.0.3` — Apache-2.0.
- `esbuild@0.28.2` — MIT — browser bundling only.

SEC-NE-01/02/03/04A/04C add no third-party dependency. Smoosic, MuseScore, TuxGuitar, VexFlow and similar projects are reference-only unless a separate dependency/license gate explicitly admits them.

## Where to read next

- `ARCHITECTURE.md` — authority map and current package flow.
- `ROADMAP.md` — merged/in-progress/not-started stage truth.
- `SAFETY.md` — fail-closed and source-immutability rules.
- `DEVELOPMENT_GOVERNANCE.md` — autonomous vs human-gated change classes.
- `DEPENDENCIES.md` — exact dependency/renderer reference register.
- `docs/sibelius-editor-expansion-plan.md` — SEC-NE authoring sequence.
- `docs/editor-ui-authority-contract.md` — pointer/keyboard/mobile UI authority boundary.
- `docs/insertion-and-timing-authority.md` — insertion/timing admission rules.
- `docs/musicxml-roundtrip-policy.md` — preservation/loss policy.
- `docs/score-authoring-capability-matrix.json` — machine-readable capability truth.
- `docs/seslitab-editor-integration-contract.md` — host integration boundary.
