# P10-3A — Professional Key-Aware Pitch Transpose Design

Status: **DESIGN APPROVED / IMPLEMENTATION NOT STARTED**

Date: 2026-09-22  
Repository: `khfy7wpr5p-maker/st-score-editor-core`

## 1. Intent

P10-3A extends the existing P08 professional semantic range infrastructure with bounded professional pitch transpose.

The user goal is to transpose a current professional `EVENT_SPAN` or `EVENT_SET` by:

- chromatic/semitone interval: `-12..-1` or `+1..+12`;
- diatonic interval: `-7..-1` or `+1..+7`.

The operation must behave like a professional score edit, not a MIDI-only pitch shift. Canonical pitch spelling and accidental presentation must remain coherent, selection must remain semantic, and one accepted action must create exactly one `EditorHistoryV4` revision.

## 2. Existing repository reality

P08 already provides:

- revision-bound semantic `EVENT_SPAN` and `EVENT_SET` selection;
- canonical target ordering independent of renderer geometry;
- professional octave transpose;
- rhythm-preserving Clear/Delete-to-REST;
- workstation/browser orchestration;
- selection rebinding after admitted bulk edits;
- single-history-step Undo/Redo.

The current octave transpose deliberately preserves `step` and `alter` and changes only octave.

Repository documentation explicitly defers chromatic/semitone and diatonic transpose because they require:

- enharmonic spelling policy;
- key-signature policy;
- relation-safety policy.

P10-3A closes that bounded gap without replacing the proven P08 selection or history architecture.

## 3. Non-goals

P10-3A does not add:

- multi-measure copy/paste;
- range delete/replace beyond existing Clear-to-REST;
- duplication;
- rhythmic transforms;
- mixed-Voice selection;
- cross-staff selection;
- renderer/lasso-derived target membership;
- tie relation closure;
- grace relation closure;
- arbitrary enharmonic preference UI;
- key-signature mutation;
- automatic modulation analysis;
- generalized score-theory inference;
- release, production cutover, or SesliTab cutover.

## 4. Canonical authority

Authority remains:

```text
Professional UI / host intent
        |
        v
P08 ProfessionalSelectionV1
(EVENT_SPAN / EVENT_SET, noncanonical)
        |
        v
P10-3A read-only admission + pitch/spelling plan
        |
        v
bounded score + notation candidate
        |
        v
EditorSessionV4
        |
        v
EditorHistoryV4
```

Rules:

- `ScoreDocumentV3 + NotationDocumentV4` remain canonical.
- Professional selection remains noncanonical interaction state.
- Renderer coordinates, DOM order and SVG geometry have no authoring authority.
- The pitch-transpose engine has no history authority.
- Only the session adapter commits the accepted direct-child candidate.
- Partial apply is forbidden.

## 5. Public operation profiles

### 5.1 Semitone transpose

Accepted interval:

```text
-12..-1 | +1..+12
```

Zero is invalid.

The resulting sounding pitch must differ from the source by exactly the requested number of semitones.

### 5.2 Diatonic transpose

Accepted interval:

```text
-7..-1 | +1..+7
```

Zero is invalid.

A diatonic step means one letter-name movement. For example, an upward diatonic step moves C to D, E to F and B to C, with octave rollover handled canonically.

The target spelling is key-aware and preserves the source note's chromatic deviation relative to the effective key signature.

## 6. Effective key-signature policy

Key signature is staff-local notation.

For every selected pitched event, admission resolves the effective key signature for its own staff and measure.

Resolution rule:

1. inspect the target staff-measure;
2. if it has an explicit key signature, use it;
3. otherwise walk backward through earlier canonical staff-measures in that same content staff;
4. use the nearest earlier explicit key signature;
5. if none exists, use `{ fifths: 0 }`.

No renderer state or MusicXML source text is consulted after canonical import.

The resolver supports only the canonical `fifths -7..+7` model already admitted by NotationDocumentV4.

## 7. Pitch model and bounded arithmetic

Canonical pitch is:

```ts
Pitch {
  step: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
  alter: number
  octave: number
}
```

P10-3A admits target results only when:

- `alter` remains an integer in `-2..+2`;
- octave remains inside the canonical score-model range;
- the target sounding pitch is exact;
- no note identity changes;
- no event identity changes;
- no chord identity changes.

If any selected note cannot be represented inside that bounded profile, the entire operation fails closed.

## 8. Key-aware diatonic algorithm

For each selected note:

