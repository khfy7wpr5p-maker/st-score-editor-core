# P10 Advanced Score Workstation — Architecture Design

Date: 2026-09-19  
Repository: khfy7wpr5p-maker/st-score-editor-core  
Design baseline: main after PR #191 merge, merge commit 9dfa253a55982a66b01b5eaa2f8df614b1e58e9b  
Status: **DESIGN APPROVED IN CHAT / WRITTEN SPEC FOR REVIEW**

## 1. Purpose

P10 turns the current collection of qualified semantic editor subsystems into a coherent advanced notation workstation without weakening the existing canonical-authority model.

The current editor core already contains strong, separately qualified capabilities:

- APP-00–10O standalone document, browser, authoring and product substrate;
- APP-11A–I rhythm/relation authoring including bounded 3:2 Triplet retiming;
- P08 professional semantic range and structure workstation capabilities;
- P09 bounded fast-entry / keyboard workstation capabilities;
- APP-09B renderer integration with physical iPhone/Safari evidence;
- unified EditorSessionV4 / EditorHistoryV4 history;
- MusicXML projection/import boundaries;
- optional playback/audio integration.

The next architectural goal is not another parallel editor. The goal is one professional workstation composition that reuses these authorities.

## 2. Current architectural position

~~~text
Browser / product controls
        |
        v
SemanticAddressV3 exact revision-bound target/range
        |
        v
admission / safety analysis
        |
        v
bounded canonical authoring primitives
        |
        v
ScoreDocumentV3 + NotationDocumentV4
        |
        v
EditorSessionV4 / EditorHistoryV4
        |
        +--> MusicXML exchange/projection
        +--> RendererRequestV4 presentation
        +--> playback/audio
        +--> export/print
~~~

The canonical pair remains ScoreDocumentV3/3.0.0 + NotationDocumentV4/4.0.0.

EditorSessionV4 remains the sole unified history authority.

SemanticAddressV3 remains exact current-revision semantic identity.

Renderer geometry, DOM/SVG identity, viewport state, keyboard state, professional selection state, file/recovery state, playback state and export/print state remain noncanonical.

## 3. Current workstation layers

### P08 — Professional Workstation

Existing admitted professional capabilities include:

- EVENT_SPAN and EVENT_SET semantic selections;
- cross-measure bounded professional ranges;
- octave transpose;
- Clear/Delete -> REST behavior;
- key signature;
- clef;
- propagation-safe time signature;
- frame barline and repeat authoring;
- browser professional bridge and qualified professional artifact.

P08 selection remains noncanonical and revision-bound.

### P09 — Fast Entry / Keyboard Workstation

PR #191 merged P09-A through P09-D.

Admitted capabilities include:

- versioned keyboard command intents;
- focus-safe browser keyboard adapter;
- delegation to existing note-entry and keypad authorities;
- semantic previous/next measure navigation;
- Undo/Redo delegation to existing history authority;
- no hidden canonical cursor;
- no second note-entry or rhythm engine.

The final qualified P09-D head was 636c17dc27b657d273cf2e4f630a2e7c11ffa8f6.

Physical iPhone/Safari qualification confirmed:

- browser launch without white-screen failure;
- renderer startup;
- rendered notehead hit-test -> semantic selection;
- authoring edit;
- exact one-step Undo;
- Redo;
- orientation stability;
- Safari background/foreground stability;
- continued touch selection after lifecycle transitions.

## 4. Architectural problem P10 solves

The repository now has several individually strong layers that are still exposed as separate development/qualification surfaces.

The principal problem is composition:

~~~text
P08 professional selection/workstation
P09 fast-entry/keyboard
APP-10 authoring
APP-11 strong rhythm/relation authoring
APP-09B renderer
P06 audio
file/recovery/export/print
~~~

These must become one coherent professional application surface while preserving exactly one canonical score/history model.

P10 must not create:

- a second canonical score;
- a second history engine;
- a browser-owned timing model;
- a renderer-owned mutation model;
- a keyboard-owned canonical cursor;
- a SesliTab-owned shadow score;
- a host last-write-wins state model.

## 5. P10 program map

### P10-0 — Architecture Reality Refresh

First step. Documentation-only.

Goals:

- update ARCHITECTURE.md, ROADMAP.md, productization and release-gate documentation to match current main;
- record PR #191 / P09 merge;
- record physical iPhone/Safari P08/P09 qualification evidence;
- distinguish the passed iPhone device gate from the still-open full release matrix;
- remove stale language that says P09 is pending or iPhone evidence is only partial where that statement is no longer accurate;
- establish this P10 design as the new architectural source for advanced workstation development.

No production code change is required in P10-0.

### P10-1 — Professional Workstation Composition

Create one professional composition layer over existing authorities.

Composition must include, without duplicating authority:

