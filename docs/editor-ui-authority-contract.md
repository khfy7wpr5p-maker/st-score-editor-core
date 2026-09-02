# Editor UI Authority Contract — E7-A / SEC-NE current reality

The editor UI is a command/authoring-intent surface, not musical authority.

## Authoritative paths

Existing-score selection path:

```text
browser / pointer / keyboard / mobile input
  -> presentation hit / opaque render token
  -> current E3 SemanticAddress + SelectionSnapshot
  -> typed score / notation / keypad / selected-rest note-entry intent
  -> canonical validation + atomic transaction
  -> immutable accepted revision
  -> unified history
  -> new RenderRequest
```

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
- accessibility focus state.

This state is presentation/interaction state only.

## Canonical state the UI may reference but not invent

- `SemanticAddress`;
- `SelectionSnapshot`;
- `InsertionPosition`;
- current document/revision identity;
- current RenderRequest identity and opaque hit tokens;
- typed editor/action/authoring intents.

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
- stale `RendererRequest`;
- Guitar Workspace fingering/voicing result;
- OMR/AI suggestion output.

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

- mouse hit -> opaque token -> canonical selection -> typed intent;
- keyboard navigation -> canonical selection/insertion movement -> typed intent;
- iPhone touch -> visual hit -> opaque token or canonical insertion candidate -> current semantic identity -> typed intent.

Viewport changes, responsive reflow, orientation changes and renderer rerenders may invalidate visual geometry but may not silently retarget canonical semantic identity.

## Stale state

Every mutable intent is bound to the current document/revision either directly or through its semantic target.

If the canonical revision changes before execution:

- stale selection fails closed;
- stale insertion position fails closed;
- stale notation evidence fails closed;
- stale render requests fail closed;
- automatic retargeting is forbidden.

After an accepted edit, selection may only be rebound deterministically by stable canonical entity identity to the new revision; otherwise it must be safely cleared.

## Renderer boundary

The renderer may:

- engrave/present the current RenderRequest;
- perform visual hit testing;
- return an opaque hit token associated with the exact current render request.

The renderer may not:

- supply canonical `SemanticAddress` as trusted edit authority;
- mutate score/notation state;
- decide writable timing gaps;
- own editor history;
- infer a target when hit testing is ambiguous.

## Production boundary

Core UI/editor work does not itself activate public uploads, persistence, publication, remote write APIs, live AI edit authority or production deployment.

SesliTab/other hosts orchestrate the core and rendering layers but may not introduce a second score model or dual-write mutation path.
