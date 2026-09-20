# P10-1 Professional Workstation Composition — Architecture Design

Date: 2026-09-20  
Repository: khfy7wpr5p-maker/st-score-editor-core  
Design baseline: main at merge commit 525c0caedf0ed44f6ff06dc92ad8f304acc3d3bf  
Status: **DESIGN APPROVED IN CHAT / WRITTEN SPEC FOR REVIEW**

## 1. Purpose

P10-1 composes the already-qualified professional, keyboard, authoring, renderer, file/recovery/export and optional audio capabilities into one professional workstation surface without introducing a second canonical score, history engine, cursor authority or renderer-owned mutation path.

This stage is composition-first. It does not invent new notation semantics.

P10-1 reuses:

- APP-10 standalone authoring;
- APP-11 bounded rhythm/relation authoring;
- APP-09B renderer interaction;
- P08 professional range + score-structure editing;
- P09 keyboard workstation intents/adapter;
- P06 external audio-host integration;
- existing local file/recovery/export/print lifecycle;
- existing EditorSessionV4 / EditorHistoryV4 history;
- current-revision SemanticAddressV3 identity.

The architectural goal is one mounted professional workstation controller and one user-facing qualification artifact that exercises all of these capabilities over one canonical document/session.

## 2. Intended outcome

The user should be able to work in one professional editor surface where:

1. a rendered score note can be selected;
2. P09 keyboard input can edit through the existing authoring/session paths;
3. P08 professional range and structure tools can act on the same current document;
4. APP-10/11 authoring remains available;
5. renderer interaction remains presentation-only;
6. optional audition can run through the existing audio host without mutating canonical state;
7. Undo/Redo traverses one unified history regardless of whether the accepted edit originated from keyboard, professional range tools or normal authoring controls.

Success is not “all controls are visible.” Success is proving that separate UI/input layers are merely alternate front ends over the same canonical document/history authority.

## 3. Current baseline

### 3.1 Default / audio-integrated browser path

Current default browser runtime:

~~~text
STScoreEditorApp
    |
    v
createAudioHostIntegratedStandaloneBrowserAppRuntime()
    |
    v
Mobile Teacher Viewport
    |
    +-- APP-10 / APP-11 authoring
    +-- APP-09B renderer interaction
    +-- file/recovery/export/print
    +-- optional external audio host
~~~

The default browser runtime already reaches the audio-host-integrated controller.

### 3.2 P09 keyboard path

Current P09 qualification runtime:

~~~text
STScoreEditorKeyboardWorkstation
    |
    v
createKeyboardWorkstationStandaloneBrowserAppRuntime()
    |
    v
createAudioHostIntegratedStandaloneScoreEditorController()
    |
    +-- P09 keyboard adapter
    +-- existing controller/session mutation paths
~~~

P09 deliberately owns no canonical score, no history, no renderer authority and no hidden cursor.

### 3.3 P08 professional path

Current professional runtime:

~~~text
STScoreEditorProfessionalApp
    |
    v
createProfessionalStructureInspectorStandaloneBrowserAppRuntimeV1()
    |
    v
Professional Structure Inspector
    |
    v
Professional Range Toolbar
    |
    v
Mobile Teacher Viewport
    |
    +-- P08 professional browser bridge
    +-- P08-D professional workstation
~~~

P08 uses the browser controller’s validated snapshot-adoption boundary and keeps professional selection noncanonical and revision-bound.

### 3.4 Present composition gap

The two advanced surfaces currently diverge:

- P09 starts from the audio-host-integrated controller but does not compose the P08 professional UI.
- P08 starts from the mobile-teacher controller but does not compose the P09 keyboard layer or the P06 audio host.
- the qualified P08 professional artifact explicitly reports:
  - audioEngineBundled = false;
  - audioHostIntegrated = false.

The problem is therefore composition, not missing canonical authoring engines.

## 4. Chosen approach

### 4.1 Decorator composition root

