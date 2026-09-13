# Editor UI Authority Contract — E7-A / SEC-NE current reality

The editor UI is a command/authoring-intent surface, not musical authority.

## Authoritative paths

Existing-score selection path:

```text
browser / pointer / keyboard / mobile input
  -> presentation hit / generic rendered-event evidence
  -> current renderEpoch/source evidence validation
  -> current E3 SemanticAddress + SelectionSnapshot
  -> typed score / notation / keypad / selected-rest note-entry intent
  -> canonical validation + atomic transaction
  -> immutable accepted revision
  -> unified history
  -> new RenderRequest
```

`NOTE` and `REST` may now arrive as bounded renderer-side target kinds through the generic rendered-event bridge. They are still presentation evidence only. Editor Core must resolve them against the current revision before any canonical action.

Insertion/cursor path:

```text
browser / pointer / keyboard / mobile gesture
  -> host resolves gesture against current semantic context
  -> revision-bound canonical InsertionPosition
  -> SEC-NE timing admission
  -> typed authoring intent
  -> atomic canonical mutation or fail closed
```

A gesture or coordinate may help the host choose a candidate semantic position, but the coordinate itself never authorizes the edit.

## UI-owned state

The UI may own:

- active tool/mode;
- viewport, zoom and scroll;
- hover/focus;
- inspector open/closed state;
- pending form text;
- temporary pointer/touch gesture state;
- status/error presentation;
- accessibility focus state;
- audition enabled/muted presentation state;
- selected audition instrument preference, such as Grand Piano or Classical Guitar.

This state is presentation/interaction state only.

## Canonical state the UI may reference but not invent

- `SemanticAddress`;
- `SelectionSnapshot`;
- `InsertionPosition`;
- current document/revision identity;
- current RenderRequest identity and opaque/generic rendered-event hit evidence;
- typed editor/action/authoring intents;
- validated canonical NOTE pitch used to form a bounded audio audition request.

The host may only use these values when they were created or validated against the current canonical revision.

## Forbidden authority

The following may never independently authorize or commit a score edit:

- DOM/SVG ids;
- x/y coordinates or drag geometry;
- renderer-local note/glyph objects;
- nearest-note guesses after an ambiguous hit;
- toolbar state;
- inspector draft values;
- browser storage;
- keyboard shortcut identity;
- pointer/touch event object identity;
- stale `SelectionSnapshot`;
- stale `InsertionPosition`;
- stale `RendererRequest` / stale render epoch;
- Guitar Workspace fingering/voicing result;
- OMR/AI suggestion output;
- AudioContext state, sample identity, decoded audio buffers or instrument-profile state.

No UI module may directly mutate `ScoreDocument` or `NotationDocument`.

## Current note-entry authority

### Selected-rest note entry

SEC-NE-02 exposes bounded selected-rest note entry through the existing session/browser composition. It requires a current exact rest event selection and commits through unified score+notation history.

### Position note entry

SEC-NE-04C is currently a low-level core primitive only. It consumes a current revision-bound `InsertionPosition` and may author only when SEC-NE-04A proves the full requested window lies inside one explicit rest.

No second public cursor-entry session/browser API is currently claimed.

Implicit gaps are not writable UI targets until SEC-NE-04B1/04B2 prove legal measure/voice silence independently of renderer geometry.

## Pointer, keyboard and mobile equivalence

Pointer, keyboard and mobile/touch input must converge on the same semantic command path. Separate platform-specific mutation semantics are forbidden.

Examples:

- mouse hit -> generic rendered NOTE/REST evidence -> canonical selection -> typed intent;
- keyboard navigation -> canonical selection/insertion movement -> typed intent;
- iPhone touch -> visual hit -> current generic rendered-event evidence -> current semantic identity -> typed intent.

Viewport changes, responsive reflow, orientation changes and renderer rerenders may invalidate visual geometry but may not silently retarget canonical semantic identity.

P05 physical iPhone Safari Task 2 has verified the current bounded NOTE/REST path for source-range selection, REST destination selection, Paste rendering and exact Undo without the earlier viewport displacement. This is interaction evidence only; it does not expand renderer authority.

## Stale state

Every mutable intent is bound to the current document/revision either directly or through its semantic target.

If the canonical revision changes before execution:

- stale selection fails closed;
- stale insertion position fails closed;
- stale notation evidence fails closed;
- stale render requests / rendered-event evidence fail closed;
- automatic retargeting is forbidden.

After an accepted edit, selection may only be rebound deterministically by stable canonical entity identity to the new revision; otherwise it must be safely cleared.

## Renderer boundary

The renderer may:

- engrave/present the current RenderRequest;
- perform visual hit testing;
- return bounded generic rendered-event evidence such as `NOTE` and `REST` associated with the exact current render request / render epoch;
- expose presentation-only highlight/cursor primitives.

The renderer may not:

- supply canonical `SemanticAddress` as trusted edit authority;
- mutate score/notation state;
- decide writable timing gaps;
- own editor history;
- infer a target when hit testing is ambiguous;
- own Web Audio, playback transport, sample selection or audition state.

## Audio audition boundary

One-note audition is a noncanonical consumer path and remains separate from edit authority.

Planned flow:

```text
current NOTE touch/selection
  -> current rendered NOTE evidence
  -> current SemanticAddressV3
  -> exact canonical NOTE pitch
  -> immutable AuditionRequest
  -> external st-score-audio-engine
  -> sound
```

Rules:

- `REST` may be selected but produces no audition request;
- audio failure must not invalidate an otherwise valid selection;
- audition must not create an `EditorSessionV4` history revision;
- Grand Piano is the first instrument profile; Classical Guitar follows only after the piano path is stable;
- instrument choice is UI/audio preference only unless a future explicit canonical instrument authoring feature is separately admitted;
- string/fret-aware guitar timbre may be used only from exact canonical guitar/TAB evidence, never screen geometry;
- Editor Core must consume the versioned public contract from `st-score-audio-engine` rather than create a second audio contract or engine.

See `docs/audio-engine-integration-boundary.md`.

## Production boundary

Core UI/editor work does not itself activate public uploads, persistence, publication, remote write APIs, live AI edit authority or production deployment.

SesliTab/other hosts orchestrate the core, rendering and optional audio layers but may not introduce a second score model or dual-write mutation path.
