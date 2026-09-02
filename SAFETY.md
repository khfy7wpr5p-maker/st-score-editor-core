# Safety and Trust Boundaries

## Mandatory controls

The active versioned `ScoreDocument` remains canonical; source identity is immutable; all edit/notation/evidence targets are revision-bound; unsupported or ambiguous operations fail closed; independent timing validation remains a veto; renderer/host coordinates never become canonical; relation semantics may not be silently damaged; accepted edits create one child revision or none; production/public-write is never activated by merge.

## Current v2 schema safety

Grace notes, articulations and ornaments are no longer future hidden semantics: they are explicitly versioned in the approved and implemented `ScoreDocumentV2` / `NotationDocumentV2` 2.0.0 contracts.

SSE-00–07 preserve these controls:

- one canonical v2 score+notation pair per v2 session;
- same-document/same-revision notation;
- lossless-only downgrade to v1;
- bounded MusicXML v2 import/export;
- fail-closed renderer projection when a canonical pair is not representable;
- opaque revision-bound renderer tokens;
- no SesliTab host dual-write;
- playback admission remains separate from editor admission.

## SSE-08 topology design safety

SSE-08 freezes design only. The active runtime remains v2; no `ScoreDocumentV3` implementation or topology mutation authority is activated by this stage.

The frozen v3 target requires:

- document-global stable measure-frame identity instead of implicit first-staff alignment;
- explicit stable part ordinals and instrument identity;
- exact staff roles: `standard`, `percussion`, `tablature-linked`;
- linked TAB as derivative presentation only, with no independent canonical event/note stream;
- v3 notation ownership split between frame-level time/barlines and staff-measure key/clef;
- exact measure-frame-aware semantic addressing;
- deterministic lossless-only v2 -> v3 migration with rejection of misaligned measures/conflicting ownership;
- lossless-only v3 -> v2 downgrade;
- no rhythmic invention when adding a content staff.

A linked TAB staff must resolve to a standard source staff in the same part. String/fret/fingering/voicing remains derivative Guitar state. Removing a source staff cannot silently orphan or retarget its linked TAB presentation.

## Topology implementation gate

SSE-09 may not bypass the frozen SSE-08 contract. Before v3 authoring/session cutover is admitted it must prove validators, deterministic migration, exact addressing, atomic history, orphan-safe topology operations, measure-frame alignment, renderer/MusicXML fail-closed behavior and Node 18/20/22 CI.

Cross-staff ownership is still not admitted. Polymeter/non-controlling topology, cross-staff note/beam/tie/slur/tuplet/ornament semantics, arbitrary instrument transposition, layout geometry and production activation remain separate gates.

## Prior stage safety remains active

04A timing veto, 04B1 evidence validation, 04B2 legal-gap proof, 05 relation-safe retiming, 06 copy/orphan protection, v2 schema validation, MusicXML safety and SSE-07 renderer/host isolation are cumulative. Later stages may not bypass them.

## Human gates

Human approval is required before any new public score/notation schema is activated, before staff/part topology implementation deviates from the frozen SSE-08 design, before cross-staff canonical ownership is introduced, before source immutability/fail-closed validation is weakened, before material dependency/license risk is added, before AI/renderer/host gains canonical authority, or before production/public-write services are activated.