# P06-F — Audio Integration Gate

Status: `RESOLVED_DISTRIBUTION_ADMITTED_AND_PRODUCTION_INTEGRATED`

Current-state reconciliation date: 2026-09-14

## Current decision

The original P06-F external distribution block is resolved. ST Score Audio Engine now has an official immutable public distribution identity and Editor Core consumes that identity through the P06-F2 adapter without creating a second score/history/audio contract authority.

The historical blocked state below remains relevant as the reason the integration originally failed closed, but it is no longer the current product state.

## Verified immutable upstream identity

Repository: `khfy7wpr5p-maker/st-score-audio-engine`

Release/tag: `v0.1.0`

Release commit: `d11a2dd9141169ddfec5901f3cadc4cce0d7b345`

Official package identities:

- `@st/score-audio-contracts@0.1.0`
- `@st/score-audio-web@0.1.0`

Published release assets include both package tarballs, the browser SDK bundle, and SHA-256 checksums. Editor Core pins the official release artifacts rather than an unpublished source tree.

## Editor Core admission and validation evidence

- P06-F2 integration PR: `#166`
- exact-head P06-F2 validation PR: `#167`
- validated integration head: `e3216ddb99f1db0a2184eeaf7760230e442dd115`
- production P06 + Audio Engine merge PR: `#169`
- production P06 merge commit on `main`: `30c16f61b016ae7e659d91bfc36f858e856fbfe0`
- production static-site assembly PR: `#170`
- current production assembly commit on `main`: `519adabf2b91b15b8fa263b5d8a45bf4992a227b`

The production assembly pins the Audio Engine `v0.1.0` browser asset and verifies SHA-256 before assembling the site.

## Admission requirements — current disposition

1. immutable published distribution identity — **PASS** (`v0.1.0` release/tag),
2. exact public package/version reproducibly pinned — **PASS**,
3. external package contract remains authoritative for `AuditionRequest`/instrument/result types — **PASS**,
4. no second score/history authority — **PASS**,
5. stale revision rechecked before audition — **PASS**,
6. REST/non-note selection remains silent — **PASS**,
7. audio failure remains capability-local — **PASS**,
8. audition creates no `EditorSessionV4` history entry — **PASS**,
9. automated and physical evidence remain separately labelled — **PASS as a boundary rule**.

## Current capability behavior

- `audioAudition` is available only when the admitted Audio Engine runtime is injected and the rollout flag permits it.
- rollout flags remain default-off; a flag does not manufacture a missing capability.
- `GRAND_PIANO` is the only production-qualified audition instrument.
- Classical Guitar remains `SUSPENDED`.
- Violin and the remaining orchestral registry entries remain unqualified until their separate sample/device gates pass.
- unqualified instruments fail closed; no hidden timbre fallback is authorized.
- renderer/DOM/SVG geometry does not own pitch or audio authority.
- canonical edit, selection, history, import/export and generic-host lifecycle remain independent of audio success.

## Physical-device evidence boundary

A physical iPhone Safari test of the Score Editor note-touch path successfully produced Grand Piano audio. That evidence applies to the tested Score Editor preview/device path and must not be generalized into an unperformed production-host speaker test.

The current Render production service has a successful deploy at commit `519adabf2b91b15b8fa263b5d8a45bf4992a227b`, but the service is presently suspended by the user; production-host physical revalidation remains separate.

## Historical snapshot — why P06-F originally blocked

At the original P06-F check, upstream package definitions already existed, but GitHub had no release and no tag. The stage therefore correctly used `BLOCKED_EXTERNAL_DISTRIBUTION_GATE` and refused to:

- invent a provisional/local `AuditionRequest`,
- copy upstream contract types,
- copy sample assets into Editor Core,
- pin an unpublished source tree as a released dependency,
- claim physical iPhone PASS from automated WebKit.

That fail-closed decision is preserved as historical evidence; it was superseded only after the official `v0.1.0` distribution was published and P06-F2 passed its integration/validation gates.

## Still not authorized by this gate

Resolving P06-F does not authorize SesliTab production cutover, make suspended/unqualified instruments production-ready, or transfer canonical score/history authority to the audio or renderer layers.
