# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for ST score products.

## Current reality

SCORE-SCHEMA-EXPANSION is implemented through **SSE-06 bounded MusicXML v2 semantic round trip** on this merge candidate.

- **SSE-00–05 — COMPLETE / MERGED:** approved v2 contract, dual-version substrate, one canonical v2 session, grace authoring, typed articulation authoring and relation-safe ornament authoring.
- **SSE-06 — COMPLETE / MERGE CANDIDATE:** isolated MusicXML v2 parser/importer/serializer for the admitted grace/articulation/ornament model.
- **SSE-07 — NEXT:** renderer + SesliTab v2 compatibility.

## SSE-06 MusicXML v2 round trip

`packages/musicxml-v2` is an additive profile; it does **not** broaden the legacy v1 MusicXML parser/importer acceptance surface.

The v2 serializer/importer preserves the bounded canonical profile for:

- normal timed score and existing v1 notation semantics;
- grace note/rest/chord identity, ordering, anchor placement and written value;
- bounded grace slash/playback metadata, dots, beams and grace-note accidentals/ties/slurs;
- typed articulations on normal and grace events;
- simple ornaments and accidental marks;
- single-note tremolo;
- numbered spanning tremolo start/stop relations;
- numbered wavy-line start/continue/stop relations.

The v2 importer first validates the original input with a separate safe parser using the existing byte/depth/element/attribute/text/deadline budgets. It then derives a noncanonical internal v1-compatible timed projection, reuses the proven v1 notation importer, migrates once to v2, and rebinds the v2-only semantics from the original tree. The final `ScoreDocumentV2 + NotationDocumentV2` pair is same-revision, sparse where notation is default, and retains the original MusicXML source identity.

Unsupported or ambiguous forms fail closed. In particular, grace placement/playback combinations that cannot be represented unambiguously by the bounded profile are rejected rather than silently altered.

Legacy `parseMusicXmlTree`, `importMusicXml`, `importMusicXmlWithMeasureSemantics` and `importNotationMusicXml` remain unchanged and intentionally reject v2-only XML.

## Rendering boundary

Direct `serializeNotationMusicXmlV2` / `importNotationMusicXmlV2` exchange support exists in SSE-06. Existing `renderer-contract-v2` wiring is intentionally unchanged in this stage: v2-only renderer requests may still report `VNEXT_XML_PENDING` with `musicXml: null` until **SSE-07** connects the bounded v2 projection to renderer/SesliTab compatibility.

## Authority and dependencies

One v2 score+notation pair remains canonical per v2 session. MusicXML remains exchange/projection data. Renderer/SesliTab remain noncanonical and Guitar remains derivative-only. Runtime dependencies remain `saxes@6.0.0` and `xmlchars@2.2.0`; no production/public-write, persistence/network, E8-D, staff/part-topology or cross-staff authority is activated.