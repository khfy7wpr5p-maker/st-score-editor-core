# MusicXML Compatibility Matrix

Status: **P-MXML-REF-01 IMPLEMENTATION IN PROGRESS**

This matrix records compatibility evidence. It does not grant canonical, release, deploy, or production-write authority.

## Evidence classes

- `SEMANTIC_REQUIRED`: musical meaning must be represented or explicitly normalized without loss.
- `IGNORABLE_PRESENTATION_METADATA`: reviewed noncanonical presentation/metadata may be discarded while preserving score meaning.
- `UNSUPPORTED_SEMANTIC_FAIL_CLOSED`: unsupported or ambiguous musical meaning must still fail closed.

## P-MXML-REF-01-SYNTHETIC

- Source: `corpus/fixtures/musicxml-compatibility/p-mxml-ref-01-sorf-surrogate.musicxml`
- Semantic-only twin: `corpus/fixtures/musicxml-compatibility/p-mxml-ref-01-sorf-surrogate-semantic-only.musicxml`
- Provenance: first-party synthetic; ordinary C-major material created solely for this repository test.
- Rights status: repository-owned synthetic test fixture.
- Personal data: none.
- External training authority: false.
- Baseline ST result: `UNSUPPORTED_MUSICXML`.
- Baseline first rejection: root `identification`.
- Expected post-change result: PASS through the bounded compatibility policy.
- Canonical comparison target: semantic-only twin.
- Required preserved semantics: two measures, one staff, two voices, exact note pitches/onsets/durations, admitted staccato.
- Mirrored blocker families:
  - root identification/encoding/software/supports/source/miscellaneous metadata;
  - defaults/scaling/page layout/margins/lyric font;
  - score-part abbreviation/instrument/MIDI metadata;
  - measure print/system layout/numbering and measure width;
  - note default-x and stem/default-y presentation;
  - neutral notehead `normal` with `filled="no"`;
  - supported articulation with presentation-only `default-y`;
  - empty print-only `staff-details`.

## P-MXML-REF-01-PRIVATE-SORF

- Source identity: `sorf_op35_no13-let.musicxml`.
- Repository inclusion: forbidden; private/reference bytes are not committed because rights/provenance for redistribution are not established.
- Smoosic: PASS.
- Partitura `load_musicxml()`: PASS.
- Partitura `score.note_array()`: 175 notes.
- Independent semantic fields observed: onset/duration in beat, quarter and divisions domains; pitch; voice; source ID; divisions-per-quarter.
- Polyphony evidence: explicit Voice 1 and Voice 2 with simultaneous/overlapping material.
- Android Chrome physical baseline: G1 PASS; G2 MusicXML open FAIL with `UNSUPPORTED_MUSICXML`.
- iPhone Safari physical baseline: MusicXML open FAIL with the same failure class.
- Expected post-change use: qualification-only PASS on the exact private file outside Git history.
- Authority: Partitura/Smoosic results are reference evidence only; ST canonical authority remains unchanged.

## Initial reviewed blocker inventory

The private file contains at least the following out-of-profile presentation/metadata families that are represented by the synthetic surrogate:

- `identification`, `encoding`, `software`, `supports`, `encoding-date`, `source`, `miscellaneous`, `miscellaneous-field`;
- `defaults`, `scaling`, `millimeters`, `tenths`, page layout/margins, `lyric-font`;
- `part-abbreviation`, `score-instrument`, `instrument-name`, `midi-instrument`, MIDI channel/program/volume;
- `print`, system layout/margins/distance, top-system-distance, measure-numbering;
- `measure@width`, `note@default-x`, `stem@default-y`, supported-articulation `@default-y`;
- neutral `notehead` presentation;
- empty print-only `staff-details`.

Unknown semantic constructs are not admitted by this inventory. `direction`, `sound`, `harmony`, foreign semantic namespaces, staff tuning/line semantics and non-neutral notehead shapes remain fail-closed candidates for later negative tests.

## Release reality

- APP-09 full release gate: false.
- Manual physical-device validation required: true.
- SesliTab cutover authorized: false.
- Render/deploy change authorized by P-MXML-REF-01: false.
