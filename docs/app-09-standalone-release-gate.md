# APP-09 Standalone Release Gate

Status: **DEFERRED FOR CURRENT DEVELOPMENT / MANUAL DEVICE-BROWSER MATRIX REQUIRED BEFORE RELEASE**

Runtime hardening source: PR #89 / `2731490575550e38e65e9f4af576b25255b0d9d9`

Permanent iPhone renderer interaction policy: PR #102 / `c6615a314b41bcdded1e968df353070179453d16`

Automated repository validation: **PASS** on Node 18 / 20 / 22, with WebKit authoring/renderer regressions retained through APP-10L, including APP-10E note entry, APP-10F selected-note editing, APP-10G explicit Staff switching, APP-10H bounded synthetic measure growth, APP-10I semantic previous/next measure navigation, APP-10J bounded exact chord-tone authoring, APP-10K bounded exact articulation toggles, APP-10L bounded exact local ornament toggles and the APP-09B renderer/orientation chain. APP-10L exact-head WebKit additionally exercises Guitar chord-event ornament authoring, multi-measure local ornament isolation and Piano Staff 2 / Voice 5 local ornament isolation.

This checklist is intentionally separate from automated CI. A green build is not evidence that real mobile viewport, audio gesture, browser print, touch/pointer behavior or lifecycle recovery works correctly on every required platform.

The matrix is currently deferred while standalone authoring development continues. Deferral does not relax this gate and does not authorize standalone release or SesliTab cutover.

## Release invariants

Every manual run must preserve these invariants:

- `ScoreDocumentV3 + NotationDocumentV4` remains the only canonical score pair;
- no Staff/Voice/measure-navigation/chord-tone/articulation/local-ornament presentation state, viewport/orientation/touch/playback/export/print/recovery action may create an unintended V4 history revision;
- Staff switching itself is presentation-only and may not materialize a missing Voice;
- previous/next semantic measure navigation is presentation-only, must preserve exact Staff context, and may not materialize a missing Voice or create history;
- measure-frame append, where admitted, is one explicit `EditorSessionV4` canonical mutation; post-append selection/navigation must not create an additional history revision;
- each admitted `+Tone` action targets the exact selected pitched event/note, adds exactly one fresh chord tone through the existing V4 basic-authoring path, and creates exactly one canonical history revision;
- exact chord-tone Delete removes only the selected tone through the existing APP-10F path;
- each admitted Staccato/Accent/Tenuto toggle targets the exact selected pitched event or exact note-parent event and creates exactly one canonical history revision through the existing V4 articulation path;
- new APP-10K articulation specs use auto placement/null direction; a single existing same-kind spec is removed exactly, while multiple same-kind specs fail closed;
- each admitted Trill/Turn/Mordent toggle targets the exact selected pitched event or exact note-parent event and creates exactly one canonical history revision through the existing V4 local-ornament path;
- new APP-10L local ornament specs use auto placement with an empty accidental-mark list; a single existing same-kind ornament is removed exactly, preserving imported placement/accidental-mark semantics, while multiple same-kind ornaments fail closed;
- APP-10L must not expose spanning tremolo/wavy-line relation authority or grace-event ornament targeting;
- rest/non-event chord-tone, articulation or local-ornament targets fail closed rather than guessing from presentation geometry;
- imported MusicXML automatic measure growth remains fail-closed while imported semantic measure navigation, exact chord-tone authoring, bounded articulation authoring and bounded local-ornament authoring are allowed only where their semantic prerequisites are satisfied;
- renderer DOM/SVG/coordinates/geometry never become edit, chord, articulation, ornament, measure or timing authority;
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
- toolbar, score viewport, inspector/status and keypad/authoring controls are usable;
- Staff, Voice, previous/next measure, `+Tone`, Staccato/Accent/Tenuto, Trill/Turn/Mordent and admitted Add measure controls remain usable and do not duplicate after rerender;
- `+Tone`, articulation and local-ornament controls are disabled or fail-closed when no exact pitched event/note target exists;
- articulation/local-ornament pressed state follows current canonical notation semantics after selection/history changes;
- active measure indication remains coherent after semantic navigation and rerender;
- no content is trapped under device safe areas/notch/home indicator where applicable;
- mobile viewport fills the visible browser area without persistent phantom overflow;
- desktop layout remains usable after window resizing.

### G2 — Open and canonical editing

- open a valid `.musicxml` or `.xml` file;
- score renders successfully;
- select a note through the semantic hit bridge;
- perform at least one admitted edit;
- exercise exact selected-note pitch/duration/delete where applicable;
- on an exact selected pitched event/note, use `+Tone` and verify exactly one palette-pitch tone is added, the new tone becomes exact selection, and only one history revision is added;
- delete the exact newly selected chord tone and verify only that tone is removed;
- toggle Staccato, Accent or Tenuto on an exact selected pitched event/note-parent event and verify exactly one history revision per accepted toggle;
- if an imported articulation already has one same-kind placed spec, toggle it off and verify the exact imported spec is removed; multiple same-kind specs must fail closed;
- toggle Trill, Turn or Mordent on an exact selected pitched event/note-parent event and verify exactly one history revision per accepted toggle;
- verify a newly added local ornament uses auto placement and an empty accidental-mark list;
- if an imported local ornament has one same-kind placed spec with accidental marks, toggle it off and verify that exact imported spec is removed without rewriting placement/accidental-mark semantics;
- if multiple same-kind local ornaments are present, verify the browser toggle fails closed instead of guessing;
- verify spanning tremolo/wavy-line relation or grace-event ornament authority is not exposed by the APP-10L controls;
- verify rest/non-event selections cannot become guessed chord, articulation or local-ornament targets;
- on a multi-measure score, navigate previous/next by semantic measure context and verify navigation alone adds no history revision;
- author chord tones, articulations and local ornaments after semantic measure navigation and verify they land only in the exact current measure/Staff/Voice event;
- where the active Voice is missing in an adjacent measure, verify navigation selects the exact target measure without implicitly materializing that Voice;
- confirm imported MusicXML supports exact semantic previous/next measure navigation and admitted exact notation authoring after valid semantic selection, but does not expose/admit automatic Add measure growth;
- create a NEW Guitar or Piano score and, where applicable, append one admitted measure; verify the new frame is exact, editing remains available, and undo/redo reverses/restores the append through unified V4 history;
- on Piano, verify both standard staves remain aligned to the same new frame and Staff/Voice/chord/articulation/local-ornament isolation remains intact, including Staff 2 / Voice 5 where admitted;
- undo and redo operate in unified V4 history;
- no renderer coordinate/DOM identifier is exposed as an edit, chord, articulation, ornament or measure target.

