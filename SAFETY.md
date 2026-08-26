# Safety and Trust Boundaries

## Threat model

Potentially untrusted inputs include MusicXML/other symbolic files, upstream OMR output, renderer metadata, browser events, AI analysis, external datasets, third-party package behavior, and downstream service responses.

## Mandatory controls

1. **Immutable source** — original bytes and source identity are never rewritten.
2. **Bounded parsing** — future importers must enforce byte, depth, element/count, text, time and cancellation budgets and disable unsafe external entity/network behavior.
3. **Stable semantic targets** — authoritative edits cannot target DOM/SVG coordinates alone.
4. **Atomic transactions** — validation failure leaves authoritative state unchanged.
5. **Fail closed** — unsupported, ambiguous, stale or identity-mismatched edits are rejected.
6. **Renderer isolation** — renderer output is presentation evidence only.
7. **AI isolation** — AI output is advisory only; no autonomous mutation or validation bypass.
8. **Product authority separation** — ScoreMosaic review authority and Guitar TAB derivative authority do not flow backwards into each other.
9. **Provenance** — imported sources, transformations, commands and revisions require versioned identity/provenance.
10. **Supply-chain gate** — third-party dependencies require pinned versions, license review, provenance review and CI compatibility evidence before use.
11. **No secret/user data fixtures** — repository fixtures must be synthetic, public-domain/appropriately licensed, or explicitly approved.
12. **No production-by-merge** — merging code does not activate public upload, persistence, AI authority, publication, or production services.

## Security-sensitive human gates

Human approval is required before:

- selecting or changing repository licensing policy;
- admitting rights-unclear datasets or fixtures;
- adding a dependency with copyleft/network-copyleft or unclear model/data terms;
- enabling AI-generated edits as anything beyond advisory proposals;
- enabling live production integrations or public write APIs;
- weakening source immutability, validation or fail-closed behavior.

## Validation doctrine

Independent validation is a veto gate. A builder/transformer cannot establish its own correctness by assertion. Cross-format and renderer tests may add evidence but never replace semantic validation.