P10-1 uses a **single base controller plus attachable/decorator capability layers**.

~~~text
STScoreEditorProfessionalWorkstation
                 |
                 v
Professional Workstation Composition Controller
canonicalAuthority = false
                 |
        +--------+--------+
        |        |        |
       P08      P09     Audio Host
        |        |        |
        +--------+--------+
                 |
                 v
StandaloneScoreEditorController lineage
                 |
        +--------+--------+
        |        |        |
      APP-10   APP-11   APP-09B
                 |
                 v
ScoreDocumentV3 + NotationDocumentV4
                 |
                 v
EditorSessionV4 / EditorHistoryV4
~~~

The composition layer coordinates browser/UI/input concerns but owns no music.

### 4.2 Why this approach

This approach reuses existing qualified paths and minimizes authority duplication.

It avoids:

- a second ProfessionalController implementation;
- a second keyboard controller;
- a new document/session store;
- a P08-owned or P09-owned shadow history;
- a renderer-derived cursor;
- duplicated note-entry/rhythm logic.

### 4.3 Rejected alternatives

#### Alternative B — Make the P08 professional app the new root and embed keyboard/audio directly

Rejected because it makes the professional artifact simultaneously responsible for professional UI, keyboard composition and audio composition. It increases coupling and weakens the distinction between capability layers and canonical controller authority.

#### Alternative C — Rewrite a new monolithic ProfessionalWorkstationController

Rejected because it would duplicate already-proven P08/P09 behavior and creates the highest risk of a second mutation/history path.

## 5. Canonical authority contract

P10-1 must preserve these exact authority rules.

### 5.1 Canonical musical pair

~~~text
ScoreDocumentV3 + NotationDocumentV4
~~~

No P10-1 object may own an alternate canonical score.

### 5.2 History authority

~~~text
EditorSessionV4 / EditorHistoryV4
~~~

All accepted canonical edits, regardless of UI/input origin, must enter the same unified history chain.

### 5.3 Semantic identity

~~~text
SemanticAddressV3, exact current revision
~~~

P08 professional ranges, P09 keyboard targets and renderer selections must resolve against current-revision semantic identity.

### 5.4 Explicitly noncanonical state

P10-1 may hold:

- active UI/tool mode;
- keyboard adapter mounted/unmounted state;
- keyboard binding configuration;
- professional range capture state;
- professional structure-panel presentation state;
- renderer selection/highlight presentation state;
- audio runtime attachment state;
- audition instrument state;
- temporary status/error presentation.

P10-1 may not hold:

- canonical notes;
- canonical rhythm;
- canonical topology;
- canonical cursor;
- history snapshots;
- renderer-coordinate mutation identity;
- host-owned shadow document state.

## 6. Composition units

P10-1 should be implemented as focused units that can be tested independently.

### 6.1 Base browser document controller

Role:

- owns the mounted ScoreEditorAppDocument;
- exposes current document/snapshot/subscription;
- owns validated snapshot adoption;
- provides APP-10/11 authoring methods;
- provides renderer interaction;
- provides file/recovery/export/print lifecycle.

This remains the document-facing browser authority.

### 6.2 Audio host decorator

Role:

- attaches optional ScoreAudioRuntimeV010;
- creates revision-bound audition requests;
- exposes instrument selection only for currently qualified instruments;
- creates no history;
- mutates no canonical score.

P10-1 must preserve:

~~~text
audioEngineBundled = false
externalAudioRuntimeRequired = true
auditionCanonicalMutationAuthority = false
auditionHistoryMutationAuthority = false
rendererAudioAuthority = false
~~~

Current qualified instruments remain:

- GRAND_PIANO;
- VIOLIN.

CLASSICAL_GUITAR remains suspended and is not reactivated by P10-1.

### 6.3 P09 keyboard decorator

Role:

- mount one focus-safe keyboard adapter;
- translate browser gestures into versioned P09 intents;
- dispatch only into existing controller/session methods;
- expose keyboard workstation state;
- unmount cleanly.

