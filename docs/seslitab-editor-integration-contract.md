# SesliTab Editor Integration Contract

Status: **SEC-NE-09 v1 integration is merged; SSE-07 adds bounded v2 compatibility as a merge candidate. Production/persistence/deployment authority remains unactivated.**

## Ownership

SesliTab is a product host/orchestrator. Neither the v1 nor v2 facade creates a second mutable musical model.

```text
MusicXML / OMR evidence
  -> canonical ScoreDocument + NotationDocument
  -> one EditorSession + unified history
  -> RenderRequest / opaque semantic-token manifest
  -> renderer / SesliTab presentation
```

Canonical edits return through Editor Core semantic operations only.

## V1 compatibility

`seslitab-editor-host/1.0.0` remains unchanged for the existing v1 session surface: render-token selection, score/notation/keypad/note-entry delegation and unified undo/redo.

## SSE-07 v2 facade

`seslitab-editor-host-v2/2.0.0` wraps exactly one `EditorSessionStateV2` and exposes:

- v2 renderer request snapshots;
- opaque revision-bound token selection for normal and grace semantic addresses;
- admitted grace authoring delegation;
- admitted articulation authoring delegation;
- admitted ornament authoring delegation;
- unified v2 undo/redo;
- typed product-facing rejection results;
- pointer, keyboard and touch provenance through the same semantic paths.

Input mode is not mutation authority. Equivalent pointer, keyboard and touch actions resolve to the same editor-owned semantic operation.

## Renderer boundary

V2 session render requests may contain `V1_COMPATIBLE_XML` or `V2_SEMANTIC_XML`. `VNEXT_XML_PENDING` means the bounded serializer cannot safely represent the canonical pair; such requests must not be sent to a renderer.

Renderer manifests contain opaque revision-bound semantic tokens. Renderer reflow, resize, orientation change or DOM replacement cannot independently redefine canonical selection identity. A token that is stale, absent or mismatched fails closed rather than resolving by nearest geometry.

## Forbidden dual-write

SesliTab must not:

- mutate renderer objects as musical state;
- edit MusicXML as live state alongside canonical score state;
- apply OMR/Guitar results directly to a second host score;
- reuse stale semantic addresses after revision change;
- use DOM/SVG coordinates as direct mutation targets;
- create a last-write-wins shadow score outside Editor Core history.

Both host profiles explicitly keep `hostDualWriteAllowed`, `rendererMutationAuthority` and `domCoordinateMutationAuthority` false.

## Selection continuity

Canonical selection is revision-bound semantic state. The host may re-present a still-current selection from the session after rerender. If a current opaque token cannot resolve exactly, selection fails rather than guesses.

Accepted authoring operations use the session-controller rebound/clear policies. History transitions remain inside the same canonical session.

## Playback boundary

Playback is a product/media capability, not editor mutation authority.

Both host profiles keep playback host-owned and `editorAdmissionControlsPlayback = false`. Therefore incomplete OMR, an unavailable edit feature or a rejected score mutation does not by itself authorize Editor Core to disable playback. Playback readiness and errors must be determined by playback-specific data/state.

Playback cursor/highlight may reference current semantic identity but cannot mutate score state.

## Guitar/TAB boundary

String/fret/fingering/voicing state remains derivative. A canonical score edit invalidates stale Guitar state; Guitar results never bypass generic Editor Core authoring. Direct external engine invocation remains E8-D human-gated.

## OMR boundary

OMR is evidence/source. Corrections must enter through admitted semantic edit paths. Original source evidence remains immutable.

## Persistence/versioning boundary

SSE-07 adds no network, persistence or server revision authority. A future product persistence layer must store/version accepted canonical revisions and define conflict handling explicitly. Silent last-write-wins is not admitted.

## Production gate

The bounded integration is CI-verified, but merge does not activate public write APIs, persistence, production services or deployment. Those remain separate human-gated product decisions. Staff/part topology and cross-staff canonical authority also remain outside SSE-07.