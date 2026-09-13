# P06 reusable SDK — final development handoff

Date: 2026-09-13

Status at document creation: **handoff candidate; final exact-head P06-H CI + WebKit validation still required**.

This document closes the autonomous implementation/documentation portion of P06 without granting merge, release, deployment or SesliTab cutover authority. It records what a future developer or host integrator may rely on, what remains optional, and which external/human gates must remain explicit.

## 1. Product direction preserved

P06 turns the standalone editor work into a reusable, versioned integration boundary without creating a second editor architecture.

The invariants remain:

- `ScoreDocumentV3` + `NotationDocumentV4` are the canonical score pair.
- `EditorSessionV4` is the unified mutation/history authority.
- `SemanticAddressV3` is semantic identity.
- Renderer, file, recovery, playback, teacher workflow and audio state are capabilities, not canonical truth.
- Presentation/host lifecycle never creates score-history revisions.
- Stale document/revision evidence fails closed; no automatic retargeting.
- DOM/SVG/renderer geometry cannot authorize a canonical edit.
- SesliTab/Smoosic remains outside the generic SDK work and was not repinned or modified by P06.

## 2. Public SDK boundary

Public consumers use only:

`packages/score-editor-sdk-v1/public.ts`

The admitted public modules are:

- base SDK contract/implementation (`./src/index.js`),
- explicit version negotiation (`./version-negotiation.js`),
- capability-aware rollout gate (`./rollout.js`).

A generic consumer must not import private browser-app composition, app-document/session internals, score model internals, renderer internals, recovery storage internals or SesliTab host packages.

Current SDK contract version: `1.0.0`.

Current negotiation contract version: `1.0.0`.

There is no silent version fallback. A host must explicitly accept a supported version.

## 3. Base capabilities

The P06 base SDK admits:

- document lifecycle: create/open/export,
- semantic selection and revision-bound target enumeration,
- unified undo/redo,
- bounded canonical authoring already admitted by the existing V4 path,
- read-only snapshots and exact document/revision guards,
- deterministic host subscription/lifecycle behavior.

Public mutation calls continue to delegate into the existing V4 standalone controller/session path. The SDK does not expose the underlying `EditorSessionV4` or mutable document as a host escape hatch.

## 4. Revision and stale-request contract

Operations that act on an existing document require the exact current `{ documentId, revisionId }` guard.

If the document or revision has changed:

- the request returns `STALE_REQUEST`,
- it is not silently retargeted,
- stale semantic enumeration is rejected,
- renderer-local identities cannot replace the semantic guard.

This is the principal safety boundary for embedding the editor in an external host.

## 5. Generic host lifecycle

P06-C adds a headless lifecycle to the SDK boundary:

- `mount(host)` — attach one compatible presentation host,
- `update()` — request a presentation refresh,
- `unmount()` — detach the host while keeping the SDK reusable,
- `dispose()` — terminal, idempotent cleanup.

`dispose()` clears SDK-managed subscriptions and rejects later mutating/lifecycle calls with a typed disposed error.

A third-party host/listener exception is diagnostic state. It must not retroactively turn an already successful canonical edit into a failed edit.

## 6. Neutral consumer proof

The P06-D example demonstrates a third-party path that imports only the public SDK entry:

1. mount a neutral host,
2. create/export a seed score,
3. open MusicXML,
4. enumerate a revision-bound semantic target,
5. select the target,
6. perform a real canonical duration edit,
7. undo through unified history,
8. observe missing renderer/playback as capability-local degradation,
9. unmount and dispose.

This proves the integration contract can be consumed without SesliTab-specific code or private score/session imports.

## 7. Version and migration policy

Within SDK major version `1.x`, compatibility is additive by default.

Allowed additive evolution includes:

- a new optional capability that defaults unavailable/off,
- a new helper that preserves the existing authority boundaries,
- additive immutable result fields whose absence is explicitly tolerated,
- new error/result codes tied to newly introduced operations.

A separate breaking-contract approval is required for changes such as:

- removing or renaming an existing public operation/field,
- changing the meaning or authority of an existing field,
- making an optional host capability mandatory,
- weakening stale-revision rejection,
- exposing mutable score/session/history ownership,
- making renderer/audio/presentation state canonical authority.

An incompatible consumer migration requires a new major contract and explicit migration path.

## 8. Optional capability rollout

P06-G defines these rollout-controlled optional feature ids:

- `renderer`
- `files`
- `recovery`
- `playback`
- `teacherWorkflow`
- `audioAudition`

All rollout flags default to `false`.

A feature becomes enabled only when both conditions hold:

`flag requested == true` **and** `SDK capability available == true`.

The resulting states are:

- `FLAG_DISABLED`
- `CAPABILITY_UNAVAILABLE`
- `ENABLED`

