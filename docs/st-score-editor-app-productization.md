# ST Score Editor App — Productization Program

Status: **ACTIVE / APP-00–01 COMPLETE / MERGED / APP-02 NEXT**

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

The standalone app never becomes a second score authority.

Canonical editing remains:

```text
ScoreDocumentV3 + NotationDocumentV4
              |
       EditorSessionV4
```

UI state, file picker state, autosave state, renderer DOM/SVG, playback cursor and recent-file metadata are product state only. They cannot directly rewrite canonical score/notation structures.

## Current product gap

APP-01 is merged and provides the standalone document lifecycle. The remaining immediate gap is unified product authoring.

Current V4 session directly exposes topology and cross-staff authoring. Earlier note-entry, pitch/duration, grace, articulation, ornament and keypad capabilities are not yet all composed through the same V4 product session.

Therefore a visual shell must not be declared feature-complete until APP-02 closes this gap.

## Program sequence

### APP-00 — Standalone product contract

Status: **COMPLETE / MERGED**

- standalone app is the primary product target;
- SesliTab cutover deferred;
- no server requirement for local editing;
- Core remains non-UI library;
- browser/product state remains noncanonical.

### APP-01 — Document runtime

Status: **COMPLETE / MERGED**

Implemented:

- New score;
- MusicXML Open with verified SHA-256 source identity;
- MusicXML Export when lossless projection is admitted;
- title/origin metadata;
- dirty/saved revision tracking;
- V4 undo/redo;
- currently available V4 topology/cross-staff commits.

APP-01 contains **no persistence authority**. `markSaved` records that an external product shell successfully saved/exported the current revision; it does not write files itself.

### APP-02 — Unified V4 authoring session

Status: **NEXT**

Required before declaring the editor shell feature-capable.

Bring the existing score-editing capabilities under one product session without V4 -> V2 -> V4 lossy round trips:

- note/rest insertion and deletion;
- pitch edits;
- duration edits;
- chord-tone operations;
- grace authoring;
- articulation authoring;
- ornament authoring;
- keypad/keyboard semantic commands;
- topology and cross-staff remain in the same history.

All accepted edits must remain one direct-child canonical revision in the same unified history.

### APP-03 — Standalone browser bundle and application shell

- independent `STScoreEditorApp` browser entry;
- no SesliTab host dependency;
- toolbar/keypad shell;
- score viewport;
- semantic selection/inspector;
- status/error surface;
- desktop/tablet/mobile responsive layout.

### APP-04 — Local file workflow

- File System Access API when available;
- safe `<input type=file>` fallback;
- MusicXML open;
- MusicXML download/save;
- local recent-document metadata only;
- no cloud/server dependency required.

### APP-05 — Local recovery/autosave

- browser-local recovery snapshots;
- explicit schema/version envelope;
- fail-closed recovery validation;
- canonical revision remains editor-session owned;
- autosave store is never mutation authority.

### APP-06 — Renderer interaction

- OSMD primary standard-notation presentation;
- AlphaTab only where admitted for derivative guitar/TAB presentation;
- semantic token hit mapping;
- zoom/page/navigation;
- no renderer geometry mutation authority.

### APP-07 — Playback

- local playback transport;
- playback remains available independently from OMR/edit admission;
- cursor/playhead is noncanonical;
- playback does not mutate score semantics.

### APP-08 — Export/print

- MusicXML export within admitted profile;
- browser print/PDF workflow;
- explicit unsupported status for semantics without a lossless MusicXML projection;
- no silent flattening.

### APP-09 — Product hardening and standalone release gate

- iPhone/iPad/Safari;
- desktop Chromium/Firefox/Safari;
- touch/pointer/keyboard regression;
- large-score performance;
- recovery tests;
- destructive-action UX;
- accessibility;
- user acceptance corpus;
- release checklist.

Only after APP-09 passes may a separate SesliTab product integration program begin.

## Service-provider boundary

A service provider is not required for the standalone editing path.

Local app operation may remain:

```text
Browser UI
   -> ST Score Editor App
   -> EditorSessionV4
   -> renderer / local playback / local file APIs
```

Backend/cloud services are optional future capabilities for account sync, cloud storage, collaboration, heavy OMR/AI or publishing. They are not canonical editing authority.

## Explicitly deferred

- SesliTab V4 product cutover;
- server revision authority;
- cloud sync/collaboration;
- account system;
- public-write/publication activation;
- cross-staff MusicXML V4 round trip;
- unsupported advanced notation scopes already gated by SSE-10.