1. resolve the effective key signature;
2. derive the signature accidental for the source letter;
3. compute the source chromatic deviation from that signature;
4. shift the letter name by the requested diatonic steps;
5. resolve octave rollover by canonical letter order;
6. derive the signature accidental for the target letter;
7. apply the same source chromatic deviation to the target signature accidental;
8. validate target `alter` and octave bounds;
9. verify the resulting pitch is representable in the canonical model.

Example principle:

- an altered scale tone remains equivalently altered relative to the destination scale degree;
- a natural scale tone follows the target key-signature spelling.

P10-3A does not change the key signature itself.

## 9. Key-aware semitone spelling algorithm

Semitone transpose first computes the exact target chromatic pitch.

All canonical spellings for that target pitch with:

- letter `A..G`;
- `alter -2..+2`;
- valid octave;

are candidate spellings.

Candidates are ranked deterministically:

1. prefer the candidate whose accidental agrees with the effective key signature;
2. then prefer the candidate requiring the smaller absolute accidental magnitude;
3. then prefer a natural spelling;
4. if still tied:
   - upward transpose prefers the sharp-direction spelling;
   - downward transpose prefers the flat-direction spelling;
5. final ties are resolved by fixed canonical letter order so the result is reproducible.

The same source score, selection, key context and interval must always produce the same target spelling.

No user preference state is introduced in P10-3A.

## 10. Accidental-display policy

Canonical pitch and explicit accidental-display metadata must never drift apart.

For every changed note:

- P10-3A computes the canonical target `Pitch`;
- it computes whether an explicit accidental display is required for the target spelling under the effective key signature;
- if an explicit display is required, it writes the corresponding existing notation value:
  - `sharp`;
  - `flat`;
  - `natural`;
  - `double-sharp`;
  - `double-flat`;
- if no explicit display is required, the accidental metadata becomes `null`.

The score-pitch update and notation update are one atomic candidate.

Existing unrelated note notation is preserved.

## 11. Selection and relation safety

Supported:

- `EVENT_SPAN`;
- discontiguous `EVENT_SET`;
- NOTE events;
- CHORD events;
- REST events inside the selection remain unchanged.

Fail closed when:

- selection is stale or tampered;
- selection resolves outside current revision;
- no pitched targets exist;
- a selected note participates in a tie;
- a selected event anchors grace content;
- a target pitch exceeds canonical pitch bounds;
- target spelling requires `alter` outside `-2..+2`;
- notation cannot be rebound exactly;
- an admitted note plan does not apply exactly once;
- result score or notation fails canonical validation;
- requested interval is zero or outside the bounded profile.

Unselected events and notes must remain byte-equivalent in canonical musical content except for unavoidable revision-address rebinding in notation.

## 12. New packages

### 12.1 `editor-professional-pitch-transpose-v1`

Responsibilities:

- validate current `ProfessionalSelectionV1`;
- resolve effective key signature;
- parse bounded interval;
- compute per-note source/target pitch plans;
- compute accidental-display plans;
- enforce relation safety;
- produce read-only admission;
- execute bounded score + notation candidate;
- rebind the professional selection to the direct-child revision.

Explicitly false authorities:

- `historyMutationAuthority = false`;
- `rendererCoordinateAuthority = false`;
- `domAuthoringAuthority = false`.

### 12.2 `editor-session-professional-pitch-transpose-v1`

Responsibilities:

- verify admission belongs to current session present revision;
- revalidate the admission/candidate boundary;
- commit exactly one direct-child score+notation pair through `EditorHistoryV4`;
- return the rebound professional selection.

It must not mutate history arrays directly.

## 13. Workstation API

`score-editor-professional-workstation-v1` adds:

```ts
commitProfessionalWorkstationSemitoneTransposeV1(
  workstation,
  semitoneDelta,
  options
)

commitProfessionalWorkstationDiatonicTransposeV1(
  workstation,
  diatonicSteps,
  options
)
```

Both:

- require an existing professional selection;
- delegate admission and authoring;
- preserve app-document saved-revision semantics;
- keep the rebound professional selection on success.

## 14. Browser API

`score-editor-browser-professional-v1` exposes:

```ts
transposeSemitones(delta, options)
transposeDiatonically(steps, options)
```

The browser bridge:

- does not compute pitch spelling;
- does not inspect renderer geometry to choose targets;
- adopts only the validated workstation result;
- clears stale selection if canonical revision changes outside the professional bridge.

## 15. First visible UI slice

The existing professional range toolbar adds four bounded controls:

- `−½` — semitone down 1;
- `+½` — semitone up 1;
- `−Step` — diatonic down 1;
- `+Step` — diatonic up 1.

