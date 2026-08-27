# Editor UI Authority Contract — E7-A

The editor UI is a command-intent surface, not musical authority.

## Authoritative path

```text
browser input
  -> optional E6 render hit token
  -> E3 semantic selection
  -> typed UI intent
  -> E4/E7 command transaction
  -> deterministic validation
  -> immutable accepted revision
  -> render request
```

## UI-owned state

The UI may own active tool, viewport/zoom, hover, focus, inspector open/closed state, pending form text and status/error presentation.

## Forbidden authority

The following may never independently authorize or commit a score edit:

- DOM/SVG ids;
- x/y coordinates or drag geometry;
- renderer-local note/glyph objects;
- toolbar state;
- inspector draft values;
- browser storage;
- keyboard shortcut identity;
- stale SelectionSnapshot or RendererRequest.

No UI module may directly mutate `ScoreDocument` or `NotationDocument`. A valid current semantic selection and a typed bounded transaction are required.

## Stale state

Every edit intent is bound to document id and revision id. If the canonical revision changes before execution, the intent fails closed. Automatic re-targeting is forbidden.

## Production boundary

E7 core UI work does not activate ScoreMosaic, public uploads, persistence, publication, remote write APIs or AI edit authority. ScoreMosaic composition begins only at the E7-G human gate.
