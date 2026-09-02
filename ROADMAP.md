# Roadmap

## Current source of truth

This file records repository reality. Planned or human-gated capability is not production capability.

## Completed bounded program

- **E0–E7-H — COMPLETE**
- **E8-A/B/C — IMPLEMENTED**
- **E8-D — HUMAN-GATED / NOT AUTHORIZED**
- **SEC-KP-00–10 — COMPLETE**
- **SEC-NE-00–07 — COMPLETE / MERGED** within documented bounded profiles.
- **SEC-NE-XML-ROUNDTRIP — COMPLETE / MERGED.**
- **SEC-NE-08 — COMPLETE / MERGED:** derivative Guitar/TAB authoring companion.
- **SEC-NE-09 — COMPLETE / MERGED:** single-session SesliTab host integration.

## SCORE-SCHEMA-EXPANSION

- **SSE-00 — COMPLETE / MERGED:** vNext contract frozen and explicitly approved.
- **SSE-01 — COMPLETE / MERGE CANDIDATE:** dual-version score/notation/addressing validation plus lossless migration and guarded downgrade.
- **SSE-02 — NEXT:** canonical session v2 cutover without parallel mutable authorities.
- **SSE-03 — NOT STARTED:** grace-note authoring.
- **SSE-04 — NOT STARTED:** articulation authoring.
- **SSE-05 — NOT STARTED:** ornament authoring.
- **SSE-06 — NOT STARTED:** vNext MusicXML semantic round trip.
- **SSE-07 — NOT STARTED:** renderer + SesliTab compatibility for v2 semantic identities.
- **SSE-08 — HUMAN-GATED DESIGN:** whole staff/part topology contract.
- **SSE-09 — NOT STARTED:** staff/part topology authoring.
- **SSE-10 — NOT STARTED:** cross-staff canonical relation model.

## SSE-01 exact capability

Additive packages:

- `score-model-v2`: strict `ScoreDocumentV2 2.0.0` validation; normal timed-event semantics remain unchanged; canonical `VoiceV2.graceGroups` are non-occupancy material anchored to exact same-voice normal events.
- `addressing-v2`: separate semantic-address contract `2.0.0`, including exact `grace-group`, `grace-event`, `grace-note` identity.
- `notation-structure-v2`: strict `NotationDocumentV2 2.0.0`; finite typed articulation and ornament vocabulary; grace event/note notation; relation endpoint validation for admitted spanning ornaments.
- `schema-migration-v1-v2`: deterministic v1 -> v2 conversion and typed `DOWNGRADE_UNREPRESENTABLE` on any lossy v2 -> v1 request.

Existing v1 score/notation/addressing packages remain unchanged and continue to reject v2 input.

## Session boundary

SSE-01 does not make v2 the active editor session model. Existing SEC-NE session/browser/SesliTab runtime remains v1 until SSE-02. Version conversion is explicit; parallel mutable v1/v2 canonical state in one session remains forbidden.

## Still fail-closed

- mixed v1 score + v2 notation or v2 score + v1 notation;
- v2 -> v1 downgrade with grace/articulation/ornament content;
- v2 authoring before SSE-03/04/05;
- unsupported MusicXML v2-only semantics before SSE-06;
- renderer-coordinate authoring;
- host dual-write;
- E8-D direct external Guitar engine invocation;
- production/public-write activation by merge.

Staff/part topology and cross-staff remain separately human-gated at SSE-08+.
