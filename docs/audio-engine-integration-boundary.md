# ST Score Audio Engine Integration Boundary

Status: **PLANNED / CONTRACT-BOUNDARY READY; AUDIO ENGINE IMPLEMENTATION LIVES OUTSIDE ST Score Editor Core**

This document defines how `st-score-editor-core` may consume the independent `st-score-audio-engine` without moving canonical score authority into the renderer, browser audio layer, sample library, or playback transport.

## Purpose

The first integration target is **note audition**:

```text
physical pointer/touch
        -> ST Score Rendering Layer generic rendered event evidence
        -> current NOTE/REST target evidence
        -> ST Score Editor Core current-revision semantic resolution
        -> exact canonical NOTE pitch
        -> immutable AuditionRequest
        -> ST Score Audio Engine
        -> Grand Piano sample output
```

The second instrument profile is **Classical Guitar**. Instrument choice is presentation/audio preference only and does not mutate the score.

## Authority boundary

### ST Score Rendering Layer

The renderer may:

- visually render the current exact renderer request;
- hit-test the current render generation;
- return bounded generic rendered-event evidence such as `NOTE` or `REST`;
- bind evidence to the current `renderEpoch` / source identity.

The renderer may not:

- create or own `AudioContext`;
- schedule or play audio;
- infer canonical pitch from geometry;
- supply trusted `SemanticAddressV3` mutation authority;
- own audition/playback state;
- mutate `ScoreDocumentV3`, `NotationDocumentV4`, or `EditorSessionV4`.

### ST Score Editor Core

Editor Core is responsible for:

- rejecting stale rendered evidence;
- resolving the current rendered NOTE target to current `SemanticAddressV3`;
- reading exact canonical pitch from the current score revision;
- producing a bounded immutable audition request;
- producing **no audition request for REST**;
- preserving selection even if audio fails;
- ensuring audition creates no canonical/history revision.

Canonical authority remains:

```text
ScoreDocumentV3 + NotationDocumentV4
        -> current SemanticAddressV3
        -> EditorSessionV4 history
```

### ST Score Audio Engine

The independent audio engine consumes validated requests. It may own:

- Web Audio / `AudioContext` lifecycle;
- sample manifests and decoded buffers;
- instrument profiles;
- note-on / note-off envelopes;
- bounded polyphony / voice management;
- user-gesture audio unlock;
- audio errors and degraded-mode status.

It may not invent score semantics or write canonical score state.

## Planned Editor-side request

The Editor Core adapter should remain small and versioned. A first request may contain:

```ts
type AuditionRequest = Readonly<{
  requestId: string;
  sourceRevisionId: string;
  sourceEventId?: string;
  pitch: CanonicalPitch;
  instrumentId: "GRAND_PIANO" | "CLASSICAL_GUITAR";
  velocity?: number;
  durationMs?: number;
  stringNumber?: number;
  fret?: number;
}>;
```

The exact public type must come from the audio-engine contract package once that package is green. Editor Core must not fork or duplicate the public contract.

## Note / rest behavior

```text
NOTE
  -> current rendered evidence
  -> exact current semantic address
  -> exact canonical pitch
  -> AuditionRequest
  -> audio

REST
  -> current rendered evidence
  -> current semantic rest target
  -> selection may proceed
  -> NO AuditionRequest
  -> silence
```

A renderer miss, ambiguous target, stale revision, stale render epoch, invalid canonical pitch, locked audio context, missing sample, or unavailable engine must never silently become a different note.

## Audition vs playback

One-note audition is not the same authority as score playback transport.

- audition is user-triggered, bounded and event-local;
- existing local playback planning remains a separate noncanonical consumer path;
- audio failure must not invalidate editing;
- playback/audition state creates no `EditorSessionV4` history;
- a future shared audio engine may serve both paths only through explicit versioned contracts.

## Instrument priority

### 1. Grand Piano

First physical target:

- touch/select a NOTE;
- hear the exact canonical pitch with a Grand Piano sample profile;
- low perceived latency;
- physical iPhone Safari user-gesture unlock;
- bounded polyphony;
- repeated-note retrigger;
- REST remains silent.

### 2. Classical Guitar

After Grand Piano is stable:

- nylon-string profile;
- canonical pitch audition through the same adapter;
- optional `stringNumber` / `fret` only when exact canonical guitar/TAB evidence exists;
- no string/fret inference from screen position;
- same pitch may later use string-aware timbre when exact evidence exists.

## UI ownership

The Editor UI may own presentation-only audio preferences such as:

- selected audition instrument;
- mute/audition-enabled toggle;
- transient audio status/error presentation.

These are noncanonical and must not create score history.

The default first instrument should be `GRAND_PIANO`. `CLASSICAL_GUITAR` becomes selectable only when the engine reports that profile as available.

## iPhone / Safari

Browser audio unlock is a real runtime constraint. The host may use the user's physical note touch as the gesture that requests audio unlock when browser policy allows it.

Rules:

- no autoplay on page load;
- no fabricated success if the context remains locked;
- expose explicit `AUDIO_UNLOCK_REQUIRED`/equivalent engine status;
- automated WebKit is regression evidence only;
- physical iPhone Safari evidence is required before declaring note audition physically passed.

## Integration gate

Editor Core must not embed a second audio implementation while `st-score-audio-engine` is being developed.

`APP-AUDIO-01` integration may begin only when the audio engine provides a green, versioned contract and browser-safe audition implementation sufficient for Grand Piano.

The Editor-side integration sequence is:

1. consume the published/versioned audio contracts;
2. add a bounded canonical NOTE -> `AuditionRequest` adapter;
3. wire current NOTE touch/selection to audition without changing selection authority;
4. prove REST produces no audio request;
5. prove stale evidence fails closed;
6. prove audition creates no `EditorSessionV4` history;
7. run automated WebKit regression;
8. run physical iPhone Safari Grand Piano audition;
9. add Classical Guitar only after Grand Piano remains green.

## Non-goals

This boundary does not authorize:

- a renderer-owned audio engine;
- DOM/SVG-to-pitch inference;
- a second canonical score model;
- automatic production deployment;
- SesliTab production cutover;
- unlicensed or provenance-unknown sample assets;
- full DAW/sequencer functionality inside Editor Core.

## Current related evidence

P05 physical iPhone Safari Task 2 has demonstrated that generic NOTE/REST targeting can support the canonical editor flow without the earlier rest/Paste viewport failure: NOTE source range selection, REST destination targeting, Paste render, and exact Undo were observed successfully on the physical device.

That evidence supports the rendered-event targeting boundary. It is **not** audio evidence and must not be reused as an audio PASS.
