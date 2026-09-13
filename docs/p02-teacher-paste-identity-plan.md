# P02 Teacher Paste Identity Plan V4

Status: **READ-ONLY PLANNER ON ISOLATED WORK BRANCH / NO CANONICAL ALLOCATION**

Package: `packages/editor-teacher-paste-identity-plan-v4/src/index.ts`

## Purpose

Prepare deterministic fresh destination event/note identity proposals only after P02-PASTE01 revalidates the exact current destination rest and source snapshot.

## Contract

`planTeacherPasteIdentitiesV4(...)`:

- requires the current score, notation, copy snapshot and exact paste admission;
- independently re-runs P02-PASTE01 against the current canonical pair;
- rejects changed/tampered admission facts;
- requires a fresh next revision ID distinct from current and immediate-parent revision IDs;
- deterministically proposes one destination event ID per copied event and one destination note ID per copied note/chord tone;
- checks all proposed IDs against every current canonical `id` and against other planned IDs;
- plans zero relation identities because the admitted P02-COPY01 profile already fails closed on relation-coupled sources;
- returns an immutable plan only.

The deterministic seed includes document ID, current revision ID, exact destination rest ID, requested next revision ID, source identity and stable source order.

## Non-authority

The planner does not:

- insert IDs into ScoreDocumentV3;
- rebind or write NotationDocumentV4;
- remove/shrink the destination rest;
- create an EditorSessionV4 revision;
- expose renderer or network authority;
- authorize cross-measure paste or relation remapping.

A later mutation stage must consume the exact admission + identity plan atomically and must still pass post-mutation score/notation validation before any session commit.
