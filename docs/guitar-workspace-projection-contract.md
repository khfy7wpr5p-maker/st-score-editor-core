# E8-B — Guitar Workspace MusicXML + Source-map Projection

## Status

E8-B implements the deterministic projection boundary prepared by E8-A. It creates an engine-compatible MusicXML document and the revision-bound `GuitarWorkspaceSourceMap` **during the same canonical traversal**.

E8-B still does not invoke `musicxml-to-guitar-tab-engine`, ingest `CanonicalTabResult`, activate production, persist user data or grant reverse canonical write authority.

## Why this stage exists

The external Guitar TAB Engine derives source identities from MusicXML source order:

```text
<partId>:measure:<measureIndex>:note:<sourceOrder>
```

ST canonical entity IDs are not embedded in MusicXML `<note>` elements. Generating XML first and reconstructing identity later from pitch, coordinates, DOM nodes or heuristics would therefore create an unsafe ambiguity boundary.

E8-B removes that ambiguity. Every emitted `<note>` is assigned its engine `sourceEventId` at emission time and immediately paired with the current canonical semantic address.

## Initial admitted source scope

The projection deliberately matches the reviewed external polyphonic MusicXML profile at `musicxml-to-guitar-tab-engine` main SHA `93abe9735a4ed70ad8362ac24ec39869ea34607f`:

- MusicXML `score-partwise`;
- exactly one part;
- one or two staves;
- at most 2,000 measures;
- at most 50,000 emitted source events;
- deterministic engine part id `P1`;
- bounded divisions, maximum 16,384;
- canonical pitch preserved exactly;
- canonical onset/duration represented exactly in divisions;
- multiple voices represented through `backup` / `forward`;
- canonical chord events represented by consecutive source notes with `<chord/>` on later tones;
- rests represented as source `<note><rest/></note>` events;
- tie start/stop facts preserved as direct `<tie>` elements;
- measure time signature required directly or through prior canonical notation inheritance.

The initial projection rejects:

- multipart scores;
- staff 3+;
- misaligned staff measures;
- missing initial time signature;
- conflicting aligned-staff time signatures;
- same-voice overlapping events that cannot be expressed by the admitted deterministic stream writer;
- events extending beyond the active measure duration;
- timing that requires divisions above the admitted bound;
- stale or invalid notation revisions.

## Engine-specific notation filtering

E8-B is not the normal notation-export serializer. It is a narrow source-fact projection for the external guitar engine.

The reviewed external semantic profile rejects or does not model several presentation/notation constructs that ST core can represent. Therefore E8-B intentionally omits these from the engine projection:

- key signature;
- clef;
- barlines/repeats;
- accidental display metadata;
- dots;
- beams;
- tuplet display/time-modification markers;
- slurs.

This omission does not change canonical state. Pitch spelling and exact rational timing remain canonical and are preserved in the projected XML. Tie start/stop facts are retained because they affect sustained polyphony.

The full E5 notation serializer remains unchanged and continues to serve notation/rendering exchange. E8-B is a separate derivative adapter surface.

## Deterministic source mapping

For each emitted source note:

```text
engine sourceEventId
    ↓ same traversal
canonical SemanticAddress
```

Mapping rules:

- canonical single note event → canonical `note` address;
- each tone of a canonical chord event → its own canonical `note` address;
- canonical rest event → canonical `event` address.

`sourceOrder` resets to zero at each measure and increments only for emitted MusicXML `<note>` elements. `attributes`, `backup` and `forward` do not increment it.

The resulting map is passed through the E8-A one-to-one source-map validator, so stale revisions, duplicate engine source IDs and duplicate canonical targets still fail closed.

## Authority boundary

The output is a derivative projection only:

```text
ScoreDocument + NotationDocument
        ↓
E8-B projection
        ├─ engine-safe MusicXML
        └─ revision-bound source map
```

There is no reverse arrow to canonical state.

Future engine output may reference this source map for traceability, but it cannot mutate `ScoreDocument` directly. Any later canonical edit must still be expressed as an existing typed, revision-bound editor intent and accepted through the normal E4/E7-E1 transaction path.

## E8-B acceptance boundary

E8-B is complete only when:

1. MusicXML and source map are produced in the same deterministic traversal;
2. note/chord/rest source ordering is regression-tested;
3. multi-voice `backup` behavior is deterministic;
4. one/two-staff normalization is tested;
5. pitch, exact timing and tie facts are preserved;
6. unsupported engine notation constructs are not emitted;
7. stale/multipart/overlap/out-of-measure cases fail closed;
8. no third-party dependency or external engine invocation is added;
9. Node 18/20/22 CI passes.

## Next safe gate

The next bounded stage should validate an actual external `CanonicalTabResult 2.0.0` against the E8-B projection/source map and create a **read-only derivative Guitar Workspace result model**. That stage must still have no canonical score mutation authority.
