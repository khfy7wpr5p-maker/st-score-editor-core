# P10-2B SonarQube Security / Issue Triage

Status: **REPOSITORY-CONTEXT TRIAGE COMPLETE / LIVE SONAR PER-ISSUE METADATA PARTIALLY UNAVAILABLE**

Date: 2026-09-22  
Project: `khfy7wpr5p-maker_st-score-editor-core`  
Analysis mode: SonarQube Cloud Automatic Analysis  
Baseline main: `cb82b4c8903a140b85f58fec147c1ee5b2f966a0`  
Observed Sonar UI total: **14 issues**  
Observed handoff Quality Gate: **Not computed**  
Observed handoff security rating: **D**

## Important evidence boundary

The authenticated Sonar UI supplied by the project owner shows 14 issues and the affected files. The current agent environment cannot retrieve Sonar's authenticated issue API, so live per-row severity, Sonar issue UUID and new-code/overall-code flags are not available.

The 14 rows below are the repository-to-rule matches that account for the 14 observed issue sites on the affected files. Rule identities are grounded in Sonar's published rule catalog and repository context. Fields that require the authenticated Sonar issue object are marked `UNAVAILABLE_FROM_CURRENT_ACCESS`; they are not invented.

## 14-row inventory

| # | Candidate Sonar rule | Baseline file:line | Type | Live severity | New/overall | Scope | Classification | Current branch action / rationale |
|---|---|---|---|---|---|---|---|---|
| 1 | S8264 — Read permissions should be defined at the job level | `.github/workflows/app09b-preview-webkit.yml:11` | Vulnerability | UNAVAILABLE_FROM_CURRENT_ACCESS | UNAVAILABLE_FROM_CURRENT_ACCESS | CI | TRUE_POSITIVE_FIX | Workflow-level `contents: read` was moved to each APP-09B job. Regression: `test/sonar-github-actions-least-privilege.test.mjs`. |
| 2 | S8264 — Read permissions should be defined at the job level | `.github/workflows/p08e4-professional-webkit.yml:9` | Vulnerability | UNAVAILABLE_FROM_CURRENT_ACCESS | UNAVAILABLE_FROM_CURRENT_ACCESS | CI | TRUE_POSITIVE_FIX | Permission moved into `professional-webkit`. Same regression gate. |
| 3 | S8264 — Read permissions should be defined at the job level | `.github/workflows/ci.yml:8` | Vulnerability | UNAVAILABLE_FROM_CURRENT_ACCESS | UNAVAILABLE_FROM_CURRENT_ACCESS | CI | TRUE_POSITIVE_FIX | Permission moved into `core`. Same regression gate. |
| 4 | S6596 — Specific version tag for image should be used | `.github/workflows/app09b-preview-webkit.yml:16` | Code Smell | UNAVAILABLE_FROM_CURRENT_ACCESS | UNAVAILABLE_FROM_CURRENT_ACCESS | CI | TRUE_POSITIVE_FIX | `ubuntu-latest` pinned to `ubuntu-24.04`. GitHub currently maps `ubuntu-latest` to Ubuntu 24.04, so this removes future label drift without changing the present image family. |
| 5 | S6596 — Specific version tag for image should be used | `.github/workflows/app09b-preview-webkit.yml:89` | Code Smell | UNAVAILABLE_FROM_CURRENT_ACCESS | UNAVAILABLE_FROM_CURRENT_ACCESS | CI | TRUE_POSITIVE_FIX | Second APP-09B job pinned to `ubuntu-24.04`. |
| 6 | S6596 — Specific version tag for image should be used | `.github/workflows/p08e4-professional-webkit.yml:14` | Code Smell | UNAVAILABLE_FROM_CURRENT_ACCESS | UNAVAILABLE_FROM_CURRENT_ACCESS | CI | TRUE_POSITIVE_FIX | P08-E4 job pinned to `ubuntu-24.04`. |
| 7 | S6596 — Specific version tag for image should be used | `.github/workflows/ci.yml:14` | Code Smell | UNAVAILABLE_FROM_CURRENT_ACCESS | UNAVAILABLE_FROM_CURRENT_ACCESS | CI | TRUE_POSITIVE_FIX | Node matrix job pinned to `ubuntu-24.04`. |
| 8 | S5725 — Remote artifacts should not be used without integrity checks | `scripts/assemble-app09b-preview-stable.mjs:12` | Security Hotspot | UNAVAILABLE_FROM_CURRENT_ACCESS | UNAVAILABLE_FROM_CURRENT_ACCESS | build/diagnostic | FALSE_POSITIVE_CANDIDATE | Renderer repo URL is followed by an immediate detached checkout of exact `APP09B_RENDERER_SOURCE_REVISION`; install uses `--ignore-scripts`. No unpinned renderer revision is executed. Keep for authenticated Sonar hotspot review rather than weakening the exact-revision contract. |
| 9 | S4036 — Searching OS commands in PATH is security-sensitive | `scripts/assemble-app09b-preview-stable.mjs:286` | Security Hotspot | UNAVAILABLE_FROM_CURRENT_ACCESS | UNAVAILABLE_FROM_CURRENT_ACCESS | build/diagnostic | ACCEPTED_RISK_CANDIDATE | Command is literal `git`; args are bounded constants/exact repo path. Path is used only by explicit renderer-refresh diagnostic flow. Cross-platform absolute-path replacement would reduce portability and does not address an attacker who already controls the developer/runner environment. |
| 10 | S4036 — Searching OS commands in PATH is security-sensitive | `scripts/assemble-app09b-preview-stable.mjs:287` | Security Hotspot | UNAVAILABLE_FROM_CURRENT_ACCESS | UNAVAILABLE_FROM_CURRENT_ACCESS | build/diagnostic | ACCEPTED_RISK_CANDIDATE | Literal `git checkout --detach` with exact revision; no user-provided executable or revision. |
| 11 | S4036 — Searching OS commands in PATH is security-sensitive | `scripts/assemble-app09b-preview-stable.mjs:292` | Security Hotspot | UNAVAILABLE_FROM_CURRENT_ACCESS | UNAVAILABLE_FROM_CURRENT_ACCESS | build/diagnostic | ACCEPTED_RISK_CANDIDATE | Literal `npm`; install explicitly uses `--ignore-scripts --no-audit --no-fund --no-package-lock`; only the explicit refresh path reaches it. |
| 12 | S4036 — Searching OS commands in PATH is security-sensitive | `scripts/assemble-app09b-preview-stable.mjs:296` | Security Hotspot | UNAVAILABLE_FROM_CURRENT_ACCESS | UNAVAILABLE_FROM_CURRENT_ACCESS | build/diagnostic | ACCEPTED_RISK_CANDIDATE | Literal `npm run export:workstation-runtime` after exact detached renderer checkout; no user-controlled executable string. |
| 13 | S5725 — Remote artifacts should not be used without integrity checks | `package.json:25` | Security Hotspot | UNAVAILABLE_FROM_CURRENT_ACCESS | UNAVAILABLE_FROM_CURRENT_ACCESS | install/build | REVIEW_REQUIRED | Direct HTTPS audio-contract tarball is version-pinned but `package.json` itself does not enforce its published SHA-256. Upstream v0.1.2 release workflow generates `SHA256SUMS.txt`; consumption-side enforcement needs a bounded install design rather than a suppression. |
| 14 | S5725 — Remote artifacts should not be used without integrity checks | `package.json:26` | Security Hotspot | UNAVAILABLE_FROM_CURRENT_ACCESS | UNAVAILABLE_FROM_CURRENT_ACCESS | install/build | REVIEW_REQUIRED | Same supply-chain boundary for `@st/score-audio-web`. Do not mark safe until checksum/integrity enforcement is designed and tested. |

