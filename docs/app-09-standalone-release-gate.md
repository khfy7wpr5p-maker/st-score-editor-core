# APP-09 Standalone Release Gate

Status: **DEFERRED FOR CURRENT DEVELOPMENT / MANUAL DEVICE-BROWSER MATRIX REQUIRED BEFORE RELEASE**

Runtime hardening source: PR #89 / `2731490575550e38e65e9f4af576b25255b0d9d9`

Permanent iPhone renderer interaction policy: PR #102 / `c6615a314b41bcdded1e968df353070179453d16`

Automated repository validation: **PASS** on Node 18 / 20 / 22, with WebKit authoring/renderer regressions retained through APP-10M, including APP-10E note entry, APP-10F selected-note editing, APP-10G Staff switching, APP-10H measure growth, APP-10I measure navigation, APP-10J chord tones, APP-10K articulations, APP-10L local ornaments, APP-10M exact explicit accidentals and the APP-09B renderer/orientation chain. APP-10M exact-head WebKit additionally exercises Guitar exact chord-tone accidental isolation, multi-measure accidental isolation and Piano Staff 2 / Voice 5 accidental isolation.

This checklist is intentionally separate from automated CI. A green build is not evidence that real mobile viewport, audio gesture, browser print, touch/pointer behavior or lifecycle recovery works correctly on every required platform.

The matrix is currently deferred while standalone authoring development continues. Deferral does not relax this gate and does not authorize standalone release or SesliTab cutover.

## Release invariants

Every manual run must preserve these invariants:

- `ScoreDocumentV3 + NotationDocumentV4` remains the only canonical score pair;
- presentation/UI state must not create unintended V4 history revisions;
- Staff switching and semantic measure navigation remain presentation-only and may not materialize missing Voices;
- admitted measure append remains one explicit `EditorSessionV4` canonical mutation;
- admitted `+Tone` actions target exact semantic pitched content and add exactly one tone;
- exact chord-tone Delete removes only the selected tone;
- Staccato/Accent/Tenuto and Trill/Turn/Mordent use their existing V4 notation-authoring paths with exact semantic targets; ambiguous same-kind cases fail closed;
- APP-10L exposes no spanning tremolo/wavy-line or grace-event ornament authority;
- APP-10M Flat/Natural/Sharp actions require exact `note` selection and may not infer a note target from event/rest/measure/renderer geometry;
- each accepted APP-10M action atomically updates canonical `pitch.alter` and `NoteNotation.accidental` in one `EditorSessionV4` history revision while preserving note step/octave;
- on chords, APP-10M may change only the exact selected chord tone;
- APP-10M exposes no advanced keypad `EVENT_RANGE`/`NOTE_PAIR` authority and no dot/rest/tuplet/tie/slur browser surface;
- imported MusicXML automatic measure growth remains fail-closed while admitted exact semantic note/notation authoring remains allowed where prerequisites are met;
- renderer DOM/SVG/coordinates/geometry never become edit, chord, accidental, articulation, ornament, measure or timing authority;
- MusicXML remains exchange/projection only;
- unsupported cross-staff MusicXML remains fail-closed;
- playback failure must not disable editing or OMR admission;
- export must not mark a dirty document saved;
- print/PDF must use the exact current rendered revision;
- recovery remains browser-local/noncanonical;
- no network/server/publication authority is introduced.

## Required browser/device matrix

| Target | Status | Evidence required |
| --- | --- | --- |
| Real iPhone Safari | PARTIAL — G4 PASS | remaining applicable scenario results + device/iOS/Safari version |
| Android Chrome | PENDING | real device + Android/Chrome version + scenario results |
| Windows 10/11 Edge | PENDING | Windows/Edge version + scenario results |
| Windows Chrome | PENDING | Windows/Chrome version + scenario results |
| Windows Firefox | PENDING | Windows/Firefox version + scenario results |

### Secondary validation

| Target | Status | Role |
| --- | --- | --- |
| Real iPad Safari | DEFERRED / PENDING | secondary tablet/Safari validation; useful but not a substitute for required Windows/Android evidence |

Mac desktop Safari is not a primary required target for the current product matrix. Safari mobile-engine evidence is carried by iPhone, with iPad retained as secondary validation.

## Existing physical iPhone evidence

Physical iPhone Safari testing isolated and fixed the renderer selection/orientation blocker. After the permanent APP-09B policy:

- semantic note selection works;
- portrait selection works;
- landscape selection works;
- returning to portrait preserves working selection;
- G4 portrait → landscape → portrait interaction is PASS.

This is partial evidence. The iPhone row remains incomplete until all applicable release scenarios required for the final closeout are recorded.

## Required scenarios per required target

Record PASS / FAIL / NOT APPLICABLE plus a short note for each item.

### G1 — Bootstrap and layout

- standalone HTML opens without bootstrap error;
- toolbar, score viewport, inspector/status and authoring controls are usable;
- Staff, Voice, previous/next measure, `+Tone`, articulation, local-ornament, explicit Flat/Natural/Sharp and admitted Add measure controls remain usable and do not duplicate after rerender;
- exact-target controls are disabled or fail-closed when semantic prerequisites are absent;
- explicit accidental pressed state follows `NoteNotation.accidental` for exact selected notes;
- active measure indication remains coherent after semantic navigation and rerender;
- safe-area, mobile viewport and desktop resizing behavior remain usable.

### G2 — Open and canonical editing

