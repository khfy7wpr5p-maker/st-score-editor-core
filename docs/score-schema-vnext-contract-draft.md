# Score / Notation vNext Contract Draft

Status: **DESIGN FREEZE CANDIDATE — NOT ACTIVE RUNTIME SCHEMA**

This document defines the proposed vNext public model for grace notes, articulations and ornaments. Existing 1.0.0 runtime contracts remain authoritative until a later approved implementation stage.

## Versioning decision

The proposed public versions are:

- `ScoreDocumentV2.schemaVersion = "2.0.0"`;
- `NotationDocumentV2.contractVersion = "2.0.0"`.

Version 2 is intentionally not accepted by v1 validators. Silent mixed-version acceptance is forbidden.

## ScoreDocumentV2

All existing root/part/staff/measure fields remain semantically unchanged. The first v2 score change is at `Voice`.

```ts
interface VoiceV2 {
  readonly id: EntityId;
  readonly ordinal: number;
  readonly events: readonly ScoreEvent[];       // normal timed events, unchanged
  readonly graceGroups: readonly GraceGroup[]; // non-occupancy canonical grace material
}
```

### GraceGroup

```ts
type GracePlacement = 'before' | 'after';

interface GraceGroup {
  readonly id: EntityId;
  readonly anchorEventId: EntityId;
  readonly placement: GracePlacement;
  readonly events: readonly GraceEvent[];
}
```

Rules:

- group must contain at least one grace event;
- `anchorEventId` must resolve to a normal timed event in the **same voice**;
- at most one grace group may exist for one `(anchorEventId, placement)` pair;
- grace groups do not consume normal measure occupancy;
- deleting an anchor without an explicit grace-group resolution is rejected;
- moving an anchor within the admitted same-voice scope retains its grace groups by identity;
- cross-voice/cross-measure anchor migration is not inferred;
- grace groups cannot recursively contain grace groups.

### GraceEvent

Grace events have stable semantic identity and written value but no normal timeline onset/duration.

```ts
interface GraceEventBase {
  readonly id: EntityId;
  readonly writtenDuration: Rational;
  readonly playback: GracePlaybackSpec;
}

interface GraceNoteEvent extends GraceEventBase {
  readonly kind: 'note';
  readonly note: NoteAtom;
}

interface GraceRestEvent extends GraceEventBase {
  readonly kind: 'rest';
}

interface GraceChordEvent extends GraceEventBase {
  readonly kind: 'chord';
  readonly notes: readonly NoteAtom[];
}

type GraceEvent = GraceNoteEvent | GraceRestEvent | GraceChordEvent;
```

`writtenDuration` is a positive reduced rational representing the written note value. It is **not** normal measure occupancy.

Chord rules remain consistent with normal chords: at least two unique note atoms, all IDs globally unique.

### GracePlaybackSpec

MusicXML can describe grace playback using time stealing or explicit make-time behavior. The canonical model normalizes that information without storing MusicXML `divisions`.

```ts
interface GracePlaybackSpec {
  readonly stealTimePreviousPercent: Rational | null;
  readonly stealTimeFollowingPercent: Rational | null;
  readonly makeTime: Rational | null;
}
```

Rules:

- percentages are reduced rationals in the closed range 0..100;
- `makeTime` is a non-negative normalized score-time rational, never raw MusicXML divisions;
- conflicting timing modes that cannot be interpreted deterministically are rejected by import;
- the editor may create a neutral value with all fields `null`;
- playback policy does not alter normal `Voice.events` occupancy.

## SemanticAddress vNext

New canonical identities require explicit address kinds:

```text
grace-group
grace-event
grace-note
```

Each address remains bound to:

- contract version;
- document ID;
- revision ID;
- part/staff/measure/voice ancestry;
- exact grace group and nested entity IDs.

No renderer coordinate may substitute for these addresses.

## NotationDocumentV2

V2 keeps existing measure/event/note notation and extends event-level notation. Grace entities receive parallel, explicitly typed notation collections.

### Event notation

```ts
interface EventNotationV2 {
  readonly dots: number;
  readonly beams: readonly BeamSpec[];
  readonly tuplet: TupletSpec | null;
  readonly articulations: readonly ArticulationSpec[];
  readonly ornaments: readonly OrnamentSpec[];
}
```

Articulations and ornaments are attack/event notation. A normal chord has one event-level articulation/ornament set rather than duplicated semantic state on every chord tone.

### Grace event notation

```ts
interface GraceEventNotation {
  readonly slash: boolean;
  readonly dots: number;
  readonly beams: readonly BeamSpec[];
  readonly articulations: readonly ArticulationSpec[];
  readonly ornaments: readonly OrnamentSpec[];
}
```

Grace note-level notation reuses accidental/tie/slur semantics in a grace-specific address collection.

```ts
interface GraceNoteNotation {
  readonly accidental: AccidentalDisplay | null;
  readonly ties: readonly BoundaryMark[];
  readonly slurs: readonly BoundaryMark[];
}
```

V2 root collections therefore include the existing arrays plus:

```text
graceEvents[]
graceNotes[]
```

There is no separate mutable grace notation authority outside `NotationDocumentV2`.

## ArticulationSpec

The first frozen vocabulary is finite and typed:

```text
accent
strong-accent
staccato
tenuto
detached-legato
staccatissimo
spiccato
scoop
plop
doit
falloff
breath-mark
caesura
stress
unstress
soft-accent
```

Proposed shape:

