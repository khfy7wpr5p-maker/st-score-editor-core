# ST Score Editor Core — Architecture

Status: **SEC-NE is complete. SSE-00–03 are merged; SSE-04 adds typed articulation authoring as a merge candidate.**

## Authority

Each v2 editor session owns exactly one `ScoreDocumentV2 + NotationDocumentV2` pair. Grace identity/order/anchor/written value live in canonical score state. Articulations and ornaments are same-revision notation semantics. Renderer/SesliTab remain noncanonical.

## Articulation authoring flow

```text
exact current event | grace-event address
        |
ArticulationAuthoringIntentV2 + fresh nextRevisionId
        |
finite typed articulation mutation
        |
ScoreDocumentV2 direct-child revision (musical content unchanged)
        |
NotationDocumentV2 strict validation
        |
EditorHistoryStateV2 atomic commit
        |
deterministic semantic selection
```

Admitted operations are set, toggle and remove. Targets are only normal `event` or canonical `grace-event` identities; geometry is never accepted as authority.

## Validation / safety

The frozen v2 notation validator owns articulation semantics. It rejects unsupported kinds, invalid placement, non-null direction outside strong accent, and duplicate semantically identical articulation specs. Old revision targets cannot be replayed after a commit.

Articulation edits do not alter pitch, onset, duration, normal measure occupancy, grace grouping or anchor identity. Even though the semantic change is notation-only, unified editor history advances one direct-child score revision and one same-revision notation document; no independent notation timeline is introduced.

## Rendering / MusicXML boundary

V2 render manifests continue to expose exact event and grace-event identities. Until SSE-06 provides vNext MusicXML support, any articulation-bearing pair reports `VNEXT_XML_PENDING` and `musicXml = null` rather than projecting lossy v1 XML.

## Next stages

- SSE-05 — typed ornament authoring with relation-safe spanning forms;
- SSE-06 — bounded v2 MusicXML round trip for grace/articulation/ornament semantics;
- SSE-07 — product renderer/SesliTab compatibility.

Staff/part topology and cross-staff remain separate SSE-08+ gates. No dependency, renderer/host authority, persistence/network authority or production activation is added by SSE-04.