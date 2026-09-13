# P06-F Audio Engine v0.1.0 Admission

Status: ADMITTED_EXTERNAL_DISTRIBUTION / IMPLEMENTATION_PENDING

## Immutable upstream identity

- Repository: `khfy7wpr5p-maker/st-score-audio-engine`
- Release: `v0.1.0`
- Release commit: `d11a2dd9141169ddfec5901f3cadc4cce0d7b345`
- Public contract package: `@st/score-audio-contracts@0.1.0`
- Browser runtime package: `@st/score-audio-web@0.1.0`
- Release assets include package tarballs, browser bundle and SHA256SUMS.

This satisfies the external distribution identity requirement that previously kept P06-F fail-closed.

## Integration boundary

Editor Core may now integrate only against the official v0.1.0 contract/runtime identities above. It must not copy or fork `AuditionRequest`, sample assets, or browser runtime implementation into Editor Core.

Canonical authority remains `ScoreDocumentV3 + NotationDocumentV4` through `EditorSessionV4`. Audio is noncanonical, revision-bound and must not create editor history revisions. Renderer geometry must never become pitch authority.

## Instrument readiness inherited from v0.1.0

- Grand Piano: ACTIVE / QUALIFIED.
- Classical Guitar: SUSPENDED.
- Violin: SCAFFOLD / UNQUALIFIED.
- Other registered orchestral instruments: scaffold only unless a later qualified release says otherwise.

Unqualified/suspended instruments must fail closed without hidden timbre fallback.

## Remaining implementation work

This admission record opens the P06-F implementation gate. It does not by itself claim that the P06 SDK exposes a live audio capability. The implementation must still:

1. adapt the existing revision-safe Editor Core audition seam to the official v0.1.0 public contract;
2. expose `audioAudition` only when the external runtime is actually injected/available;
3. keep feature rollout default-off;
4. preserve stale-revision fail-closed behavior and selection independence from audio success;
5. pass exact-head Node CI and WebKit regression validation.

No merge, production release, deployment or SesliTab cutover is authorized by this document.
