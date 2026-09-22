# ST Score Editor App — Productization Program

Status: **ACTIVE / APP-00–10O + APP-11A–I + P09 + P10-0/P10-1 MERGED FOR RECORDED SCOPE / APP-11J ANALYSIS PRESENT ON MAIN / P10-2 BOUNDED UNRETIMING IMPLEMENTED / FULL RELEASE MATRIX OPEN**

Date: 2026-09-19

## Product decision

ST Score Editor is an independent standalone score-editing product. Canonical editing remains `ScoreDocumentV3 + NotationDocumentV4` owned by `EditorSessionV4`.

UI state, semantic-range capture state, file/recovery state, renderer/viewport state, playback state, export/print state and release-hardening state are noncanonical. Local product operation does not require a backend.

SesliTab is not an architectural dependency and is outside this development track. No SesliTab cutover is authorized by this program.

## Completed product substrate

### APP-00–08

**COMPLETE / MERGED.**

Standalone document/runtime, unified V4 authoring history, browser shell, bounded local MusicXML workflow, guarded recovery, renderer/viewport integration, local playback and bounded export/print are merged.

### APP-09 / APP-09B

**AUTOMATED HARDENING COMPLETE / PHYSICAL RELEASE MATRIX STILL OPEN.**

Responsive/mobile/accessibility/recovery hardening, standalone bundle budget and exact-current-revision host-controlled renderer rerender are merged. iPhone Safari P08/P09 device gate PASS is recorded for the tested professional/keyboard/renderer scope. The full APP-09 G1–G10 multi-platform release matrix remains incomplete. Automated WebKit is regression evidence and cannot by itself establish a physical-device PASS.

### APP-10A–O

**COMPLETE / MERGED.**

The standalone editor product now includes bounded Guitar/Piano starts, Voice 1–5, note entry, exact selected-note edit/delete, semantic Staff/measure navigation, bounded synthetic measure append, chord-tone authoring, articulation/ornament groups and exact explicit Flat/Natural/Sharp authoring.

## P09 Fast Entry / Keyboard Workstation

**COMPLETE / MERGED / QUALIFIED — PR #191 / merge `9dfa253a55982a66b01b5eaa2f8df614b1e58e9b`.**

Exact qualified P09-D head: `636c17dc27b657d273cf2e4f630a2e7c11ffa8f6`.

P09 adds versioned keyboard intents, focus-safe browser dispatch, semantic measure navigation and delegation into the existing note-entry/keypad/session authorities. It does not add a second canonical cursor, score, rhythm engine or history authority. Physical iPhone/Safari evidence covers renderer startup, rendered-note selection, edit, Undo/Redo, orientation, lifecycle return and continued touch selection.

## APP-11 strong-editor program

### APP-11A — Rhythm Timing Admission

**COMPLETE / MERGED — PR #129.**

Read-only exact-event timing admission. It classifies shrink/grow/no-op, checks next-event occupancy, synthetic measure bounds and timing coupling. Imported trailing growth without proven measure semantics fails closed.

### APP-11B — Safe Duration + Explicit Rest Balancing

**COMPLETE / MERGED — PR #131.**

Duration/Rest/Dot timing-changing paths converge on shared V4 rhythm mutation authority. Contraction creates or extends explicit rest space; growth consumes only exact adjacent admitted neutral rest. One accepted edit creates one `EditorSessionV4` history revision.

### APP-11C — Semantic Selection V4

**COMPLETE / MERGED — PR #133.**

Revision-bound `SINGLE`, `NOTE_PAIR` and contiguous same-measure `EVENT_RANGE` provide explicit multi-target semantics without renderer inference. Selection remains noncanonical and history-free.

### APP-11D — Tie

**COMPLETE / MERGED — PR #134.**

Explicit note-pair capture exposes bounded Tie authoring. Capture is presentation-only; Apply is one unified history revision.

### APP-11E — Slur

**COMPLETE / MERGED — PR #135.**

Explicit note-pair capture exposes bounded Slur authoring while preserving Tie semantics beneath the same semantic selection model.

### APP-11F — Metadata-only Triplet

**COMPLETE / MERGED — PR #136.**

Three explicitly captured contiguous events may receive Triplet metadata only when their canonical timing is already exact 3:2 timing. No onset/duration retiming occurs in this path.

### APP-11G — Triplet Retiming Admission

**COMPLETE / MERGED — PR #138 / merge `91d6e162392149399daae476efe13936a1686ddf`.**

Analysis-only straight-three-to-Triplet admission for exactly three explicit current-revision, consecutive, contiguous events with equal supported simple written-base duration.

For three straight eighths it deterministically produces the candidate:

```text
onsets:    0, 1/12, 1/6
durations: 1/12, 1/12, 1/12
```

It also exposes the exact released interval required for explicit-rest balancing.

Dots, beams, existing tuplets, ties, selected cross-staff events, stale ranges, unsupported written bases and invalid timing fail closed.

### APP-11H — Atomic Triplet Retiming Authoring

**COMPLETE / MERGED — PR #139 / merge `bd210bac620489a108c42dd565e85084b64294fd`.**

APP-11H consumes APP-11G evidence and atomically changes the three admitted event onsets/durations, preserves event/note identities, adds Triplet start/middle/stop notation and balances released time by extending an immediately adjacent neutral rest backward or creating deterministic `tuplet-rest:<hex>` residual rest.

Notation-coupled or cross-staff adjacent rests are not consumed implicitly. Imported MusicXML contraction is admitted within the same bounded local rules. APP-11H itself does not own history.

