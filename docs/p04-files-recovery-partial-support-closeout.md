# P04 Files, Recovery and Partial-Support Closeout

Status: **CODE-COMPLETE / VERIFIED ON OPEN PR**

Branch: `p04-file-recovery-partial-support-v1`  
PR: #145  
Verified code head: `ac0d99776edced34ff2ecacddfd7c45096646430`  
Verified code CI: `34099830414` — Node 18 / 20 / 22 PASS

## Scope closed in P04-CAP01

P04 closes the bounded file/recovery/capability-isolation gap without adding a second persistence or recovery architecture.

### Local MusicXML input boundary

- Existing local file bound remains **32 MiB (33,554,432 bytes)**.
- `.musicxml` and `.xml` remain the admitted text MusicXML extensions.
- `.mxl` is now explicitly classified as **unsupported compressed MusicXML** in the current standalone build.
- `.mxl` is rejected with typed `COMPRESSED_MUSICXML_UNSUPPORTED` before source bytes are decoded as text.
- No ZIP/runtime dependency was added merely to claim `.mxl` support.
- Existing parser hardening remains authoritative: source identity checks, hostile XML/DOCTYPE/entity rejection, depth/event budgets, abort/deadline behavior and fail-closed unsupported semantics are unchanged.

### Failed-open isolation

The file-enabled product profile now explicitly declares and regression-tests that failed open operations preserve live work:

- unsupported `.mxl` cannot replace the active canonical document;
- malformed/unsupported text MusicXML cannot replace the active canonical document;
- the current revision and dirty state remain unchanged;
- an existing file association remains attached to the original document;
- failed open does not create a parallel canonical/history path.

The implementation still adopts a newly opened document only after parsing/import completes successfully.

### Output capability isolation

A current canonical document may contain semantics/topology for which the admitted MusicXML projection is unavailable. P04 verifies that this is a capability-specific failure rather than a global editor failure:

- export returns typed `EXPORT_UNAVAILABLE` when lossless output is not admitted;
- the canonical document is not mutated by the failed export;
- subsequent local canonical editing remains available;
- the accepted local edit uses the same `EditorSessionV4` history;
- unified Undo restores the exact prior revision.

Therefore an output limitation does not revoke safe local edit/history authority.

### Recovery chain

P04 does **not** create another autosave/recovery implementation. The existing APP-05 chain remains the single recovery path and its regression suite remains green, including:

- explicit prepare/adopt rather than silent live-document replacement;
- stale prepared-recovery rejection;
- corrupt recovery rejection;
- bounded retention;
- storage-unavailable degraded behavior that keeps editing available;
- explicit application of a validated recovery snapshot.

## Existing capability retained

Current admitted MusicXML round-trip, local file save/download, recovery, renderer projection and standalone editing tests remain green under the same canonical/history authority boundaries.

## Explicitly deferred

P04 does **not** claim completion of:

- actual `.mxl` ZIP-container support;
- new ZIP/decompression dependency admission or archive-security review;
- broader cross-staff/output projection semantics;
- OMR-source-specific UX/provenance work assigned to later packages;
- physical iPhone/iPad release validation.

If true `.mxl` support is added later, dependency, archive-bomb/path/resource limits, format-container parsing and round-trip evidence require a separate bounded review before admission.

## Safety / authority

- No merge performed.
- No release, deployment or production activation performed.
- Physical-device validation remains `NOT_RUN` and release-gated.
- No SesliTab repository work was performed.
- No Smoosic integration was modified.
- The preserved external pinned dependency was not changed.

A final closeout-document/roadmap HEAD must independently pass the repository CI matrix before P04 closeout is considered final.