# ST Score Editor Core — Architecture

Status: **SEC-NE is implemented through the bounded SEC-NE-08 Guitar/TAB authoring companion. Current public score/notation schemas remain unchanged; Guitar Workspace state remains derivative-only.**

## Canonical authority

`ScoreDocument` is the single musical edit authority. `NotationDocument` owns same-revision notation semantics. MusicXML/evidence is exchange or bounded source evidence. Guitar Workspace projection/result state is revision-bound derivative evidence. Renderer/host state is noncanonical.

## Implemented authoring layers

- SEC-NE-01/02 — explicit-rest note entry and unified editor composition.
- SEC-NE-03 — revision-bound semantic insertion position.
- SEC-NE-04A/04C — exact timing veto and explicit-rest position entry.
- SEC-NE-04B1/04B2 — MusicXML measure semantics and proven gap materialization.
- SEC-NE-05 — relation-safe retiming and atomic current 3:2 triplet movement.
- SEC-NE-06 — bounded measure/voice structure and relation-free fresh-ID copy/paste.
- SEC-NE-07 — advanced current-schema authoring composition.
- SEC-NE-XML-ROUNDTRIP — bounded notation serializer-profile re-import.
- SEC-NE-08 — derivative Guitar/TAB authoring companion.

## Guitar/TAB composition

The existing E8-A/B/C boundary remains intact:

```text
ScoreDocument + NotationDocument
        ↓
Guitar Workspace projection + source map
        ↓
external result (outside Editor Core invocation authority)
        ↓
E8-C current-revision validation
        ↓
SEC-NE-08 derivative authoring companion
```

`createGuitarAuthoringCompanion` reuses E8-C validation and exposes only annotations tied to exact current note addresses: disposition, selected string/fret and validated finger/shape facts where present.

For a canonical edit, `executeCanonicalAuthoringWithGuitarInvalidation` first validates the current Guitar result, delegates the actual score mutation to existing Editor Core advanced authoring, and returns the new score/notation revision plus `REQUIRES_RECOMPUTE` for Guitar state. The old result cannot be promoted or rebound by approximation; its source facts must be recomputed/revalidated against the new canonical revision.

Teacher review does not alter authority. Guitar result state cannot call reverse canonical mutation, cannot infer pitch changes from selected positions, and cannot grant production authority.

## MusicXML

Legacy score-only, 04B1 measure-evidence and bounded notation-aware import surfaces remain distinct. The notation serializer profile has explicit semantic export/re-import coverage without making MusicXML live edit state.

## Public/human-gated boundaries

Grace notes, articulations, ornaments and whole staff/part topology remain outside the frozen public 1.0.0 contracts. E8-D direct external engine invocation and production/public-write activation remain separately human-gated.

## Remaining autonomous stage

- SEC-NE-09 — SesliTab integration around one canonical editor session without host dual-write.

## Dependencies / invariants

Runtime dependencies remain only `saxes@6.0.0` and `xmlchars@2.2.0`; build-only remains `typescript@6.0.3` and `esbuild@0.28.2`. Source immutability, revision binding, independent validation, derivative Guitar authority and no-production-by-merge remain active.
