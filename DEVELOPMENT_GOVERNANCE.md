# Development Governance

## Branching

- Never develop directly on `main`.
- Each bounded stage/package is developed on a dedicated branch and reviewed through a pull request.
- Merge only after applicable CI is green and the exact PR head has been reviewed for scope drift.
- Prefer squash merge for bounded stage PRs unless preserving separate commits is required for evidence.

## Change classes

### Autonomous-safe

May proceed without a new human decision when already inside an approved stage:

- non-breaking additive internal packages;
- typed intents, validators and read-only analyzers;
- implementation matching frozen contracts;
- unit/property/regression/integration tests;
- documentation reality refresh;
- refactors that preserve public/domain contracts;
- security hardening that only tightens existing gates;
- CI fixes that do not reduce coverage, validation or fail-closed behavior;
- green non-breaking PR merge after exact diff review.

SEC-NE examples currently autonomous-safe include additive timing evidence, explicit-rest validators and documentation synchronization so long as canonical authority and public schemas are not broken.

### Human-gated

Stop before:

- breaking/versioning `ScoreDocument` after downstream use;
- breaking/versioning `NotationDocument` after downstream use;
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

If SEC-NE-04B1 cannot preserve pickup/incomplete-measure evidence additively and requires a breaking public score/notation schema change, development must stop at this gate.

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
- blur Editor Core vs Rendering Layer vs SesliTab vs OMR/Guitar boundaries.

## Evidence

Every stage closure should record:

- exact base/head SHA;
- PR and merge SHA;
- tests/checks run;
- dependency state;
- known limitations;
- public contracts changed;
- whether canonical/runtime/production authority changed (normally `false`).

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
- disabling canonical validation.

Do not merge with failing required checks or unresolved blocking review comments.
