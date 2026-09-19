# P09-A — Fast Entry / Keyboard Workstation Inventory

Audit target: `main` at `4d8920c81ebb34af31f62f4a8e9ba24a4d7d7e15`.

This audit supersedes the handoff baseline `e281d52881aaad0fade574a944251b12ea752038`. The only observed newer mainline change at audit start is S06E source MusicXML note-identity preservation at the SDK/import boundary. P09 must preserve that boundary and must not create another score, history, timing, identity, renderer or host authority.

## Decision

P09 does **not** need a new note-entry engine.

The repository already contains the semantic mutation and workflow primitives required for a desktop fast-entry layer:

- versioned `ACTION_ID_ONLY` keypad commands;
- current-revision `SemanticAddressV3` selection;
- rhythm-safe duration/rest/dot routing through the shared V4 rhythm authoring authority;
- active Voice / entry pitch / entry duration workflow state;
- explicit-rest-only note insertion;
- semantic previous/next measure navigation;
- unified `EditorSessionV4` / `EditorHistoryV4` commits and Undo/Redo;
- P08 semantic professional selection/range infrastructure;
- public SDK lifecycle that is explicitly non-authoritative.

Therefore P09-B is admitted only as a **thin, versioned command-intent contract**. P09-C may add a browser keyboard adapter only after P09-B is tested. P09-D remains conditional on focus, history, selection rebound and WebKit qualification.

## 1. Existing keypad contract

`packages/editor-keypad/src/index.ts` already provides contract version `1.0.0` and the following action families:

- duration: whole, half, quarter, eighth, 16th, 32nd;
- rests: whole, half, quarter, eighth, 16th, 32nd;
- accidentals: flat, natural, sharp;
- dots: 0–3;
- triplet;
- tie edit;
- slur edit.

The manifest declares `semanticAuthority: ACTION_ID_ONLY`; glyph metadata is explicitly non-authoritative. This is the correct semantic vocabulary to reuse for keyboard-triggered selected-event edits.

**Gap:** there is no physical-key gesture contract mapping desktop keystrokes to these semantic actions.

## 2. Rhythm authority

`packages/editor-keypad-rhythm-safe-v4/src/index.ts` already separates timing-changing keypad actions from other keypad actions.

Duration/rest/dot changes resolve the current semantic selection, reject stale/wrong-kind targets, and route timing changes through `executeRhythmAuthoringV4`. Existing error translation retains fail-closed behavior for stale targets, cross-staff conflict, notation orphan risk and unsupported timing.

**P09 rule:** keyboard code must never calculate or write canonical timing directly. It can only request an already admitted semantic action.

## 3. Session and history authority

`commitSessionKeypadActionV4` in `editor-session-controller-v4` calls `executeSafeEditorKeypadActionV4` against the current history pair and commits the returned score+notation pair through `EditorHistoryV4`.

Repository tests across professional authoring and teacher workflows already assert exact Undo/Redo restoration of the canonical pair.

**P09 rule:** one accepted keyboard semantic edit must remain one existing session/history commit. The keyboard layer gets no direct history-write API.

## 4. Note-entry workflow

`packages/score-editor-browser-app/src/authoring-workspace.ts` already exposes browser workflow state for:

- active Voice ordinal;
- entry pitch;
- entry duration;
- `enterNoteAtSelection()`.

The profile explicitly states:

- authoring workspace canonical authority: false;
- position note entry: `explicit-rest-only`;
- renderer coordinate timing authority: false;
- note-entry history: `EditorSessionV4`.

This is sufficient for a first bounded keyboard fast-entry workflow. P09 should call existing setters and `enterNoteAtSelection()` rather than introducing a cursor-owned insertion engine.

**Current limitation to preserve:** insertion is admitted only where the existing semantic note-entry path accepts an explicit rest/timing context. P09 must not silently fill, shift, split or invent unsupported music.

## 5. Semantic navigation

`packages/score-editor-browser-app/src/measure-navigation.ts` already provides previous/next measure navigation using the current semantic part/staff/frame context. It carries the selected event onset when possible, resolves the corresponding event in the adjacent frame, and selects through `SemanticAddressV3`.

Its profile explicitly has no canonical or history mutation authority and no renderer-coordinate authority.

**Reuse:** previous/next measure keyboard commands can delegate directly to this controller behavior.

**Not yet admitted by this audit:** a generic left/right event ordering, staff-switching ordering or arbitrary cursor traversal model. Those must not be inferred from rendered geometry.

## 6. Professional selection/range

P08 already established current-revision `SemanticAddressV3` endpoints for professional range selection. The professional browser UI declares `EditorHistoryV4` as history authority and the renderer as non-authoritative.

The P08 foundation explicitly anticipates future keyboard/Shift-selection on top of semantic endpoints.

**Reuse:** future Shift-range behavior must extend the P08 selection model. P09 must not keep a separate keyboard-only range.

