# P02-PASTE03 — Teacher Paste Session History

Status: VERIFIED ON ISOLATED WORK BRANCH / PR #143 OPEN / NOT MERGED / NOT RELEASED

## Purpose

Move the already-verified bounded P02-PASTE02 canonical paste candidate through the existing `EditorSessionV4` unified history authority without creating a second paste-specific history mechanism.

## Contract

`commitSessionTeacherPasteOverwriteV4(...)`:

1. receives the current `EditorSessionV4` plus the previously verified copy snapshot, paste admission and deterministic identity plan;
2. enforces the session revision-reuse guard;
3. executes `executeTeacherPasteOverwriteV4(...)` against the exact current canonical `ScoreDocumentV3 + NotationDocumentV4` pair;
4. commits the result exactly once through `commitEditorHistoryV4(...)`;
5. returns the first inserted event as current-revision semantic selection;
6. regenerates the renderer request from the committed canonical pair.

No parallel paste history is introduced. `EditorSessionV4` remains the sole history authority.

## Verified behavior

Exact feature head: `2c2533c23bd4d47519e27fc7e244bda8d1044840`

CI run: `34048830113`

Node 18 / 20 / 22:
- repository contracts PASS;
- build PASS;
- full test chain PASS.

Regression file: `test/p02-teacher-paste-session-history-v4.test.mjs`

The regression proves:
- one paste produces exactly one new history snapshot;
- the previous canonical score+notation pair is preserved in `past`;
- Undo restores the exact pre-paste score+notation pair;
- Redo restores the exact post-paste score+notation pair;
- renderer revision follows the history-present revision;
- selection is cleared by history navigation according to existing session semantics;
- tampered/stale rejected paste leaves the original session and history unchanged.

## Still outside this package

- app-document convenience wrapper;
- browser UI command/wiring;
- cross-measure paste mutation;
- relation remapping;
- transpose/bulk editing;
- insert-mode semantics;
- physical-device validation;
- merge/release/production activation.

## External product boundary

No SesliTab repository, Smoosic integration or SesliTab production code is touched. The existing pinned ST Score Editor runtime/build dependency remains unchanged.
