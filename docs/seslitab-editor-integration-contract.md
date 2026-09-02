# SesliTab Editor Integration Contract

Status: **SEC-NE-09 bounded Editor Core integration implemented. Production/persistence/deployment authority remains unactivated.**

## Ownership

SesliTab is a product host/orchestrator. `seslitab-editor-host/1.0.0` contains exactly one `EditorSessionState`; it does not create another mutable musical model.

```text
MusicXML / OMR evidence
  -> ScoreDocument + NotationDocument
  -> EditorSessionState + unified history
  -> RenderRequest / opaque token manifest
  -> ST Score Rendering Layer / SesliTab UI
```

Canonical edits return through existing Editor Core semantic operations.

## Implemented SEC-NE-09 adapter

The adapter supports:

- one current editor session;
- current render-token selection;
- score-intent delegation;
- notation-intent delegation;
- keypad delegation, including existing exact-target advanced actions;
- existing selected-rest note-entry delegation;
- unified undo/redo;
- typed product-facing rejection results;
- pointer, keyboard and touch provenance using the same semantic paths.

Input mode is not mutation authority. A touch gesture and a keyboard gesture that express the same admitted semantic operation reach the same Editor Core path.

## Forbidden dual-write

SesliTab must not:

- mutate renderer objects as musical state;
- edit MusicXML as live state alongside `ScoreDocument`;
- apply OMR/Guitar results directly to a second host score;
- reuse stale semantic addresses after revision change;
- use DOM/SVG coordinates as direct mutation targets;
- create a last-write-wins shadow score outside Editor Core history.

## Selection continuity

Canonical selection is revision-bound semantic state. Renderer reflow, resize, orientation change or DOM replacement does not independently erase canonical identity. The host may re-present a still-current selection from the session; if a current token cannot resolve exactly, selection must fail rather than guess.

Accepted operations use the existing session-controller rebound/clear policies. History transitions remain within the same session.

## Playback boundary

Playback is a product/media capability, not editor mutation authority.

`sesliTabEditorHostProfile.editorAdmissionControlsPlayback` is `false`. Therefore an incomplete OMR result, unavailable edit feature or rejected score mutation does not by itself authorize the Editor Core adapter to disable playback. Playback must be decided from playback-specific source/data readiness and its errors should remain distinct from editor-admission errors.

Playback cursor/highlight may reference current semantic identity but cannot mutate score state.

## Guitar/TAB boundary

SEC-NE-08 keeps string/fret/fingering/voicing derivative. A canonical score edit invalidates old Guitar state; Guitar results never bypass generic Editor Core authoring. Direct external engine invocation remains E8-D human-gated.

## OMR boundary

OMR is evidence/source. Corrections must enter through admitted semantic edit paths. Original source evidence remains immutable.

## Persistence/versioning boundary

SEC-NE-09 adds no network, persistence or server revision authority. A future product persistence layer must store/version accepted canonical revisions and define conflict handling explicitly. Silent last-write-wins is not admitted by this contract.

## Production gate

The bounded Editor Core integration is implemented and CI-verified, but merge does not activate public write APIs, persistence, production services or deployment. Those remain separate human-gated product decisions.