It must not:

- calculate rhythm independently;
- invent semantic cursor state;
- bypass controller/session admission;
- own Undo/Redo state.

### 6.4 P08 professional bridge

Role:

- attach P08 professional workstation capability to the same base controller;
- use current document/session;
- adopt validated P08 results back through the existing browser-controller adoption boundary;
- maintain revision-bound professional selection only.

Professional selection must clear when current-revision validity is lost according to existing P08 rules.

### 6.5 Professional range UI decorator

Role:

- expose range-start/range-end capture over current semantic event identity;
- invoke P08 range operations;
- render desktop/mobile range controls;
- own presentation only.

### 6.6 Professional structure UI decorator

Role:

- expose key signature, clef, meter and barline/repeat controls over the same current selection/document;
- invoke P08 structure operations;
- create one accepted history revision per admitted edit.

### 6.7 P10-1 composition controller

New P10-1 composition controller is a coordinator over the units above.

It may expose a combined typed surface such as:

~~~text
ProfessionalWorkstationController
  base
  audio
  keyboard
  professional
  rangeToolbar
  structureInspector
~~~

The names are design intent, not a requirement to duplicate controller objects. Implementation should prefer thin attach/decorator seams over stateful wrappers.

The combined controller must have exactly one effective mounted document lineage.

## 7. Constructor / attachment strategy

P10-1 should move capability layers toward attachable seams.

Today, several constructors create their own lower layer directly.

Examples:

- keyboard workstation creates an audio-host-integrated controller;
- professional range UI creates a mobile-teacher controller;
- professional structure UI creates the professional range controller.

P10-1 should introduce bounded attachment seams where needed so the same existing base controller can be decorated rather than recreated.

Design rule:

~~~text
createXController(options)
    may remain as convenience constructor
but internally becomes conceptually:
    createBaseController(options)
    -> attachX(base)
~~~

Existing public constructors should remain backward-compatible where practical.

P10-1 must not break the current default, P08 or P09 qualification surfaces merely to create the combined surface.

## 8. One-document composition invariant

The strongest P10-1 invariant is:

> Every P08, P09, APP-10/11, renderer and audio action visible in the combined workstation must observe the same active ScoreEditorAppDocument and the same EditorSessionV4 history present revision.

Tests must prove object/document continuity through public behavior rather than depending only on internal object identity.

No decorator may silently create a second standalone controller under the combined artifact.

## 9. Selection behavior

### 9.1 Canonical selection

The active semantic selection remains the existing document/session selection.

Renderer hit-test may select a semantic note through the existing controller path.

Keyboard operations that require selection consume the same current-revision selection.

Professional structure controls derive measure/frame targets from that same selection.

### 9.2 Professional range selection

P08 EVENT_SPAN / EVENT_SET selection remains a separate noncanonical professional-range concept.

It is allowed because it is:

- revision-bound;
- presentation/workflow state only;
- not persisted as canonical score;
- cleared/rebound using existing P08 rules.

P10-1 must not merge professional range selection into a hidden canonical cursor abstraction.

### 9.3 Selection after history traversal

Existing history behavior remains authoritative.

Undo/Redo may clear selection according to EditorSessionV4 contract.

P10-1 must not auto-reinvent a stale semantic selection merely to keep a toolbar active.

## 10. History behavior

### 10.1 Unified chain

A mixed interaction sequence must prove one history chain:

~~~text
renderer note selection
    -> no history

P09 keyboard edit
    -> history +1

P08 professional range edit
    -> history +1

Undo
    -> only P08 edit is reverted

Undo
    -> P09 edit is reverted

Redo
    -> P09 edit returns

Redo
    -> P08 edit returns
~~~

No layer may keep a private undo stack.

### 10.2 Noncanonical actions

The following must create zero history revisions:

