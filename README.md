# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for ST score products.

## Current reality

The repository now implements the bounded SEC-NE authoring line through **SEC-NE-06**.

- **SEC-NE-01/02:** exact selected-rest note entry and unified history/session composition.
- **SEC-NE-03:** revision-bound canonical `InsertionPosition`.
- **SEC-NE-04A/04C:** exact timing veto and explicit-rest position note entry.
- **SEC-NE-04B1/04B2:** MusicXML measure evidence and proven normal-measure implicit-gap rest materialization.
- **SEC-NE-05:** fail-closed canonical onset movement plus atomic current 3:2 triplet retiming.
- **SEC-NE-06:** bounded measure/voice structural authoring and relation-safe identity-fresh voice copy/paste.

## SEC-NE-06 structural authority

`editor-structural-authoring/1.0.0` admits:

- `ADD_MEASURE_AFTER` — inserts one fresh measure with one fresh empty initial voice and deterministic ordinal normalization;
- `REMOVE_EMPTY_MEASURE` — only when the staff keeps another measure, every contained voice is empty, and no measure notation would be orphaned;
- `ADD_EMPTY_VOICE` — appends one fresh empty voice;
- `REMOVE_EMPTY_VOICE` — only when the voice is empty and its measure keeps another voice.

All canonical IDs must be globally fresh. Structural changes create one direct child revision and same-revision notation must rebind successfully or the operation rejects.

Measure-level time/key/clef/barline authoring already exists through `notation-commands` and remains the notation authority; SEC-NE-06 does not duplicate that state in `ScoreDocument`.

`editor-copy-paste/1.0.0` admits `COPY_VOICE_TO_EMPTY_VOICE` for relation-free source content only. Every copied event and note receives an explicit fresh identity. Onset, duration, pitch and safe accidental/dot notation are preserved. Beam/tuplet/tie/slur-coupled source material rejects instead of being ambiguously cloned. The target must be empty and the pasted voice must independently pass SEC-NE-04A timing validation.

MusicXML-derived paste requires current safe 04B1 target-measure evidence and rejects pickup/incomplete, non-controlling and unknown-meter targets.

## Deliberately unadmitted structural topology

Adding/removing whole staffs or parts is **not** inferred from the existing schema. Cross-staff correspondence, measure alignment and part-level notation ownership need a separately frozen topology contract before those operations can become canonical authority.

## Next stages

- **SEC-NE-07:** advanced authoring that is representable by current canonical/notation contracts; schema-expanding features remain human-gated.
- **SEC-NE-XML-ROUNDTRIP:** golden preservation/equivalence hardening.
- **SEC-NE-08:** guitar/TAB authoring composition.
- **SEC-NE-09:** SesliTab product integration.

## Canonical authority

`ScoreDocument` remains the single musical edit authority. MusicXML and sidecar evidence are revision-bound inputs, renderers are presentation-only, SesliTab is host/orchestration only, and Guitar/OMR results are derivative or advisory unless separately admitted.

No repository merge activates production/public-write authority.

## Dependencies

Runtime remains only `saxes@6.0.0` and `xmlchars@2.2.0`; build-only remains `typescript@6.0.3` and `esbuild@0.28.2`. SEC-NE-06 adds no third-party dependency.

## Documentation

See `ARCHITECTURE.md`, `ROADMAP.md`, `SAFETY.md`, `docs/sibelius-editor-expansion-plan.md`, `docs/score-authoring-capability-matrix.json`, `docs/musicxml-roundtrip-policy.md`, `docs/insertion-and-timing-authority.md` and `docs/seslitab-editor-integration-contract.md`.