## Root-cause fixes completed on the P10-2B branch

### S8264

Root cause: repository workflows granted read-only token permissions at workflow scope instead of each job scope.

TDD evidence:

1. RED commit `87765351573ee97769e2154ed17da9590a456c97`
2. CI #924: 827 tests / 826 pass / 1 fail
3. failure reason: workflow-level `contents: read`
4. fixed in:
   - `5eb66d6ffdce1d22e26fd708deaf28add2991e1f`
   - `33ca6ee93724677d3f978f99a26410b164aa80dc`
   - `3a4b584345ac58a1d365469ae2a03e1d2bb2fdaf`
5. CI #925: Node 18/20/22 PASS; 827/827 PASS on Node 22.

### S6596

Root cause: four CI jobs used the moving `ubuntu-latest` runner label.

TDD evidence:

1. RED commit `29cedc09f9eec389582b4521bc35082758096c58`
2. CI #926: 827 tests / 826 pass / 1 fail
3. failure reason: APP-09B workflow still used `ubuntu-latest`
4. fixed in:
   - `2d24069fb067e2fa2ee7b1ce775acf69c6157b07`
   - `17065bfe7e95976cd7692978168ccb8ca0ff8db9`
   - `b1c286579b6715d9397be822b49061735b5cc8a9`
5. CI #928: Node 18/20/22 PASS; 827/827 PASS on Node 22.
6. Exact-head retained WebKit at `b1c286579b6715d9397be822b49061735b5cc8a9`:
   - APP-09B preview WebKit #314 PASS
   - P08-E4 professional artifact WebKit #145 PASS
   - P10-1 professional workstation WebKit #69 PASS
   - P10-1 renderer qualification WebKit #64 PASS
   - P10-2 Triplet Unretiming WebKit #36 PASS

## Upstream audio integrity evidence

The `st-score-audio-engine` v0.1.2 release workflow packages both tarballs and generates `SHA256SUMS.txt` using `sha256sum`.

This means rows 13–14 are not missing producer-side checksums. The remaining gap is **consumer-side enforcement inside Editor Core installation**.

Do not remove the official package boundary or duplicate the audio contract merely to silence Sonar.

## Scanner/configuration ruling

- Keep SonarQube Cloud Automatic Analysis.
- Do not add `sonar-project.properties`.
- Do not add a duplicate GitHub Actions Sonar scanner.
- Do not request/add `SONAR_TOKEN` merely to duplicate Automatic Analysis.
- Do not add `//NOSONAR` or global exclusions.
- Do not claim Sonar Quality Gate PASS until SonarQube Cloud itself reports PASS.

## Remaining decision queue

### Authenticated Sonar review

Rows 8–12 require the authenticated Sonar hotspot state to be set only after human/service review confirms the repository-context reasoning.

### Audio tarball integrity

Rows 13–14 remain `REVIEW_REQUIRED`.

The next bounded security design should decide between:

1. a lock/integrity-aware npm installation contract;
2. a verified release-asset bootstrap that checks the producer's pinned SHA-256 before local package installation; or
3. migration to a package registry/provenance path that supplies integrity metadata natively.

Any option must preserve the existing official `@st/score-audio-contracts` / `@st/score-audio-web` boundary and current audio admission tests.

## Service truth

Quality Gate remains **not claimed** from this document. The authenticated Sonar service must be re-read after Automatic Analysis processes the branch. CI/WebKit success is not a Sonar Quality Gate PASS.
