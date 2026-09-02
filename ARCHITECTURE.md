# ST Score Editor Core — Architecture

Status: **Core remains implemented through E8-C. SEC-SMUFL-KEYPAD-01 is complete through SEC-KP-10. SEC-NE is COMPLETE / MERGED through SEC-NE-06 for bounded note entry, legal-gap materialization, retiming, measure/voice structure and identity-safe copy/paste.**

## 1. Canonical authority

`ScoreDocument` is the single musical edit authority. `NotationDocument` is same-revision notation authority. MusicXML and measure-semantics documents are exchange/evidence, renderers are presentation-only, SesliTab is orchestration-only, and OMR/Guitar outputs cannot independently mutate canonical state.

```text
MusicXML / OMR evidence
        ↓
safe import adapters
        ↓
ScoreDocument + same-revision NotationDocument/evidence
        ↓
SemanticAddress / Selection / InsertionPosition
        ↓
typed bounded authoring operation
        ↓
independent validation
        ↓
atomic child revision or no mutation
        ↓
unified score+notation history
        ↓
RenderRequest / presentation renderer / host
```

## 2. Implemented SEC-NE layers

- `editor-note-entry` — selected explicit-rest entry.
- `editor-insertion-position` — revision-bound semantic cursor.
- `editor-measure-timing` — exact timing/occupancy veto.
- `editor-position-note-entry` — explicit-rest position entry.
- `musicxml-measure-semantics` — bounded source measure/time evidence.
- `editor-implicit-gap-materialization` — proven normal-measure silence → explicit rest.
- `editor-event-retiming` — relation-safe same-measure single-event onset movement.
- `editor-triplet-retiming` — atomic exact supported 3:2 triplet movement.
- `editor-structural-authoring` — bounded measure/voice add/remove.
- `editor-copy-paste` — relation-free source voice → empty target voice with fresh identities.

Existing `notation-commands` remain the structural notation authority for time signature, key signature, clef and barline state.

## 3. SEC-NE-06 structural model

### Measure authoring

`ADD_MEASURE_AFTER` inserts a new measure after one exact current measure. Caller supplies a globally fresh measure ID and globally fresh initial empty voice ID. Existing measure IDs and display numbers are not silently rewritten; canonical sibling ordinals are normalized.

`REMOVE_EMPTY_MEASURE` is destructive and therefore narrower: all voices must be empty, the staff must retain another measure, and there must be no measure-level notation entry whose target would disappear. Otherwise it rejects.

### Voice authoring

`ADD_EMPTY_VOICE` adds one fresh empty voice to an exact measure. `REMOVE_EMPTY_VOICE` only removes an empty voice when another voice remains. Voice ordinals are normalized deterministically; existing IDs do not change.

### Copy/paste

`COPY_VOICE_TO_EMPTY_VOICE` copies exact canonical source events into one exact empty target voice. Every destination event/note ID is explicitly supplied and must be globally fresh. Source onsets, durations and pitches are preserved.

Copy v1 rejects any source beam, tuplet, tie or slur coupling. This is deliberate: copying relation markers without an explicit relation-identity/range contract could create ambiguous or unintended endpoints. Safe accidental/dot notation can be cloned with fresh semantic targets.

After paste, the complete target voice must pass `editor-measure-timing`. MusicXML-derived target measures additionally require current safe 04B1 evidence.

## 4. Structural topology boundary

Whole staff/part add/remove remains unadmitted. The current public model does not yet freeze enough topology semantics for:

- cross-staff measure correspondence;
- equal/unequal measure-count policy across staves;
- staff-to-part notation ownership;
- safe removal of cross-staff or derivative relationships;
- deterministic creation of a complete staff/part skeleton.

These facts cannot be guessed from renderer layout or existing array shape. A future topology contract must make them explicit before staff/part mutation becomes canonical authority.

## 5. Revision/history/evidence

Every accepted mutation creates one direct child score revision and one same-revision notation snapshot. Structural removal must not orphan notation. Copy/paste creates fresh semantic identities. Old revision-bound addresses, insertion positions, render requests and 04B1 evidence become stale after mutation and cannot be replayed.

## 6. Remaining stages

- **SEC-NE-07:** advanced authoring that fits current score/notation contracts; features requiring public schema expansion remain human-gated.
- **SEC-NE-XML-ROUNDTRIP:** golden semantic preservation/equivalence hardening.
- **SEC-NE-08:** Guitar/TAB authoring composition with derivative fingering authority.
- **SEC-NE-09:** SesliTab product integration without dual-write.

## 7. Dependencies and invariants

Runtime remains only `saxes@6.0.0` and `xmlchars@2.2.0`; build-only remains `typescript@6.0.3` and `esbuild@0.28.2`.

Non-negotiable invariants: source immutability, canonical ScoreDocument authority, current revision validation, independent timing veto, fail-closed relation semantics, no renderer-coordinate authority, no hidden dual-write, no production/public-write activation by merge, and no implicit new dependency.
