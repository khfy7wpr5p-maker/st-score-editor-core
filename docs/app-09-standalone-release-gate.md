# APP-09 Standalone Release Gate

Status: **DEFERRED FOR CURRENT DEVELOPMENT / MANUAL DEVICE-BROWSER MATRIX REQUIRED BEFORE RELEASE**

APP-09/09B automated hardening is merged. The earlier physical iPhone renderer-selection/orientation blocker was resolved, and P05 Teacher Task 2 now has a separate physical iPhone Safari PASS for generic NOTE/REST targeting, Paste rendering and exact Undo. The full practical device/browser matrix is still incomplete.

Automated repository validation is currently **PASS** through APP-11I on Node 18 / 20 / 22 and the retained WebKit/renderer chain. This includes APP-10E–O, APP-11B safe rhythm timing, APP-11D Tie, APP-11E Slur, APP-11F metadata-only Triplet, APP-11I straight-note Triplet Retiming, exact ST Score Rendering Layer build, APP-09B renderer regression, controlled-layout rerender regression and the P05 physical-like generic NOTE/REST Paste -> visible render -> Undo regression.

Automated WebKit is regression evidence only. It is **not** evidence that real iPhone/Android/Windows browser behavior has passed the release matrix.

## Release invariants

Every manual run must preserve these invariants:

- `ScoreDocumentV3 + NotationDocumentV4` is the canonical score pair;
- `EditorSessionV4` is the sole unified history authority;
- `SemanticAddressV3` is exact current-revision identity;
- renderer generic `NOTE`/`REST` target evidence remains presentation evidence and must be resolved against the current revision before canonical action;
- renderer DOM/SVG identifiers, coordinates and geometry are never authoring authority;
- MusicXML remains exchange/projection only;
- Staff switching, measure navigation and semantic multi-target capture are presentation-only and create no history;
- one accepted canonical user edit creates one history revision unless a separately documented operation explicitly defines otherwise;
- APP-11B duration contraction creates/extends explicit rest space and admitted growth consumes only exact adjacent neutral rest;
- APP-11C semantic `NOTE_PAIR` / `EVENT_RANGE` capture never invents targets from renderer layout;
- APP-11D Tie and APP-11E Slur use explicit semantic endpoints and unified history;
- APP-11F `Triplet Apply` is metadata-only and requires already-canonical exact 3:2 timing;
- APP-11I `Triplet Retiming` is a separate path and must first pass APP-11G admission;
- admitted straight-three Triplet retiming preserves event/note identities, changes all three onsets/durations atomically, writes Triplet metadata in the same canonical result and keeps released time represented by explicit rest balancing;
- admitted APP-11I retiming creates exactly one `EditorSessionV4` history revision;
- one Undo after APP-11I retiming restores the exact prior score+notation pair;
- dots, beams, existing tuplets, ties, selected cross-staff events, stale/invalid ranges and unsupported written bases remain fail-closed for straight-three retiming;
- imported MusicXML automatic Voice/measure growth remains fail-closed; bounded local contraction may be admitted where APP-11G/H prove it without topology invention;
- playback, one-note audition, file/recovery, viewport, palette/range capture and export/print state remain noncanonical;
- future note audition must consume exact current canonical pitch and must not create history;
- REST must never be converted into an audio note by geometry or fallback guessing;
- export does not mark a document saved unless the external save handoff succeeds;
- print/PDF uses the exact current rendered revision;
- no cloud/server/publication authority is introduced.

## Required browser/device matrix

| Target | Status | Evidence required |
| --- | --- | --- |
| Real iPhone Safari | PARTIAL | P05 Task 2 PASS recorded; complete remaining applicable G1–G10 + iOS/Safari version |
| Android Chrome | PENDING | real device + Android/Chrome version + G1–G10 |
| Windows 10/11 Edge | PENDING | Windows/Edge version + G1–G10 |
| Windows Chrome | PENDING | Windows/Chrome version + G1–G10 |
| Windows Firefox | PENDING | Windows/Firefox version + G1–G10 |