- P08 professional semantic selection/range;
- P09 keyboard intents/adapter;
- APP-10 authoring controls;
- APP-11 rhythm/relation authoring;
- APP-09B renderer interaction;
- optional P06 audio;
- file/recovery/export/print lifecycle.

The composition layer may coordinate UI/workflow state but may not own canonical music.

### P10-2 — Advanced Rhythm and Relations

Continue from the actual current APP-11 boundary.

APP-11J read-only Triplet Removal / Unretiming Admission already exists on current main. Commit `674187b920434d6d7d72330baba44c2692a64596` is an ancestor of the P10 baseline main commit, the `editor-tuplet-unretiming-admission-v4` package and tests are present, and the admission remains mutation/history/renderer-authority false. PR #142 remains open as stale stacked metadata and must not be treated as evidence that the code is absent from main.

P10-2 therefore starts after the admission foundation:

1. document/close out the APP-11J mainline reality without duplicating the existing analyzer;
2. design and admit bounded canonical Triplet removal/unretiming mutation consuming APP-11J evidence;
3. productize that mutation through EditorSessionV4/browser with one accepted action = one history revision and exact Undo;
4. broaden tuplet ratios/cardinalities only after separate explicit admission contracts;
5. beam authoring;
6. stronger grace-note workflows;
7. relation-safe retiming programs.

Every timing-changing program must preserve exact rational timing and use read-only admission before mutation.

### P10-3 — Professional Range Editing

Expand P08 semantic range infrastructure into deeper professional operations.

Candidate capabilities:

- multi-measure copy/paste;
- diatonic/semitone bulk transpose;
- range delete/replace profiles;
- duplication;
- controlled rhythmic transforms;
- multi-target articulation/dynamic/text authoring.

Renderer layout may help presentation, but target membership/order must remain semantic.

### P10-4 — Score Structure and Instrument Management

Develop professional score-level structure capabilities:

- add/remove/reorder staff;
- add/remove/reorder part;
- instrument assignment;
- staff groups;
- braces/brackets;
- transposing instruments;
- percussion maps;
- stronger measure topology;
- polymeter/non-controlling measures only through separate explicit contracts.

Topology mutation must remain deterministic and history-backed.

### P10-5 — Guitar and TAB Workstation

Integrate guitar workflows into the professional editor without making TAB a second canonical model.

Target capabilities:

- linked notation + TAB presentation;
- string/fret editing;
- fingering;
- classical-guitar multi-voice workflows;
- derivative voicing suggestions;
- stale derivative Guitar/TAB state invalidated on canonical revision change.

External Guitar engines may propose results, but accepted changes must re-enter through semantic Editor Core authoring.

### P10-6 — Notation Content

Expand authored notation content:

- dynamics;
- text;
- lyrics;
- stronger articulation/ornament coverage;
- rehearsal/annotation-style text where semantically appropriate;
- expanded relation semantics.

Notation content must live in the canonical score/notation pair or a deliberately versioned canonical extension, not renderer state.

### P10-7 — Engraving and Layout

Separate semantic music from engraving authority while enabling professional visual control.

Target areas:

- system/page layout;
- spacing controls;
- collision handling;
- print-quality layout;
- persistent layout metadata where explicitly admitted.

Layout metadata must not silently redefine note identity or timing.

### P10-8 — High-Speed Input

Build on P09 without creating a hidden cursor authority.

Target areas:

- productionized desktop keyboard entry;
- semantic event navigation;
- Shift-range extension using P08 endpoints;
- MIDI step entry;
- configurable shortcut layer;
- conflict-safe focus and host integration.

### P10-9 — Interchange and Persistence

Strengthen interchange and long-lived project state:

- .mxl container support;
- stronger MusicXML round-trip;
- V4-native cross-staff round trip;
- project persistence;
- revision versioning;
- explicit conflict semantics if server/cloud persistence is later introduced.

Silent last-write-wins is not admitted.

### P10-10 — Product Qualification

Close the full standalone release matrix after the workstation composition is stable.

Required physical targets remain:

- iPhone Safari — current P08/P09 physical qualification evidence exists;
- Android Chrome — pending;
- Windows Edge — pending;
- Windows Chrome — pending;
- Windows Firefox — pending;
- iPad Safari — secondary.

Passing one device gate does not automatically set the whole standalone release gate to PASS.

## 6. Professional Workstation Composition architecture

~~~text
                         PROFESSIONAL WORKSTATION UI
                                      |
          +---------------------------+----------------------------+
          |                           |                            |
     pointer/touch               keyboard/P09                host intents
          |                           |                            |
          +---------------------------+----------------------------+
                                      |
                                      v
                        Semantic interaction coordinator
                          canonicalAuthority = false
                                      |
          +---------------------------+----------------------------+
          |                           |                            |
   P08 semantic range          APP-10 authoring             APP-11 relations
          |                           |                            |
          +---------------------------+----------------------------+
                                      |
                                      v
                         exact admission / safety
                                      |
                                      v
                    bounded canonical authoring primitives
                                      |
                                      v
                    ScoreDocumentV3 + NotationDocumentV4
                                      |
                                      v
                           EditorSessionV4
                                      |
                                      v
                           EditorHistoryV4
                                      |
            +-------------------------+-------------------------+
            |                         |                         |
      RendererRequestV4          MusicXML                  playback/audio
            |
       Rendering Layer
