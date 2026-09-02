# ST Score Editor Core — Architecture

Status: **SEC-NE is complete. SSE-00/01 are merged; SSE-02 provides the v2-native canonical session cutover as a merge candidate.**

## Authority

Each editor session has exactly one canonical versioned score+notation pair. Renderer/SesliTab remain presentation/orchestration only; MusicXML/OMR/Guitar remain exchange/evidence/derivative state.

## V2 runtime path

```text
optional v1 input
   |
   | explicit lossless migration once
   v
ScoreDocumentV2 + NotationDocumentV2
   |
EditorHistoryStateV2
   |
RendererRequestV2 + RenderManifestV2
   |
opaque v2 semantic token
   |
SelectionSnapshotV2 / InspectorModelV2
```

The v2 session never stores a parallel mutable v1 copy. Mixed-version score/notation input rejects.

## History and notation rebinding

`editor-history-v2/2.0.0` stores one atomic score+notation snapshot per revision and requires direct-child revision lineage. Rebinding after score edits resolves every surviving notation target against the new v2 revision, including `grace-event` and `grace-note`; missing targets reject rather than orphaning notation.

## Renderer boundary before SSE-06

`renderer-contract-v2/2.0.0` always derives an exact v2 semantic manifest. If a v2 pair contains no v2-only semantic, it may be losslessly downgraded for the existing serializer and reports `V1_COMPATIBLE_XML`.

If grace/articulation/ornament content would be lost, downgrade is not attempted as presentation truth. The request reports:

```text
projectionStatus = VNEXT_XML_PENDING
musicXml = null
```

This preserves semantic authority until SSE-06 supplies the bounded v2 MusicXML serializer/importer.

## V2 selection

Opaque render tokens resolve through the current request/revision and may target normal document/part/staff/measure/voice/event/note entities plus canonical grace group/event/note identities. No geometry is canonical.

## Stage boundary

SSE-02 establishes runtime identity/history infrastructure only. Grace, articulation and ornament mutation remain closed until SSE-03/04/05. This prevents authoring semantics from being added before a single-version history and selection model exists.

## Compatibility

V1 packages remain available and unchanged for existing consumers. V2 is a separate explicit path. Existing SEC-NE regressions remain required throughout the expansion.

Runtime dependencies remain `saxes@6.0.0` and `xmlchars@2.2.0`. No renderer/host authority, Guitar reverse-write, persistence/network authority or production activation is added.
