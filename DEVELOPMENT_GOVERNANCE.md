# Development Governance

## Branching

- Never develop directly on `main`.
- Each bounded stage/package is developed on a dedicated branch and reviewed through a pull request.
- Merge only after applicable CI is green and the exact PR head has been reviewed for scope drift.
- Prefer squash merge for bounded stage PRs unless preserving separate commits is required for evidence.

## Change classes

### Autonomous-safe

May proceed without a new human decision when already inside an approved, frozen stage:

- non-breaking additive internal packages;
- typed intents, validators and read-only analyzers;
- implementation matching frozen contracts;
- unit/property/regression/integration tests;
- documentation reality refresh;
- refactors that preserve public/domain contracts;
- security hardening that only tightens existing gates;
- CI fixes that do not reduce coverage, validation or fail-closed behavior;
- green non-breaking PR merge after exact diff review.

### Human-gated

Stop before:

- breaking/versioning `ScoreDocument` after downstream use;
- breaking/versioning `NotationDocument` after downstream use;
- changing the frozen vNext authority/migration model;
- weakening source immutability;
- weakening fail-closed validation or canonical validation;
- enabling production/public write authority;
- making renderer/browser/host state canonical;
- changing OMR or Guitar Workspace ownership boundaries;
- adding a runtime dependency with material license/provenance implications;
- copying source from reciprocal-license projects without explicit approval;
- repository license selection/change;
- admitting rights-unclear training/test assets;
- enabling AI/OMR output as direct canonical mutation authority.

## SCORE-SCHEMA-EXPANSION gate record

On 2026-09-02, work was approved to **design** the next schema expansion after completion of the bounded SEC-NE program.

`SSE-00` is therefore autonomous-safe as a documentation/contract-design stage because it does not modify runtime schemas.

The draft contract proposes:

- `ScoreDocumentV2 2.0.0`;
- `NotationDocumentV2 2.0.0`;
- canonical voice-owned grace groups outside normal timed occupancy;
- typed articulation/ornament notation;
- lossless v1 -> v2 migration;
- fail-closed v2 -> v1 downgrade.

This design approval is **not** implicit authorization to merge breaking/versioned runtime APIs. Before SSE-01/SSE-02 changes public score/notation contracts, the frozen vNext contract must receive explicit acceptance. Once that contract is accepted, implementation that exactly follows it may proceed autonomously stage-by-stage until another listed human gate is reached.

Whole staff/part topology remains a separate design/approval gate even after the grace/articulation/ornament vNext contract is accepted.

## Architecture documentation gate

Architecture/current-reality documentation is part of Definition of Done.

An architecture-changing PR is incomplete until affected documents are synchronized in the same PR unless governance explicitly records a linked follow-up.

Use explicit status language:

- `COMPLETE / MERGED`;
- `IN_PROGRESS / WORK BRANCH`;
- `BLOCKED`;
- `NOT STARTED`;
- `HUMAN-GATED` where applicable.

Do not:

- describe planned functionality as production-ready;
- describe a work branch as a `main` capability;
- leave diagrams that imply deprecated authority flow;
- blur Editor Core vs Rendering Layer vs SesliTab vs OMR/Guitar boundaries;
- describe a draft schema as active before its validator/cutover stage is merged.

## Evidence

Every stage closure should record:

- exact base/head SHA;
- PR and merge SHA;
- tests/checks run;
- dependency state;
- known limitations;
- public contracts changed;
- whether canonical/runtime/production authority changed.

For schema-versioning stages additionally record:

- accepted schema versions;
- migration direction and loss behavior;
- downgrade failures;
- mixed-version rejection behavior;
- MusicXML compatibility profile;
- downstream session/renderer/host compatibility evidence.

## Dependency policy

Default posture is zero new runtime dependencies until a capability requires one. Any new dependency must have:

- exact/pinned version policy;
- upstream/source identity;
- license review;
- security/maintenance review;
- compatibility evidence;
- documented authority boundary.

Renderer libraries remain replaceable adapters and cannot own the canonical score model.

## Fixtures

Fixtures must be synthetic, first-party, public-domain, or have explicit compatible permission. No real user uploads, secrets, private scores, or rights-unclear corpora belong in normal Git history.

## CI and merge policy

Every feature PR must run the repository contract validation, TypeScript build, affected integration tests, full regression suite and the supported Node matrix.

Never make CI green by:

- deleting or weakening legitimate regression tests;
- broadening fail-open fallback;
- silently ignoring unsupported MusicXML semantics;
- disabling canonical validation;
- silently dropping vNext fields during migration/downgrade.

Do not merge with failing required checks or unresolved blocking review comments.