```ts
type Placement = 'auto' | 'above' | 'below';

interface ArticulationSpec {
  readonly kind: ArticulationKind;
  readonly placement: Placement;
  readonly direction: 'up' | 'down' | null;
}
```

Rules:

- `direction` is admitted only where the articulation vocabulary supports it (initially strong accent); otherwise it must be null;
- duplicate semantically identical articulation specs on one event are rejected;
- source forms outside the admitted vocabulary fail closed;
- `other-articulation` is not a generic canonical escape hatch.

## OrnamentSpec

Ornaments use a discriminated union so simple marks are not confused with numbered spanning relations.

### Simple ornaments

Admitted kinds in the design:

```text
trill-mark
turn
delayed-turn
inverted-turn
delayed-inverted-turn
vertical-turn
inverted-vertical-turn
shake
mordent
inverted-mordent
schleifer
haydn
```

```ts
interface OrnamentAccidentalMark {
  readonly accidental: AccidentalDisplay;
  readonly placement: Placement;
}

interface SimpleOrnamentSpec {
  readonly kind: SimpleOrnamentKind;
  readonly placement: Placement;
  readonly accidentalMarks: readonly OrnamentAccidentalMark[];
}
```

### Tremolo

```ts
interface TremoloOrnamentSpec {
  readonly kind: 'tremolo';
  readonly type: 'single' | 'start' | 'stop';
  readonly marks: number;
  readonly number: number | null;
  readonly placement: Placement;
}
```

A start/stop tremolo must use a validated relation number; a single-note tremolo must not fabricate a relation endpoint.

### Wavy line

```ts
interface WavyLineOrnamentSpec {
  readonly kind: 'wavy-line';
  readonly type: 'start' | 'continue' | 'stop';
  readonly number: number;
  readonly placement: Placement;
}
```

Start/continue/stop relationships must be validated across current semantic event identities. Broken or ambiguous relation chains fail closed.

`other-ornament` is intentionally not canonical in the initial v2 contract.

## Canonical vs notation boundary

| Semantic | Authority |
|---|---|
| normal pitch/onset/duration | `ScoreDocumentV2` |
| grace note/chord/rest identity and order | `ScoreDocumentV2` |
| grace anchor | `ScoreDocumentV2` |
| grace written duration | `ScoreDocumentV2` |
| normalized grace playback timing | `ScoreDocumentV2` |
| grace slash/beam/dots | `NotationDocumentV2` |
| accidentals/ties/slurs | `NotationDocumentV2` |
| articulations | `NotationDocumentV2` |
| ornaments | `NotationDocumentV2` |
| renderer placement/coordinates | renderer only, noncanonical |

## History and mutation rules

Any editor operation touching score and notation remains one atomic history commit.

Examples:

- deleting an anchor event with a grace group: reject unless operation explicitly handles the group;
- deleting a grace note targeted by notation: notation must be removed/rebound atomically or reject;
- copying a grace group: every group/event/note ID must be fresh and the destination anchor explicit;
- retiming an anchor: grace group identity follows the anchor only when the anchor remains the same canonical event;
- undo/redo restores the exact score + notation pair.

## Migration rules

### v1 -> v2

```text
Voice.events stays byte-semantically identical
Voice.graceGroups = []
EventNotation.articulations = []
EventNotation.ornaments = []
graceEvents = []
graceNotes = []
```

No musical data is invented.

### v2 -> v1

Allowed only when:

- every `graceGroups` array is empty;
- every articulation array is empty;
- every ornament array is empty;
- all future v2-only topology/relation content is empty.

Otherwise return a typed `DOWNGRADE_UNREPRESENTABLE` error with exact paths/reasons.

## MusicXML mapping

### Grace

MusicXML `<note><grace .../></note>` maps to a canonical grace event and does not create a normal timed duration. Source sequence determines grace order; surrounding normal note stream determines the anchor only when unambiguous under the importer profile.

The importer normalizes:

- `slash` -> grace event notation;
- `steal-time-previous` -> normalized grace playback rational;
- `steal-time-following` -> normalized grace playback rational;
- `make-time` -> normalized score-time rational using active divisions.

Ambiguous anchoring or unsupported combinations reject.

### Articulations

`<notations><articulations>...</articulations></notations>` maps to `ArticulationSpec[]` for the canonical event attack.

### Ornaments

`<notations><ornaments>...</ornaments></notations>` maps to the typed ornament union. Unknown ornament forms are rejected; no silent omission.

## Compatibility constraints

- existing v1 serializer/importer behavior must not broaden silently;
- v2 MusicXML uses a separate explicit profile/API until migration/cutover is complete;
- existing SEC-NE note entry/timing/copy/retime tests remain required;
- Guitar Workspace must either explicitly ignore v2-only content with proven safe projection policy or reject it; it may not silently alter canonical semantics;
- SesliTab host remains a single-session orchestrator;
- renderer manifests must add exact new semantic tokens rather than infer grace targets from geometry.

## Open implementation decisions that do not alter this model

The following may be chosen during SSE-01/SSE-03 without changing the authority model:

- exact TypeScript package placement for V2 types/migrators;
- internal indexing implementation;
- command names and UI labels;
- renderer glyph layout;
- performance playback engine behavior when all grace playback fields are null.

Any proposal to move grace identity out of canonical score state, make renderer state authoritative, silently downgrade v2 semantics, or reuse normal timed events with zero duration is a contract change and requires a new architecture decision.
