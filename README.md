# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for ST score products.

## Current reality

The repository has three distinct capability lines:

1. **Core E0–E8-C** — canonical score model, bounded MusicXML import/export, semantic addressing, atomic edits/history, notation sidecar, renderer/browser contracts and read-only Guitar Workspace evidence.
2. **SEC-SMUFL-KEYPAD-01** — existing-score correction keypad, complete through SEC-KP-10; general onset retiming remains intentionally absent.
3. **SEC-NE Sibelius-style authoring expansion** — complete through SEC-NE-04A, 04C, 04B1 and the bounded 04B2 implicit-gap materialization stage.

### SEC-NE current state

- **SEC-NE-01 — COMPLETE / MERGED:** exact selected-rest note entry.
- **SEC-NE-02 — COMPLETE / MERGED:** selected-rest entry through unified history/session/browser composition.
- **SEC-NE-03 — COMPLETE / MERGED:** revision-bound canonical `InsertionPosition`.
- **SEC-NE-04A — COMPLETE / MERGED:** exact measure timing/target-voice occupancy and explicit-rest admission.
- **SEC-NE-04C — COMPLETE / MERGED:** low-level explicit-rest position note-entry primitive.
- **SEC-NE-04B1 — COMPLETE / MERGED:** revision-bound MusicXML measure/time evidence.
- **SEC-NE-04B2 — COMPLETE IN THIS PR:** conservative legal implicit-silence assessment and deterministic full-gap explicit-rest materialization.

04B2 does **not** treat an empty-looking span as immediately writable. Materialization is admitted only when:

- the requested window is already classified by 04A as one target-voice `IMPLICIT_GAP_UNADMITTED` span;
- current 04B1 evidence exists for the exact canonical measure/staff;
- 04B1 effective meter equals 04A timing meter;
- the source measure is not `implicit="yes"`;
- the source measure is not `non-controlling="yes"`;
- the requested window lies fully inside one exact target-voice implicit gap.

When admitted, the **entire containing gap** becomes one fresh canonical rest. Existing event IDs and onsets are unchanged. Another gap in the same voice is not materialized accidentally.

04B2 remains low-level and adds no second browser/session cursor-write API. After same-revision notation rebinding, the new rest is an ordinary `EXPLICIT_REST_SLOT`, so existing explicit-rest authoring authority can be composed on top without renderer or host inference.

### Next stages

- **SEC-NE-05:** canonical onset movement/retiming.
- **SEC-NE-06:** structural authoring.
- **SEC-NE-07:** advanced note/notation authoring.
- **SEC-NE-XML-ROUNDTRIP:** broader golden preservation/equivalence hardening.
- **SEC-NE-08:** guitar/TAB authoring composition.
- **SEC-NE-09:** SesliTab product integration.

The repository still does **not** support arbitrary note dragging/retiming, automatic voice creation, pickup/non-controlling implicit-gap authoring, or renderer-coordinate gap authority.

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
04A timing + 04B1 measure evidence
        ↓
typed bounded authoring primitive
        ↓
atomic validated child revision
        ↓
unified score+notation history
        ↓
RenderRequest + opaque manifest
        ↓
ST Score Rendering Layer / product UI
```

`ScoreDocument` is the single musical edit authority. MusicXML, measure evidence, renderer objects, SVG/DOM state, coordinates, glyphs, OMR/AI output and Guitar Workspace results are non-authoritative by themselves.

## MusicXML measure-semantics boundary

Legacy `importMusicXml` remains the narrow E2 score-only profile and rejects newly meaningful measure/time semantics rather than silently dropping them.

`importMusicXmlWithMeasureSemantics` returns same-revision score, notation and `MusicXmlMeasureSemanticsDocument`, preserving the admitted simple time-signature chain, `implicit`, `non-controlling`, exact `backup`/`forward` cursor evidence and source measure provenance.

Short measure length alone is never pickup proof. `.mxl` remains unadmitted.

## Insertion and implicit-gap safety

`editor-measure-timing` remains the first timing veto. Its base classifications remain unchanged. 04B2 does not weaken `IMPLICIT_GAP_UNADMITTED`; instead a separate `editor-implicit-gap-materialization` primitive may convert one specifically proven normal-measure gap into an explicit rest.

Pickup/implicit and non-controlling/multimetric measures remain fail-closed in the first 04B2 profile.

## Renderer, host and Guitar boundaries

Renderers are presentation-only. SesliTab is a host/orchestrator and may not dual-write score state. Guitar fingering/voicing remains derivative unless separately admitted. Direct external Guitar TAB engine invocation remains human-gated.

## Dependencies

Runtime:

- `saxes@6.0.0`
- `xmlchars@2.2.0`

Build-only:

- `typescript@6.0.3`
- `esbuild@0.28.2`

SEC-NE-01/02/03/04A/04C/04B1/04B2 add no third-party dependency.

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
