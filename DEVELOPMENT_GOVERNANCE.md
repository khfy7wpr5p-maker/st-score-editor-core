# Development Governance

## Branching

- Never develop directly on `main`.
- Each bounded stage/package is developed on a dedicated branch and reviewed through a pull request.
- Merge only after applicable CI is green and the exact PR head has been reviewed for scope drift.

## Change classes

### Autonomous-safe
May proceed without a new human decision when already inside an approved stage:
- implementation matching frozen contracts;
- unit/property/regression tests;
- documentation synchronization;
- refactors that preserve public/domain contracts;
- security hardening that only tightens existing gates;
- CI improvements that do not reduce coverage or policy.

### Human-gated
Stop before:
- repository license selection/change;
- adding dependencies with material license/provenance uncertainty;
- production/public write activation;
- AI/OMR authority expansion;
- weakening validation, source immutability or fail-closed behavior;
- admitting rights-unclear training/test assets;
- changing ScoreMosaic vs Guitar TAB authority ownership;
- breaking/versioning a public contract after downstream consumers exist.

## Evidence

Every stage closure should record:
- exact source/head SHA;
- tests/checks run;
- dependency state;
- known limitations;
- whether production/runtime authority changed (normally `false`).

## Dependency policy

Default posture is zero runtime dependencies until a capability requires one. Any new dependency must have:
- exact/pinned version policy;
- upstream/source identity;
- license review;
- security/maintenance review;
- compatibility evidence;
- documented authority boundary.

Renderer libraries remain replaceable adapters and cannot own the canonical score model.

## Fixtures

Fixtures must be synthetic, first-party, public-domain, or have explicit compatible permission. No real user uploads, secrets, private scores, or rights-unclear corpora belong in normal Git history.

## Merge policy

Prefer squash merge for bounded stage PRs unless preserving separate commits is needed for evidence. Do not merge with failing required checks or unresolved blocking review comments.