A flag never manufactures a missing capability. Rollout inspection is read-only and must not change canonical document/revision/history state.

This permits staged host adoption without making optional infrastructure a global editor blocker.

## 9. P06-F audio gate

P06-F is intentionally **`BLOCKED_EXTERNAL_DISTRIBUTION_GATE`**.

Verified upstream repository:

`khfy7wpr5p-maker/st-score-audio-engine`

Verified upstream source HEAD during the gate:

`779a0d9c3c3cb8d91607d3e96c60554d47de1a27`

Source package definitions exist for:

- `@st/score-audio-contracts@0.1.0`
- `@st/score-audio-web@0.1.0`

The web runtime consumes the contracts package and the contract owns `AuditionRequest`/instrument/result shapes. Editor Core must not create a parallel substitute schema.

At the P06-F check, upstream GitHub had no release and no tag. Therefore P06 did **not** add an Editor Core audio dependency, copy sample assets, or copy/redefine the external `AuditionRequest` contract.

`audioAudition: true` in rollout therefore remains `CAPABILITY_UNAVAILABLE` until the external distribution gate opens.

P06-F can be unblocked only after the official audio package has an immutable, independently verifiable published distribution identity and the exact package/version can be pinned reproducibly.

When later integrated, the audio seam must still preserve:

- current canonical NOTE pitch as pitch authority,
- stale-revision recheck before audition execution,
- REST/non-note silence,
- audio failure as capability-local degradation,
- zero `EditorSessionV4` history entries for audition,
- separate physical iPhone evidence rather than treating WebKit as speaker-output proof.

## 10. Stage/evidence map

P06 was kept as a stacked draft-PR sequence rather than one opaque change:

- **P06-A / PR #154 — PASS:** integration-surface inventory and authority map.
- **P06-B / PR #155 — PASS:** versioned generic SDK contract; verified head `25861c66…`.
- **P06-C / PR #156 — PASS:** deterministic host lifecycle; verified head `9ccf5922…`.
- **P06-D / PR #157 — PASS:** neutral public host example; verified head `51fe560f…`.
- **P06-E / PR #158 — PASS:** version negotiation/conformance/migration; verified head `fee469cc…`.
- **Validation-only PR #159 — PASS:** same P06-A–E head passed Node CI plus APP-09B/P05 WebKit, including paste/render/undo. It is not a merge request.
- **P06-F / PR #160 — BLOCKED_EXTERNAL_DISTRIBUTION_GATE:** block documented, exact-head Node matrix green at `f53edc8c…`.
- **P06-G / PR #161 — PASS:** capability-aware default-off rollout; exact-head Node 18/20/22 green at `13599036…`.
- **P06-H — this documentation/handoff stage:** final exact-head Node + WebKit validation must be run after documentation is committed.

PASS above means development/automated gate PASS only. It does not convert unexecuted physical/device/teacher gates into PASS.

## 11. Frozen and prohibited actions preserved

P06 did not authorize or perform:

- protected-branch merge,
- production release/deployment,
- SesliTab production cutover,
- SesliTab/Smoosic refactor or dependency repin,
- force-push or destructive rebase,
- replacement of `EditorSessionV4` history authority,
- renderer/DOM identity as canonical mutation authority,
- unpublished audio package pretending to be a released dependency.

## 12. Remaining human/external gates

The next engineer must keep the following distinct:

1. **Audio distribution:** publish/verify immutable ST Score Audio Engine distribution identity before activating P06-F.
2. **Physical iPhone audio:** real Safari/user-gesture/speaker evidence remains a separate human-device gate; automated WebKit is not enough.
3. **Teacher physical evidence:** P06 does not claim teacher tasks/pilot runs that were not actually executed. Existing earlier evidence must remain task-specific rather than being generalized.
4. **Merge/release/cutover:** requires explicit human approval after exact-head review; draft PR success alone is not authorization.

## 13. Rollback / containment

P06 is intentionally easy to contain:

- the work remains a stacked draft-PR chain,
- optional rollout flags default off,
- a host can decline the SDK version negotiation,
- missing optional capabilities degrade locally,
- `audioAudition` remains unavailable while P06-F is blocked,
- no destructive repository history rewrite is required to back out of P06,
- no canonical score/history migration is required merely to stop using the generic SDK host boundary.

## 14. Final validation rule

Before calling P06-H development-green, validate the **exact P06-H HEAD** with:

- Node 18 core CI,
- Node 20 core CI,
- Node 22 core CI,
- APP-09B/P05 WebKit through a validation-only PR that targets an admitted WebKit workflow base.

The validation-only PR must remain explicitly non-merge. Automated WebKit PASS must not be described as physical iPhone/device PASS.

Machine-readable companion: `docs/p06-sdk-final-handoff.json`.
