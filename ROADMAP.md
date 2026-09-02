# Roadmap

## Current source of truth

This file records merged/in-progress/not-started repository reality. Planned capability is not production capability.

## Baseline

- **E0–E7-H — COMPLETE**
- **E8-A/B/C — IMPLEMENTED**
- **E8-D — HUMAN-GATED / NOT AUTHORIZED**
- **SEC-KP-00–10 — COMPLETE**
- **SEC-NE-00–07 — COMPLETE / MERGED** within documented bounded profiles.
- **SEC-NE-XML-ROUNDTRIP — COMPLETE / MERGE CANDIDATE:** current notation serializer profile has bounded export→re-import coverage.

## SEC-NE-XML-ROUNDTRIP exact capability

`importNotationMusicXml` is the matching importer for `serializeNotationMusicXml` within current public contracts.

Admitted round-trip semantics:

- pitch/chord/rest/onset/duration/voice/staff;
- time/key/clef/barline/repeat;
- dots/accidentals/beams;
- current tuplet representation;
- MusicXML tie playback markers plus numbered tied marks;
- slur marks;
- current 04B1 measure/time evidence through the unchanged legacy score-only import authority.

The safe XML parser admits only the explicit serializer envelope and still applies structural/resource budgets. Legacy import profiles remain fail-closed for notation-rich input.

## Human-gated public-schema expansion

The following remain outside public `ScoreDocument` / `NotationDocument` 1.0.0:

- grace-note identity/timing model;
- articulations;
- ornaments;
- whole staff/part topology with frozen cross-staff correspondence rules.

## Next autonomous sequence

1. **SEC-NE-08 — NEXT:** guitar/TAB authoring composition.
2. **SEC-NE-09 — NOT STARTED:** SesliTab product integration.

## Still fail-closed

- schema-absent grace/articulation/ornament semantics;
- whole staff/part topology mutation;
- pickup/non-controlling implicit-gap authoring;
- unsupported relation-coupled retiming/copy;
- arbitrary MusicXML outside the admitted serializer profile;
- renderer-coordinate authoring;
- host dual-write;
- production/public-write activation by merge.

`ScoreDocument` remains canonical; notation is same-revision authority; renderer/host state is noncanonical; source evidence remains immutable.
