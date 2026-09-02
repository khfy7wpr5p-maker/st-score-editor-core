# Safety and Trust Boundaries

## Threat model

Potentially untrusted inputs include MusicXML/other symbolic files, upstream OMR output, renderer metadata, browser events, insertion/cursor state, revision-bound sidecar evidence, retiming targets, AI analysis, external datasets, third-party package behavior and downstream service responses.

## Mandatory controls

1. **Immutable source** — original bytes and source identity are never rewritten.
2. **Bounded parsing** — importers enforce byte/depth/element/count/text budgets and disable unsafe external entity/network behavior.
3. **Single canonical authority** — `ScoreDocument` is musical edit authority; MusicXML, evidence, renderer objects and host state are not.
4. **Stable semantic targets** — edits cannot target DOM/SVG coordinates alone.
5. **Revision binding** — addresses, selections, insertion positions, notation, measure evidence and render requests must match the current revision.
6. **Atomic mutation** — validation failure leaves authoritative state unchanged.
7. **Fail closed** — unsupported, ambiguous, stale or identity-mismatched operations reject.
8. **Independent timing veto** — mutation primitives cannot establish writable time by assertion.
9. **Evidence is not authority by itself** — 04B1 evidence must be cross-checked against canonical timing.
10. **Relation preservation** — beam, tuplet, tie and slur semantics may not be silently changed by event-order mutation.
11. **Renderer isolation** — presentation only.
12. **AI/OMR isolation** — advisory/evidence only unless separately admitted.
13. **Product authority separation** — Editor Core, Rendering Layer, SesliTab, OMR Correction Engine and Guitar Workspace cannot silently absorb each other's authority.
14. **Provenance** — imported sources, transformations, commands and revisions require versioned identity/provenance.
15. **Supply-chain gate** — new dependencies require pin/license/provenance/security/CI review.
16. **No user-data fixtures** — fixtures must be synthetic/public-domain/appropriately licensed or explicitly approved.
17. **No production-by-merge** — merge does not activate public upload, persistence, publication, AI authority or production services.

## Explicit-rest and implicit-gap safety

04A directly authorizes only `EXPLICIT_REST_SLOT` windows. 04C may replace/split that one explicit rest without moving unrelated events. 04B2 may materialize exactly one proven normal-measure target-voice implicit gap into one fresh explicit rest after current 04B1 evidence and independent 04A timing agree.

Pickup/`implicit="yes"`, non-controlling, unknown-meter, cross-voice inference and renderer-geometry gap authority remain fail-closed.

## SEC-NE-05 retiming safety

SEC-NE-05 adds canonical onset mutation only through explicit low-level contracts.

### Single-event movement

`MOVE_EVENT/1.0.0` requires an exact current `EventAddress`, a canonical non-negative new onset and one same-measure/same-voice target. The operation preserves event/note identity, duration and pitch.

It rejects when:

- target event has beam or tuplet notation;
- any note inside target event has tie or slur marks;
- moving the target across another event would cross beam/tuplet/tie/slur-sensitive notation;
- the result overlaps another event;
- the event would extend beyond the active measure;
- MusicXML measure evidence is missing/stale/unsafe;
- the source measure is `implicit="yes"`, `non-controlling="yes"`, or unknown-meter;
- target/notation/identity is stale or malformed.

After mutation, the complete target voice is independently re-analyzed by SEC-NE-04A. The primitive does not trust its own reorder calculation as proof of safety.

### Atomic current 3:2 triplet movement

`MOVE_TRIPLET_GROUP/1.0.0` may move the currently supported triplet profile only as one atomic group. It requires:

- three distinct consecutive events in one current measure/voice;
- equal canonical durations;
- contiguous canonical timing;
- explicit `actualNotes=3`, `normalNotes=2` notation on all three;
- one exact start mark, marker-free middle, matching stop mark;
- no beam coupling in v1;
- no tie/slur coupling in v1.

The three new onsets are derived deterministically from one new group start and existing equal durations. Partial tuplets cannot be retimed. The final whole voice is revalidated by SEC-NE-04A.

### Intentionally unsupported retiming

- cross-measure movement;
- independent movement of a tuplet member;
- independent movement of beamed/tied/slurred events;
- arbitrary tuplet ratios or ranges outside the admitted current 3:2 profile;
- relation rewrites inferred from event proximity;
- renderer-coordinate drag authority.

These cases reject rather than silently alter musical semantics.

## History safety

When a low-level mutation is composed into editor history:

- score and notation share one revision;
- accepted score edits rebind notation or fail closed;
- history requires direct parent lineage;
- undo/redo restores score+notation together;
- old semantic/insertion/evidence identities are never reused as current;
- RenderRequest is regenerated only from accepted state.

05 regressions prove both single-event and atomic triplet retiming compose as one unified revision.

## Security-sensitive human gates

Human approval remains required before:

- repository license policy changes;
- rights-unclear datasets/fixtures;
- material new dependency/license uncertainty;
- AI-generated canonical edit authority;
- live production/public write activation;
- weakening source immutability, validation or fail-closed behavior;
- renderer/host canonical authority;
- breaking public ScoreDocument/NotationDocument contracts;
- OMR/Guitar ownership boundary changes.

## Validation doctrine

Independent validation is a veto gate. Builders/transformers cannot establish their own correctness by assertion. Cross-format and renderer tests add evidence but never replace semantic validation.
