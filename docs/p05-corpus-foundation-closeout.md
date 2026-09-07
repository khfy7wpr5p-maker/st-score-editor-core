# P05 Corpus Foundation Closeout

Status: **P05-CORPUS01 VERIFIED / P05 REMAINS IN_PROGRESS**

Branch: `p05-teacher-corpus-metrics-v1`  
PR: #146  
Verified code head: `8ed79315bb13857b527484ec7fff0a044a9c5d81`  
Verified code CI: `34104094125` — Node 18 / 20 / 22 PASS

## What P05-CORPUS01 establishes

P05 now has a typed, immutable and runtime-validated evidence boundary for product-pilot corpus work.

Package:

- `packages/editor-teacher-pilot-corpus-v1`

Committed baseline:

- `corpus/p05-teacher-pilot-baseline-v1.json`

Contract documentation:

- `docs/p05-teacher-pilot-corpus-contract.md`

## Evidence truthfulness

Three evidence levels are distinct and cannot silently substitute for one another:

- `AUTOMATED`
- `TEACHER_PILOT`
- `PHYSICAL_DEVICE`

Executed teacher evidence requires a `TEACHER` observer and a concrete evidence reference.

Executed physical-device evidence requires a `DEVICE_TESTER` observer, a concrete evidence reference, and explicit hardware/platform/OS/browser metadata.

`NOT_RUN` rows are required to contain no observer, evidence reference, or device result. This prevents planned/manual checks from being represented as completed evidence.

CI/WebKit automation therefore cannot create a physical-device PASS, and automation cannot create a teacher-pilot PASS.

## Runtime hardening

The corpus constructor validates JSON/JS inputs at runtime rather than relying only on TypeScript declarations.

It rejects unsupported or malformed:

- evidence level;
- outcome;
- observer;
- source kind;
- rights status;
- provenance booleans;
- empty/duplicate capabilities;
- duplicate case IDs;
- malformed device evidence;
- stale/tampered corpus envelopes.

## Provenance and authority

Each case records source provenance and rights status.

The v1 contract always keeps:

- `externalTrainingAuthorized: false`;
- `externalTrainingAuthority: false`;
- `productionReleaseAuthority: false`.

Corpus metadata cannot authorize external training/upload or a production release.

## Deterministic metrics

The metrics layer reports:

- total cases;
- PASS / FAIL / BLOCKED / NOT_RUN counts;
- automated / teacher-pilot / physical-device case counts;
- teacher-pilot PASS count;
- physical-device PASS count;
- deterministic per-capability outcome summaries.

Metrics describe evidence; they do not create release authority.

## Baseline reality

The initial six-case baseline deliberately records:

- automated PASS: 3;
- teacher-pilot PASS: 0;
- physical-device PASS: 0;
- teacher-pilot NOT_RUN: 1;
- physical-device NOT_RUN: 2.

No real teacher session or physical-device session was fabricated to close this tranche.

## P05 remaining work

P05 as a whole is **not complete**. Remaining work includes:

1. representative musical fixture/piece-set expansion with provenance;
2. task-level teacher acceptance criteria and measurable correction workflow metrics;
3. real teacher pilot sessions and recorded evidence;
4. physical iPhone/iPad/desktop device evidence;
5. pilot acceptance thresholds and release-gate synthesis after real evidence exists.

## Safety / authority

- No PR merge performed.
- No release, deployment or production activation performed.
- No external training/upload authorized.
- No physical-device PASS claimed.
- No teacher-pilot PASS claimed.
- No SesliTab repository work performed.
- No Smoosic integration modified.
- Existing pinned external ST Score Editor dependency remains untouched.

A roadmap/closeout final HEAD must independently pass the Node 18/20/22 CI matrix before P05-CORPUS01 closeout is final.
