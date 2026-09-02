# Sibelius-style Editor Expansion Plan

Date: 2026-09-02

Goal: evolve ST Score Editor Core into a general-purpose renderer-independent score-authoring core while preserving canonical authority, source immutability and fail-closed semantics.

## Completed foundation

SEC-NE-00 through SEC-NE-05 are COMPLETE / MERGED within their documented bounded profiles.

## SEC-NE-06 — COMPLETE / MERGED

**Bounded structural goal achieved without opening unsafe topology inference.**

Implemented:

- `editor-structural-authoring/1.0.0`;
- add measure after exact current measure with fresh measure + initial voice IDs;
- remove only fully empty non-last measure with no measure-notation orphan;
- add empty voice;
- remove only empty non-last voice;
- deterministic measure/voice ordinal normalization;
- globally fresh identities;
- same-revision notation rebind or rejection;
- existing notation-command authority reused for time/key/clef/barline rather than duplicated;
- `editor-copy-paste/1.0.0`;
- relation-free source voice → exact empty target voice;
- explicit fresh destination identity for every event/note;
- exact onset/duration/pitch preservation;
- safe notation cloning;
- beam/tuplet/tie/slur-coupled source rejection;
- independent target timing veto;
- current safe 04B1 evidence required for MusicXML-derived targets;
- unified history composition covered by regression tests.

### Structural topology not guessed

Staff/part add/remove remains a separate topology gate because current contracts do not explicitly encode cross-staff measure correspondence, staff alignment policy or safe relationship ownership. This is an intentional fail-closed boundary, not an incomplete implementation disguised as support.

## Next autonomous sequence

### SEC-NE-07 — NOT STARTED

Use current canonical/notation capabilities to expose advanced authoring without duplicating semantics already present in commands/keypad packages.

Priority:

1. chord construction/removal through canonical chord commands;
2. pitch/duration transformation with current timing veto;
3. accidental/dot/beam/tuplet/tie/slur authoring by composing existing notation contracts;
4. bounded transposition/enharmonic operations representable by current pitch model;
5. multi-event/paste composition only through fresh identities and existing safety gates.

Grace notes, articulations and ornaments are not present in public `ScoreDocument`/`NotationDocument` 1.0.0. Adding them requires a public schema expansion and therefore remains a human-gated design decision rather than an autonomous silent schema break.

### SEC-NE-XML-ROUNDTRIP — HARDENING CONTINUES

Build a golden first-party/public-domain corpus for every admitted import/edit/export/re-import semantic. No unsupported semantic may disappear silently.

### SEC-NE-08 — NOT STARTED

Compose guitar/TAB authoring on top of generic Editor Core. Standard notation stays canonical; string/fret/fingering stays derivative unless separately admitted.

### SEC-NE-09 — NOT STARTED

Compose SesliTab host/UI around one canonical Editor Core state and one renderer presentation path. No dual-write, no renderer-owned edit state, playback independent from OMR completeness where possible.

## Definition of done

Every stage requires exact PR/head/merge identity, supported Node CI, package-boundary regressions, synchronized current-reality docs, no hidden dependency/license change and explicit authority-change recording.
