# External Runtime Dependency Freeze

Status: **ACTIVE — USER DIRECTIVE**

This policy is intentionally outside the ST Score Editor Core architecture map. ST Score Editor continues as an independently developed product.

## SesliTab boundary

Until the user explicitly reopens this scope:

- do not modify the SesliTab repository;
- do not modify the existing Smoosic integration;
- do not modify SesliTab production code;
- do not create SesliTab-specific adapter, migration, cutover or integration work from the ST Score Editor roadmap;
- do not remove, replace, repin or otherwise change SesliTab's existing pinned ST Score Editor runtime/build dependency.

The existing pinned runtime/build dependency is a preservation constraint, not an ST Score Editor architectural dependency or active integration target.

## Dependency-change gate

Any future removal, replacement, repin or structural change to that existing pinned dependency requires both:

1. a separate dependency inventory that identifies the exact runtime/build references, versions, ownership and production impact; and
2. explicit user approval after that inventory is reviewed.

No dependency inventory is implied by normal ST Score Editor development, and no such inventory authorizes a change by itself.

## Allowed work

ST Score Editor Core may continue independent development, testing, documentation, SDK design and product hardening so long as that work does not mutate or require changes to SesliTab, Smoosic integration or SesliTab production code.
