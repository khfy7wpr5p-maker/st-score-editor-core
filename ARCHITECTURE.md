# ST Score Editor Core — Architecture

Status: Stage E0 foundation

## 1. Purpose

ST Score Editor Core is the shared semantic editing layer between symbolic score data and product-specific user interfaces. It is not an engraving engine, OMR engine, guitar optimizer, AI model host, or publication authority.

## 2. Layering

```text
External symbolic input
  -> import/safety boundary
  -> ScoreDocument
  -> semantic addressing
  -> EditCommand
  -> transaction
  -> validation
  -> accepted ScoreDocument revision
  -> serializer / typed adapter
  -> renderer adapters (presentation only)
```

Product composition:

```text
ScoreMosaic
  -> Teacher Review adapter
  -> ST Score Editor Core
  -> score renderer adapter

MusicXML-to-Guitar-TAB-Engine
  -> Guitar Workspace adapter
  -> ST Score Editor Core
  -> alphaTab-class renderer adapter
```

Advisory analysis:

```text
Score snapshot
  -> bounded analysis request
  -> external specialist
  -> typed advisory result
  -> overlay/panel
```

Analysis output cannot enter the edit path without an explicit user/system command that independently passes the same validation boundary.

## 3. Core packages

Planned package boundaries:

- `score-model`: Part, Staff, Measure, Voice, Event, Note, Rest, Chord, Tie, Beam, Tuplet and metadata.
- `musicxml`: safe import, normalization, serialization, semantic round-trip checks.
- `addressing`: stable document/part/staff/measure/voice/event/note identities and source binding.
- `commands`: typed bounded mutations.
- `history`: transactions, undo/redo and revision identity.
- `validation`: structural, rhythmic, identity and cross-reference invariants.
- `renderer-contract`: presentation-only renderer interface.
- `analysis-contract`: advisory-only analysis request/response interface.
- product adapters remain outside core authority.

## 4. Identity model

Renderer coordinates are unstable and forbidden as authoritative mutation addresses. A future selected note must resolve to a stable semantic address such as:

```text
documentId
partId
staffId
measureId
voiceId
eventId
noteId
```

IDs must survive re-rendering. When an edit intentionally replaces an entity, lineage must record replacement rather than silently reusing an incompatible identity.

## 5. Source policy

Original source bytes are immutable. A source hash/identity is recorded at import. Editing produces derived semantic revisions; it never rewrites source bytes in place.

For ScoreMosaic, an approved/validated upstream symbolic artifact is the production handoff target. Raw OMR candidates are not automatically authoritative input.

For Guitar TAB, derivative string/fret/fingering state cannot mutate upstream note pitch/onset/duration authority unless an explicit score edit is separately issued.

## 6. Edit transaction model

Every edit follows:

```text
stable target
  -> bounded EditCommand
  -> precondition checks
  -> deterministic transform
  -> validation
  -> accept revision OR reject without partial state
```

No partially-applied authoritative transaction is allowed.

## 7. Renderer boundary

Renderers may receive immutable score snapshots and return presentation metadata. They may not:

- choose authoritative note identity;
- mutate score state;
- infer accepted edits from SVG/DOM coordinates alone;
- become the source of truth for beams, ties, voices, pitches or durations;
- bypass validation.

## 8. AI/analysis boundary

AI specialists may classify, rank, explain or propose. They may not create authoritative edits, silently repair score state, bypass deterministic validation, or present uncalibrated scores as probabilities.

## 9. Stage map

- E0 — architecture, safety, governance, CI foundation.
- E1 — canonical ScoreDocument model.
- E2 — MusicXML safe import + semantic round trip.
- E3 — stable selection/addressing.
- E4 — basic edit commands + transaction + undo/redo.
- E5 — notation structure: ties, slurs, beams, tuplets, voices, signatures, clefs, barlines.
- E6 — renderer adapters.
- E7 — reusable editor UI primitives + ScoreMosaic product composition.
- E8 — guitar/TAB editing adapter.
- E9 — advisory Music Intelligence overlays.

Each stage must preserve the authority boundaries frozen here.
