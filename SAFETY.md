# Safety and Trust Boundaries

## Threat model

Potentially untrusted inputs include MusicXML/other symbolic files, upstream OMR output, renderer metadata, browser events, insertion/cursor state, AI analysis, external datasets, third-party package behavior and downstream service responses.

## Mandatory controls

1. **Immutable source** — original bytes and source identity are never rewritten.
2. **Bounded parsing** — importers enforce byte/depth/element/count/text budgets and disable unsafe external entity/network behavior.
3. **Single canonical authority** — `ScoreDocument` is the musical edit authority; MusicXML, renderer objects and host state are not.
4. **Stable semantic targets** — authoritative edits cannot target DOM/SVG coordinates alone.
5. **Revision binding** — `SemanticAddress`, `SelectionSnapshot`, `InsertionPosition`, notation evidence and RenderRequest identity must match the current canonical revision.
6. **Atomic transactions** — validation failure leaves authoritative state unchanged.
7. **Fail closed** — unsupported, ambiguous, stale or identity-mismatched edits are rejected.
8. **Timing veto** — a builder/authoring primitive cannot establish writable time by assertion; independent timing/occupancy validation is a veto gate.
9. **Renderer isolation** — renderer output is presentation evidence only.
10. **AI/OMR isolation** — AI/OMR output is advisory/evidence only unless a separately approved contract says otherwise.
11. **Product authority separation** — Editor Core, Rendering Layer, SesliTab host, OMR Correction Engine and Guitar Workspace may not silently absorb each other's authority.
12. **Provenance** — imported sources, transformations, commands and revisions require versioned identity/provenance.
13. **Supply-chain gate** — third-party dependencies require pinned versions, license/provenance/security review and CI compatibility evidence before use.
14. **No secret/user-data fixtures** — repository fixtures must be synthetic, public-domain/appropriately licensed, or explicitly approved.
15. **No production-by-merge** — merging code does not activate public upload, persistence, AI authority, publication or production services.

## SEC-NE timing and insertion safety

Current position authoring is deliberately narrower than a general notation editor.

`editor-measure-timing` is the admission authority for SEC-NE-04C. A position note-entry operation is authoring-safe only when the entire requested duration is classified as `EXPLICIT_REST_SLOT` inside one explicit rest.

The following remain fail-closed:

- pitched overlap;
- measure overflow;
- stale insertion position;
- stale notation evidence;
- implicit gaps;
- mixed explicit/implicit windows;
- invalid/zero/negative/non-canonical duration rationals;
- duplicate canonical identities.

An apparent empty time span is not proof of writable silence. Until SEC-NE-04B1/04B2 preserve pickup/incomplete-measure semantics and prove legal per-voice silence, `IMPLICIT_GAP_UNADMITTED` cannot be upgraded to authoring authority.

## MusicXML destructive-loss prevention

MusicXML is an exchange/projection format. Unsupported semantics must be rejected or explicitly preserved when silently discarding them could change musical meaning.

Current authoring safety therefore does not infer pickup/incomplete measure semantics from event spacing. Time/pickup evidence needed to admit implicit gaps is a separate additive stage.

## Revision/history safety

Where a mutable operation is exposed through editor composition:

- score and notation must share the same revision;
- accepted score changes rebind notation or fail closed if notation targets disappear unsafely;
- history commits require direct parent lineage;
- undo/redo restores score+notation together;
- old semantic addresses/insertion positions are never replayed onto a newer revision;
- RenderRequest is regenerated from the accepted revision only.

SEC-NE-04C itself remains a low-level primitive. Its closeout tests prove composition with notation rebinding, unified history, undo/redo and revision-bound rendering without creating a parallel history path.

## Security-sensitive human gates

Human approval is required before:

- selecting or changing repository licensing policy;
- admitting rights-unclear datasets or fixtures;
- adding a dependency with material copyleft/network-copyleft/provenance uncertainty;
- enabling AI-generated edits as anything beyond advisory proposals;
- enabling live production integrations or public write APIs;
- weakening source immutability, validation or fail-closed behavior;
- making renderer/host state canonical;
- breaking public ScoreDocument/NotationDocument contracts;
- changing OMR/Guitar ownership boundaries.

## Validation doctrine

Independent validation is a veto gate. A builder/transformer cannot establish its own correctness by assertion. Cross-format and renderer tests may add evidence but never replace semantic validation.
