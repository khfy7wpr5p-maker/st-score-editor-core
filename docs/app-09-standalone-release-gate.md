# APP-09 Standalone Release Gate

Status: **DEFERRED FOR CURRENT DEVELOPMENT / MANUAL DEVICE-BROWSER MATRIX REQUIRED BEFORE RELEASE**

Runtime hardening source: PR #89 / `2731490575550e38e65e9f4af576b25255b0d9d9`

Permanent iPhone renderer interaction policy: PR #102 / `c6615a314b41bcdded1e968df353070179453d16`

Automated repository validation: **PASS** on Node 18 / 20 / 22, with WebKit authoring/renderer regressions retained through APP-10H, including APP-10E note entry, APP-10F selected-note editing, APP-10G explicit Staff switching, APP-10H bounded synthetic measure growth and the APP-09B renderer/orientation chain. APP-10H exact-head WebKit additionally exercises selected pitch/duration/delete after measure growth and Piano Staff 2 / Voice 5 isolation on the new frame.

This checklist is intentionally separate from automated CI. A green build is not evidence that real mobile viewport, audio gesture, browser print, touch/pointer behavior or lifecycle recovery works correctly on every required platform.

The matrix is currently deferred while standalone authoring development continues. Deferral does not relax this gate and does not authorize standalone release or SesliTab cutover.

## Release invariants

Every manual run must preserve these invariants:

- `ScoreDocumentV3 + NotationDocumentV4` remains the only canonical score pair;
- no Staff/Voice/measure-navigation palette action, viewport/orientation/touch/playback/export/print/recovery action may create an unintended V4 history revision;
- Staff switching itself is presentation-only and may not materialize a missing Voice;
- measure-frame append, where admitted, is one explicit `EditorSessionV4` canonical mutation; post-append selection/navigation must not create an additional history revision;
- imported MusicXML automatic measure growth remains fail-closed;
- renderer DOM/SVG/coordinates/geometry never become edit or measure/timing authority;
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
- Staff, Voice and admitted Add measure controls remain usable and do not duplicate after rerender;
- no content is trapped under device safe areas/notch/home indicator where applicable;
- mobile viewport fills the visible browser area without persistent phantom overflow;
- desktop layout remains usable after window resizing.

### G2 — Open and canonical editing

- open a valid `.musicxml` or `.xml` file;
- score renders successfully;
- select a note through the semantic hit bridge;
- perform at least one admitted edit;
- exercise exact selected-note pitch/duration/delete where applicable;
- confirm imported MusicXML does not expose/admit automatic Add measure growth;
- create a NEW Guitar or Piano score and, where applicable, append one admitted measure; verify the new frame is exact, editing remains available, and undo/redo reverses/restores the append through unified V4 history;
- on Piano, verify both standard staves remain aligned to the same new frame and Staff/Voice isolation remains intact;
- undo and redo operate in unified V4 history;
- no renderer coordinate/DOM identifier is exposed as an edit or measure target.

### G3 — Touch / pointer / keyboard

- touch/pointer targets are practically usable at the device scale;
- coarse-pointer controls satisfy the APP-09 minimum target contract where applicable;
- keyboard focus is visibly indicated on desktop;
- keyboard viewport/navigation actions do not create canonical revisions;
- touch/pointer viewport activity does not create canonical revisions.

### G4 — Orientation and dynamic viewport

On mobile/tablet:

- change portrait -> landscape -> portrait;
- show/hide browser chrome where applicable;
- zoom/scroll presentation remains coherent after each transition;
- selection does not silently switch to another semantic event;
- current canonical revision/history is unchanged by the orientation/viewport transition itself;
- renderer presentation remains aligned with the current revision.

For the physically tested iPhone path this scenario is already **PASS**.

### G5 — Playback independence

- playback starts from an admitted score after a user gesture;
- play/pause/stop/seek operate;
- changing canonical score revision stops stale playback;
- playback unavailable/error does not prevent further score editing;
- playback state/tempo/cursor does not create V4 history entries.

### G6 — Recovery lifecycle

- make an admitted dirty edit;
- background/hide or navigate away in a manner that triggers browser lifecycle handling;
- return/reopen and inspect available recovery state;
- no automatic canonical restore occurs;
- explicit guarded recovery remains required;
- storage/recovery failure does not crash or replace current canonical state.

### G7 — MusicXML export

- export current MusicXML successfully;
- for an admitted NEW Guitar/Piano score with APP-10H growth, export/re-import preserves the appended measure count and Piano two-staff frame alignment;
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
- Staff/Voice/Add measure and authoring controls have usable accessible names;
- status updates are exposed as a polite live region;
- keyboard focus remains visible where applicable;
- reduced-motion OS/browser preference does not break layout or controls;
- accessibility presentation changes do not alter canonical state.

### G10 — Performance / stability

- standalone app bundle remains within the automated 512 KiB budget;
- repeated edit -> Add measure where admitted -> render -> playback -> orientation/resize cycles do not accumulate obvious duplicate listeners or duplicate UI controls;
- repeated Staff/Voice switching does not create unintended history or duplicate authoring controls;
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
