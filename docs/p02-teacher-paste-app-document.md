# P02-APP01 — Teacher Paste App Document Wiring

Status: VERIFIED ON ISOLATED WORK BRANCH / PR #143 OPEN / NOT MERGED / NOT RELEASED

## Purpose

Expose the already-proven P02-PASTE03 session-level paste commit through `ScoreEditorAppDocument` without introducing new canonical, history or dirty-state authorities.

## Contract

`commitAppTeacherPasteOverwrite(...)` delegates directly to `commitSessionTeacherPasteOverwriteV4(...)` and rebuilds the app document through the existing private `appState(...)` helper.

This means:
- `EditorSessionV4` remains the only history authority;
- `ScoreEditorAppDocument.savedRevisionId` remains unchanged by an edit;
- `dirty` continues to be derived only from `present revision != savedRevisionId` (or unsaved-new-document state);
- no browser UI command is introduced by this package.

## Exact evidence

Feature head: `3caaa7fdae9d930c1da101f036d1236e7fba58cc`

CI: `34049060092`

Node 18 / 20 / 22:
- repository contracts PASS;
- build PASS;
- full test chain PASS.

Regression: `test/p02-teacher-paste-app-document-v4.test.mjs`

The regression opens a real MusicXML app document with a saved revision and proves:
- initial imported document is clean;
- admitted paste creates one new revision and makes the app document dirty;
- savedRevisionId is not silently moved by editing;
- Undo restores the saved revision and therefore clean state;
- Redo restores the pasted revision and dirty state;
- rejected/tampered paste leaves the original app document unchanged.

## Still outside this package

- browser UI/toolbar wiring;
- cross-measure paste;
- relation remapping;
- transpose/bulk;
- insert-mode semantics;
- physical-device validation;
- merge/release/production activation.

SesliTab/Smoosic remains outside scope and untouched. Its existing pinned ST Score Editor runtime/build dependency remains unchanged.
