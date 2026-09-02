# SesliTab Editor Integration Contract

Status: architecture boundary for future SEC-NE-09 product integration.

## Ownership

SesliTab is the product host/orchestrator. It is not a second canonical score authority.

```text
MusicXML / OMR evidence
  -> ST Score Editor Core canonical state
  -> RenderRequest
  -> ST Score Rendering Layer
  -> SesliTab interaction/playback UI
```

Guitar Workspace, OMR Correction Engine and playback may supply evidence or product behavior, but canonical score edits must return through Editor Core typed semantic operations.

## Forbidden dual-write

SesliTab must not maintain a second mutable musical model that is independently edited in parallel with `ScoreDocument`.

Forbidden patterns include:

- mutating renderer objects and separately mutating Editor Core;
- editing MusicXML text as the live state while also editing `ScoreDocument`;
- applying an OMR/Guitar result directly to host score state without a canonical Editor Core intent;
- storing a stale semantic address and replaying it after revision change;
- using DOM/SVG coordinates as direct mutation targets.

## Renderer interaction

Visual hit testing belongs to the Rendering Layer. The host returns only an exact current render-request identity and opaque hit token through the editor selection bridge.

Renderer resize, reflow, orientation changes and mobile DOM replacement may change geometry, but must not change canonical semantic identity.

If a visual entity cannot be resolved unambiguously after rerender, the host must expose no target rather than guess a nearest note.

## Pointer, keyboard and mobile

Desktop pointer, keyboard and iPhone/touch flows must converge on the same semantic Editor Core intent path.

Platform-specific gesture code may derive a candidate action or insertion location, but mutation is admitted only after current semantic identity and revision checks.

## Current note-entry integration

Today the bounded public session/browser note-entry surface is the SEC-NE-02 exact selected-rest path.

SEC-NE-04C provides a merged low-level `InsertionPosition` + explicit-rest primitive, but there is no second public cursor-position session/browser API yet. SesliTab must not bypass this boundary by calling low-level score mutation from UI code and maintaining separate history.

A future cursor-entry UI should compose 04C through the existing unified session/history architecture.

## Selection continuity

After accepted mutations:

- selection may be deterministically rebound to a surviving canonical entity on the new revision; or
- selection must be cleared safely.

Renderer rerender itself must not delete semantic selection merely because DOM nodes were recreated. The host should retain semantic selection state and ask the current renderer to present it again.

## Playback boundary

Playback availability is a product/media capability, not canonical authoring authority.

Incomplete OMR or unavailable editing capability should not automatically disable playback unless playback itself lacks sufficient safe source data. Playback errors and edit-admission errors should remain separate typed product states.

Playback cursor/highlight state may reference current canonical semantic identity but cannot mutate score state.

## OMR boundary

OMR output is source/evidence. Corrections from `st-omr-correction-engine` remain reversible proposals and must enter Editor Core through admitted semantic edit operations.

Original OMR/source evidence remains immutable and auditable.

## Guitar/TAB boundary

Standard score semantics remain canonical. String/fret/fingering/voicing output remains derivative unless a future explicit contract admits additional canonical guitar semantics.

TAB UI must not bypass generic Editor Core authoring operations.

## Autosave/versioning

Product persistence should store/version accepted canonical revisions or an explicitly versioned serialization of them. Autosave must not create a parallel mutation authority.

Stale server/client revisions require explicit conflict handling; silent last-write-wins over a different canonical revision is not an editor-core assumption.

## Production gate

This document defines a boundary; it does not activate SesliTab production integration, public write APIs, persistence or deployment.

SEC-NE-09 remains NOT STARTED until earlier authoring stages and an explicit product-integration PR satisfy their own gates.
