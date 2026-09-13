# P01 — Core Editing Reliability Closeout

Status: **CODE-COMPLETE ON WORK BRANCH / NOT RELEASED / NOT MERGED**

Date: 2026-09-06

This closeout records the bounded P01 reliability evidence after the APP-11J admission foundation and the shared timing-authority audit. It does not authorize merge, production release, SesliTab cutover, or physical-device PASS.

## Canonical boundary

The supported product/session mutation path remains:

`ScoreEditorAppDocument -> EditorSessionV4 -> bounded authoring primitive -> ScoreDocumentV3 + NotationDocumentV4 -> EditorHistoryV4`

Existing-event duration and dot mutations converge on the shared APP-11 rhythm admission/mutation authority. Unsupported imported trailing pickup/non-controlling-measure growth remains explicitly fail-closed rather than inferred.

## Reliability evidence

### Unrelated content preservation

Retained APP-11A/B/G/H/I tests cover multi-event timing isolation, exact adjacent-rest balancing, fail-closed overlap/coupled-notation cases, imported topology preservation, and triplet retiming without unrelated identity changes.

APP-11H additionally proves that articulation, ornament, accidental and slur notation unrelated to the retiming transform is preserved while the bounded triplet semantics are added.

### Failed operations are atomic

The timing admission layer rejects stale targets, overlap, timing-coupled notation, cross-staff targets where the bounded operation does not own the relation, invalid durations, unsupported imported trailing expansion, and insufficient/provenance-unsafe rest growth before canonical mutation.

P01 revision-identity hardening further rejects immediate-parent revision reuse before any supported `EditorSessionV4` write. `test/p01-session-revision-reuse-hardening.test.mjs` proves Basic duration and timing-safe keypad failures leave history and duration unchanged.

### Undo / history

`test/app11b-safe-duration-rest-balancing-v4.test.mjs` proves that a duration growth which consumes the complete adjacent rest is committed as one history edit and `UNDO` restores the exact prior note/rest pair.

The unified `EditorHistoryV4` boundary remains the product history authority; the P01 patch does not introduce a second history path.

### Relation / orphan safety

Existing V4 boundaries remain fail-closed for relation orphaning rather than silently deleting semantics:

- rest replacement blocks when note notation would be orphaned (`NOTATION_ORPHAN_RISK`);
- topology/cross-staff rebinding blocks when a source event or display staff would no longer resolve (`CROSS_STAFF_ORPHAN_RISK`);
- timing-coupled beams, tuplets and ties are rejected when a bounded timing mutation does not own the required relation rewrite;
- APP-11H preserves unrelated slur/ornament/articulation/accidental semantics during admitted triplet retiming.

No new orphan-cleanup mutation was added because the audit found fail-closed guards and retained regression coverage rather than a proven product-path orphaning bypass.

## Final exact-head verification before this closeout commit

PR #142 head: `745a8718af8cbbc2b83620b6301f7b9bc0fd4344`

GitHub Actions CI run: `34043756679`

Result:

- Node 18 core: repository contracts PASS; build and full test chain PASS
- Node 20 core: repository contracts PASS; build and full test chain PASS
- Node 22 core: repository contracts PASS; build and full test chain PASS

The closeout document commit itself requires a new exact-head CI check before its SHA can be called green.

## P01 disposition

P01 core reliability work is **code-complete on the isolated work branch** for the represented scope:

- shared timing mutation authority audited;
- one concrete revision-identity gap fixed and regression-tested;
- atomic failure behavior retained;
- Undo evidence retained;
- relation/orphan boundaries remain fail-closed;
- imported pickup/non-controlling trailing growth remains explicitly unsupported rather than guessed.

Remaining work is not a hidden P01 reliability bypass:

1. APP-11J canonical Triplet Removal / Unretiming mutation is a later bounded package after admission closeout/review.
2. Broader imported pickup semantics may be modeled later if product requirements require trailing growth.
3. P06 must expose only the safe application/session mutation allowlist.
4. Physical-device validation remains a release gate.
5. PR #142 merge requires separate authority under the current handoff.