### G3 — Touch / pointer / keyboard

- touch/pointer targets are practically usable at the device scale;
- coarse-pointer controls satisfy the APP-09 minimum target contract where applicable;
- previous/next measure, `+Tone`, articulation and local-ornament toggles are practically usable without accidental duplicate activation;
- keyboard focus is visibly indicated on desktop;
- keyboard viewport/navigation actions do not create canonical revisions;
- touch/pointer viewport activity does not create canonical revisions.

### G4 — Orientation and dynamic viewport

On mobile/tablet:

- change portrait -> landscape -> portrait;
- show/hide browser chrome where applicable;
- zoom/scroll presentation remains coherent after each transition;
- selection does not silently switch to another semantic event, chord tone, notation target or measure;
- articulation/local-ornament pressed state remains aligned with the exact selected event after rerender/orientation;
- active semantic measure context remains coherent after the transition;
- current canonical revision/history is unchanged by the orientation/viewport transition itself;
- renderer presentation remains aligned with the current revision.

For the physically tested iPhone path this scenario is already **PASS** for the earlier interaction evidence. APP-10I/J/K/L authoring behavior still requires normal final release-matrix coverage; no new physical-device PASS is claimed by automated WebKit.

### G5 — Playback independence

- playback starts from an admitted score after a user gesture;
- play/pause/stop/seek operate;
- changing canonical score/notation revision, including chord-tone, articulation or local-ornament authoring, stops stale playback;
- semantic measure navigation alone does not create a revision or corrupt playback/edit admission state;
- playback unavailable/error does not prevent further score editing;
- playback state/tempo/cursor does not create V4 history entries.

### G6 — Recovery lifecycle

- make an admitted dirty edit, including notation authoring where applicable;
- background/hide or navigate away in a manner that triggers browser lifecycle handling;
- return/reopen and inspect available recovery state;
- no automatic canonical restore occurs;
- explicit guarded recovery remains required;
- storage/recovery failure does not crash or replace current canonical state.

### G7 — MusicXML export

- export current MusicXML successfully;
- for an admitted NEW Guitar/Piano score with APP-10H growth, export/re-import preserves the appended measure count and Piano two-staff frame alignment;
- after re-import, exact semantic measure navigation remains available from frame-bearing selection without changing imported score topology;
- add an admitted chord tone and verify export/re-import preserves it;
- add an admitted Staccato/Accent/Tenuto articulation and verify export/re-import preserves the semantic articulation;
- add an admitted Trill/Turn/Mordent local ornament and verify export/re-import preserves the semantic ornament without inventing placement or accidental marks;
- for imported placed/accidental-mark local ornaments, exact removal must not rewrite unrelated notation semantics;
- exported document is generated through the admitted lossless path;
- export does not mark a dirty document saved;
- export does not add a canonical revision/history entry;
- unsupported projection remains fail-closed rather than flattened silently.

### G8 — Print / Save as PDF

- with a current renderer presentation, open browser print flow;
- paper presentation hides editor-only controls;
- Save as PDF is available where the browser/OS provides it;
- canceling print leaves canonical state unchanged;
- stale/missing/rejected renderer presentation does not proceed to print handoff.

### G9 — Accessibility presentation

- toolbar and score viewport expose meaningful accessible labels/roles;
- Staff/Voice/previous-next measure/Add measure/`+Tone`/articulation/local-ornament controls have usable accessible names;
- controls communicate disabled state when exact pitched selection is absent;
- articulation/local-ornament toggles expose pressed state consistently with current semantic notation;
- active measure indication is understandable to assistive technology;
- status updates are exposed as a polite live region;
- keyboard focus remains visible where applicable;
- reduced-motion OS/browser preference does not break layout or controls;
- accessibility presentation changes do not alter canonical state.

### G10 — Performance / stability

- standalone app bundle remains within the automated 512 KiB budget;
- repeated edit -> semantic measure navigation -> chord add/delete -> articulation toggle -> local-ornament toggle -> Add measure where admitted -> render -> playback -> orientation/resize cycles do not accumulate obvious duplicate listeners or duplicate UI controls;
- repeated Staff/Voice/measure switching does not create unintended history or duplicate authoring controls;
- repeated `+Tone` then exact chord-tone Delete cycles change only intended chord membership;
- repeated Staccato/Accent/Tenuto cycles change only intended articulation semantics;
- repeated Trill/Turn/Mordent cycles change only intended local ornament semantics and keep pressed state coherent;
- repeated admitted measure append keeps exact frame/staff alignment and does not create duplicate controls or implicit Voices;
- no recurring crash, frozen viewport or lost score interaction appears during the run;
- no unexpected network dependency is required for local editing/playback/export/print orchestration.

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
