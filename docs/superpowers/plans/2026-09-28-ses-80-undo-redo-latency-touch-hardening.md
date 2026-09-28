# SES-80 Undo/Redo Latency + Touch Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans task-by-task.

**Goal:** Remove visible Undo/Redo render backlog without changing canonical history semantics, then revalidate touch targeting.

**Architecture:** Keep EditorSessionV4 / EditorHistoryV4 authoritative. Fix presentation scheduling at the APP-09B stable host boundary with a single in-flight render and latest-revision catch-up; do not coalesce canonical edits or weaken stale-result rejection.

**Tech Stack:** TypeScript 6, Node test runner, generated browser bootstrap, WebKit CI.

**Spec:** Notion SES-80 developer handoff / Linear SES-80.

## Global Constraints
- Preserve exact Undo/Redo ScoreDocumentV3 + NotationDocumentV4 snapshots.
- Preserve stale-revision rejection.
- No new Render service or URL.
- No merge/deploy/release/cutover without separate approval.
- standaloneReleaseGatePassed=false.
- Stop at st-score-rendering-layer boundary for renderer-source touch changes.

## Review Focus
- Rapid Undo→Redo must not run overlapping renderer work.
- Canonical revision changes during a render must catch up to the latest revision.
- A same-revision transient renderer failure keeps the existing bounded retry behavior.
- Renderer stale-result rejection remains intact.
- Touch hardening remains separate from latency scheduling.

### Task 1: P0/P1 renderer scheduling
**Files:**
- Modify: `scripts/assemble-app09b-preview-stable.mjs`
- Test: `test/ses80-render-scheduler-single-flight.test.mjs`

- [ ] Add RED regression proving stable bootstrap lacks single-flight/latest-revision scheduling.
- [ ] Run CI and record expected RED.
- [ ] Add minimal single-flight host scheduling with latest-revision catch-up.
- [ ] Run focused + full CI and WebKit checks.

### Task 2: P4/P5 touch targeting
- [ ] Reassess only after Task 1 automated and physical performance evidence.
- [ ] If renderer-source changes are required, stop and create cross-repo handoff.

### Task 3: P6 closeout
- [ ] Run retained CI/Sonar evidence.
- [ ] Record physical G3/G10 evidence.
- [ ] Keep release gate false until explicit closeout.