## 7. Existing browser keyboard handling

`packages/score-editor-browser-app/src/viewport-presentation.ts` currently installs a root `keydown` listener for presentation-only actions:

- Ctrl/Cmd + `+`, `-`, `0` for zoom;
- Arrow keys for pan;
- PageUp/PageDown for page navigation;
- Home/End for first/last page.

The handler runs only when the event target is within the score viewport and then calls `preventDefault()` for recognized actions.

This is the primary P09-C conflict boundary.

**Gap:** there is no centralized edit-keyboard adapter, editable-target exclusion policy, or deterministic arbitration between presentation shortcuts and future editing shortcuts.

**P09-C requirement:** before any semantic keyboard command is dispatched, exclude `input`, `textarea`, `select`, contenteditable elements and host-reserved editable surfaces. A gesture must be owned by at most one adapter.

## 8. SDK lifecycle

P06 already has reusable mount/update/unmount/remount lifecycle tests. The SDK host is a presentation/integration boundary, not canonical authority. S06E additionally introduced source-note identity preservation at the SDK/import boundary on current main.

**P09 rule:** do not make keyboard workstation state a host-owned score authority. Keep the first browser adapter internal until qualification. Any future SDK exposure must be explicit and versioned.

## 9. Mobile boundary

P09 is a desktop productivity enhancement, not a replacement for existing touch authoring.

Existing authoring/professional button surfaces must remain operational. Changes to shared browser code require retained WebKit regressions. At audit time, automated keyboard qualification could not satisfy the then-pending physical iPhone/Safari gate for `STScoreEditorProfessionalApp`. That separate gate was later completed as recorded in the closeout section below.

## 10. Canonical authority map for P09

| Concern | Authority P09 must reuse |
| --- | --- |
| Canonical score | `ScoreDocumentV3` |
| Canonical notation | `NotationDocumentV4` |
| Selection identity | current-revision `SemanticAddressV3` |
| Session/history | `EditorSessionV4` / `EditorHistoryV4` |
| Timing mutations | existing rhythm authoring V4 path |
| Selected-event keypad edit | existing safe keypad/session path |
| Note insertion | existing authoring/position note-entry path |
| Professional range | existing P08 semantic range model |
| Renderer | presentation only, never musical authority |
| Keyboard adapter | intent translation only, never canonical authority |
| SDK host | integration only, never canonical authority |

## P09-B admission

**Status: `ADMITTED_BOUNDED`.**

P09-B may add a small versioned keyboard command-intent contract if it obeys all of the following:

1. Intent-only contract; no score mutation implementation.
2. Commands delegate to existing controller/session methods.
3. Unknown version/command fails closed.
4. No hidden canonical cursor.
5. No renderer/DOM/SVG ids in semantic command payloads.
6. No new rhythm calculations.
7. No topology invention.
8. Existing explicit-rest-only note-entry admission remains unchanged.
9. Existing Undo/Redo granularity remains unchanged.
10. P09-C cannot be considered admitted until P09-B contract tests prove these boundaries.

## P09-C admission condition

P09-C is conditionally admitted after P09-B tests. The adapter must:

- ignore editable/text-entry targets;
- avoid double execution with viewport shortcuts;
- be mount/unmount safe;
- dispatch only versioned P09 intents;
- keep touch/mobile controls independent;
- contain no canonical mutation logic.

## P09-D admission condition

P09-D remains conditional on P09-C qualification and must include deterministic tests for:

- selected-event edit rebound;
- exact one-step Undo and Redo;
- note entry through existing explicit-rest path;
- previous/next semantic measure navigation;
- stale selection rejection;
- editable-target non-interference;
- viewport shortcut coexistence;
- mount/unmount/remount listener safety;
- retained WebKit regression when shared browser code changes.

No production exposure, physical iPhone PASS declaration, SesliTab cutover, Classical Guitar reactivation or merge-to-main is authorized by P09-A.


## P09 closeout / current state

The admission sections above are retained as the design-time rationale. Their conditions have now been satisfied.

- **P09-B — MERGED / QUALIFIED.**
- **P09-C — MERGED / QUALIFIED.**
- **P09-D — MERGED / QUALIFIED.**
- PR #191 merged to main at `9dfa253a55982a66b01b5eaa2f8df614b1e58e9b`.
- Exact qualified P09-D head: `636c17dc27b657d273cf2e4f630a2e7c11ffa8f6`.
- Exact-head Node 18 / 20 / 22 repository validation and retained WebKit qualification passed.
- Physical iPhone/Safari P08/P09 device gate passed for renderer startup, rendered-note semantic selection, edit, one-step Undo/Redo, orientation, Safari background/foreground lifecycle and continued touch selection.
- The keyboard layer remains intent-only/noncanonical; touch/mobile authoring remains independent.
- Production exposure, public-write activation and SesliTab cutover remain separate human decisions.
