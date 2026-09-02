# ST Score Editor Core — Architecture

Status: **SEC-NE is complete. SSE-00–02 are merged; SSE-03 adds canonical grace authoring as a merge candidate.**

## Authority

Each v2 editor session owns exactly one `ScoreDocumentV2 + NotationDocumentV2` pair. Grace identity/order/anchor/written value live in canonical score state; grace visual notation lives in same-revision notation state. Renderer/SesliTab remain noncanonical.

## Grace authoring flow

```text
exact current v2 semantic target
        |
GraceAuthoringIntentV2 + fresh nextRevisionId
        |
canonical candidate mutation
        |
ScoreDocumentV2 validation
        |
normal Voice.events occupancy fingerprint unchanged
        |
NotationDocumentV2 rebind / orphan veto
        |
EditorHistoryStateV2 atomic commit
        |
deterministic semantic selection
```

Admitted operations are group create/remove, grace event add/remove/reorder, event replacement with stable event ID, and exact grace-note pitch edits. Added grace events may be note, rest or chord.

## Safety

Grace groups remain anchored to exact normal events in the same voice. The v2 validator prevents missing anchors and duplicate identities. The authoring layer independently confirms that normal timed event ID/kind/onset/duration occupancy is unchanged.

Removing the last grace event is rejected; group removal must be explicit. Replacing or deleting a grace entity that still has notation targets is rejected by v2 notation rebinding rather than silently discarding notation.

All targets are revision-bound. Old addresses cannot be replayed after a commit.

## Rendering / MusicXML boundary

V2 render manifests already expose exact grace group/event/note identities. Until SSE-06, a score containing grace semantics reports `VNEXT_XML_PENDING` and no lossy MusicXML projection.

## Next stages

- SSE-04 — typed articulation authoring for normal/grace event notation;
- SSE-05 — ornament authoring with relation-safe spanning forms;
- SSE-06 — bounded v2 MusicXML round trip;
- SSE-07 — product renderer/SesliTab compatibility.

Staff/part topology and cross-staff remain separate SSE-08+ gates. No dependency, renderer/host authority, persistence/network authority or production activation is added by SSE-03.
