# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for ST score products.

## Current reality

The SEC-NE bounded program is complete. SCORE-SCHEMA-EXPANSION is implemented through the **SSE-02 v2-native session cutover** on this merge candidate.

- **SSE-00 — COMPLETE / MERGED:** vNext contract frozen and approved.
- **SSE-01 — COMPLETE / MERGED:** additive v2 score/notation/addressing and migration substrate.
- **SSE-02 — COMPLETE / MERGE CANDIDATE:** one canonical v2 session/history/render/selection path.
- **SSE-03 — NEXT:** grace-note authoring.

## SSE-02 session cutover

`editor-session-controller-v2/2.0.0` owns one `ScoreDocumentV2 + NotationDocumentV2` pair. V1 input may enter only through explicit `createEditorSessionV2FromV1`, which performs the approved lossless migration once; the resulting session retains no parallel mutable v1 state.

`editor-history-v2` stores atomic same-version score+notation snapshots, enforces direct-child revision lineage and rebinds normal plus grace notation targets. Disappearing targets fail closed.

`renderer-contract-v2` always produces a v2 semantic manifest. A v2 pair that can be losslessly represented by the existing v1 MusicXML serializer receives `V1_COMPATIBLE_XML`. If v2-only content exists before SSE-06, the request returns `VNEXT_XML_PENDING` with `musicXml: null` instead of silently dropping semantics.

`editor-selection-v2` resolves opaque v2 render tokens and supports normal plus `grace-group`, `grace-event` and `grace-note` identity.

SSE-02 intentionally adds no grace/articulation/ornament mutation command; authoring begins in SSE-03–05 after this single-version session boundary is established.

## Authority and dependencies

Canonical authority is one versioned ScoreDocument per session; notation is same-version/same-revision. Renderer and SesliTab remain noncanonical. MusicXML/OMR/Guitar remain exchange/evidence/derivative state. Runtime dependencies remain only `saxes@6.0.0` and `xmlchars@2.2.0`; no production/public-write, persistence/network, E8-D or staff/part topology authority is activated.
