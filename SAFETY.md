# Safety and Trust Boundaries

## Threat model

Potentially untrusted inputs include MusicXML/other symbolic files, upstream OMR output, renderer metadata, browser events, insertion/cursor state, revision-bound sidecar evidence, AI analysis, external datasets, third-party package behavior and downstream service responses.

## Mandatory controls

1. **Immutable source** — original bytes and source identity are never rewritten.
2. **Bounded parsing** — importers enforce byte/depth/element/count/text budgets and disable unsafe external entity/network behavior.
3. **Single canonical authority** — `ScoreDocument` is musical edit authority; MusicXML, evidence, renderer objects and host state are not.
4. **Stable semantic targets** — edits cannot target DOM/SVG coordinates alone.
5. **Revision binding** — addresses, selections, insertion positions, notation, measure evidence and render requests must match the current revision.
6. **Atomic mutation** — validation failure leaves authoritative state unchanged.
7. **Fail closed** — unsupported, ambiguous, stale or identity-mismatched operations reject.
8. **Independent timing veto** — a mutation primitive cannot establish writable time by assertion.
9. **Evidence is not authority by itself** — 04B1 evidence must be independently cross-checked against current canonical timing before 04B2 can materialize anything.
10. **Renderer isolation** — presentation only.
11. **AI/OMR isolation** — advisory/evidence only unless separately admitted.
12. **Product authority separation** — Editor Core, Rendering Layer, SesliTab, OMR Correction Engine and Guitar Workspace cannot silently absorb each other's authority.
13. **Provenance** — imported sources, transformations, commands and revisions require versioned identity/provenance.
14. **Supply-chain gate** — new dependencies require pin/license/provenance/security/CI review.
15. **No user-data fixtures** — fixtures must be synthetic/public-domain/appropriately licensed or explicitly approved.
16. **No production-by-merge** — merge does not activate public upload, persistence, publication, AI authority or production services.

## Explicit-rest authoring safety

04A directly authorizes only `EXPLICIT_REST_SLOT` windows. 04C may then replace/split that one explicit rest without moving unrelated events.

Pitched overlap, measure overflow, stale state, mixed windows, invalid rationals and duplicate identities remain fail-closed.

## SEC-NE-04B1 evidence safety

04B1 preserves bounded source measure/time semantics and independently validates evidence structure, cursor arithmetic, source-measure uniqueness and meter inheritance consistency.

A short measure alone is never pickup evidence. `implicit` and `non-controlling` remain distinct facts.

## SEC-NE-04B2 implicit-gap safety

04B2 adds a deliberately narrow mutation authority: **add exactly one explicit rest into one proven target-voice implicit gap**.

Materialization is allowed only when:

- the 04B1 evidence document is valid and current;
- the insertion position and notation are current;
- 04A independently classifies the requested window as target-voice `IMPLICIT_GAP_UNADMITTED`;
- the requested window is contained by one exact implicit-gap interval;
- evidence meter equals independently derived 04A meter;
- `implicit` is not `yes`;
- `non-controlling` is not `yes`;
- the new rest ID is globally fresh;
- the final canonical score validates.

The transformation materializes the **entire containing gap**. This avoids arbitrary partial gap segmentation and guarantees a deterministic result.

04B2 may not:

- infer a pickup from measure length or event spacing;
- materialize `implicit="yes"` measures;
- materialize `non-controlling="yes"` measures;
- use another voice to prove the target voice is empty;
- move, shorten, extend or delete an existing event;
- infer from renderer geometry;
- bypass 04A or 04B1;
- directly create a pitched note.

After materialization, previous 04B1 evidence is stale because the canonical revision changed. It must be re-derived/rebound as required before any later evidence-dependent operation.

## History safety

When a low-level mutation is composed into editor history:

- score and notation share one revision;
- accepted score edits rebind notation or fail closed;
- history requires direct parent lineage;
- undo/redo restores score+notation together;
- old semantic/insertion/evidence identities are never reused as current;
- RenderRequest is regenerated only from accepted state.

04B2 regression proves unified history undo/redo composition without creating a parallel history path.

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
