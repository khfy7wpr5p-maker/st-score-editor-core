# SES-87 — ST canonical validator/mapper implementation plan — 2026-09-29

## Goal

Implement Task 4 of P-MXML-REF-03 without widening the import/router/release scope.

The mapper consumes the versioned Partitura `NormalizedImportEnvelopeV1` plus the raw MusicXML preservation sidecar and returns either a fully validated `ScoreDocumentV3 + NotationDocumentV4` pair or an explicit fail-closed diagnostic result.

## Constraints

- Partitura output never becomes canonical authority directly.
- Reuse existing canonical validators and migrations instead of reimplementing their invariants.
- Use the same deterministic import identity scheme as the native MusicXML importer.
- Preserve sidecar evidence as noncanonical evidence only; do not promote raw string/fret/technical symbols in SES-87.
- Any normalized semantic that cannot be represented losslessly in the current canonical contracts fails closed.
- No active document/session/history mutation.
- No router integration in SES-87.
- No merge, deploy, release, cutover, or Render change.

## Implementation sequence

1. Add RED mapper tests covering:
   - deterministic canonical IDs;
   - canonical voice/timing rejection;
   - preserved-sidecar source matching and non-promotion;
   - unsupported semantics fail closed;
   - equivalent native/fallback fixture equality at the V3/V4 canonical layer.
2. Add a strict normalized-Partitura semantic validator.
3. Materialize a bounded V2 score/notation intermediate using native importer identity rules.
4. Validate through `createScoreDocumentV2` and `createNotationDocumentV2`.
5. Migrate through `migrateScoreNotationV2ToV3` and `migrateNotationV3ToV4`.
6. Return the V3/V4 pair only after all validators succeed; otherwise return diagnostics with no partial score.
7. Run focused mapper tests, retained import-contract/symbol-preservation tests, build/validate, then full CI.

## Deliberate fail-closed boundaries for SES-87

- Grace notes are rejected because the current normalized envelope does not carry enough anchor/placement information to construct canonical `GraceGroup` semantics safely.
- Non-empty Partitura fingering payload is rejected because fingering is not canonical score/notation authority and is owned by the later guitar/TAB bridge.
- Unknown upstream diagnostics, unsupported articulation/ornament values, mid-measure key/time/clef changes, invalid tie identity, and source-sidecar mismatches are rejected.
- Dots/beams/slurs/explicit accidental display are not invented from incomplete evidence.

## Verification gate

Completion requires fresh evidence for:
- Partitura cannot create invalid canonical timing/voice state.
- Unsupported meaning returns diagnostics and no partial canonical pair.
- Canonical IDs are deterministic.
- A supported fixture imported natively and through the fallback mapper compares equal at the canonical V3/V4 layer.
