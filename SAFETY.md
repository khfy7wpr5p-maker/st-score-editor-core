# Safety and Trust Boundaries

## Mandatory controls

1. Source bytes/identity remain immutable.
2. `ScoreDocument` remains the single musical edit authority.
3. All semantic targets, notation and evidence must be current-revision bound.
4. Unsupported, ambiguous, stale or identity-conflicting operations fail closed.
5. Timing/overlap validation remains an independent veto.
6. Renderer/DOM/SVG/coordinates never become canonical authority.
7. Beam/tuplet/tie/slur relationships may not be silently damaged by retiming, copy or structure changes.
8. Accepted mutations create one direct child revision or none; score and notation remain aligned.
9. Third-party dependencies remain separately gated.
10. Repository merge never activates production/public-write authority.

## SEC-NE-04/05 safety baseline

04A independently validates target-voice timing. 04B1 preserves bounded measure evidence. 04B2 materializes only independently proven normal-measure silence. 05 admits same-measure relation-safe onset movement and atomic exact supported 3:2 triplet movement. Pickup/non-controlling and unsupported relation cases remain fail-closed.

## SEC-NE-06 structural safety

`editor-structural-authoring` deliberately limits destructive operations.

- New measure and voice IDs must be globally fresh.
- A new measure is explicit and starts with exactly one fresh empty voice.
- Removing a measure is allowed only if every voice is empty, the staff retains another measure, and no measure-level notation entry would be orphaned.
- Removing a voice is allowed only when it is empty and the measure retains another voice.
- Sibling ordinals are normalized deterministically after structural mutation.
- Existing semantic IDs are preserved.
- Same-revision notation rebinding must succeed; otherwise the candidate rejects.

Whole staff/part mutation is not admitted because cross-staff correspondence, measure alignment and topology ownership are not yet explicit enough to remove or synthesize safely.

## SEC-NE-06 copy/paste safety

`COPY_VOICE_TO_EMPTY_VOICE/1.0.0` is a bounded clone operation, not arbitrary paste.

- Source and target are exact current `VoiceAddress` values.
- Target voice must be empty.
- Every source event and note requires one explicit fresh destination identity in exact source order.
- Event/note identity collisions fail closed.
- Source onset, duration and pitch are copied exactly; originals remain unchanged.
- Safe event/note notation may be copied, but any beam/tuplet/tie/slur coupling rejects in v1.
- The complete pasted target voice is independently revalidated by 04A.
- MusicXML-derived targets require current 04B1 evidence and reject pickup/incomplete, non-controlling or unknown-meter measures.

This prevents copy/paste from creating hidden relation endpoints, timing overflow or identity aliases.

## History and evidence safety

After any accepted structural/copy mutation, old revision-bound measure evidence is stale by design. A later evidence-dependent operation must use evidence derived/rebound for the new revision. Undo/redo restores score+notation together.

## Human gates

Human approval remains required before breaking public `ScoreDocument`/`NotationDocument` contracts, enabling whole staff/part topology without frozen invariants, adding material dependencies/license risk, granting AI canonical edit authority, weakening validation/source immutability, granting renderer/host canonical authority, or activating production/public-write services.
