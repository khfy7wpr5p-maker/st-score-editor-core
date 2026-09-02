# Insertion and Timing Authority

Status: current-reality contract after SEC-NE-04C merge `8e486617fdc6eefad3586f2c4fdcc7db7c04b889`.

## Core rule

Writable musical time is a canonical semantic fact, not a renderer-coordinate fact.

A screen/page/SVG/DOM position may help a host propose where the user pointed, but authoring may proceed only after that proposal is converted to a current revision-bound `InsertionPosition` and independently admitted by canonical timing analysis.

## InsertionPosition

The current insertion identity contains:

```text
InsertionPosition {
  contractVersion
  documentId
  revisionId
  partId
  staffId
  measureId
  voiceId
  onset
}
```

It is bound to one exact canonical document/revision/path and a non-negative rational onset. A stale position is invalid and cannot be replayed against a later revision.

## Timing admission authority

`editor-measure-timing` from SEC-NE-04A is the current admission authority for position-based note entry.

It must:

- verify score/notation revision identity;
- resolve effective time signature by canonical notation inheritance;
- derive exact rational measure duration;
- derive exact event intervals for the requested voice;
- reject overlapping events;
- reject events/windows beyond the measure span;
- distinguish pitched occupation from explicit rest and implicit silence.

Current classes:

- `EXPLICIT_REST_SLOT` — authoring-safe when the full requested duration is contained in one explicit rest;
- `BLOCKED_PITCHED` — rejected;
- `OUTSIDE_MEASURE` — rejected;
- `IMPLICIT_GAP_UNADMITTED` — rejected;
- `MIXED_UNADMITTED` — rejected.

## SEC-NE-04C mutation rule

`editor-position-note-entry` may mutate only after the timing analyzer admits the exact full window as `EXPLICIT_REST_SLOT`.

It may produce:

- note + trailing rest at rest start;
- leading rest + note + trailing rest in the middle;
- leading rest + note at rest end;
- note only for exact rest fill.

The original admitted rest event id becomes the inserted note event id. Fresh note/rest ids must not collide with any canonical id. Other event onsets are unchanged.

The final candidate must pass canonical `ScoreDocument` validation or the entire operation fails.

## Why implicit gaps remain blocked

An apparent gap between events does not prove that the span is legal writable silence. It may reflect pickup/incomplete measure semantics or source timing evidence not currently admitted into canonical authoring authority.

SEC-NE-04B1 must first preserve sufficient measure semantics. SEC-NE-04B2 may then prove legal per-voice silence and materialize explicit rests deterministically.

No renderer geometry, event spacing heuristic or cross-voice inference can bypass these stages.

## Multi-voice rule

Timing evidence is voice-specific. A gap in one voice cannot be inferred from another voice's occupancy, and one voice's events cannot establish writable time in another voice.

Future implicit-gap admission must prove the legal span for the exact target voice and measure semantics.

## History and rendering composition

When a primitive result is exposed as an editor operation, it must compose through:

```text
accepted ScoreDocument child revision
  -> same-revision NotationDocument rebind/update
  -> unified history commit
  -> new revision-bound RenderRequest
```

Undo/redo restores the exact unified snapshots. Old `SelectionSnapshot`, `InsertionPosition` and RenderRequest identities are never reused as current authority.

SEC-NE-04C is currently low-level only; no second public cursor-entry session/browser API is claimed.

## Future onset authority

SEC-NE-05 is a separate authority expansion for moving/retiming existing events. It must not be smuggled into insertion logic.

Before onset mutation is admitted, the design must freeze overlap/measure validation and coupling rules for ties, slurs, beams and tuplets. Tuplet retiming must be atomic.
