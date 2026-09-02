# ST Score Editor Core — Architecture

Status: **SEC-NE is complete. SSE-00–04 are merged; SSE-05 adds relation-safe ornament authoring as a merge candidate.**

## Authority

Each v2 editor session owns exactly one `ScoreDocumentV2 + NotationDocumentV2` pair. Grace identity/order/anchor/written value live in canonical score state. Articulations and ornaments are same-revision notation semantics. Renderer/SesliTab remain noncanonical.

## Ornament authoring profiles

### Local profile

Exact current normal `event` or `grace-event` targets may add/toggle/remove typed simple ornaments or a single-note tremolo. The local API explicitly refuses wavy-line and tremolo start/stop endpoints, so it cannot create a broken spanning relation.

### Spanning relation profile

```text
exact ordered normal pitched events
        |
whole-relation intent
        |
same part/staff/measure/voice scope check
        |
canonical event-order + relation-number checks
        |
all endpoints/members written atomically
        |
NotationDocumentV2 relation validation
        |
EditorHistoryStateV2 atomic commit
```

Two-note tremolo is created/removed with start and stop together. Wavy-line is created/removed as one ordered start/continue/stop chain. The bounded profile does not infer cross-measure, cross-voice, grace-spanning or rest-member relations.

## Validation / safety

Targets are revision-bound and must be unique and strictly increasing in canonical event order. Spanning relation members must be pitched normal events. Relation numbers are collision-checked within the relation kind. Removal requires the exact current member list/endpoints. Stale, reversed, ambiguous or unsupported-scope relations fail closed.

Ornament edits do not alter pitch, onset, duration, normal measure occupancy or grace identity. Unified editor history advances one direct-child score revision and one same-revision notation document; there is no independent notation timeline.

## Rendering / MusicXML boundary

V2 semantic manifests already expose the exact target identities. Until SSE-06 supplies vNext MusicXML semantics, any ornament-bearing pair remains `VNEXT_XML_PENDING` with `musicXml = null` rather than emitting a lossy v1 projection.

## Next stages

- SSE-06 — bounded v2 MusicXML round trip for grace/articulation/ornament semantics;
- SSE-07 — product renderer/SesliTab v2 compatibility.

Staff/part topology and cross-staff remain separate SSE-08+ gates. No dependency, renderer/host authority, persistence/network authority or production activation is added by SSE-05.