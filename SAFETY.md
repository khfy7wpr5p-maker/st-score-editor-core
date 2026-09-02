# Safety and Trust Boundaries

## Mandatory controls

`ScoreDocument` remains canonical; source identity is immutable; all edit/notation/evidence targets are revision-bound; unsupported or ambiguous operations fail closed; independent timing validation remains a veto; renderer/host coordinates never become canonical; relation semantics may not be silently damaged; accepted edits create one child revision or none; production/public-write is never activated by merge.

## SEC-NE-07 advanced authoring safety

`editor-advanced-authoring` is a composition/safety layer over existing canonical commands, not a second musical model.

- Pitch/chord/rest-note operations use existing `commands` semantics.
- If a canonical edit would remove an entity still targeted by notation, same-revision notation rebind rejects the edit.
- `SET_EVENT_DURATION` is additionally rejected when the target carries augmentation dots, beam marks or tuplet metadata because changing duration independently could desynchronize written rhythm from canonical timing.
- Every admitted duration edit is independently rechecked by SEC-NE-04A after the candidate revision is built.
- MusicXML-derived duration edits require current safe 04B1 evidence and reject `implicit="yes"`, `non-controlling="yes"` or unknown-meter measures.
- Existing tie/slur/triplet authoring uses the explicit-target validators in `editor-keypad-advanced`; raw proximity/geometry is never enough to infer a relation.

## Public-schema safety gate

Grace notes, articulations and ornaments are absent from public `ScoreDocument` / `NotationDocument` 1.0.0. Adding hidden fields or unversioned side state would violate the canonical contract. These semantics remain **human-gated public schema expansion** until an explicit versioned representation, import/export policy and migration/compatibility strategy are approved.

Whole staff/part topology likewise remains separately gated until cross-staff measure correspondence and ownership rules are explicit.

## Prior stage safety remains active

04A timing veto, 04B1 evidence validation, 04B2 legal-gap proof, 05 relation-safe retiming and 06 structural/copy orphan protection are cumulative. Later stages may not bypass them.

## Human gates

Human approval is required before breaking public score/notation contracts, enabling schema-absent advanced semantics, enabling staff/part topology without frozen rules, weakening source immutability/fail-closed validation, adding material dependency/license risk, granting AI/renderer/host canonical authority, or activating production/public-write services.