### Secondary validation

| Target | Status | Role |
| --- | --- | --- |
| Real iPad Safari | DEFERRED / PENDING | secondary tablet/Safari evidence only |

Physical iPhone evidence now has two distinct categories:

1. earlier APP-09B semantic-selection/orientation evidence;
2. P05 Teacher Task 2 physical PASS using generic NOTE/REST targeting: source range `C-D`, REST destination, one Paste producing visible `C-D-C-D`, then one Undo restoring visible `C-D-half-rest` with no recurrence of the prior viewport displacement.

This remains partial release-matrix evidence. Teacher Task 1 and Task 3 are not promoted to PASS unless separately observed.

## Required scenarios per target

Record PASS / FAIL / NOT APPLICABLE plus device/browser version and a short note.

### G1 — Bootstrap and layout

- standalone HTML opens without bootstrap error;
- score viewport, toolbar, inspector/status and authoring controls are usable at device scale;
- Staff, Voice, measure navigation, note/chord controls, articulations, ornaments, explicit accidentals, Tie, Slur, Triplet capture/apply and Triplet Retiming controls do not duplicate after rerender;
- Triplet Retiming control survives/reappears correctly when the nested APP-11F Triplet group rerenders;
- controls are disabled or fail closed when exact semantic prerequisites are absent;
- safe-area and dynamic viewport behavior remain usable.

### G2 — Open and canonical editing

- open valid `.musicxml` / `.xml` and render current revision;
- perform admitted note/chord/articulation/ornament/accidental edits;
- exercise safe duration contraction/growth and verify explicit-rest balance;
- verify Tie with exact semantic note-pair endpoints;
- verify Slur with exact semantic note-pair endpoints;
- verify APP-11F metadata-only Triplet on an already-canonical 3:2 range;
- verify ordinary supported straight events are not silently accepted by APP-11F metadata-only apply;
- capture three supported straight eighths and invoke APP-11I Triplet Retiming;
- verify the same event/note identities remain, durations become `1/12` each and onsets become `0`, `1/12`, `1/6` for a group beginning at zero;
- verify released timing is represented by the admitted explicit-rest balance rather than a hidden gap;
- verify exactly one history revision is added by the retiming user action;
- Undo once and verify exact straight timing/rest/notation restoration;
- redo where applicable and verify exact canonical retiming returns;
- on imported MusicXML, verify no Voice or measure topology is invented;
- no renderer coordinate/DOM identifier is exposed as an authoring target.

### G3 — Touch / pointer / keyboard

- touch/pointer targets are practically usable;
- generic rendered `NOTE` and `REST` evidence resolves only through current-revision semantic identity;
- a topmost REST does not fall through to an overlapping lower NOTE;
- capture/apply controls do not double-fire;
- Tie/Slur/Triplet capture order remains explicit under touch;
- Triplet Retiming cannot activate until exactly admitted semantic prerequisites are present;
- desktop focus indication remains visible;
- presentation-only interaction creates no unintended canonical revision.

### G4 — Orientation and dynamic viewport

On mobile/tablet:

- portrait -> landscape -> portrait and browser-chrome changes preserve usable layout;
- exact semantic selection does not silently switch;
- partially captured Tie/Slur/Triplet semantic state does not acquire different canonical targets because of rerender;
- Triplet Retiming control remains presentation-only and its enabled/disabled state reflects current semantic admission after rerender;
- viewport/orientation transitions create no history;
- renderer presentation remains aligned with current canonical revision;
- generic NOTE/REST selection plus rerender must not recreate the earlier horizontal/offscreen Paste displacement.

### G5 — Playback and audition independence

