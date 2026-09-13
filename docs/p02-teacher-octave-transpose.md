# P02 Teacher Octave Transpose Chain

Status: VERIFIED ON ISOLATED WORK BRANCH / PR #143 OPEN / NOT MERGED / NOT RELEASED

## Scope

The first teacher bulk-transpose profile is intentionally octave-only: `-2`, `-1`, `+1` or `+2` octaves.

It preserves note spelling (`step` and `alter`) and changes only the canonical octave field. General chromatic/diatonic transpose remains outside this package because it requires explicit enharmonic spelling, key-signature and relation policy.

## P02-TRANSPOSE01 — read-only admission

Package: `packages/editor-teacher-octave-transpose-admission-v4/src/index.ts`

Verified head: `8c962bd7ba63a246ef1c3fc916941f33d23fd038`
CI: `34049362326` — Node 18/20/22 PASS.

The admission:
- consumes an exact current-revision `TeacherEventSpanSelectionV4`;
- plans every selected note/chord tone while preserving rests;
- preserves `step` and `alter` and changes only octave;
- rejects unsupported octave deltas;
- rejects stale/tampered selection;
- rejects selected tie-coupled notes until relation closure is implemented;
- rejects selected pitched grace anchors until grace transposition policy exists;
- rejects canonical octave range overflow/underflow;
- rejects all-rest spans;
- has no canonical/history mutation authority.

## P02-TRANSPOSE02 — atomic canonical authoring

Package: `packages/editor-teacher-octave-transpose-authoring-v4/src/index.ts`

Verified head: `de682e154e59a4a57259742bf38c6c10a9d20cfd`
CI: `34049513929` — Node 18/20/22 PASS.

The authoring primitive:
- revalidates the admission before mutation;
- changes all admitted note/chord pitches in one fresh `ScoreDocumentV3` revision;
- keeps existing event/note identities;
- keeps rest timing/content unchanged;
- rebinds and preserves existing `NotationDocumentV4` semantics;
- rejects tampered admission and current/immediate-parent revision reuse;
- does not mutate its inputs;
- returns `historyMutationAuthority=false` so history remains a separate authority.

## P02-TRANSPOSE03 — unified session history

Verified head: `5af95eb930815e12efa2c8ce109f89422019dd2f`
CI: `34049652893` — Node 18/20/22 PASS.

`commitSessionTeacherOctaveTransposeV4(...)` commits the canonical result exactly once through `EditorHistoryV4`.

Regression proves:
- one bulk transpose = one history entry;
- Undo restores the exact pre-transpose score+notation pair;
- Redo restores the exact post-transpose pair;
- renderer revision follows current history-present revision;
- rejected/tampered admission leaves session/history unchanged.

## P02-TRANSPOSE04 — app-document authority

Verified head: `79363e3e61e35544298439dd305d596983469653`
CI: `34049811854` — Node 18/20/22 PASS.

`commitAppTeacherOctaveTranspose(...)` reuses the existing app-document state contract:
- saved imported document begins clean;
- transpose keeps the saved revision marker unchanged and makes the document dirty;
- Undo back to the saved revision makes the document clean;
- Redo makes it dirty again;
- rejected transpose leaves the original app document unchanged.

No second dirty/save/history authority is introduced.

## Explicit limitations

Still not implemented by this chain:
- chromatic/semitone transpose;
- diatonic/key-aware transpose;
- enharmonic respelling policy;
- tie-closure transpose;
- grace-note transpose;
- browser/mobile command wiring;
- physical-device validation;
- merge/release/production activation.

SesliTab/Smoosic remains outside scope and untouched. Its existing pinned ST Score Editor runtime/build dependency remains unchanged.
