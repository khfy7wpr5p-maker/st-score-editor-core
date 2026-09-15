# ST Score Editor Core — Roadmap

Updated: **2026-09-15**  
Repository source of truth: `main` at **`0adabbdc426f8481196ee41cce5c9b2bbff2768e`**.

Planned capability is not production capability. Automated browser evidence is not physical-device evidence.

## Product objective

Build ST Score Editor Core into a professional, reusable notation-editing platform that can operate as:

1. a standalone score editor;
2. an embeddable/browser product component;
3. a versioned SDK for external hosts;
4. a commercially licensable editing engine.

The architectural goal is professional notation editing with fast input, exact semantic targeting, reliable Undo/Redo, renderer independence, safe MusicXML interchange, optional audio audition and strong desktop/mobile workflows.

SesliTab remains a separate product integration decision, not an architectural dependency.

## Completed / merged foundation

- **SSE semantic/model foundation — COMPLETE / MERGED** within the repository's bounded V3/V4 profiles.
- **APP-00–10O — COMPLETE / MERGED**: standalone runtime, files/recovery, renderer bridge, playback, export/print, note/chord/Voice/staff/measure authoring, articulations, ornaments and explicit accidentals.
- **APP-11 rhythm/relation program — merged bounded capabilities** including shared safe rhythm authority, semantic multi-target selection, Tie, Slur, Triplet metadata and straight-triplet retiming paths.
- **P05 generic NOTE/REST renderer targeting + paste/render/undo regression — retained.**
- **P06 versioned SDK/audio admission work — production-composed where explicitly merged; historical stacked validation PRs remain non-current merge surfaces.**
- **P07 latency hardening — merged** for non-blocking note selection / Grand Piano audition behavior.
- **P08-A–D — COMPLETE / MERGED**: professional semantic selection, range transforms, score structure authoring and unified workstation controller.
- **P08-E1–E3 — COMPLETE / MERGED**: browser professional bridge, responsive professional range toolbar and semantic structure inspector.
- **P08-E4 — COMPLETE / MERGED via PR #187**: separately qualified professional browser artifact.

## Current professional browser milestone

`STScoreEditorProfessionalApp` is now an independently built optional artifact rather than an expansion of the default app bundle.

Qualification facts:

- main merge: `0adabbdc426f8481196ee41cce5c9b2bbff2768e`;
- professional bundle measured: **599,398 bytes**;
- maximum: **615,000 bytes**;
- budget revision: `P08-E4-QUALIFIED-1`;
- default app budget remains **542,720 bytes / `P06-AUDIO-V010-1`**;
- Node 18/20/22 exact-head tests: PASS;
- dedicated professional WebKit regression: PASS;
- retained APP-10/11, APP-09B and P05 WebKit regressions: PASS.

This is **not** a physical iPhone PASS and does **not** authorize production exposure.

## Open manual gate — Issue #188

**PHYSICAL-IOS: qualify P08-E4 Professional Browser Artifact**

The real-device test must confirm on physical iPhone Safari:

- professional artifact opens without disappearing/blank editor state;
- bounded MusicXML opens;
- semantic professional range operations work;
- Clear -> REST preserves rhythmic position/duration;
- Undo restores the notes;
- structure edit + Undo works;
- controls are practically tappable and safe-area compatible;
- no crash/freeze occurs.

Only explicit observed physical evidence may close this gate.

## Next autonomous development track — P09 Fast Entry / Keyboard Workstation

This is the next recommended engineering track because professional editor quality now depends strongly on input speed and command ergonomics, while the canonical mutation engines already exist.

### P09-A — existing capability inventory and gap matrix

**NEXT AUTONOMOUS ACTION.**

Read the current `main` implementation and document, without duplicating behavior:

- all `editor-keypad-*` packages/contracts;
- keypad session/browser execution paths;
- existing keyboard shortcuts and focus handling;
- APP-10 insertion and selected-note editing;
- rhythm-changing duration/rest/dot paths;
- semantic navigation and active Voice/staff/measure behavior;
- Undo/Redo semantics;
- professional selection interactions;
- SDK exposure and host lifecycle;
- mobile behavior where desktop keyboard concepts do not apply.

Output a machine-readable and human-readable matrix:

```text
capability
  -> existing implementation
  -> canonical mutation owner
  -> browser/UI surface
  -> missing gap
  -> reuse plan
  -> risk / fail-closed boundary
```

P09-A should avoid production code unless a small test/documentation change is required to prove current behavior.

### P09-B — command-intent contract

Proceed only if P09-A proves a real gap.

Define a versioned, bounded keyboard command vocabulary that maps to existing semantic authoring primitives. It must not become a second mutation engine.

Required properties:

- deterministic semantic target/insertion state;
- explicit focus/input-field guards;
- current-revision target validation;
- no renderer/DOM geometry as musical authority;
- keyboard auto-repeat bounded or explicitly handled;
- command dispatch errors capability-local;
- no history for navigation-only commands;
- exactly one history revision for one accepted authoring command.

### P09-C — browser keyboard adapter

After the contract is proven:

- desktop keyboard routing;
- safe `preventDefault` policy only for admitted notation commands;
- text form fields/contenteditable elements excluded;
- canonical selection/insertion state reflected visually but not stored in DOM as authority;
- keyboard and pointer/touch edits must converge on the same mutation engines;
- mobile behavior must remain intact.

### P09-D — fast-entry workflow qualification

Only after B/C are green, qualify a compact professional entry flow such as:

```text
choose duration / pitch intent
        -> exact semantic insertion target
        -> accepted note/rest mutation
        -> selection/caret rebound
        -> next command
        -> unified Undo
```

Do not introduce hidden cursor semantics until their canonical/noncanonical role is explicitly defined and tested.

## Parallel tracks that must not silently merge into P09

### Audio

- Grand Piano remains the qualified default audition capability from current merged production work.
- Classical Guitar remains suspended.
- Open Violin PR #176 is not current `main`; do not merge it as part of P09.
- The P08-E4 professional artifact currently has no bundled/integrated audio host.

### Physical validation

Issue #188 remains manual and may progress in parallel. Automated WebKit cannot close it.

### Production / SesliTab

P09 does not authorize:

- professional artifact production exposure;
- SesliTab cutover;
- Render production activation;
- release publication;
- repinning external product dependencies.

## Current fail-closed boundaries

Continue to reject or defer unsupported/unproven cases rather than inventing behavior:

- stale revision targets;
- renderer-coordinate/DOM/SVG authoring;
- imported automatic Voice/measure invention;
- unsupported trailing timing growth;
- arbitrary tuplets/rhythm transforms beyond admitted profiles;
- unsupported cross-staff MusicXML projection;
- `.mxl` container support until separately admitted;
- cloud/server canonical revision authority;
- unqualified audio instruments;
- automatic Classical Guitar reactivation;
- production exposure without physical and explicit human gates.

## Required exact-head validation before implementation merge

At minimum preserve:

- Node 18 / 20 / 22 repository contract + build/test;
- retained APP-10/11 browser authoring regressions;
- APP-09B exact renderer build and renderer regression;
- APP-09B controlled-layout rerender regression;
- P05 paste/render/undo regression;
- P08-E4 professional WebKit regression when professional/shared browser code changes;
- dedicated P09 command tests once P09 implementation begins.

## Current release/product flags

```text
professionalArtifactMerged = true
professionalArtifactAutomatedWebKitPassed = true
professionalArtifactPhysicalIPhonePassed = false
professionalArtifactProductionExposureAuthorized = false
standaloneReleaseGatePassed = false
seslitabCutoverAuthorized = false
```
