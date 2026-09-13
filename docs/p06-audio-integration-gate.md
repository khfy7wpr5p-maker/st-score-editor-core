# P06-F — Audio Integration Gate

Status: `BLOCKED_EXTERNAL_DISTRIBUTION_GATE`

Date: 2026-09-13

## Decision

P06-F does **not** activate ST Score Audio Engine inside the P06 standalone SDK stack yet.

This is intentional and fail-closed. The handoff requires Editor Core to integrate only against the official published, versioned public audio contract. The upstream repository currently contains versioned public package definitions and green automated CI, but no GitHub release or tag is published. The Editor Core P06 stack therefore must not invent a parallel local `AuditionRequest`, copy upstream contract types, or pin an unpublished source tree as though it were a released package.

## Verified upstream evidence

Repository: `khfy7wpr5p-maker/st-score-audio-engine`

Verified upstream HEAD during this gate: `779a0d9c3c3cb8d91607d3e96c60554d47de1a27`

Public package definitions present in source:

- `@st/score-audio-contracts` version `0.1.0`
- `@st/score-audio-web` version `0.1.0`

The public contract defines canonical `AuditionRequest` with `requestId`, `sourceRevisionId`, canonical MIDI pitch, `instrumentId` and bounded optional audition metadata. The web engine consumes `@st/score-audio-contracts`; Editor Core should not redefine those shapes.

Current GitHub distribution evidence:

- releases: none
- tags: none

The upstream handoff also records physical iPhone Safari audition as a separate human-device evidence gate. Automated WebKit must not be reported as physical-speaker PASS.

## Existing Editor Core evidence

Editor Core `main` already contains AUDIO-01C on merge commit `cb43122d5331c5cde6344ddfe405411569d3c3f7`, including canonical NOTE-to-audition adaptation and stale-revision fail-closed behavior. The P05/P06 product stack is intentionally diverged from that main line and must not be blindly rebased or cherry-picked merely to make P06-F appear complete.

## Admission requirements for unblocking P06-F

P06-F may proceed when all of the following are independently verified:

1. the official audio packages have an immutable published distribution identity (release/tag or equivalent package publication evidence),
2. the exact public package/version to consume is pinned and reproducible,
3. the package contract remains authoritative for `AuditionRequest`, instrument IDs and audio result/error types,
4. the P06 stack can consume the contract without creating a second score/history authority,
5. stale revision is rechecked before audition execution,
6. REST/non-note selection remains silent,
7. audio failure remains capability-local and cannot block canonical editing,
8. audition creates no `EditorSessionV4` history entry,
9. physical iPhone evidence remains separately labelled until explicitly performed.

## Current P06 capability behavior

Until the gate opens:

- `audioAudition` remains unavailable in the P06 SDK capability surface,
- no audio dependency is added to `st-score-editor-core`,
- no sample assets are copied into Editor Core,
- no local provisional audio contract is created,
- canonical edit, selection, history, import/export and generic-host lifecycle continue independently.

This blocked stage does not prevent P06-G feature-flag work or P06-H documentation/handoff work because those stages do not require an active audio implementation.
