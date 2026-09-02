# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for ST score products.

## Current reality

The repository has three distinct capability lines:

1. **Core E0–E8-C** — canonical score model, bounded MusicXML import/export, semantic addressing, atomic edits/history, notation sidecar, renderer/browser contracts and read-only Guitar Workspace evidence.
2. **SEC-SMUFL-KEYPAD-01** — existing-score correction keypad, complete through SEC-KP-10 with general onset-retiming intentionally absent.
3. **SEC-NE Sibelius-style authoring expansion** — complete through SEC-NE-04A, SEC-NE-04C and SEC-NE-04B1.

### SEC-NE merged state

- **SEC-NE-01 — COMPLETE / MERGED:** exact selected-rest note entry.
- **SEC-NE-02 — COMPLETE / MERGED:** selected-rest entry through unified history/session/browser composition.
- **SEC-NE-03 — COMPLETE / MERGED:** revision-bound canonical `InsertionPosition`.
- **SEC-NE-04A — COMPLETE / MERGED:** exact measure timing/occupancy and explicit-rest-only admission.
- **SEC-NE-04C — COMPLETE / MERGED:** low-level explicit-rest position note-entry primitive.
- **SEC-NE-04B1 — COMPLETE / MERGED:** additive revision-bound MusicXML measure-semantics evidence for admitted simple time signatures, inheritance/change, `implicit`, `non-controlling`, and exact `backup`/`forward` cursor evidence.

04C remains a low-level primitive; no parallel cursor-position browser/session mutation path exists. 04B1 is evidence-only and does **not** make implicit gaps writable.

### Next stages

- **SEC-NE-04B2:** prove legal per-voice implicit silence and deterministically materialize explicit rests.
- **SEC-NE-05:** canonical onset movement/retiming.
- **SEC-NE-06:** structural authoring.
- **SEC-NE-07:** advanced note/notation authoring.
- **SEC-NE-08:** guitar/TAB authoring composition.
- **SEC-NE-09:** SesliTab product integration.

The repository still does **not** support unrestricted free insertion, arbitrary note dragging/retiming, automatic voice creation, or renderer-coordinate gap authoring.

## Canonical authority

```text
MusicXML / OMR evidence
        ↓
safe import adapters
        ↓
Canonical ScoreDocument + revision-bound notation/evidence
        ↓
SemanticAddress / Selection / InsertionPosition
        ↓
measure timing + typed edit/authoring intent
        ↓
atomic validated revision
        ↓
unified score+notation history
        ↓
RenderRequest + opaque manifest
        ↓
ST Score Rendering Layer / product UI
```

`ScoreDocument` is the single musical edit authority. MusicXML, renderer objects, SVG/DOM state, coordinates, glyphs, OMR/AI output and Guitar Workspace results are non-authoritative.

## MusicXML measure-semantics boundary

Legacy `importMusicXml` remains the narrow E2 score-only importer and continues to reject newly admitted measure/time semantics rather than silently dropping them.

SEC-NE-04B1 adds `importMusicXmlWithMeasureSemantics`, which returns:

- canonical `ScoreDocument`;
- same-revision `NotationDocument` containing admitted declared time-signature notation;
- same-revision `MusicXmlMeasureSemanticsDocument` containing source-bound measure evidence.

The additive evidence preserves admitted simple time declarations/inheritance/change, MusicXML `implicit` and `non-controlling` attributes independently, and exact `backup`/`forward` cursor operations. Short measures are never inferred to be pickups.

Unsupported/ambiguous time forms remain fail-closed. `.mxl` is not admitted.

## Insertion safety

`editor-measure-timing` remains the authoring admission authority. Current classes are:

- `EXPLICIT_REST_SLOT` — authoring-safe;
- `BLOCKED_PITCHED` — rejected;
- `OUTSIDE_MEASURE` — rejected;
- `IMPLICIT_GAP_UNADMITTED` — rejected;
- `MIXED_UNADMITTED` — rejected.

SEC-NE-04B1 adds evidence, not write authority. Implicit-gap authoring remains blocked until SEC-NE-04B2.

## Renderer, host and Guitar boundaries

Renderers are presentation-only. SesliTab is a host/orchestrator and may not dual-write score state. Guitar fingering/voicing remains derivative unless separately admitted. Direct external Guitar TAB engine invocation remains human-gated.

## Dependencies

Runtime:

- `saxes@6.0.0`
- `xmlchars@2.2.0`

Build-only:

- `typescript@6.0.3`
- `esbuild@0.28.2`

SEC-NE-01/02/03/04A/04C/04B1 add no third-party dependency.

## Documentation

- `ARCHITECTURE.md`
- `ROADMAP.md`
- `SAFETY.md`
- `DEVELOPMENT_GOVERNANCE.md`
- `DEPENDENCIES.md`
- `docs/sibelius-editor-expansion-plan.md`
- `docs/editor-ui-authority-contract.md`
- `docs/insertion-and-timing-authority.md`
- `docs/musicxml-roundtrip-policy.md`
- `docs/score-authoring-capability-matrix.json`
- `docs/seslitab-editor-integration-contract.md`
