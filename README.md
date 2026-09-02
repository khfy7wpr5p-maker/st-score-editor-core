# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for ST score products.

## Current reality

The repository has three distinct capability lines:

1. **Core E0–E8-C** — canonical score model, bounded MusicXML import/export, semantic addressing, atomic edits/history, notation sidecar, renderer/browser contracts and read-only Guitar Workspace evidence.
2. **SEC-SMUFL-KEYPAD-01** — existing-score correction keypad, complete through SEC-KP-10.
3. **SEC-NE Sibelius-style authoring expansion** — complete through SEC-NE-05 for bounded score authoring and fail-closed retiming.

### SEC-NE completed state

- **SEC-NE-01 — COMPLETE / MERGED:** exact selected-rest note entry.
- **SEC-NE-02 — COMPLETE / MERGED:** selected-rest entry through unified history/session/browser composition.
- **SEC-NE-03 — COMPLETE / MERGED:** revision-bound canonical `InsertionPosition`.
- **SEC-NE-04A — COMPLETE / MERGED:** exact measure timing/target-voice occupancy and explicit-rest admission.
- **SEC-NE-04C — COMPLETE / MERGED:** low-level explicit-rest position note-entry primitive.
- **SEC-NE-04B1 — COMPLETE / MERGED:** revision-bound MusicXML measure/time evidence.
- **SEC-NE-04B2 — COMPLETE / MERGED:** conservative legal implicit-silence assessment and deterministic full-gap explicit-rest materialization.
- **SEC-NE-05 — COMPLETE / MERGED:** bounded canonical event onset movement plus atomic retiming of the already-supported exact 3:2 three-event triplet profile.

### SEC-NE-05 retiming boundary

`editor-event-retiming` admits `MOVE_EVENT/1.0.0` only for a current event inside its existing measure/voice. The target keeps its event/note identities, duration and pitch; only onset changes. The result is independently rechecked by SEC-NE-04A timing/occupancy validation.

Single-event movement fails closed when the target carries beam/tuplet/tie/slur coupling, or when the move crosses another event carrying such relation-sensitive notation. This prevents event-order changes from silently corrupting notation relationships.

`editor-triplet-retiming` separately admits one atomic current **3:2 three-event triplet** range. All three events move as one revision and preserve their current triplet notation. The profile requires three consecutive equal-duration contiguous events with exact start/middle/stop tuplet evidence. Beam or tie/slur coupling remains unsupported in this v1 group-retiming profile.

For MusicXML-derived scores, retiming requires current SEC-NE-04B1 evidence for the exact measure. Pickup/incomplete (`implicit="yes"`), non-controlling and unknown-meter measures remain fail-closed.

### Next stages

- **SEC-NE-06:** structural authoring.
- **SEC-NE-07:** advanced note/notation authoring.
- **SEC-NE-XML-ROUNDTRIP:** broader golden preservation/equivalence hardening.
- **SEC-NE-08:** guitar/TAB authoring composition.
- **SEC-NE-09:** SesliTab product integration.

The repository still does **not** authorize cross-measure drag, independent movement of relation-coupled events, automatic voice creation, pickup/non-controlling implicit-gap authoring, or renderer-coordinate edit authority.

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
typed bounded authoring / retiming primitive
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

## Insertion and retiming safety

`editor-measure-timing` remains the independent timing veto for both insertion and retiming. 04B2 may convert one specifically proven normal-measure implicit gap into an explicit rest. 05 may move admitted canonical events only if the final whole voice remains non-overlapping and inside the active measure span.

Relation coupling is never guessed from renderer geometry or nearest-neighbor order. Unsupported relation-coupled retiming rejects instead of degrading notation.

## Renderer, host and Guitar boundaries

Renderers are presentation-only. SesliTab is a host/orchestrator and may not dual-write score state. Guitar fingering/voicing remains derivative unless separately admitted. Direct external Guitar TAB engine invocation remains human-gated.

## Dependencies

Runtime:

- `saxes@6.0.0`
- `xmlchars@2.2.0`

Build-only:

- `typescript@6.0.3`
- `esbuild@0.28.2`

SEC-NE through 05 adds no third-party dependency.

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
