# Smoosic reference analysis

Date: 2026-09-02

Reviewed upstream:

- repository: `Smoosic/Smoosic`
- reviewed main SHA: `1427042ef0d6b9d8684b140c8f2a489270e8cc9f`
- license: MIT (upstream `LICENSE`, copyright 2024 Smoosic)
- upstream package version observed: `1.0.44`

## Why it is relevant

Smoosic is a browser music-notation application with real-time editing, playback, part extraction, and MIDI/MusicXML import/export. Its source layout separates score-domain data (`src/smo/data`), MusicXML conversion (`src/smo/mxml`), score transformations (`src/smo/xform`), rendering (`src/render`) and UI/application code.

The reviewed code confirms several architecture patterns that are useful as independent reference evidence:

1. A notation editor needs an internal score object graph rather than editing MusicXML or SVG directly.
2. MusicXML import and export should be adapters around that score model.
3. Editing, selection and undo/redo are first-class application capabilities, not renderer behavior.
4. Rendering can be replaceable relative to the score model.
5. Browser editing needs explicit command/operation surfaces rather than DOM mutation as musical authority.

## Upstream implementation facts used as reference

- `src/smo/data/score.ts` defines `SmoScore` as the high-level score object.
- `src/smo/mxml/xmlToSmo.ts` and `src/smo/mxml/smoToXml.ts` implement MusicXML conversion in both directions.
- `src/smo/xform/undo.ts` manages undo/redo state for serializable score objects.
- `src/render/vex/toVex.ts` converts Smo score state toward Vex rendering.
- application/view operations expose edit actions such as note deletion and measure addition.
- Smoosic currently depends on `vexflow_smoosic`, its own VexFlow branch.

## Decision for ST Score Editor Core

Smoosic is **reference evidence, not a runtime dependency**.

Do not:

- import Smoosic as canonical score authority;
- copy its score identity model into ST;
- replace ST revision-bound semantic addressing with renderer/view selections;
- adopt `vexflow_smoosic` into Editor Core;
- make MusicXML, SVG, DOM ids or renderer objects authoritative editor state;
- introduce a second undo/redo authority beside ST unified history.

The MIT license makes upstream code legally permissive for reuse subject to notice requirements, but there is no current need to copy source code. The architectural value can be obtained without dependency or source-copy coupling.

## Capability comparison

| Capability | Smoosic reference | ST Score Editor Core current reality | Decision |
| --- | --- | --- | --- |
| Internal score model | Yes (`SmoScore`) | Yes (`ScoreDocument`) | Keep ST model |
| MusicXML import | Yes | Yes, bounded/fail-closed | Keep ST importer |
| MusicXML export | Yes | Yes | Keep ST exporter |
| Real-time score editing | Yes | Existing-score correction | Expand ST incrementally |
| Undo/redo | Yes | Yes, revision/history based | Keep ST history |
| Stable semantic identity | Application-specific | Revision-bound `SemanticAddress` | ST is authority |
| Renderer | VexFlow-derived | Presentation-only OSMD/alphaTab adapters | Keep renderer replaceable |
| Note correction | Yes | Yes | Already covered |
| Note entry into existing rest | Yes conceptually | SEC-NE-01 adds bounded primitive | Implemented on branch |
| Free cursor note insertion | Yes in product | Not admitted | Later bounded stage |
| Event onset mutation/retiming | Editing operations exist | Not admitted | Separate reviewed contract |
| Tuplet retiming | Supported in editor workflow | Metadata-only unless timing already proves 3:2 | Requires onset authority |
| Measure/part structural editing | Yes | Not general-purpose | Later stage |
| Copy/paste | Yes | Not general-purpose score-authoring surface | Later stage |

## SEC-NE-01 boundary

The first score-authoring primitive is intentionally narrower than unrestricted Sibelius-style entry.

`ENTER_NOTE_IN_REST`:

- requires an exact current-revision rest `EventAddress`;
- preserves the selected rest event identity for the inserted note;
- accepts an explicit pitch and canonical positive duration;
- if duration equals the rest, replaces it atomically;
- if duration is shorter, creates one explicit trailing rest with a caller-supplied fresh id;
- preserves the total represented time of the original rest;
- rejects duration overflow, stale targets and identity collisions;
- creates one immutable canonical revision or none;
- adds no renderer, UI framework, network, persistence, AI or external-engine authority.

This provides real note-entry capability without yet admitting arbitrary onset mutation or measure-timing inference.

## Reference posture

Smoosic, MuseScore, TuxGuitar, alphaTab, OSMD and Verovio should remain an external technical taxonomy/reference set. ST Score Editor Core owns its own contracts and canonical state. Any source-level reuse must be separately reviewed for exact file provenance, license notice obligations, maintenance coupling and whether a clean independent implementation is simpler.