- keyboard mode/binding state;
- viewport interaction;
- professional range capture itself;
- audio attach/detach;
- audition;
- renderer highlight;
- panel open/close;
- selection-only interaction unless existing session contract explicitly says otherwise.

## 11. Renderer interaction

APP-09B remains presentation-only.

Renderer interaction path:

~~~text
rendered note hit
    -> guarded rendered-note ref
    -> current semantic selection
    -> optional audition
    -> normal UI/keyboard/professional actions
~~~

P10-1 must not authorize mutation from:

- SVG path id;
- DOM element id;
- pixel coordinate;
- OSMD/VexFlow geometry;
- stale rendered revision.

Renderer rerender must continue to follow current canonical revision.

## 12. Audio behavior

Audio remains capability-local and optional.

### 12.1 Combined workstation behavior

The combined artifact may expose the audio-host attachment surface, but the audio engine itself remains external.

~~~text
audioHostIntegrated = true
audioEngineBundled = false
externalAudioRuntimeRequired = true
~~~

### 12.2 Failure independence

Audio failure must not:

- roll back an admitted canonical edit;
- block editing;
- mutate history;
- corrupt semantic selection.

### 12.3 Instrument policy

P10-1 must not change qualification policy.

Current runtime/test/production-assembly evidence on main treats GRAND_PIANO and VIOLIN as qualified audition instruments. The P08 Violin production integration was merged in commit `e281d52881aaad0fade574a944251b12ea752038`, and current `audio-host-integrated.ts`, P08 Violin admission tests and production-site assembly contracts all expose `['GRAND_PIANO', 'VIOLIN']`.

Legacy P06 handoff/status documents still describe VIOLIN as `SCAFFOLD_UNQUALIFIED`; those records predate the later P08 Violin qualification and must not override current runtime/test/production-assembly truth.

Therefore P10-1 preserves:

- GRAND_PIANO qualified;
- VIOLIN qualified;
- CLASSICAL_GUITAR suspended;
- other orchestral instruments outside P10-1.

P10-1 does not reopen instrument qualification work.

## 13. Combined UI artifact

P10-1 introduces a separate qualification artifact rather than replacing current artifacts.

The qualification artifact identity is fixed for P10-1:

~~~text
global: STScoreEditorProfessionalWorkstation
bundle: st-score-editor-professional-workstation.js
entry HTML: st-score-editor-professional-workstation.html
manifest: st-score-editor-professional-workstation.manifest.json
~~~

Implementation planning must preserve these names unless a concrete repository collision is discovered and documented before code changes.

Existing artifacts remain intact:

- default STScoreEditorApp;
- P08 professional artifact;
- P09 keyboard qualification artifact.

P10-1 does not change the default application entry point.

## 14. Manifest contract

The P10-1 artifact should publish an independent manifest proving composition boundaries.

Minimum fields:

~~~text
contract
version
artifactClass
canonicalAuthority = false
historyAuthority = EditorHistoryV4
semanticTargetAuthority = SemanticAddressV3-current-revision

p08ProfessionalBundled = true
p09KeyboardBundled = true
app10AuthoringAvailable = true
app11AuthoringAvailable = true
rendererIntegrated = true

audioHostIntegrated = true
audioEngineBundled = false
externalAudioRuntimeRequired = true

rendererCoordinateAuthority = false
domAuthoringAuthority = false
keyboardCursorAuthority = false
professionalSelectionCanonicalAuthority = false

productionDefault = false
replacesDefaultApp = false
productionReleaseAuthorized = false
seslitabCutoverAuthorized = false
physicalDeviceValidationRequired = true
~~~

A separate P10-1 bundle budget revision must be defined.

Existing default, P08 and P09 bundle ceilings must not be silently increased.

## 15. Lifecycle behavior

The combined controller must be safe under:

~~~text
mount
unmount
remount
dispose
~~~

Requirements:

- at most one keyboard listener set is active;
- professional subscriptions do not duplicate;
- renderer/pointer listeners do not duplicate;
- audio runtime reference does not survive a dispose unless the existing audio-host contract explicitly permits it;
- range/structure UI is decorated exactly once per active surface;
- remount creates no duplicate authoring actions.

