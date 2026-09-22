# Verified Audio Tarball Consumption Design

Status: **APPROVED FOR IMPLEMENTATION / P10-2B SONAR FOLLOW-UP**

Date: 2026-09-22  
Repository: `khfy7wpr5p-maker/st-score-editor-core`

## Problem

`package.json` currently names two GitHub Release tarball URLs directly as optional dependencies:

- `@st/score-audio-contracts@0.1.0`
- `@st/score-audio-web@0.1.2`

The upstream v0.1.2 release workflow publishes SHA-256 checksums, but Editor Core's npm consumption path does not itself enforce an immutable checksum before npm accepts the tarball.

## Chosen design

Remove remote tarball URLs from `package.json`.

Add a repository-owned release manifest that pins:

- upstream repository;
- release tag;
- release commit;
- package name/version;
- exact release URL;
- exact npm-observed SHA-512 integrity.

Add a verified installer that:

1. reads and validates the manifest;
2. downloads each tarball once;
3. computes `sha512-<base64>`;
4. fails closed before installation on any mismatch;
5. writes only verified bytes to a temporary local tarball;
6. invokes npm through `process.execPath + npm_execpath`, not a PATH search for `npm`;
7. installs only those verified local tarballs with `--ignore-scripts --no-save --no-package-lock --no-audit --no-fund`;
8. removes temporary tarballs after completion.

The installer is invoked explicitly after the repository's base dependency install in every current Editor Core CI/WebKit workflow.

## Pinned integrity values

These values were observed independently by npm on exact Editor Core CI head `4a2c9d170951dd1389d51a34faafca33cbecaec8` after resolving the official v0.1.2 GitHub Release tarballs:

- `@st/score-audio-contracts@0.1.0`  
  `sha512-w5esj/tbxipcdxQhIIRZkemThsbP1r8KZKBVSBzt6UjQYWKBASyTsRW3Q+ScFC2ymbHPTU1RSfRLyMOnapDPlQ==`
- `@st/score-audio-web@0.1.2`  
  `sha512-ajmk2ATxfzn815WDamE6faDANAdCs8GRZ50gxmC0YjdjXTcDmX5pLWjsSyV1tMBuVPFfk+isVaAql2m4rRynMw==`

## Safety invariants

- no package is installed before its pinned integrity matches;
- no fallback to an unverified remote URL;
- no install-script execution;
- no package-lock policy change;
- no duplicated audio contract;
- no change to audio runtime authority;
- no production/SesliTab cutover;
- checksum/integrity failure is fatal and explicit;
- network or HTTP failure is fatal and explicit;
- package identity/version mismatch in the manifest fails closed;
- temporary files are cleaned on success and failure.

## TDD requirements

RED tests must prove:

- direct GitHub tarball dependency URLs still exist before migration;
- integrity mismatch is rejected before any npm execution;
- failed download is rejected;
- malformed manifest is rejected;
- exact bytes with matching SHA-512 are accepted;
- installer npm invocation uses local tarball paths only;
- final `package.json` contains no remote tarball dependency URL;
- all six current Editor Core workflows invoke the verified installer.

## Non-goals

- no publication of new Audio Engine artifacts;
- no change to upstream release v0.1.2;
- no registry migration in this tranche;
- no package-lock introduction;
- no weakening of `--ignore-scripts`;
- no Sonar suppression.
