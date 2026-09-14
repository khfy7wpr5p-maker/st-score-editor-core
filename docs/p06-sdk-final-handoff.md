# P06 reusable SDK — current production handoff

Date: 2026-09-14

Status: **production-integrated with ST Score Audio Engine v0.1.0; SesliTab cutover still separate**.

This document supersedes the earlier handoff snapshot that recorded P06-F as `BLOCKED_EXTERNAL_DISTRIBUTION_GATE`. That historical decision was correct at the time because no immutable upstream distribution existed. The block is now resolved through P06-F2 and the production integration chain.

## 1. Product direction and authority

P06 remains a reusable, versioned integration boundary rather than a second editor architecture.

The authority rules are unchanged:

- `ScoreDocumentV3` + `NotationDocumentV4` are the canonical score pair.
- `EditorSessionV4` owns mutation/history.
- `SemanticAddressV3` is semantic identity.
- Renderer, audio, files, recovery, playback and teacher workflow are capabilities, not canonical truth.
- stale document/revision evidence fails closed; no automatic retargeting.
- DOM/SVG/renderer geometry cannot authorize a canonical edit.
- audio audition creates no score/history revision.

## 2. Public SDK boundary

Public consumers use only:

`packages/score-editor-sdk-v1/public.ts`

Current admitted public modules:

- `./src/index.js`
- `./version-negotiation.js`
- `./rollout.js`
- `./audio-v010.js`

SDK contract version: `1.0.0`.

Negotiation contract version: `1.0.0`.

There is no silent version fallback.

## 3. Optional capability rollout

Optional features remain rollout-controlled and default-off:

- `renderer`
- `files`
- `recovery`
- `playback`
- `teacherWorkflow`
- `audioAudition`

A feature becomes enabled only when the rollout flag is true **and** the SDK actually reports the capability. A flag cannot manufacture an unavailable capability.

## 4. P06-F audio gate — resolved

Historical P06-F PR #160 correctly blocked integration because upstream source packages existed without a GitHub release or tag.

The upstream distribution now has an immutable published identity:

- repository: `khfy7wpr5p-maker/st-score-audio-engine`
- release/tag: `v0.1.0`
- release commit: `d11a2dd9141169ddfec5901f3cadc4cce0d7b345`
- contract package: `@st/score-audio-contracts@0.1.0`
- browser runtime package: `@st/score-audio-web@0.1.0`
- production browser asset SHA-256: `0f25713f481c42d7a1909e15f968635202d3247203402d8f9f95c19a0a0fb99c`

P06-F2 then admitted the official contract without redefining `AuditionRequest` or creating a second audio schema.

Evidence:

- integration PR #166
- exact-head validation PR #167
- validated P06-F2 head `e3216ddb99f1db0a2184eeaf7760230e442dd115`

The adapter preserves:

- current canonical NOTE pitch as pitch authority,
- stale-revision recheck before runtime execution,
- REST/non-note silence,
- capability-local audio failure,
- zero `EditorSessionV4` history entries for audition,
- external Audio Engine contract ownership.

## 5. Production integration

The validated P06 stack and Audio Engine v0.1.0 were composed into production through:

- PR #169 — production P06 + Audio Engine integration
- `main` commit `30c16f61b016ae7e659d91bfc36f858e856fbfe0`
- PR #170 — production static-site assembly
- current production assembly commit `519adabf2b91b15b8fa263b5d8a45bf4992a227b`

The production assembly verifies the pinned Audio Engine browser artifact checksum before building the site.

Render service:

- service: `st-score-editor-core`
- URL: `https://st-score-editor-core.onrender.com`
- last deploy: `dep-dajgjh0ae00c739t8e8g`
- deploy commit: `519adabf2b91b15b8fa263b5d8a45bf4992a227b`
- recorded deploy status: `live`
- current service state: suspended by the user

The service must be resumed before a new production-host physical-device validation can be performed.

## 6. Instrument readiness

Current production readiness is intentionally narrow:

- Grand Piano — `ACTIVE / QUALIFIED`
- Classical Guitar — `SUSPENDED`
- Violin — `SCAFFOLD / UNQUALIFIED`
- remaining orchestral registry entries — `SCAFFOLD / UNQUALIFIED`

Unqualified instruments must fail closed. No hidden timbre fallback is authorized.

## 7. Physical evidence

A physical iPhone Safari test of the Score Editor note-touch path successfully produced Grand Piano audio.

That is valid evidence for the tested Score Editor device/preview path. It is **not** a substitute for an unperformed physical test against the production Render URL.

Automated WebKit remains separate from physical speaker-output evidence.

## 8. Stage/evidence map

- P06-A / PR #154 — PASS
- P06-B / PR #155 — PASS
- P06-C / PR #156 — PASS
- P06-D / PR #157 — PASS
- P06-E / PR #158 + validation PR #159 — PASS
- historical P06-F / PR #160 — correctly BLOCKED at the time
- P06-G / PR #161 — PASS
- historical final validation PR #164 — automated validation surface
- P06-F2 / PR #166 + validation PR #167 — PASS / distribution gate resolved
- production integration PR #169 — merged
- production site PR #170 — merged

## 9. Current frozen boundaries

Still prohibited unless separately authorized:

- SesliTab production cutover,
- treating suspended/unqualified instruments as production-ready,
- renderer/audio becoming canonical score or history authority,
- hidden fallback from an unavailable instrument to another timbre,
- destructive history rewrites merely to change host/audio integration.

## 10. Remaining gates

1. Resume the Render production service before production-host device validation.
2. Re-run physical iPhone Safari Grand Piano note-touch on the production Render URL.
3. Keep Classical Guitar suspended until its own qualification work is explicitly resumed.
4. Qualify Violin and later orchestral instruments independently before activation.
5. Keep teacher/pilot evidence task-specific; do not generalize unperformed physical tasks.
6. Obtain separate explicit approval before SesliTab production cutover.

## 11. Rollback / containment

Audio remains capability-local. A host can disable `audioAudition` or omit the admitted runtime without changing canonical score/history semantics. No canonical score/history migration or destructive Git history operation is required to stop using the audio capability.

Machine-readable companion: `docs/p06-sdk-final-handoff.json`.
