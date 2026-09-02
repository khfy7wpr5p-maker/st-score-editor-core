# MusicXML Round-Trip Policy

Status: current-reality policy through SEC-NE-04B1.

## Authority rule

MusicXML is an import/export exchange format. It is never live mutable editor state. After admitted import, `ScoreDocument` is canonical musical authority; notation and measure evidence are revision-bound sidecars.

## Import policy

For each semantic, an importer must do one of three things:

1. import it into canonical/admitted revision-bound state;
2. preserve it explicitly as bounded evidence; or
3. reject the input/profile as unsupported.

Silent discard is forbidden when loss could change musical meaning or authoring safety.

## Current import profiles

### Legacy E2 profile

`importMusicXml` remains score-only and intentionally narrow. It continues to reject SEC-NE-04B1-only time/measure semantics rather than accepting them without returning their evidence.

### SEC-NE-04B1 profile

`importMusicXmlWithMeasureSemantics` returns:

```text
ScoreDocument
NotationDocument
MusicXmlMeasureSemanticsDocument
```

All outputs are bound to the same canonical document/revision.

The admitted 04B1 profile preserves:

- simple unnumbered time-signature declarations within existing notation limits;
- time-signature inheritance and changes;
- MusicXML measure `implicit` yes/no evidence;
- MusicXML measure `non-controlling` yes/no evidence independently from `implicit`;
- exact rational `backup` / `forward` cursor-operation evidence;
- source part/measure/staff provenance bound to canonical measure addresses.

A short measure alone is never pickup evidence. Mid-measure time changes, extra `<time>` attributes, compound/ambiguous unsupported forms and hidden nested leaf semantics fail closed.

SEC-NE-04B1 evidence does not authorize implicit-gap writes or rest materialization.

## Export policy

Export is generated from current canonical state plus admitted same-revision notation/evidence. Export must not reconstruct authority from renderer state, DOM/SVG state, host UI state or stale evidence.

If an admitted semantic cannot be exported without destructive loss, export must reject or surface an explicit unsupported/loss state.

## Semantic round-trip goal

For every fully admitted round-trip semantic:

```text
MusicXML import
  -> canonical score + admitted evidence
  -> supported edit
  -> MusicXML export
  -> re-import
  -> semantic equivalence
```

Byte-for-byte XML identity is not required.

SEC-NE-04B1 **does not by itself claim complete export/re-import round trip** for all newly preserved measure evidence. The additive evidence import is now admitted; golden export/preservation/re-import coverage remains part of `SEC-NE-XML-ROUNDTRIP` hardening.

## Required golden corpus categories

Progressively cover:

- monophonic material;
- voices 1–4;
- chords/rests;
- explicit gaps;
- simple time-signature declaration/inheritance/change;
- pickup/anacrusis once 04B2 legal-span semantics are admitted;
- key/clef changes;
- ties/slurs;
- tuplets;
- grace notes;
- multi-staff material;
- cross-staff only after explicit admission;
- guitar notation and later notation+TAB.

Fixtures must be synthetic, first-party, public-domain or explicitly licensed.

## Loss policy

Unsupported is not equivalent to ignorable. Omission must be proven presentation-only for the admitted profile or explicitly rejected/recorded as loss.

CI may never be fixed by broadening a silent-loss fallback.

## Container policy

`.mxl` remains unadmitted. A future container contract must define compressed/uncompressed size, entry count, path rules, MIME/content checks, decompression limits and cancellation behavior before support is added.
