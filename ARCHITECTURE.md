# ST Score Editor Core — Architecture

Status: **SEC-NE and SSE-00–06 are merged; SSE-07 renderer + SesliTab v2 compatibility is a merge candidate.**

## Authority

Each v2 editor session owns exactly one `ScoreDocumentV2 + NotationDocumentV2` pair. MusicXML remains exchange/projection data. Renderer, DOM/SVG state and SesliTab host state remain noncanonical.

## MusicXML v2 layer

SSE-06 remains the bounded exchange layer: separate safe v2 parser, isolated importer/serializer, legacy v1 APIs unchanged, unsupported semantics fail closed.

## SSE-07 renderer projection

```text
canonical v2 score + notation
        |
try lossless v2 -> v1 downgrade
   | success                  | unrepresentable
V1_COMPATIBLE_XML             v
                       serializeNotationMusicXmlV2
                          | success          | unsupported
                     V2_SEMANTIC_XML      VNEXT_XML_PENDING
                          |
               exact renderer profile
                          |
                 OSMD / alphaTab adapter
```

`VNEXT_XML_PENDING` now means the canonical pair is outside the currently admitted renderer projection profile; it no longer means every v2-only pair.

`RenderManifestV2` remains derived from the canonical semantic address index. Opaque tokens cover document/part/staff/measure/voice/event/note plus grace-group/grace-event/grace-note identities. Hit resolution validates document, revision, token mapping and exact semantic address before selection.

Legacy renderer adapters are unchanged. Additive v2 adapter functions consume `RendererRequestV2`; pending requests fail before renderer load.

## SesliTab v2 host

`seslitab-editor-host-v2` is an additive facade over `EditorSessionStateV2`:

- one canonical v2 pair and unified history;
- renderer-token selection only through opaque semantic tokens;
- grace/articulation/ornament authoring delegated to editor-owned typed operations;
- unified undo/redo;
- pointer/keyboard/touch converge on the same semantic paths;
- playback stays host-owned and independent of editor admission.

The facade exposes no direct score mutation, coordinate mutation, network, persistence, server-revision, publication or production authority. The legacy v1 SesliTab host remains unchanged.

## Fail-closed rules

- stale/mismatched render requests or tokens reject;
- unrenderable bounded v2 pairs remain pending;
- wrong renderer family/version/license rejects;
- host cannot dual-write canonical score state;
- renderer load/render failure does not create a canonical revision;
- no silent v2 -> v1 semantic loss;
- no coordinate/DOM inference for selection or mutation.

## Next gate

**SSE-08 is HUMAN-GATED DESIGN** for staff/part topology. Implementation must not begin until identity lifecycle, aligned-measure correspondence, notation ownership, instrument/TAB semantics, migration/source-map and renderer impacts are explicitly approved. Cross-staff remains a later separate gate.