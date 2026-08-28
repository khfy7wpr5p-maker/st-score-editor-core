# E8-A — Guitar Workspace Authority Contract

## Status

Stage E8-A freezes the authority and source-identity boundary for a future Guitar Workspace adapter. It does **not** connect the MusicXML-to-Guitar-TAB-Engine yet and does not create a production integration.

The reviewed external reference is:

- repository: `khfy7wpr5p-maker/musicxml-to-guitar-tab-engine`
- reviewed main SHA: `93abe9735a4ed70ad8362ac24ec39869ea34607f`
- canonical result: `CanonicalTabResult` schema `2.0.0`
- polyphonic source model: `1.0.0`

## Authority rule

Guitar string, fret, fingering, barre, voicing, reduction, teacher-review and playability data are derivative workspace state only.

They may explain or visualize a guitar realization of the current canonical score, but they may not:

- mutate `ScoreDocument` directly;
- become canonical pitch/rhythm/notation authority;
- write backwards from an engine result into canonical score state;
- use renderer/DOM/coordinate state as edit authority;
- bypass E4/E7-E1 typed transactions;
- activate production, persistence, publication or public write APIs.

Any future user-requested canonical edit derived from a guitar suggestion must be translated into an ordinary revision-bound semantic selection plus an already-authorized typed editor intent/transaction. The engine result itself never authorizes that mutation.

## Source traceability boundary

The Guitar TAB Engine uses deterministic polyphonic source identities of the form:

```text
<partId>:measure:<measureIndex>:note:<sourceOrder>
```

ST Score Editor Core uses revision-bound semantic addresses. E8-A therefore introduces a `GuitarWorkspaceSourceMap` that binds each external `sourceEventId` to exactly one current canonical semantic target.

Allowed canonical target kinds are:

- `note` — for emitted pitched note atoms, including individual notes inside canonical chord events;
- `event` — for source events such as rests where there is no canonical note atom.

The map carries the exact canonical `documentId` and `revisionId`. A stale document/revision, duplicate external source identity, duplicate canonical target, unsupported target kind, unknown field set or unresolved semantic address fails closed.

## Why the map is required

The core MusicXML serializer intentionally does not embed ST internal entity IDs into `<note>` elements. Meanwhile the Guitar TAB Engine derives its `sourceEventId` from deterministic MusicXML source order. A future adapter must therefore create the MusicXML payload and source map together from the same deterministic traversal. It must never reconstruct authority later from renderer coordinates or best-effort matching.

That deterministic projection is deliberately deferred to a later E8 substage. E8-A defines only the required safety contract.

## External engine compatibility evidence

The reviewed Guitar TAB Engine contracts are compatible with a derivative-only boundary:

- `SustainedCanonicalSelectionBridge 1.0.0` declares `REDUCTION_PROJECTION_FACTS_ONLY` authority;
- `CanonicalTabResult 2.0.0` validates guitar configuration, source provenance, note dispositions, selected positions, selected shapes, fingering/barre data and physical playability fail closed;
- selected positions remain engine output facts and do not become ST canonical score identities.

These facts support the adapter design but do not grant cross-repository write authority.

## E8-A acceptance boundary

E8-A is complete only when:

1. the guitar workspace authority profile is immutable and derivative-only;
2. source maps are revision-bound and resolve through ST semantic addressing;
3. duplicate or stale mappings fail closed;
4. only `event` and `note` semantic targets are admitted;
5. no runtime dependency is added;
6. external engine integration remains unimplemented;
7. production/public-write/live-AI authority remains unchanged;
8. full Node 18/20/22 CI passes.

## Next safe substage

E8-B should implement a deterministic **MusicXML + source-map projection** for the initial Guitar Workspace scope. It should generate both artifacts in one traversal and prove that each emitted MusicXML `<note>` position maps to the expected canonical event/note identity before any engine result adapter is admitted.