- playback controls operate after user gesture;
- canonical edits including relation/Triplet retiming stop stale playback where required;
- playback errors do not prevent editing;
- playback state creates no V4 history entries;
- once `APP-AUDIO-01` is integrated, NOTE audition must use exact current canonical pitch through the versioned `st-score-audio-engine` contract;
- once integrated, REST produces no audition request/sound;
- audio-lock/sample/engine errors do not invalidate selection or editing;
- audition/instrument preference creates no V4 history entries;
- physical iPhone audio PASS must be recorded separately from WebKit automation.

### G6 — Recovery lifecycle

- create a dirty canonical edit, including relation/Triplet retiming where applicable;
- lifecycle recovery stores guarded browser-local state without becoming canonical authority;
- no automatic silent restore replaces current score;
- recovery failure does not corrupt current canonical pair.

### G7 — MusicXML export

- export the exact current score when projection is admitted;
- supported chord/articulation/ornament/accidental semantics survive re-import;
- admitted 3:2 Triplet timing/metadata survives the supported MusicXML path;
- exported result does not invent Voices/measures;
- export creates no history and does not automatically mark dirty state saved;
- unsupported projection remains fail closed.

### G8 — Print / Save as PDF

- browser print uses exact current renderer presentation;
- editor-only controls are hidden for paper presentation;
- canceling print changes no canonical state;
- missing/stale/rejected renderer presentation cannot proceed as a valid print source.

### G9 — Accessibility presentation

- controls have meaningful names/roles and visible focus where applicable;
- disabled/pressed/admission state is communicated correctly;
- Tie/Slur/Triplet capture/apply and Triplet Retiming controls are operable with accessible navigation;
- future audition instrument/mute controls expose accessible names and state without changing canonical score;
- accessibility presentation changes no canonical state.

### G10 — Performance / stability

- standalone bundle remains within automated budget;
- repeated edit -> relation capture -> Triplet capture/retiming -> Undo/Redo -> render -> playback -> orientation cycles do not accumulate duplicate listeners/controls;
- repeated Triplet group rerenders do not create duplicate Triplet Retiming buttons;
- repeated admitted retiming preserves exact identities and explicit-rest occupancy;
- repeated semantic navigation/capture creates no unintended history;
- once audio is integrated, repeated note audition does not leak voices, contexts, listeners or unbounded decoded sample state;
- no recurring crash, frozen viewport or unexpected network dependency appears.

## Current automated and physical evidence

The current P05/APP-11I line has passed:

- Node 18 / 20 / 22 repository contract + build/test;
- retained APP-10E–O WebKit authoring regressions;
- APP-11B, APP-11D, APP-11E and APP-11F WebKit regressions;
- dedicated mobile WebKit straight eighths -> canonical `1/12 + 1/12 + 1/12` Triplet -> exact Undo;
- exact ST Score Rendering Layer generic NOTE/REST checkout/build;
- APP-09B WebKit renderer regression;
- APP-09B controlled-layout rerender regression;
- P05 physical-like WebKit REST-target -> Paste -> visible current viewport -> exact Undo regression.

Separate physical iPhone Safari evidence records P05 Teacher Task 2 as PASS for NOTE/REST targeting, Paste render and Undo restoration.

The automated set proves regression compatibility only. The physical P05 result proves only the observed P05 Task 2 scenario, not the full release matrix.

## Pass rule

The standalone release gate may be marked PASS only when:

1. all five required physical targets have recorded applicable evidence;
2. G1–G10 have no unresolved release-blocking failure;
3. discovered regressions have linked fixes + exact-head green CI + affected-target rerun evidence;
4. canonical/noncanonical authority invariants remain unchanged;
5. `standaloneReleaseGatePassed` changes to `true` only in a separate evidence-backed closeout.

Until then:

```text
manualDeviceValidationRequired = true
standaloneReleaseGatePassed = false
seslitabCutoverAuthorized = false
```

SesliTab is not an architectural dependency of ST Score Editor Core and remains outside this development track. `st-score-audio-engine` is an optional external consumer/service boundary for future audition/playback work and does not alter canonical editor authority.