- open a valid `.musicxml` or `.xml` file and render successfully;
- select a note through the semantic hit bridge and perform admitted edits;
- exercise exact selected-note pitch/duration/delete and chord-tone add/delete where applicable;
- exercise Staccato/Accent/Tenuto and Trill/Turn/Mordent on exact semantic targets; ambiguity must fail closed;
- on one exact selected note, set explicit Sharp and verify canonical `alter=+1` plus notation `accidental=sharp` in one history revision;
- set explicit Natural and verify canonical `alter=0` plus notation `accidental=natural`; set Flat and verify `alter=-1` plus `accidental=flat`;
- verify explicit accidental actions preserve note step and octave;
- on a chord, select one exact tone and verify only that tone changes accidental/pitch alter;
- switch selection to event/rest/measure and verify APP-10M cannot infer or mutate an accidental target;
- verify no advanced keypad target, dot, tuplet, tie, slur or rest action is exposed through APP-10M;
- navigate across measures and confirm navigation alone creates no history; accidental state must remain isolated to the exact authored notes;
- on imported MusicXML, edit an exact note accidental and verify admitted behavior without topology invention;
- on Piano, verify Staff/Voice/chord/notation isolation including Staff 2 / Voice 5;
- undo and redo operate through unified V4 history;
- no renderer coordinate/DOM identifier is exposed as an authoring target.

### G3 — Touch / pointer / keyboard

- touch/pointer targets are practically usable at device scale;
- coarse-pointer controls satisfy APP-09 minimum target contract where applicable;
- measure, chord, articulation, ornament and explicit accidental controls avoid accidental duplicate activation;
- keyboard focus is visibly indicated on desktop;
- presentation-only keyboard/touch viewport actions do not create canonical revisions.

### G4 — Orientation and dynamic viewport

On mobile/tablet:

- change portrait -> landscape -> portrait and show/hide browser chrome where applicable;
- zoom/scroll presentation remains coherent;
- selection does not silently switch semantic note/event/tone/measure;
- notation-control pressed state, including APP-10M explicit accidental, remains aligned with the current semantic selection after rerender;
- orientation/viewport transitions themselves do not change canonical revision/history;
- renderer presentation remains aligned with current revision.

The existing physical iPhone G4 result remains partial earlier interaction evidence. APP-10I–M authoring behavior still requires final real-device matrix coverage; automated WebKit does not create a new physical-device PASS.

### G5 — Playback independence

- playback starts after user gesture and play/pause/stop/seek operate;
- any canonical score/notation revision, including APP-10M accidental authoring, stops stale playback;
- semantic navigation alone does not create a revision or corrupt edit/playback admission;
- playback errors do not prevent further editing;
- playback state/tempo/cursor creates no V4 history entries.

### G6 — Recovery lifecycle

- make an admitted dirty edit, including notation/accidental authoring where applicable;
- trigger browser lifecycle handling and inspect recovery state;
- no automatic canonical restore occurs;
- explicit guarded recovery remains required;
- storage/recovery failure does not replace current canonical state.

### G7 — MusicXML export

- export current MusicXML successfully;
- APP-10H grown Guitar/Piano scores preserve measure count and Piano alignment after re-import;
- chord tones, admitted articulations and admitted local ornaments survive admitted lossless export/re-import;
- APP-10M explicit Flat/Sharp/Natural survives export/re-import with both canonical alter and explicit notation accidental semantics preserved;
- explicit Natural is verified, not silently dropped as merely implicit pitch spelling;
- export does not mark dirty state saved or create canonical history;
- unsupported projection remains fail-closed.

### G8 — Print / Save as PDF

- with current renderer presentation, open browser print flow;
- editor-only controls are hidden in paper presentation;
- Save as PDF is available where browser/OS provides it;
- canceling print leaves canonical state unchanged;
- stale/missing/rejected renderer presentation does not proceed.

### G9 — Accessibility presentation

- toolbar and score viewport expose meaningful accessible labels/roles;
- Staff/Voice/measure/Add measure/`+Tone`/articulation/local-ornament/explicit accidental controls have usable accessible names;
- explicit accidental controls communicate disabled and pressed state correctly;
- active measure/status/focus/reduced-motion presentation remains usable;
- accessibility presentation changes do not alter canonical state.

### G10 — Performance / stability

- standalone app bundle remains within automated 512 KiB budget;
- repeated edit -> navigation -> chord -> notation toggles -> explicit accidental -> Add measure -> render -> playback -> orientation cycles do not accumulate duplicate listeners/UI;
- repeated Flat/Natural/Sharp changes affect only exact selected note and keep pressed state coherent;
- repeated Staff/Voice/measure switching creates no unintended history;
- repeated admitted measure append retains exact alignment and no implicit Voices;
- no recurring crash, frozen viewport or unexpected network dependency appears.

## Pass rule

APP-09 standalone release gate may be marked PASS only when:

1. all five required targets have recorded applicable evidence;
2. G1–G10 have no unresolved release-blocking failure on applicable targets;
3. any discovered regression has a linked fix + exact-head green CI + rerun evidence on affected targets;
4. canonical/noncanonical authority invariants remain unchanged;
5. `standaloneReleaseGatePassed` is changed to `true` only in a separate evidence-backed closeout PR.

Until then:

```text
manualDeviceValidationRequired = true
standaloneReleaseGatePassed = false
seslitabCutoverAuthorized = false
```

No SesliTab V4 cutover should begin before this gate is explicitly closed with evidence.
