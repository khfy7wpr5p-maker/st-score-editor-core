# P08-E — Browser / UI Professional Integration

P08-E connects the already-proven P08 professional workstation semantics to browser-facing product surfaces without moving canonical authority into renderer geometry or DOM state.

## P08-E1: browser professional bridge

`score-editor-browser-professional-v1` attaches to the existing `StandaloneScoreEditorController` and exposes the P08-D professional workstation operations to a browser host.

The bridge does not create a second score or history authority. The existing browser controller still owns the active `ScoreEditorAppDocument`, whose `EditorSessionV4` / `EditorHistoryV4` remains canonical for browser editing.

```text
StandaloneScoreEditorController
        |
        | current ScoreEditorAppDocument
        v
Browser Professional Bridge
        |
        +-- EVENT_SPAN / EVENT_SET selection (noncanonical, revision-bound)
        +-- octave transpose
        +-- Clear/Delete -> REST
        +-- key signature / clef
        +-- propagation-safe time signature
        +-- frame barline / repeat
        +-- existing topology authority
        |
        v
P08-D Professional Workstation
        |
        v
existing semantic authoring engines
        |
        v
EditorSessionV4 / EditorHistoryV4
```

### Selection lifetime

Professional range/set selection is deliberately noncanonical and lives only in the bridge.

- Creating or changing a professional selection does not create history.
- Successful professional bulk edits use the P08-D rebinding result, so the selection follows the new canonical revision.
- If another browser-controller edit changes the canonical revision outside the professional bridge, the bridge clears its professional selection rather than carrying stale addresses forward.
- Structure/topology operations use the P08-D rules and therefore clear professional selection where the workstation contract requires it.

This prevents a renderer or UI range from becoming a parallel score identity system.

### Adoption boundary

A successful P08-D professional operation returns a validated `ScoreEditorAppDocument`. The bridge hands that document back through the existing browser controller's validated snapshot-adoption boundary. This preserves the browser controller as the one mounted document surface while retaining the complete `EditorHistoryV4` chain.

If adoption fails, the bridge reports an explicit error and clears revision-bound professional selection.

### UI policy

P08-E1 is the programmatic browser integration layer. It intentionally does not yet add dense professional controls to the compact mobile shell. P08-E2 should add a small responsive professional toolbar/inspector that derives targets only from current `SemanticAddressV3` selections and calls this bridge. DOM/SVG coordinates must remain presentation-only.
