# APP-09 Standalone Release Gate

Status: **MANUAL DEVICE / BROWSER MATRIX PENDING**

Runtime hardening source: PR #89 / `2731490575550e38e65e9f4af576b25255b0d9d9`

Automated repository validation: **PASS** on Node 18 / 20 / 22.

This checklist is intentionally separate from automated CI. A green Node build is not evidence that Safari/mobile viewport, audio gesture, browser print, touch hit behavior or lifecycle recovery work correctly on real devices.

## Release invariants

Every manual run must preserve these invariants:

- `ScoreDocumentV3 + NotationDocumentV4` remains the only canonical score pair;
- no viewport/orientation/touch/playback/export/print/recovery action may create an unintended V4 history revision;
- renderer DOM/SVG/coordinates/geometry never become edit authority;
- MusicXML remains exchange/projection only;
- unsupported cross-staff MusicXML remains fail-closed;
- playback failure must not disable editing or OMR admission;
- export must not mark a dirty document saved;
- print/PDF must use the exact current rendered revision;
- recovery remains browser-local/noncanonical;
- no network/server/publication authority is introduced.

## Required browser matrix

| Target | Status | Evidence required |
| --- | --- | --- |
| Real iPhone Safari | PENDING | device/iOS/Safari version + scenario results |
| Real iPad Safari | PENDING | device/iPadOS/Safari version + scenario results |
| Desktop Safari | PENDING | macOS/Safari version + scenario results |
| Desktop Chromium | PENDING | browser/OS version + scenario results |
| Desktop Firefox | PENDING | browser/OS version + scenario results |

## Required scenarios per target

Record PASS / FAIL / NOT APPLICABLE plus a short note for each item.

### G1 — Bootstrap and layout

- standalone HTML opens without bootstrap error;
- toolbar, score viewport, inspector/status and keypad are usable;
- no content is trapped under device safe areas/notch/home indicator;
- mobile viewport fills the visible browser area without persistent phantom overflow;
- desktop layout remains usable after window resizing.

### G2 — Open and canonical editing

- open a valid `.musicxml` or `.xml` file;
- score renders successfully;
- select a note through the semantic hit bridge;
- perform at least one admitted edit;
- undo and redo operate in unified V4 history;
- no renderer coordinate/DOM identifier is exposed as an edit target.

### G3 — Touch / pointer / keyboard

- touch/pointer targets are practically usable at the device scale;
- toolbar/keypad coarse-pointer targets are at least the APP-09 44 CSS px contract;
- keyboard focus is visibly indicated on desktop;
- keyboard viewport/navigation shortcuts do not create canonical revisions;
- touch/pointer viewport activity does not create canonical revisions.

### G4 — Orientation and dynamic viewport

On mobile/tablet:

- change portrait -> landscape -> portrait;
- show/hide browser chrome where applicable;
- zoom/scroll presentation remains coherent after each transition;
- selection does not silently switch to another semantic event;
- current canonical revision/history is unchanged by the orientation/viewport transition itself;
- renderer presentation remains aligned with the current revision.

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
- status updates are exposed as a polite live region;
- keyboard focus remains visible;
- reduced-motion OS/browser preference does not break layout or controls;
- accessibility presentation changes do not alter canonical state.

### G10 — Performance / stability

- standalone app bundle remains within the automated 512 KiB budget;
- repeated edit -> render -> playback -> orientation/resize cycles do not accumulate obvious duplicate listeners or duplicate UI controls;
- no recurring crash, frozen viewport or lost score interaction appears during the run;
- no unexpected network dependency is required for local editing/playback/export/print orchestration.

## Pass rule

APP-09 standalone release gate may be marked PASS only when:

1. all five required browser targets have recorded evidence;
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
