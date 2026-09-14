# P08-D — Professional Workstation Controller

P08-A through P08-C established separate proven semantic engines for selection, bulk authoring, score-structure notation and topology. P08-D adds one app-facing orchestration surface without moving canonical authority out of those engines.

## State

`ScoreEditorProfessionalWorkstationV1` contains:

- the current immutable `ScoreEditorAppDocument`;
- optional noncanonical `ProfessionalSelectionV1` (`EVENT_SPAN` or `EVENT_SET`).

Professional selection is intentionally outside `ScoreDocumentV3`, `NotationDocumentV4` and `EditorHistoryV4`.

## Unified operations

The workstation exposes one state transition surface for:

- cross-measure / discontiguous professional selection;
- octave transpose;
- rhythm-preserving Clear/Delete-to-REST;
- staff-local key signature;
- staff-local clef;
- frame-global propagation-safe time signature;
- frame-owned barline/repeat marks;
- existing part/staff/topology intents;
- Undo / Redo.

## Delegation, not duplication

The workstation performs orchestration only:

```text
UI / host
   -> ProfessionalWorkstationV1
       -> ProfessionalSelectionV1
       -> professional bulk admission/authoring packages
       -> professional structure packages
       -> existing topology authoring V3/V4
       -> EditorHistoryV4
```

It does not implement a second score mutation engine. Time-signature admission remains in the propagation-aware meter package; topology remains in `editor-topology-authoring-v3/v4`; bulk pitch and Clear remain in their respective professional packages.

## Selection lifetime

- successful bulk operations return a rebased professional selection on the new revision;
- structural edits, topology edits and Undo/Redo clear professional selection because the prior revision-bound addresses are stale;
- explicit selection clear has no history authority and does not mutate the document.

This gives a browser/UI layer a predictable rule: never carry an old revision selection through an unrelated structural transition.

## App-document behavior

The controller preserves document title, origin and saved revision identity. `dirty` is recalculated from the new session revision against `savedRevisionId`, matching `ScoreEditorAppDocument` semantics.

## Next layer

The next step is browser/UI integration: expose this workstation controller through the browser app and bind the existing editor shell tools (`select`, `clef`, `time-signature`, `key-signature`, `barline`) plus professional bulk actions to semantic targets. UI code must remain a command surface only; renderer hit evidence resolves into current semantic addresses before any authoring operation.
