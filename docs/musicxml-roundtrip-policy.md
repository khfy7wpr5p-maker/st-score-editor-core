# MusicXML Round-Trip Policy

Status: current-reality policy through **SSE-06 bounded MusicXML v2 semantic round trip**.

## Authority rule

MusicXML is an import/export exchange format. It is never live mutable editor state. After admitted import, the versioned `ScoreDocument` is canonical musical authority and same-revision notation is canonical notation authority. Source identity remains auditable and renderer/host state remains noncanonical.

## Legacy v1 profiles

### Legacy E2

`importMusicXml` remains score-only and intentionally narrow.

### SEC-NE-04B1

`importMusicXmlWithMeasureSemantics` preserves the admitted simple time/measure evidence profile.

### Bounded v1 notation round trip

`serializeNotationMusicXml` + `importNotationMusicXml` remain the public v1 score/notation exchange profile for the admitted 1.0.0 semantics.

SSE-06 does **not** broaden any of these parser/importer profiles. V2-only MusicXML continues to fail closed when supplied to legacy v1 APIs.

## SSE-06 isolated v2 profile

`packages/musicxml-v2` adds separate bounded APIs:

- `serializeNotationMusicXmlV2`
- `importNotationMusicXmlV2`
- a separate safe v2 XML parser used by the importer

The v2 parser reuses the established input/resource safety model: normalized untrusted input, bounded bytes/depth/elements/attributes/text, cancellation and processing deadline. Only the explicitly admitted v2 MusicXML elements and attributes are accepted.

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

The internal projection is an implementation detail, not canonical state and not a public v2 -> v1 downgrade. Final source identity belongs to the original MusicXML input.

## Admitted SSE-06 semantics

The bounded v2 round trip preserves:

- normal pitch/chord/rest/onset/duration/voice/staff semantics already admitted by v1;
- current measure/event/note notation admitted by the v1 notation profile;
- grace note/rest/chord events and exact canonical anchor grouping;
- grace written values without turning grace notes into normal timeline occupancy;
- bounded grace slash, steal-time/make-time metadata, dots and beams;
- grace-note accidentals, ties and slurs;
- typed articulations on normal and grace events;
- simple ornaments plus accidental marks;
- single-note tremolo;
- numbered spanning tremolo start/stop;
- numbered wavy-line start/continue/stop.

Default notation stays sparse after re-import.

## Grace placement policy

MusicXML does not provide a direct canonical `before|after` grace-placement field matching `GraceGroup.placement`. The bounded serializer therefore admits only combinations it can encode and recover unambiguously. Unsupported combinations reject rather than being guessed or silently normalized. A serializer-produced after-grace marker is interpreted only by this bounded v2 profile.

## Equivalence contract

For the admitted v2 profile:

```text
ScoreDocumentV2 + NotationDocumentV2
  -> serializeNotationMusicXmlV2
  -> importNotationMusicXmlV2
  -> semantically equivalent canonical score + notation
```

The imported score source identity represents the newly supplied MusicXML bytes; it is not required to equal the pre-export source envelope. Canonical musical structure, revision identity requested by the importer and admitted notation semantics must round-trip. Sparse default notation must not appear merely as an import artifact.

Golden regression covers v2 semantic equality, legacy v1 rejection of v2 XML and fail-closed rejection of an unrepresentable grace placement/playback combination.

## Loss policy

Unsupported is not equivalent to ignorable. Unknown elements/attributes, broken relations, source identity mismatches and schema-absent semantics must reject or remain behind a later versioned profile. Silent semantic loss is forbidden.

SSE-06 does not claim arbitrary external MusicXML, `.mxl`, staff/part topology authoring or cross-staff semantics.

## Renderer boundary

Direct v2 MusicXML exchange exists after SSE-06. Existing renderer requests are not automatically widened by this policy. Wiring v2-only XML into renderer/SesliTab requests is **SSE-07** work; until then `renderer-contract-v2` may still report `VNEXT_XML_PENDING` for v2-only pairs.

## Corpus policy

Round-trip fixtures must be synthetic, first-party, public-domain or explicitly licensed. Add a golden fixture/regression whenever the public admitted semantic set expands.

## Container policy

`.mxl` remains unadmitted. A future container contract must define compressed/uncompressed size, entry count, path rules, MIME/content checks, decompression limits and cancellation behavior before support is added.