The engine/API still supports the complete approved interval bounds:

- semitone `±1..±12`;
- diatonic `±1..±7`.

A larger interval picker/dialog is deferred.

UI buttons:

- remain disabled until a current semantic professional range is ready;
- use the existing revision-id factory;
- remain command surfaces only;
- do not gain canonical authority.

## 16. History and identity contract

One accepted user action creates exactly one `EditorHistoryV4` revision.

Required:

- direct-child revision;
- exact Undo restores pre-transpose score + notation;
- exact Redo restores post-transpose score + notation;
- event ids preserved;
- note ids preserved;
- chord membership preserved;
- onset and duration preserved;
- selection rebinds to the new revision;
- unrelated document metadata remains unchanged.

## 17. Error model

The new engine uses explicit bounded failure codes, including:

- `INVALID_SEMITONE_DELTA`;
- `INVALID_DIATONIC_STEPS`;
- `SELECTION_STALE_OR_TAMPERED`;
- `NO_PITCHED_TARGETS`;
- `TIE_RELATION_UNSUPPORTED`;
- `GRACE_RELATION_UNSUPPORTED`;
- `KEY_CONTEXT_INVALID`;
- `PITCH_RANGE_EXCEEDED`;
- `SPELLING_UNREPRESENTABLE`;
- `ADMISSION_STALE_OR_TAMPERED`;
- `TARGET_PLAN_INVALID`;
- `NOTATION_RESULT_INVALID`;
- `RESULT_INVALID`;
- `RESULT_SELECTION_INVALID`;
- `INVALID_REVISION_ID`.

Failures before commit mutate nothing and create no history revision.

## 18. Required TDD matrix

### Admission / theory

- semitone `+1/-1`;
- semitone `+12/-12`;
- diatonic `+1/-1`;
- diatonic `+7/-7`;
- zero rejected;
- out-of-range intervals rejected;
- C-major spelling;
- sharp-key spelling;
- flat-key spelling;
- inherited effective key signature across later measures;
- default `fifths: 0` when no key is declared;
- B→C and C→B octave rollover;
- double-sharp / double-flat bounded cases;
- unrepresentable third accidental rejected.

### Selection/content

- contiguous multi-measure `EVENT_SPAN`;
- discontiguous `EVENT_SET`;
- NOTE;
- CHORD all tones;
- REST unchanged;
- unselected intervening events unchanged;
- stale selection rejected;
- duplicate/tampered selection rejected by existing professional selection boundary.

### Relations

- tied selected note rejected;
- grace-anchored selected event rejected;
- unrelated slur/ornament/articulation metadata preserved when no closure is required.

### Notation

- accidental display updated atomically with canonical pitch;
- no redundant explicit accidental when key signature already supplies it;
- required natural/sharp/flat/double accidental emitted correctly;
- unrelated note/event/frame/measure notation preserved.

### Authoring/history

- every plan applies exactly once;
- fresh revision required;
- one operation = one history entry;
- exact Undo;
- exact Redo;
- selection rebound to new revision;
- dirty/savedRevision semantics unchanged except normal edit dirtiness.

### Browser/UI

- browser bridge semitone API;
- browser bridge diatonic API;
- four toolbar buttons;
- disabled without ready semantic range;
- no renderer/DOM target authority;
- existing mobile/desktop toolbar behavior remains intact.

## 19. Qualification gates

Before P10-3A can be presented for merge:

- full repository suite PASS;
- Node 18 PASS;
- Node 20 PASS;
- Node 22 PASS;
- P10-3A focused tests PASS;
- retained APP-09B WebKit PASS;
- retained P08-E4 professional artifact WebKit PASS;
- retained P10-1 professional workstation WebKit PASS;
- retained P10-1 renderer qualification WebKit PASS;
- retained P10-2 Triplet Unretiming WebKit PASS;
- new P10-3A browser/WebKit regression PASS;
- `SonarCloud Code Analysis` required GitHub check PASS.

No merge, release, default cutover, public-write cutover or SesliTab cutover is implied by test success.

## 20. Delivery boundary

P10-3A is complete when:

- semitone and diatonic transpose are available over existing professional semantic selections;
- approved interval ranges are enforced;
- key-aware deterministic spelling is proven;
- pitch + accidental notation remain atomic;
- session/history/browser integration is proven;
- regression and Sonar gates are green;
- docs reflect exact capability boundaries.

P10-3B remains separate and may address bounded range delete/replace beyond the already-existing Clear-to-REST profile.
