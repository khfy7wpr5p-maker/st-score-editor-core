# Roadmap

## Current source of truth

Repository reality only. Planned capability is not production capability.

Current development line:

```text
APP-11I merged main baseline
        -> APP-11J read-only unretiming admission foundation
        -> P02 bounded teacher workflow
        -> P03 mobile workspace/performance
        -> P04 file/recovery capability isolation
        -> P05 corpus / teacher-pilot / physical evidence
```

The stacked development PR chain remains reviewable and separate from `main`. The latest P05 branch is `p05-representative-musicxml-corpus-v1`.

## Completed merged baseline

- **E0–E7-H — COMPLETE**
- **E8-A/B/C — IMPLEMENTED**
- **E8-D — HUMAN-GATED / NOT AUTHORIZED**
- **SEC-KP-00–10 — COMPLETE**
- **SEC-NE-00–09 + XML ROUNDTRIP — COMPLETE / MERGED** within documented bounded profiles.
- **SSE-00–10 — COMPLETE / MERGED** including bounded V3 topology and V4 cross-staff runtime.
- **Stage 07 semantic -> renderer presentation locators — COMPLETE / MERGED.**
- **APP-00–10O — COMPLETE / MERGED.**
- **APP-11A–I — COMPLETE / MERGED.**

`ScoreDocumentV3 + NotationDocumentV4` remains canonical. `EditorSessionV4` remains unified history authority. `SemanticAddressV3` remains exact current-revision identity.

## Current stacked development reality

### APP-11J — Triplet Removal / Unretiming Admission Foundation

**READ-ONLY FOUNDATION IMPLEMENTED ON STACKED WORK BRANCH — PR #142.**

APP-11J proves a bounded straight-timing proposal for an exact current-revision 3-event 3:2 Triplet without mutating score/notation or history. It remains fail-closed for unsupported coupling, topology invention and ambiguous rest-space requirements.

No canonical unretiming mutation/browser surface is claimed by APP-11J.

### P02 — Bounded Teacher Workflow Baseline

**CODE-COMPLETE ON STACKED WORK BRANCH — PR #143.**

Verified bounded teacher operations include:

- exact current-revision event-span selection;
- immutable Copy snapshot;
- bounded neutral-rest Paste overwrite;
- bounded Insert after event;
- octave-only bulk transpose `±1/±2`;
- unified Undo/Redo through `EditorSessionV4`;
- browser facade using semantic addresses only.

Deferred: cross-measure Paste/relation remapping and general chromatic/diatonic transpose until explicit policy exists.

### P03 — Mobile Workspace / Performance

**CODE-COMPLETE / VERIFIED ON STACKED WORK BRANCH — PR #144.**

Includes semantic mobile teacher toolbar, shared viewport reuse, presentation-only zoom/pan/page behavior, interaction/performance instrumentation and bounded standalone bundle budget. Renderer/DOM coordinates remain non-authoritative.

### P04 — File / Recovery Capability Isolation

**CODE-COMPLETE / VERIFIED ON STACKED WORK BRANCH — PR #145.**

Current admitted local source formats remain text `.musicxml` / `.xml`. `.mxl` is explicitly unsupported pending separate ZIP/dependency/archive-security review. Failed open/export capability paths do not silently destroy canonical editing authority or history.

### P05 — Teacher Corpus / Pilot / Physical Evidence

**IN PROGRESS — PRs #146 / #147 plus P05 Task 2 preview work merged into the P05 branch.**

Verified foundations include:

- typed immutable corpus/provenance contract;
- strict separation of `AUTOMATED`, `TEACHER_PILOT` and `PHYSICAL_DEVICE` evidence;
- repository-owned representative MusicXML fixtures;
- bounded teacher task plan and metrics;
- generic rendered-event NOTE/REST bridge for the P05 interaction path;
- strengthened real-toolbar WebKit Paste/render/Undo regression.

#### Physical iPhone Safari Task 2

**PASS for the observed physical workflow.**

Observed sequence:

```text
select C -> Start
select D -> Copy
select trailing half rest -> Paste once
visible C-D-C-D
Undo once
visible C-D-half-rest restored
```

The previous Paste viewport displacement did not recur. REST targeting, Paste commit and exact Undo restoration were observed on the physical iPhone.