Background/foreground browser lifecycle remains noncanonical.

## 16. Error handling

Capability-local failures must remain capability-local where safe.

Examples:

- keyboard dispatch rejection -> keyboard/action error, no partial mutation;
- P08 professional admission failure -> professional error, no canonical change;
- audio failure -> audio status/error only;
- stale renderer target -> selection/hit rejection, no mutation;
- adoption failure -> professional selection clears according to existing P08 contract;
- unsupported structure/topology edit -> fail closed.

P10-1 should expose combined status without flattening every error into one generic failure.

A reasonable implementation may maintain capability-specific status channels plus a current surface status presentation.

## 17. Backward compatibility

P10-1 must preserve these existing surfaces:

### 17.1 Default app

~~~text
STScoreEditorApp
~~~

No default cutover in P10-1.

### 17.2 P08 professional app

~~~text
STScoreEditorProfessionalApp
~~~

Must continue to build and pass retained qualification.

### 17.3 P09 keyboard workstation

~~~text
STScoreEditorKeyboardWorkstation
~~~

Must continue to build and pass retained qualification.

Existing manifests, globals and expected behavior remain unchanged unless a separately reviewed compatibility change is required.

## 18. Testing strategy

P10-1 needs both component and integrated evidence.

### 18.1 Existing regression suites retained

Retain:

- Node 18/20/22 repository validation/build/test;
- APP-10 authoring regressions;
- APP-11 relation/rhythm regressions;
- P08 professional bridge/UI tests;
- P09 keyboard tests;
- APP-09B renderer WebKit;
- P08-E4 professional WebKit;
- existing audio-host tests;
- existing file/recovery/export/print tests.

### 18.2 New composition contract tests

New tests must prove:

1. combined controller exposes one current document lineage;
2. P09 keyboard edit changes the same document observed by P08 professional tools;
3. P08 professional edit changes the same document observed by P09/default controls;
4. one mixed sequence creates a single ordered EditorHistoryV4 chain;
5. professional range capture alone creates no history;
6. keyboard mount/unmount does not duplicate dispatch;
7. audio attach/audition creates no history;
8. audio failure does not block later canonical edit;
9. stale professional selection is cleared after unrelated canonical revision change;
10. renderer-selected note can immediately become a keyboard/professional target where each existing contract allows it.

### 18.3 Required mixed-history integration test

At minimum:

~~~text
create/open score
select rendered/semantic event
record revision R0

P09 keyboard edit
expect R1 != R0
expect one history step

capture P08 professional range
expect no new history step

perform admitted P08 range edit
expect R2 != R1
expect second history step

Undo
expect exact R1 canonical content
expect P08 edit absent
expect P09 edit present

Undo
expect exact R0 canonical content
expect both edits absent

Redo
expect exact P09 edit state

Redo
expect exact P08 edit state
~~~

The test should compare canonical score+notation content, not merely revision labels.

### 18.4 WebKit combined artifact qualification

A dedicated browser/WebKit test should exercise:

- artifact bootstrap;
- no duplicate controls;
- renderer note selection;
- one P09 keyboard action;
- one P08 professional action;
- Undo/Redo;
- audio host detached state;
- optional stubbed/qualified audio-host attachment if existing test seams permit;
- focus-safe keyboard exclusion on editable controls;
- orientation/layout regression if supported by current WebKit harness.

## 19. Physical-device gate

P10-1 combined artifact requires its own physical iPhone/Safari human gate before any production-exposure discussion.

Minimum human checks:

1. bootstrap without white screen;
2. rendered notation visible;
3. rendered note selection works;
4. touch authoring still works;
5. keyboard layer does not interfere with touch/mobile controls;
6. professional range/structure UI remains usable at device scale;
7. edit -> Undo -> Redo works;
8. orientation portrait -> landscape -> portrait preserves usability;
9. Safari background/foreground return preserves interaction;
10. no duplicate controls/listeners after lifecycle transitions.

