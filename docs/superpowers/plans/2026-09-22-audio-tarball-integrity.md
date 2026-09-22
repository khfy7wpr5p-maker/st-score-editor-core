# Verified Audio Tarball Integrity Implementation Plan

**Goal:** eliminate direct remote audio tarball installation and enforce pinned SHA-512 before npm sees the package bytes.

## Task 1 — RED contract tests

Modify `test/audio-release-tarball-integrity.test.mjs` to require:

- no remote audio URLs in `package.json`;
- exact release manifest and integrity values;
- mismatch-before-install behavior;
- local-only npm install arguments;
- all current Editor Core CI/WebKit jobs invoke the verified installer.

Run full CI and retain the expected RED reason.

## Task 2 — Manifest + installer

Create:

- `contracts/audio-release-dependencies-v1.json`
- `scripts/install-verified-audio-dependencies.mjs`

Installer requirements:

- validate exact repository/tag/commit/package identities;
- fetch once;
- SHA-512 verify before write/install;
- fail closed;
- temporary local tarballs only;
- npm launched via `process.execPath` + `npm_execpath`;
- `--ignore-scripts --no-save --no-package-lock --no-audit --no-fund`;
- cleanup in `finally`.

## Task 3 — Package/workflow migration

Modify `package.json`:

- remove direct `optionalDependencies` GitHub tarball URLs;
- add `install:verified-audio`.

Modify all current build workflows:

- `.github/workflows/ci.yml`
- `.github/workflows/app09b-preview-webkit.yml`
- `.github/workflows/p08e4-professional-webkit.yml`
- `.github/workflows/p10-1-professional-workstation-webkit.yml`
- `.github/workflows/p10-1-renderer-qualification-webkit.yml`
- `.github/workflows/p10-2-triplet-unretiming-webkit.yml`

Each Editor Core job must run `npm run install:verified-audio` after base dependencies and before build/test.

## Task 4 — GREEN + regression

Require exact-head:

- Node 18/20/22 PASS;
- full suite PASS;
- APP-09B WebKit PASS;
- P08-E4 WebKit PASS;
- P10-1 workstation PASS;
- P10-1 renderer qualification PASS;
- P10-2 Triplet Unretiming PASS.

Update Sonar triage rows 13–14 from `REVIEW_REQUIRED` only after this verified consumer-side integrity path is green.

Stop before merge.
