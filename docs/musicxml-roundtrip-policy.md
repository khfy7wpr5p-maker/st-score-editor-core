# MusicXML Round-Trip Policy

Status: current-reality policy for ST Score Editor Core as of main `8e486617fdc6eefad3586f2c4fdcc7db7c04b889`.

## Authority rule

MusicXML is an import/export exchange format. It is never the live mutable editor state. After an admitted import, `ScoreDocument` is the canonical musical authority; admitted notation/measure evidence is revision-bound sidecar data.

## Import policy

An importer may do exactly one of the following for a musical semantic:

1. import it into canonical/admitted revision-bound state;
2. preserve it explicitly as bounded evidence for later export/validation; or
3. reject the document/profile as unsupported.

It may not silently discard a semantic when doing so could change musical meaning or later authoring safety.

The current base importer is intentionally narrow. Unsupported advanced notation remains fail-closed. Time-signature/pickup/incomplete-measure semantics needed for implicit-gap authoring are not yet admitted through SEC-NE-04B1.

## Export policy

Export is generated from the current canonical score plus admitted same-revision notation/evidence. Export code must not reconstruct musical authority from renderer state, DOM/SVG state, host UI state or stale source evidence.

If a supported semantic cannot be represented without destructive loss, export must reject or surface an explicit unsupported/loss condition rather than silently emitting a materially different score.

## Semantic round-trip goal

For admitted semantics:

```text
MusicXML import
  -> canonical score + admitted evidence
  -> supported edit
  -> MusicXML export
  -> re-import
  -> semantic equivalence
```

Byte-for-byte XML identity is not required. Musical semantic equivalence and stable canonical identity rules are the goal.

## Required golden corpus categories

Round-trip hardening should progressively cover:

- monophonic material;
- voices 1–4;
- chords and rests;
- explicit gaps;
- pickup/anacrusis once admitted;
- time-signature inheritance/change once admitted;
- key and clef changes;
- ties/slurs;
- tuplets;
- grace notes;
- multi-staff material;
- cross-staff only after explicit admission;
- guitar notation;
- notation + TAB only after explicit admission.

Each fixture must be synthetic, first-party, public-domain or explicitly licensed for repository use.

## SEC-NE-04B1 gate

SEC-NE-04B1 must add measure/time semantics without turning MusicXML into editor authority. Preferred design is a versioned additive evidence contract bound to canonical semantic measure addresses.

The design must preserve or explicitly classify, where required:

- time signatures and changes;
- inherited effective time signatures;
- MusicXML measure `implicit="yes"` evidence;
- distinctions between pickup/incomplete and non-controlling measure semantics;
- `backup` / `forward` timing evidence needed to reconstruct source timing;
- ambiguity/unsupported states.

A short measure alone is never sufficient proof of a pickup.

## Loss policy

Unsupported semantics are not automatically equivalent to ignorable semantics. Any omission must be proven presentation-only for the admitted profile or explicitly recorded as unsupported/lossy.

No stage may make CI green by broadening a silent-loss fallback.

## Container policy

`.mxl` container processing is not admitted by this policy. Do not add `.mxl` support until a separately bounded container-processing contract defines size, entry-count, decompression, path, MIME/content and cancellation limits.
