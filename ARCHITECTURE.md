# ST Score Editor Core — Architecture

Status: **SEC-NE is complete. SSE-00–05 are merged; SSE-06 adds bounded MusicXML v2 semantic round trip as a merge candidate.**

## Authority

Each v2 editor session owns exactly one `ScoreDocumentV2 + NotationDocumentV2` pair. Grace identity/order/anchor/written value live in canonical score state. Articulations and ornaments are same-revision notation semantics. MusicXML remains exchange/projection data. Renderer/SesliTab remain noncanonical.

## SSE-06 MusicXML v2 boundary

Legacy MusicXML APIs remain deliberately narrow. SSE-06 does not widen `parseMusicXmlTree`, `importMusicXml`, `importMusicXmlWithMeasureSemantics` or `importNotationMusicXml`.

Instead, `packages/musicxml-v2` owns a separate bounded profile:

```text
untrusted MusicXML v2 input
        |
separate safe v2 parser
(existing byte/depth/element/attribute/text/deadline budgets)
        |
original source identity validation
        |
noncanonical internal v1-compatible timed projection
        |
existing proven v1 notation importer
        |
one deterministic v1 -> v2 migration
        |
rebind v2-only semantics from original parsed tree
        |
ScoreDocumentV2 + sparse same-revision NotationDocumentV2
```

The internal projection strips grace material plus v2-only articulation/ornament elements only for reuse of the existing timed-score importer. It is never exposed as canonical state or a public downgrade. Final canonical source identity belongs to the original MusicXML input, not the internal projection.

## Admitted v2 round-trip semantics

The bounded serializer/importer preserves:

- existing normal timed score and v1 notation semantics;
- grace note/rest/chord events outside normal measure occupancy;
- grace written value, slash and bounded playback metadata;
- grace event dots/beams and grace-note accidental/tie/slur notation;
- finite typed articulations on normal/grace events;
- finite simple ornaments plus accidental marks;
- single-note tremolo;
- numbered spanning tremolo start/stop;
- numbered wavy-line start/continue/stop.

Notation remains sparse: default normal-event, grace-event and grace-note notation is not materialized merely because XML was re-imported.

## Fail-closed rules

- unknown or unsupported v2 XML elements/attributes reject;
- legacy importers continue to reject v2-only XML;
- source format/byte-length mismatch rejects before canonical output;
- unsupported/ambiguous grace placement-playback combinations reject rather than being normalized silently;
- broken ornament relations are rejected by `NotationDocumentV2` validation;
- no renderer geometry, DOM/SVG identity or host state participates in import authority;
- no silent v2 -> v1 semantic loss is admitted.

## Rendering boundary

SSE-06 provides direct bounded `serializeNotationMusicXmlV2` / `importNotationMusicXmlV2` exchange support. `renderer-contract-v2` is intentionally not widened in this stage. V2-only renderer requests may therefore continue to expose `VNEXT_XML_PENDING` / `musicXml = null` until SSE-07 wires the proven v2 projection into renderer/SesliTab compatibility.

## Next stages

- **SSE-07 — NEXT:** renderer + SesliTab v2 compatibility while retaining opaque semantic tokens and no host dual-write.
- **SSE-08 — HUMAN-GATED DESIGN:** staff/part topology contract.
- **SSE-09+** remain gated by the frozen topology/cross-staff design sequence.

No dependency, renderer/host authority, persistence/network authority or production activation is added by SSE-06.