This PASS is specific to Teacher Task 2 physical behavior. It does not fabricate Teacher Task 1/3 PASS, full teacher-pilot acceptance, or the complete release-device matrix.

## Rendering interaction architecture

`SRL-EDITOR-BRIDGE-02` establishes bounded first-class rendered target evidence for:

- `NOTE`
- `REST`

Authority remains:

```text
renderer evidence
  -> current renderEpoch/source validation
  -> Editor Core current revision
  -> SemanticAddressV3
  -> canonical action or presentation-only selection
```

DOM/SVG identity, renderer objects and screen geometry do not become canonical authoring authority.

## Audio audition parallel lane

A separate repository, `st-score-audio-engine`, owns browser audio implementation.

Editor Core must not create a duplicate private audio engine while that project is under development.

Planned Editor integration is **APP-AUDIO-01** and begins only after the audio engine exposes a green versioned Grand Piano/browser contract:

```text
NOTE touch/selection
  -> current generic NOTE evidence
  -> current SemanticAddressV3
  -> exact canonical pitch
  -> AuditionRequest
  -> st-score-audio-engine
  -> Grand Piano
```

Then Classical Guitar follows through the same contract. REST produces no audition request. Audition is noncanonical and creates no `EditorSessionV4` history.

See `docs/audio-engine-integration-boundary.md`.

## Next autonomous development action

### P06 — Versioned SDK + Generic Integration Contract

**READY.**

P06 is the next independent engineering package that does not require fabricated teacher/device evidence.

Goals:

- define a stable public Editor SDK surface from existing verified capabilities;
- version public contracts explicitly;
- expose capability negotiation rather than product-specific assumptions;
- define host lifecycle and teardown boundaries;
- define error/result contracts and migration/version behavior;
- provide a generic third-party integration example without SesliTab coupling;
- preserve one canonical mutation/history authority;
- keep renderer and optional audio dependencies capability-driven;
- avoid production activation or public-write authority.

P06 must be additive. It may not weaken stale-revision guards, fail-closed behavior or current authority boundaries merely to simplify embedding.

## P05 parallel evidence work

P05 remains open for evidence tasks that require humans/devices:

- Teacher Task 1/3 only when actually executed;
- explicit teacher-pilot acceptance evidence;
- additional representative repertoire only with provenance/rights;
- Android/Windows/iPad evidence where required by release policy;
- release-gate synthesis only after evidence exists.

Automation may prepare evidence tooling but may not synthesize human/device PASS.

## Later packages

- **P07 — Source image / correction provenance:** immutable source provenance, source-region mapping, before/after trace.
- **P08 — AI proposal contract / rules-vs-model experiment:** proposal schema, dry-run, stale-revision rejection, optional narrow model; AI never receives direct canonical write authority.
- **P09 — Guitar / pedagogy differentiation:** TAB/harmony audit, playability constraints and teacher variants after P06 contract maturity.
- **P10 — Commercial service readiness:** license inventory, institution/account/entitlement and tenant/revision threat model.
- **P11 — Release candidate / safe continuation:** full physical support matrix, release/migration/rollback/runbook and separate activation authority.

## Still fail-closed / gated

- arbitrary Triplet removal mutation until separately admitted beyond APP-11J analysis;
- arbitrary tuplet ratios/cardinalities outside bounded profiles;
- automatic renderer-derived semantic/range inference;
- arbitrary imported trailing MusicXML growth without proven topology semantics;
- selected cross-staff timing transformations outside admitted contracts;
- arbitrary rest redistribution;
- automatic imported Voice/measure invention;
- true `.mxl` ZIP-container support;
- direct PDF bytes;
- V4-native cross-staff MusicXML round trip;
- polymeter/non-controlling topology;
- public-write/server revision authority;
- renderer-owned audio/playback authority;
- audio samples without explicit provenance/license suitability;
- production activation.

## External product freeze

SesliTab remains outside the active ST Score Editor work packages.

No SesliTab repository/code change, Smoosic integration change, production change, or pinned ST Score Editor dependency change is authorized without a separate exact dependency inventory and explicit user approval.

## Release state

```text
manualDeviceValidationRequired = true
standaloneReleaseGatePassed = false
seslitabCutoverAuthorized = false
```

Required physical release targets remain real iPhone Safari, Android Chrome, Windows Edge, Windows Chrome and Windows Firefox, with iPad Safari secondary. Automated WebKit regression is not physical-device evidence.