Passing prior P08/P09 physical gates does not automatically pass the new combined artifact gate.

## 20. Bundle and capability budget

P10-1 must define a new bounded combined-artifact size ceiling based on measured composition cost.

Rules:

- do not raise default app max bytes;
- do not raise P08 max bytes;
- do not raise P09 max bytes;
- add a P10-1-specific budget revision;
- no external imports in the browser bundle unless separately admitted;
- retain forbidden network/storage capability-token checks where applicable;
- no new network authority.

If composition duplicates large lower layers due to constructor design, treat that as an architectural smell and refactor attachment seams rather than merely increasing the budget.

## 21. Security / capability boundaries

P10-1 does not authorize:

- network calls;
- cloud persistence;
- cookies;
- localStorage/sessionStorage authority beyond existing admitted recovery mechanisms;
- public-write APIs;
- renderer-to-canonical direct mutation;
- arbitrary host scripting authority;
- production publication;
- SesliTab cutover.

Qualification artifacts should retain existing forbidden-capability scanning conventions.

## 22. Non-goals

P10-1 does not implement:

- APP-11J canonical unretiming mutation;
- arbitrary tuplet ratios;
- beam authoring;
- advanced grace-note authoring;
- multi-measure copy/paste;
- staff/part/instrument management;
- Guitar/TAB workstation expansion;
- dynamics/text/lyrics expansion;
- engraving/page-layout controls;
- MIDI step entry;
- .mxl;
- cloud persistence/collaboration;
- production release;
- SesliTab integration/cutover.

These remain later P10 stages.

## 23. Expected implementation shape

Likely implementation work will involve:

- extracting attachable seams from keyboard and professional UI layers where necessary;
- adding a P10-1 composition package/runtime;
- adding a combined global entry;
- adding a combined bundle builder + manifest;
- adding component composition tests;
- adding mixed-history integration tests;
- adding combined WebKit qualification.

The implementation plan must identify exact files and preserve existing public constructors.

## 24. Acceptance criteria

P10-1 design/implementation is complete only when all of the following are true.

### Architecture

- exactly one active browser document/session lineage serves P08, P09, APP-10/11, renderer and audio-host surfaces;
- no new canonical score/history/cursor/renderer authority exists;
- P08 professional selection remains revision-bound/noncanonical;
- P09 keyboard remains intent translation only;
- audio remains noncanonical and external-engine-based.

### Behavior

- mixed P09 + P08 accepted edits use one ordered EditorHistoryV4 chain;
- exact Undo/Redo restores canonical score+notation in correct order;
- renderer-selected semantic targets are reusable across admitted input surfaces;
- touch authoring remains independent;
- audio failure is capability-local;
- lifecycle remount does not duplicate listeners/actions.

### Compatibility

- default app retained;
- P08 artifact retained;
- P09 artifact retained;
- existing regression suites remain green;
- no old bundle budget is silently increased.

### Qualification

- new combined artifact has an independent manifest and budget;
- Node 18/20/22 exact-head CI is green;
- retained APP-09B/P08/P09 browser tests are green;
- new combined WebKit test is green;
- separate physical iPhone/Safari combined-artifact gate is recorded before any production-exposure decision.

### Release boundary

- productionDefault remains false;
- productionReleaseAuthorized remains false;
- SesliTab cutover remains unauthorized;
- full APP-09 multi-platform release matrix remains independent.

## 25. Design decision

Proceed with P10-1 using the decorator-composition-root approach.

Implementation must preserve existing qualified surfaces and create a new combined qualification artifact instead of replacing the default app.

The next allowed step after written-spec review is a separate Superpowers implementation plan.

No production code should be written until:

1. this written spec is reviewed and approved;
2. a P10-1 implementation plan is written;
3. that plan is reviewed;
4. execution method is selected.