### APP-11I — Session + Browser Triplet Retiming

**COMPLETE / MERGED — PR #140 / merge `6b0e2cac572dfcfa570bfab2bb8eb47a9d7f68fc`.**

APP-11H is integrated with `EditorSessionV4`, the app document and standalone browser runtime.

The product now deliberately exposes two separate Triplet paths:

1. **Triplet Apply** — metadata-only APP-11F path for events already in exact canonical 3:2 timing.
2. **Triplet Retiming** — APP-11G/H path for three explicitly captured supported straight events.

A successful retiming operation:

- preserves the three event/note identities;
- rewrites exact rational onsets/durations atomically;
- adds Triplet notation in the same canonical result;
- keeps explicit-rest occupancy exact;
- creates exactly one `EditorSessionV4` history revision;
- returns exact first-event semantic selection;
- is completely restored by one Undo.

Dedicated mobile WebKit verifies straight eighths -> canonical `1/12 + 1/12 + 1/12` Triplet -> exact Undo. The same exact head also passed the retained APP-10E–O, APP-11B/D/E/F, exact renderer build and APP-09B renderer/controlled-layout regression chain.

### APP-11J — Triplet Removal / Unretiming Admission

**ANALYSIS FOUNDATION PRESENT ON MAIN / CANONICAL MUTATION NOT EXPOSED.**

Foundation commit `674187b920434d6d7d72330baba44c2692a64596` is already an ancestor of the P10 baseline main commit. The read-only admission package and regression tests are present on main. Historical PR #142 remaining open is stacked metadata and is not code-presence authority.

APP-11J keeps canonical mutation authority, history authority and renderer-coordinate authority false. P10-2 consumes this evidence rather than recreating it.

### P10-2 — bounded Triplet removal / unretiming

**IMPLEMENTED AS AN OPTIONAL PROFESSIONAL-WORKSTATION SURFACE; DEFAULT/RELEASE CUTOVER FALSE.**

The separate P10-2 authoring package atomically restores one fresh APP-11J-admitted exact 3:2 Triplet to its supported straight timing, removes only owned Triplet metadata and applies the exact admitted adjacent neutral-rest plan. Event/note identities and existing part/staff/frame/measure/Voice topology are preserved.

The session/app wrappers commit one accepted action through `EditorSessionV4`. Exact Undo restores the prior Triplet score+notation pair; Redo restores the straight pair. The visible **Remove Triplet** / **Restore straight timing** control is composed into an optional P10-2 workstation decorator. It does not change the `tuplet.triplet` keypad action, replace the qualified default standalone global or authorize production/SesliTab cutover.

Automated mobile WebKit covers the visible control, straight -> Triplet -> straight round trip, exact Undo/Redo, remount/re-capture and duplicate-listener history behavior.

### P10-2B — read-only generalized 4:3 tuplet admission

**IMPLEMENTED AS ANALYSIS-ONLY CAPABILITY; QUALIFICATION PENDING; GENERALIZED MUTATION NOT AUTHORIZED.**

The separate `editor-generalized-tuplet-admission-v4` package analyzes exactly four current-revision events representing one exact 4:3 tuplet. It returns immutable straight-four timing/rest-capacity evidence while preserving event/note identity and existing part/staff/frame/measure/Voice topology.

This capability is **read-only**:

- canonical mutation authority: false;
- history mutation authority: false;
- renderer-coordinate authority: false;
- browser/public-write authority: false;
- generalized tuplet mutation: not authorized.

The first imported MusicXML regression preserves imported event/note ids while admitting exact 4:3 timing. Arbitrary ratios/cardinalities and generalized mutation remain outside current product authority. SonarQube Cloud live issue-detail triage is pending; this document does not claim a Sonar Quality Gate PASS.

## Product authority boundaries

The browser is allowed to present and invoke only already-admitted semantic operations. It may not infer canonical targets/timing from renderer geometry.

Current fail-closed boundaries include:

- generalized tuplet mutation and arbitrary ratios/cardinalities beyond the bounded 3:2 mutation path and read-only 4:3 admission;
- renderer-derived Triplet range inference;
- selected cross-staff Triplet retiming;
- independent retiming of dots/beams/existing tuplets/ties outside admitted atomic programs;
- arbitrary imported trailing duration growth without proven pickup/non-controlling evidence;
- automatic imported Voice/measure invention;
- arbitrary rest redistribution outside admitted local contracts;
- `.mxl` container support;
- direct PDF bytes;
- V4-native cross-staff MusicXML round trip;
- cloud/server revision authority.

## Release gate

The standalone release gate remains open:

```text
manualDeviceValidationRequired = true
standaloneReleaseGatePassed = false
seslitabCutoverAuthorized = false
```

Physical target status:

- iPhone Safari — P08/P09 DEVICE GATE PASS / FULL G1–G10 INCOMPLETE;
- Android Chrome — PENDING;
- Windows Edge — PENDING;
- Windows Chrome — PENDING;
- Windows Firefox — PENDING.

Real iPad Safari remains secondary. The full release matrix remains open.

Automated WebKit success remains regression evidence only; the iPhone Safari P08/P09 device gate PASS is separate human physical-device evidence.

## Next bounded development action

**P10-2B closeout — exact-head qualification, Sonar live triage and review.**

Before merge, the current branch still requires fresh exact-head CI/retained WebKit evidence, live Sonar status and whole-branch review. Physical iPhone/Safari evidence is separately required before any release/cutover claim. Generalized tuplet mutation is not authorized; broader tuplets, beams and rhythm/relation semantics remain separate architectural tranches.
