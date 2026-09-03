# ST Score Editor App — Productization Program

Status: **ACTIVE / APP-00–02 COMPLETE / MERGED / APP-03 NEXT**

Date: 2026-09-03

## Product decision

ST Score Editor must become a complete standalone application before any SesliTab V4 product cutover. Core remains a renderer-independent library; the standalone app consumes it through one canonical V4 session.

```text
ST Score Editor Core
        |
        +--> ST Score Editor App   <-- CURRENT PRODUCT TARGET
        |
        +--> SesliTab              <-- DEFERRED UNTIL APP-09
```

Canonical editing remains `ScoreDocumentV3 + NotationDocumentV4` owned by `EditorSessionV4`. UI/file/autosave/renderer/playback state is noncanonical. Local editing does not require a service provider/backend.

## Completed stages

### APP-00 — Standalone product contract
Status: **COMPLETE / MERGED**

Standalone-first authority boundary; SesliTab deferred; no server requirement for local editing.

### APP-01 — Document runtime
Status: **COMPLETE / MERGED**

New score, verified-SHA MusicXML Open, lossless-only MusicXML Export, title/origin, dirty/saved tracking, V4 undo/redo, topology and cross-staff commit entry points. No persistence/network/server authority.

### APP-02 — Unified V4 authoring session
Status: **COMPLETE / MERGED**

APP-02 was split only for implementation/test isolation; all slices now share the same canonical `EditorHistoryV4`.

#### APP-02A — Basic musical authoring
Merged via PR #64.

- exact note/chord-tone pitch edit;
- event duration edit;
- rest -> note with explicit identity;
- pitched event -> rest;
- chord-tone add/remove;
- stale target and identity collision rejection;
- note-notation orphan protection;
- cross-staff conflict protection for destructive rest conversion.

#### APP-02B1 — Grace authoring
Merged via PR #65.

- grace group create/remove;
- grace event add/remove/move/replace;
- grace-note pitch;
- orphan/stale protection.

#### APP-02B2 — Articulation authoring
Merged via PR #66.

- set/toggle/remove articulation;
- normal and grace event targets;
- notation validation remains canonical.

#### APP-02B3 — Ornament authoring
Merged via PR #67.

- local normal/grace ornaments;
- bounded tremolo and wavy-line spanning relations;
- same exact source part/staff/frame/measure/voice scope;
- canonical event order and pitched-endpoint validation;
- relation-number collision protection.

#### APP-02C — Semantic keypad orchestration
Merged via PR #68.

Existing semantic keypad action IDs now execute natively against the V4 product pair:

- whole/half/quarter/eighth/16th/32nd duration;
- equivalent rest values;
- flat/natural/sharp;
- dots 0..3;
- explicit triplet range;
- explicit tie/slur note pair.

Duration/rest actions synchronize canonical duration with dot state. Accidentals synchronize canonical pitch alteration with display accidental. Triplet/tie/slur require explicit current-revision semantic targets. Renderer geometry and nearest-note inference are forbidden.

`selectSessionSemanticAddressV4` / `selectAppSemanticAddress` admit only current addresses that resolve against the canonical score. All accepted APP-02 edits create exactly one direct-child score revision, one same-revision notation document and one unified history snapshot. No whole-document V4 -> V2 -> V4 editing bridge exists.

## Next stage

### APP-03 — Standalone browser bundle and application shell
Status: **NEXT**

- independent `STScoreEditorApp` browser entry;
- no SesliTab host dependency;
- toolbar/keypad shell;
- score viewport container;
- semantic selection/inspector surface;
- status/error surface;
- responsive desktop/tablet/mobile layout;
- UI dispatch only through admitted app/session APIs;
- no DOM/SVG canonical mutation authority.

### APP-04 — Local file workflow
Status: **PLANNED**

File System Access API when available, safe file-input fallback, MusicXML open/download/save and local recent-document metadata; no cloud requirement.

### APP-05 — Local recovery/autosave
Status: **PLANNED**

Browser-local validated recovery snapshots. Autosave never becomes mutation authority.

### APP-06 — Renderer interaction
Status: **PLANNED**

OSMD primary standard notation, AlphaTab only for admitted derivative guitar/TAB, semantic token hit mapping, zoom/navigation and no renderer geometry authority.

### APP-07 — Playback
Status: **PLANNED**

Local transport independent from OMR/edit admission; playhead is noncanonical.

### APP-08 — Export/print
Status: **PLANNED**

Admitted MusicXML export plus browser print/PDF workflow; unsupported semantics fail closed.

### APP-09 — Product hardening and standalone release gate
Status: **PLANNED**

iPhone/iPad/Safari, desktop browsers, touch/pointer/keyboard, performance, recovery, destructive-action UX, accessibility, user acceptance corpus and release checklist.

Only after APP-09 passes may a separate SesliTab product integration program begin.

## Explicitly deferred

- SesliTab V4 product cutover;
- server revision authority;
- cloud sync/collaboration;
- account system;
- public-write/publication activation;
- cross-staff MusicXML V4 round trip;
- unsupported advanced notation scopes already gated by SSE-10.
