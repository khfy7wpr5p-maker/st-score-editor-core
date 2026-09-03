# ST Score Editor Core — Architecture

Status: **SEC-NE and SSE-00–10 are merged. ST-SCORE-EDITOR-APP / PRODUCTIZATION is active; APP-00–05 are complete/merged and APP-06 is next.**

## Product architecture

```text
Standalone HTML / Browser Shell
        |
        v
STScoreEditorApp controller
        |
        +--> browser-local file workflow (noncanonical)
        +--> recovery/autosave cache (noncanonical)
        |
        v
ScoreEditorAppDocument
        |
        v
EditorSessionV4
        |
        +--> ScoreDocumentV3
        +--> NotationDocumentV4
        |
        v
RendererRequestV4
```

SesliTab V4 integration is deferred until APP-09. A backend/service provider is not required for the local editing path.

## Canonical authority

One product session owns exactly one current pair:

```text
ScoreDocumentV3/3.0.0 + NotationDocumentV4/4.0.0
```

`SemanticAddressV3` is the stable revision-bound source identity. MusicXML is exchange/projection data. Browser file handles, recovery state, shell state, renderer DOM/SVG, playback state and future SesliTab state are noncanonical.

## APP-01–04 product substrate

APP-01 owns New/Open/export/dirty/saved document lifecycle. APP-02 composes all admitted V4 authoring in one history. APP-03 provides the independent standalone browser bundle/shell. APP-04 provides bounded `.musicxml/.xml` local open/save/download with lossless-export-first ordering and document-bound file handles.

## APP-05 local recovery/autosave

APP-05 is complete through PRs #76–79.

### Recovery envelope

The recovery payload stores only the current canonical `ScoreDocumentV3 + NotationDocumentV4` pair plus bounded metadata. It does not serialize undo/redo history. Admission requires canonical V3/V4 validation, metadata alignment and a SHA-256 integrity digest. Recovery JSON is bounded to 64 MiB.

### Recovery cache and autosave

IndexedDB is admitted only in the standalone app bundle for noncanonical recovery cache. The legacy core browser bundle still forbids IndexedDB. At most 8 document records are retained. Autosave is eligible only for dirty documents after at least one accepted history revision. Duplicate revision writes are suppressed. If the canonical revision changes while a digest is being created, that older snapshot is not written and the newer revision is rescheduled.

Corrupt records are isolated and rejected; they are never silently admitted as canonical state.

### Explicit restore boundary

There is no automatic restore. Recovery uses a two-step flow:

```text
validated recovery candidate
        |
        v
prepareRecoveryApplication
        |   captures active document/revision guard
        v
explicit applyPreparedRecovery
        |
        +--> guard still current? no -> reject
        +--> canonical V3/V4 revalidation fails? -> reject
        |
        v
affected live document adopts recovered snapshot
        |
        +--> fresh V4 history starts at recovered snapshot
        +--> stale local file association cleared
        +--> consumed cache cleanup attempted
```

The controller never silently overwrites a newer live revision. Cache cleanup is noncanonical: if deletion fails after a valid adoption, the applied canonical state is not rolled back merely to satisfy cache cleanup.

The standalone app manifest keeps `persistenceCapable:false`, `networkCapable:false`, `serverRevisionAuthority:false`, `publicationAuthority:false`, `recoveryCanonicalAuthority:false` and `recoveryAutoRestore:false`.

## Cross-staff and renderer boundary

`NotationDocumentV4.crossStaffPlacements[]` assigns display staff without changing canonical source identity. Non-empty placements remain `CROSS_STAFF_XML_PENDING` with `musicXml = null`; no V4-native cross-staff MusicXML round trip is claimed.

## Next product layer

APP-06 is next: renderer interaction, canonical semantic-token hit mapping, zoom/navigation and viewport lifecycle while keeping renderer geometry noncanonical.

## Remaining gates

APP-07 playback, APP-08 export/print and APP-09 product hardening remain planned. Cloud/server authority, production/public-write and SesliTab V4 cutover remain separately gated.
