# MusicXML Round-Trip Policy

Status: current-reality policy through **SSE-07 renderer/SesliTab v2 compatibility**.

## Authority rule

MusicXML is an import/export and render-projection format. It is never live mutable editor state. After admitted import, the versioned `ScoreDocument` is canonical musical authority and same-revision notation is canonical notation authority. Source identity remains auditable; renderer and host state remain noncanonical.

## Legacy v1 profiles

### Legacy E2

`importMusicXml` remains score-only and intentionally narrow.

### SEC-NE-04B1

`importMusicXmlWithMeasureSemantics` preserves the admitted simple time/measure evidence profile.

### Bounded v1 notation round trip

`serializeNotationMusicXml` + `importNotationMusicXml` remain the public v1 score/notation exchange profile for admitted 1.0.0 semantics.

SSE-06/07 do **not** broaden these parser/importer profiles. V2-only MusicXML continues to fail closed when supplied to legacy v1 APIs.

## Isolated v2 profile

`packages/musicxml-v2` provides:

- `serializeNotationMusicXmlV2`;
- `importNotationMusicXmlV2`;
- a separate safe v2 XML parser used by the importer.

The parser reuses the established input/resource safety model: normalized untrusted input, bounded bytes/depth/elements/attributes/text, cancellation and processing deadline. Only explicitly admitted elements and attributes are accepted.

### Import architecture

```text
original v2 MusicXML bytes
  -> separate bounded v2 parser
  -> original source format/byteLength validation
  -> internal grace/articulation/ornament-stripped v1-compatible projection
  -> existing proven v1 notation importer
  -> deterministic v1 -> v2 migration
  -> rebind v2-only semantics from original parsed tree
  -> ScoreDocumentV2 + sparse same-revision NotationDocumentV2
```

The internal projection is implementation detail, not canonical state and not a public v2 -> v1 downgrade. Final source identity belongs to the original MusicXML input.

## Admitted v2 round-trip semantics

The bounded v2 profile preserves:

- normal pitch/chord/rest/onset/duration/voice/staff semantics already admitted by v1;
- current measure/event/note notation admitted by the v1 notation profile;
- grace note/rest/chord events and exact canonical anchor grouping;
- grace written values without normal timeline occupancy;
- bounded grace slash, steal-time/make-time metadata, dots and beams;
- grace-note accidentals, ties and slurs;
- typed articulations on normal and grace events;
- simple ornaments plus accidental marks;
- single-note tremolo;
- numbered spanning tremolo start/stop;
- numbered wavy-line start/continue/stop.

Default notation stays sparse after re-import.

## Grace placement policy

MusicXML does not provide a direct canonical `before|after` grace-placement field matching `GraceGroup.placement`. The bounded serializer admits only combinations it can encode and recover unambiguously. Unsupported combinations reject rather than being guessed or silently normalized.

## Equivalence contract

For the admitted v2 profile:

```text
ScoreDocumentV2 + NotationDocumentV2
  -> serializeNotationMusicXmlV2
  -> importNotationMusicXmlV2
  -> semantically equivalent canonical score + notation
```

The imported score source identity represents newly supplied MusicXML bytes and need not equal the pre-export source envelope. Canonical musical structure, requested revision identity and admitted notation semantics must round-trip. Sparse default notation must not appear merely as an import artifact.

## Renderer projection policy

SSE-07 connects bounded MusicXML to `renderer-contract-v2` without making MusicXML or the renderer canonical.

Projection is explicit:

- `V1_COMPATIBLE_XML`: the v2 pair downgrades losslessly and uses the proven v1 serializer;
- `V2_SEMANTIC_XML`: v2-only semantics are present and the SSE-06 serializer can represent the pair;
- `VNEXT_XML_PENDING`: the pair is canonical but outside the bounded serializer profile, so `musicXml` is null and renderer loading is forbidden.

Opaque render-token manifests remain derived from revision-bound semantic addresses, not XML node identity or renderer geometry.

## Loss policy

Unsupported is not equivalent to ignorable. Unknown elements/attributes, broken relations, source identity mismatches and schema-absent semantics must reject or remain pending behind a later versioned profile. Silent semantic loss is forbidden.

The current profile does not claim arbitrary external MusicXML, `.mxl`, staff/part topology authoring or cross-staff semantics.

## Corpus policy

Round-trip fixtures must be synthetic, first-party, public-domain or explicitly licensed. Add a golden fixture/regression whenever the admitted semantic set expands.

## Container policy

`.mxl` remains unadmitted. A future container contract must define compressed/uncompressed size, entry count, path rules, MIME/content checks, decompression limits and cancellation behavior before support is added.