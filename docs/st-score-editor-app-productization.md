# ST Score Editor App — Productization Program

Status: **ACTIVE / APP-00–01 COMPLETE / MERGED / APP-02A MERGE CANDIDATE / APP-02B NEXT**

Date: 2026-09-03

## Product decision

ST Score Editor must become a complete standalone application before any SesliTab V4 product cutover.

The core remains a renderer-independent library. The standalone product is a separate application layer that consumes the core contracts. SesliTab integration is explicitly deferred until the standalone product passes the final product gate.

```text
ST Score Editor Core
        |
        +--> ST Score Editor App   <-- CURRENT PRODUCT TARGET
        |
        +--> SesliTab              <-- DEFERRED UNTIL APP COMPLETE
```

## Non-negotiable authority boundary

The standalone app never becomes a second score authority. Canonical editing remains `ScoreDocumentV3 + NotationDocumentV4` owned by `EditorSessionV4`. UI/file/autosave/renderer/playback state stays noncanonical.

## Program sequence

### APP-00 — Standalone product contract
Status: **COMPLETE / MERGED**

### APP-01 — Document runtime
Status: **COMPLETE / MERGED**

Implemented: New score, verified-SHA MusicXML Open, lossless-only MusicXML Export, title/origin, dirty/saved revision tracking, V4 undo/redo, topology and cross-staff commits. No persistence/network/server authority.

### APP-02 — Unified V4 authoring session
Status: **IN PROGRESS**

APP-02 is split only for implementation/test isolation; all slices share the same canonical V4 history.

#### APP-02A — Basic musical authoring
Status: **COMPLETE / MERGE CANDIDATE**

Native V4 authoring now covers:

- exact normal-note/chord-tone pitch edit;
- timed event duration edit;
- rest -> note with explicit fresh note identity;
- pitched event -> rest;
- add chord tone;
- remove chord tone;
- stale target and identity-collision rejection;
- note-notation orphan protection;
- explicit cross-staff conflict protection when converting a placed event to rest;
- one direct-child `ScoreDocumentV3` revision plus same-revision `NotationDocumentV4` per accepted edit;
- the same `EditorHistoryV4` used by topology and cross-staff edits.

No whole-document V4 -> V2 -> V4 editing bridge is used.

#### APP-02B — Grace / articulation / ornament / keypad composition
Status: **NEXT**

Required before APP-02 is complete:

- grace-group/event authoring;
- articulation authoring;
- ornament authoring;
- keypad/keyboard semantic command routing;
- all under the same V4 history and selection model.

### APP-03 — Standalone browser bundle and application shell
Status: **PLANNED**

Independent `STScoreEditorApp` browser entry, toolbar/keypad shell, score viewport, semantic selection/inspector, status/error surface and responsive desktop/tablet/mobile layout.

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

## Service-provider boundary

A service provider is not required for the standalone editing path. Backend/cloud services are optional later capabilities for account sync, cloud storage, collaboration, heavy OMR/AI or publishing and are never canonical editing authority.

## Explicitly deferred

- SesliTab V4 product cutover;
- server revision authority;
- cloud sync/collaboration;
- account system;
- public-write/publication activation;
- cross-staff MusicXML V4 round trip;
- unsupported advanced notation scopes already gated by SSE-10.
