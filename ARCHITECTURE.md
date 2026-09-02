# ST Score Editor Core — Architecture

Status: **SEC-NE is COMPLETE / MERGED through SEC-NE-09. SSE-00 is COMPLETE / MERGED and the approved vNext contract is frozen. SSE-01 implements an additive dual-version substrate; v1 remains the active editor-session runtime until SSE-02.**

## Canonical authority

Canonical musical state is a versioned `ScoreDocument`; same-revision notation is a version-matched `NotationDocument`. MusicXML/OMR remain exchange/evidence, Guitar Workspace remains derivative, and renderer/SesliTab state remains noncanonical.

No editor session may contain independently mutable v1 and v2 canonical pairs.

## Dual-version topology

```text
v1 boundary                              v2 substrate
ScoreDocument 1.0.0                      ScoreDocumentV2 2.0.0
NotationDocument 1.0.0                   NotationDocumentV2 2.0.0
SemanticAddress 1.0.0                    SemanticAddressV2 2.0.0
        |                                      |
        +---- explicit lossless migration ----+
                                               |
                         guarded downgrade only when no v2-only semantics
```

SSE-01 deliberately adds separate packages. Existing v1 exact-key validators and address unions are not broadened.

## ScoreDocumentV2

Normal timed events retain existing onset/duration semantics. `VoiceV2` adds canonical `graceGroups`:

```text
VoiceV2
  events[]       -> normal timed occupancy
  graceGroups[]  -> canonical non-occupancy grace material
                     anchorEventId -> exact normal event in same voice
                     placement     -> before | after
                     events[]      -> ordered grace note/rest/chord identities
```

Grace written duration is positive but is not normal measure occupancy. Playback steal/make-time values are normalized canonical grace metadata. Zero-duration timed-event emulation is rejected.

The validator enforces globally unique grace identities, exact same-voice anchors, one group per `(anchorEventId, placement)`, bounded/canonical grace rationals and valid pitches/chords.

## AddressingV2

`addressing-v2/2.0.0` reproduces normal semantic ancestry under a separate contract and adds:

- `grace-group`;
- `grace-event`;
- `grace-note`.

Every address remains document/revision/path bound. Stale, cross-document or ancestry-mismatched targets fail closed. The old `SemanticAddress 1.0.0` union is unchanged.

## NotationDocumentV2

V2 retains measure/note notation and extends event notation with finite typed `articulations[]` and `ornaments[]`. Grace events/notes have dedicated address-bound notation collections.

Unsupported arbitrary `other-*` forms are not admitted. Articulation direction is constrained by kind. Numbered spanning tremolo/wavy-line facts require complete relation endpoints; incomplete relation state is rejected rather than inferred from renderer geometry.

## Migration architecture

### v1 -> v2

Pure schema conversion is deterministic and lossless:

- document/revision/source identity remains unchanged;
- normal event content is unchanged;
- every voice receives `graceGroups: []`;
- event notation receives `articulations: []` and `ornaments: []`;
- grace notation arrays begin empty;
- semantic ancestry is preserved while address contract version changes explicitly from 1.0.0 to 2.0.0.

### v2 -> v1

Downgrade is accepted only when v2-only structures are empty. Any grace material, articulation, ornament or grace notation yields `DOWNGRADE_UNREPRESENTABLE` with exact loss paths. Silent semantic loss is forbidden.

## Active session/runtime boundary

SSE-01 is substrate, not cutover. Existing `EditorSessionState`, browser runtime and SesliTab host remain v1 until SSE-02 provides a version-2-native session/history/render path. This prevents a big-bang replacement and preserves all SEC-NE regressions while v2 is introduced.

## Future sequence

- SSE-02 — one canonical v2 session/history pair;
- SSE-03 — grace authoring;
- SSE-04 — articulation authoring;
- SSE-05 — ornament authoring;
- SSE-06 — bounded v2 MusicXML round trip;
- SSE-07 — renderer/SesliTab v2 identity integration;
- SSE-08+ — separately gated staff/part topology and cross-staff work.

## Dependencies / authority

Runtime dependencies remain only `saxes@6.0.0` and `xmlchars@2.2.0`. SSE-01 adds no dependency, renderer authority, host authority, Guitar reverse-write, persistence/network authority or production/public-write activation.
