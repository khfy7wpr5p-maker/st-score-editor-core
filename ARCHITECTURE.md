# ST Score Editor Core — Architecture

Status: **The bounded SEC-NE autonomous authoring program is COMPLETE / MERGED through SEC-NE-09. `ScoreDocument` / `NotationDocument` 1.0.0 remain the active runtime contracts. SSE-00 is a design-only vNext contract stage.**

## Canonical authority

`ScoreDocument` is the single musical edit authority. `NotationDocument` owns same-revision notation semantics. MusicXML/OMR data is exchange/evidence. Guitar Workspace state is derivative. Renderers and SesliTab are presentation/orchestration layers and are never independent canonical state.

## Implemented program

- SEC-NE-01/02 — explicit-rest note entry and unified session/browser composition.
- SEC-NE-03 — revision-bound semantic insertion position.
- SEC-NE-04A/04C — exact timing veto and explicit-rest position entry.
- SEC-NE-04B1/04B2 — MusicXML measure semantics and proven gap materialization.
- SEC-NE-05 — relation-safe retiming and atomic supported 3:2 triplet movement.
- SEC-NE-06 — bounded measure/voice structure and relation-free fresh-ID copy/paste.
- SEC-NE-07 — advanced current-schema authoring composition.
- SEC-NE-XML-ROUNDTRIP — bounded notation serializer-profile export/re-import.
- SEC-NE-08 — derivative Guitar/TAB authoring companion.
- SEC-NE-09 — single-session SesliTab host integration.

## SSE-00 vNext architecture candidate

The next public-schema expansion is deliberately versioned rather than hidden inside v1 exact-key objects.

```text
current runtime
ScoreDocument 1.0.0 + NotationDocument 1.0.0
        |
        | explicit lossless migration only
        v
proposed vNext
ScoreDocumentV2 2.0.0 + NotationDocumentV2 2.0.0
```

SSE-00 changes documentation only. Current validators must continue rejecting version 2 input until a later approved implementation stage introduces explicit dual-version handling.

### Grace-note authority

Current `ScoreEvent` timing requires a positive duration and participates in normal measure occupancy. A grace note therefore cannot safely be represented as a zero-duration normal event.

The vNext candidate adds voice-owned canonical grace groups:

```text
VoiceV2
  events[]       -> normal timed score events
  graceGroups[]  -> non-occupancy canonical grace material
                      |
                      +-- exact anchorEventId in same voice
                      +-- before | after
                      +-- ordered grace note/rest/chord events
```

Grace events have stable IDs and written durations but no normal timeline onset/duration. Their normalized playback-steal/make-time policy is canonical grace semantics; slash/beams/dots remain notation.

Anchor deletion cannot silently orphan a grace group. Copy/move/delete must resolve the relationship atomically or reject.

### Articulation / ornament authority

Articulations and ornaments extend event-level notation rather than creating a second score event identity.

`EventNotationV2` adds typed `articulations[]` and `ornaments[]`. Grace events receive equivalent grace-event notation collections. Arbitrary `other-articulation` / `other-ornament` values are not canonical escape hatches in the initial contract.

Numbered or spanning ornament forms such as wavy lines and double-note tremolo require explicit validated relation semantics. Renderer geometry cannot establish those relations.

### Addressing

The vNext semantic address space adds explicit identity kinds:

- `grace-group`;
- `grace-event`;
- `grace-note`.

Addresses remain document/revision/ancestry bound. Renderers expose opaque tokens mapping to these semantic identities; they never infer canonical grace ownership from coordinates.

## Migration architecture

### v1 -> v2

Lossless defaults only:

- `Voice.graceGroups = []`;
- event articulations = `[]`;
- event ornaments = `[]`;
- grace-notation collections = `[]`.

No musical semantic is invented.

### v2 -> v1

Downgrade is accepted only when all v2-only structures are empty. Otherwise reject with typed `DOWNGRADE_UNREPRESENTABLE` evidence identifying the paths that would be lost.

A session may never maintain separately mutable v1 and v2 score authorities. Version conversion occurs at an explicit boundary, then one canonical version owns the session.

## MusicXML vNext boundary

MusicXML 4.0 represents grace notes as `<note>` with `<grace>` and without normal `<duration>`, and places articulations/ornaments under `<notations>`. A future v2 importer/exporter therefore receives a separate explicit profile until the cutover is complete.

Source-specific timing attributes are normalized; raw MusicXML `divisions` never become canonical grace state. Unsupported/ambiguous anchoring or ornament relations reject instead of disappearing.

Legacy v1 importer behavior must not broaden silently.

## SesliTab / renderer / Guitar compatibility

The existing authority topology remains unchanged during schema expansion:

```text
source/evidence
  -> one canonical score+notation version
  -> unified editor history
  -> RenderRequest + opaque semantic tokens
  -> renderer / SesliTab host
```

Guitar Workspace remains derivative-only. A v2 feature must have an explicit safe Guitar projection policy or be rejected by that projection; it cannot be silently rewritten.

Playback remains separate from edit admission.

## Human gates

SSE-00 design documentation may merge with no runtime schema change.

Implementation of public `ScoreDocumentV2` / `NotationDocumentV2` and the canonical session cutover requires explicit acceptance of the frozen vNext contract. Staff/part topology, E8-D engine invocation, persistence/network authority and production/public-write activation remain separate gates.

## Dependencies / invariants

Runtime dependencies remain only `saxes@6.0.0` and `xmlchars@2.2.0`; build-only remains `typescript@6.0.3` and `esbuild@0.28.2`. SSE-00 requires no dependency change. Source immutability, revision binding, fail-closed validation, unified history, renderer isolation, derivative Guitar authority and no-production-by-merge remain active.
