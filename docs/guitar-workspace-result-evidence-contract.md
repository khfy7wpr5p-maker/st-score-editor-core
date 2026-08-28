# E8-C — Guitar Workspace Result Evidence Contract

## Status

E8-C validates a host/test-supplied `CanonicalTabResult 2.0.0` artifact and converts only verified facts into immutable derivative Guitar Workspace state.

E8-C does **not** invoke `musicxml-to-guitar-tab-engine`, does not add a network/process/package bridge, and does not authorize canonical score mutation.

## Core problem

The reviewed external `CanonicalTabResult 2.0.0` contract carries source-model metadata and deterministic `sourceEventId` values, but it does not carry ST Score Editor Core `documentId`, ST `revisionId`, or an ST projection hash.

Therefore this is unsafe:

```text
sourceEventId matches
→ trust external string/fret result
```

The same deterministic source-event id pattern can exist after a score revision changes. E8-C must prove that the returned source facts still describe the current canonical score.

## Input boundary

E8-C accepts a **JSON string only**.

- maximum encoded size: 16 MiB;
- invalid/empty/oversized JSON fails closed;
- arbitrary JavaScript objects are not accepted;
- accessors, proxies, shared references and prototype tricks therefore do not cross the ingestion boundary;
- parsed objects must use exact admitted field sets.

## Current-revision proof

The caller does not supply an authoritative projection object.

E8-C receives:

```text
ScoreDocument(current revision)
NotationDocument(same revision)
CanonicalTabResult JSON
```

It re-derives the current E8-B projection internally. The external result is accepted only if its copied source-model facts match that current projection/canonical revision exactly.

Validated source facts include:

- `P1` part identity;
- measure id/index/number;
- divisions and time signature;
- expected measure duration;
- exact source-event count/order/id;
- note/rest type;
- voice/staff;
- onset/duration divisions;
- pitch spelling and MIDI;
- tie start/stop;
- source location and chord-with-previous flag.

A stale result therefore fails even if some source ids happen to remain textually identical.

## Reviewed external contract locks

E8-C currently locks the reviewed engine surface to:

- document type: `CanonicalTabResult`;
- schema: `2.0.0`;
- engine name: `musicxml-to-guitar-tab-engine`;
- source document: `PolyphonicSourceModel`;
- source contract: `1.0.0`;
- MusicXML source version: `4.0`;
- part id: `P1`;
- guitar contract: `1.0.0`;
- standard six-string tuning;
- fret range: `0..20`;
- final-selection policy: `STATIC_ATTACK_PATH_LEXICOGRAPHIC_1.0`;
- final-selection version: `1.0.0`.

Policy drift fails closed rather than being accepted as semantically equivalent.

## Polyphonic result validation

After current source facts are proven, E8-C validates the result graph needed by the workspace.

### Simultaneous groups

Expected attack groups are independently derived from current projected note onsets. The returned group count, order, ids, onset, measure and source membership must match exactly.

### Arrangement decisions

Every current source note must be covered exactly once. Decision ids and order are deterministic. `CHORD_REDUCED` membership must equal the referenced simultaneous group; other initial decision types cover one source note and use no group id.

### Note dispositions

Dispositions must remain in exact source-note order and link to their covering decision.

- `PRESERVED` → `KEEP`, zero octave shift, `PRESERVE_IN_REGISTER`;
- `OCTAVE_DISPLACED` → `KEEP`, non-zero multiple-of-12 shift, `OCTAVE_NEAREST_IN_REGISTER`;
- `OMITTED` → `OMIT`, null target/position/shape, `OMIT_EXPLICIT`;
- `CHORD_REDUCED` → retained or omitted members with the approved chord-reduction rules.

Target pitch must preserve source pitch-class spelling and match the declared octave shift.

### Guitar positions

For every retained note:

```text
open-string MIDI + fret == selected target MIDI
```

String must be `1..6`, fret `0..20`, and simultaneous retained notes may not select the same string.

### Selected shapes

A selected shape is required exactly for each simultaneous group retaining at least two notes. Singleton retained groups must not carry a selected shape id.

Shape membership/order, finger assignments, open-string finger zero, fretted-note finger requirement, barre span/kind/matching assignments and physical status are checked fail closed.

## Output boundary

Accepted output is an immutable `GuitarWorkspaceResult 1.0.0` containing:

- current ST document/revision identity;
- engine name/version as evidence;
- reported teacher review state;
- derivative note dispositions mapped to current canonical `NoteAddress` targets;
- derivative selected-shape/finger/barre facts.

The output does not expose a canonical mutation method.

## Teacher review state

`NOT_REVIEWED`, `APPROVED`, or `REJECTED` may be reported by the external result contract. E8-C preserves the value as evidence only.

`APPROVED` does not grant:

- canonical edit authority;
- publication authority;
- persistence authority;
- production authority;
- bypass of E4/E7-E1 transactions.

## Human gate after E8-C

The next boundary is direct engine invocation. That is **not authorized by E8-C**.

Before any E8-D implementation, a human decision must freeze:

- local package / process / service topology;
- exact engine artifact/version provenance;
- timeout/cancellation/resource ownership;
- request/result byte limits;
- stale revision behavior while conversion is running;
- network/process permissions;
- production/deployment authority.

Repository CI success does not authorize that boundary.
