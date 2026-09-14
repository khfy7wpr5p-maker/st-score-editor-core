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

## P08-E2: responsive professional range toolbar

`score-editor-browser-professional-ui-v1` composes the P08-E1 bridge with the existing mobile teacher viewport/controller instead of introducing another document controller.

The first visible professional slice deliberately reuses the already-proven semantic teacher range gesture:

```text
select event/note
      -> Capture Range Start
      -> select different current-revision event/note
      -> professional range is ready
      -> Clear / ±8
      -> reconstruct current EventAddressV3 endpoints by canonical event id
      -> P08-E1 EVENT_SPAN
      -> P08-D mutation
      -> existing browser snapshot-adoption boundary
      -> EditorHistoryV4
```

### Visible behavior

- Desktop: a compact professional range bar is rendered above the status area.
- Mobile: `Clear` is injected into the existing safe-area-aware teacher toolbar rather than stacking another bottom bar.
- The professional bar also exposes octave transpose on desktop.
- Buttons are at least 44 CSS px and use `touch-action: manipulation`.
- Controls remain disabled until the existing semantic teacher range is complete.

### Clear/Delete semantics

`Clear` means the P08-B3 rhythm-preserving professional clear profile: selected pitched events become rests while their event ids, onsets and durations remain unchanged. It is not structural time deletion.

Exactly one accepted Clear action creates one `EditorHistoryV4` revision. The existing mobile teacher range and the hidden professional selection are cleared after the action, so the UI cannot accidentally carry a stale range into the next edit.

### Authority and failure policy

- Range start/end identities come only from current `SemanticAddressV3` event/note selection.
- Stored toolbar state keeps event ids only as transient UI references; each mutation reconstructs and validates current-revision `EventAddressV3` endpoints before authoring.
- DOM/SVG coordinates never become authoring evidence.
- The toolbar has no score mutation implementation of its own; it calls P08-E1/P08-D.
- Incomplete or stale ranges fail closed before canonical mutation.
- `EditorHistoryV4` remains sole history authority.
- Renderer authority, DOM authoring authority and network authority remain false.

### Production bundle boundary

P08-E2 is an optional browser professional UI controller/package. It is intentionally **not yet imported into the existing `STScoreEditorApp` production global entry**. The current production bundle is already close to its qualified size ceiling, so P08 does not weaken or silently re-baseline that release budget. A later integration step must either prove the existing bundle still fits unchanged or expose the professional UI through a separately qualified extension artifact.

## Next UI work

The next professional UI slice should add structure editing controls for key signature, clef, meter and frame barline/repeat using the P08-E1 structure methods. Those controls must derive staff/frame targets from current semantic selection and must remain separate from renderer coordinate authority.