~~~

The interaction coordinator may own:

- active palette state;
- keyboard mode;
- professional range capture;
- modal/tool state;
- renderer selection presentation;
- temporary command context.

It may not own:

- canonical notes;
- canonical rhythm;
- canonical topology;
- history snapshots;
- renderer-derived target identity.

## 7. Invariants

P10 inherits and strengthens these invariants.

1. ScoreDocumentV3 + NotationDocumentV4 remains the canonical musical pair.
2. EditorSessionV4 / EditorHistoryV4 remains the sole history authority.
3. One accepted semantic user edit produces one unified history revision unless a separately versioned transaction contract explicitly states otherwise.
4. SemanticAddressV3 remains revision-bound identity.
5. Renderer coordinates and DOM/SVG IDs never become mutation authority.
6. Keyboard and MIDI adapters translate intent only.
7. Professional range capture is noncanonical.
8. Playback failure never invalidates an otherwise admitted edit.
9. OMR/Guitar/AI systems provide evidence/proposals, never direct shadow-score mutation.
10. Unsupported topology/timing transformations fail closed until explicitly admitted.
11. Production exposure, public-write activation and SesliTab cutover remain separate human decisions.
12. Device/browser qualification evidence is recorded per exact commit and target.

## 8. Explicit non-goals for initial P10 work

P10-0 and P10-1 do not immediately authorize:

- arbitrary tuplet support;
- automatic Voice invention in imported MusicXML;
- unrestricted measure growth;
- cloud collaboration;
- server-side conflict resolution;
- SesliTab V3 cutover;
- production publication;
- replacement of ScoreDocumentV3/NotationDocumentV4;
- renderer-authoritative editing;
- AI-autonomous mutation without semantic admission.

## 9. Release and integration boundary

Current state after PR #191:

- P09 is merged to main;
- physical iPhone/Safari P08/P09 device evidence is PASS;
- the full standalone multi-platform release matrix remains open;
- SesliTab product cutover remains unauthorized;
- production/public-write decisions remain separate;
- qualification-only preview surfaces are not production deployments.

P10 work must keep these distinctions explicit.

## 10. Documentation reality gaps discovered before P10

At the P10 design baseline, several repository documents lag current reality:

- README.md still presents APP-11J as the next bounded action and does not reflect the post-P09 physical iPhone/Safari evidence;
- ARCHITECTURE.md does not yet describe P09;
- ROADMAP.md still points to APP-11J as future work even though the read-only APP-11J admission package/test is already present on main, and it also does not reflect the newly merged P09 workstation layer;
- docs/st-score-editor-app-productization.md does not reflect P09 composition and still phrases APP-11J as future admission work;
- docs/app-09-standalone-release-gate.md still lists real iPhone Safari as PARTIAL;
- docs/p08e-browser-professional-integration.md still says physical iPhone/Safari qualification remains pending;
- docs/p09-fast-entry-keyboard-inventory.md remains an admission-stage document and therefore still describes P09-C/D as conditional even though P09-D is now merged/qualified;
- docs/st-score-editor-app-productization.json correctly exposes APP-11J evidence but retains stale `VERIFIED_PR_OPEN` / PR #142 wording even though the APP-11J foundation commit is already an ancestor of current main; P10-0 must distinguish code reality from stale PR metadata.

These are source-of-truth drift, not runtime defects.

## 11. P10-0 acceptance criteria

P10-0 is complete only when:

- README.md and the above documentation files consistently describe the current main state;
- APP-11J is described as an existing read-only admission capability on main, not re-planned as missing foundation work;
- PR #191 and merge commit 9dfa253a55982a66b01b5eaa2f8df614b1e58e9b are represented;
- P09-A/B/C/D is marked merged/qualified;
- the physical iPhone/Safari P08/P09 gate is recorded as PASS;
- the full release matrix remains open for Android/Windows targets;
- no text accidentally authorizes production, public write, release or SesliTab cutover;
- documentation validation/tests pass if repository contracts cover these files.

## 12. Design decision

Proceed with P10 as an additive professional-workstation program.

The next implementation activity after this written design is reviewed is **P10-0 Architecture Reality Refresh**.

No feature implementation should begin until:

1. this written design is reviewed;
2. a Superpowers implementation plan is written from this spec;
3. the implementation plan is reviewed;
4. an execution method is chosen.
