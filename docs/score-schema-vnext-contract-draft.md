# Score / Notation vNext Contract

Status: **FROZEN / APPROVED — SSE-01 DUAL-VERSION SUBSTRATE IMPLEMENTED; V2 EDITOR SESSION CUTOVER PENDING SSE-02**

This document is the approved public model for grace notes, articulations and ornaments. Version-2 validators, addressing and migration exist additively after SSE-01; existing editor session/browser/SesliTab mutation paths remain on v1 until SSE-02.

## Versioning decision

Public versions are:

- `ScoreDocumentV2.schemaVersion = "2.0.0"`;
- `NotationDocumentV2.contractVersion = "2.0.0"`;
- `SemanticAddressV2.contractVersion = "2.0.0"`.

Version 2 is intentionally not accepted by v1 validators. Silent mixed-version acceptance is forbidden.

## ScoreDocumentV2

All existing root/part/staff/measure fields remain semantically unchanged. The first v2 score change is at `Voice`.

```ts
interface VoiceV2 {
  readonly id: EntityId;
  readonly ordinal: number;
  readonly events: readonly ScoreEvent[];
  readonly graceGroups: readonly GraceGroup[];
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

- group contains at least one grace event;
- `anchorEventId` resolves to a normal timed event in the same voice;
- at most one grace group exists for one `(anchorEventId, placement)` pair;
- grace groups do not consume normal measure occupancy;
- deleting an anchor without explicit grace-group resolution is rejected;
- moving an anchor within admitted same-voice scope retains its grace groups by identity;
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

`writtenDuration` is a positive reduced rational representing the written note value. It is not normal measure occupancy.

Chord rules remain consistent with normal chords: at least two note atoms and globally unique entity IDs.

### GracePlaybackSpec

```ts
interface GracePlaybackSpec {
  readonly stealTimePreviousPercent: Rational | null;
  readonly stealTimeFollowingPercent: Rational | null;
  readonly makeTime: Rational | null;
}
```

Rules:

- percentages are reduced rationals in closed range 0..100;
- `makeTime` is a non-negative normalized score-time rational, never raw MusicXML divisions;
- unsupported/conflicting timing modes reject at import;
- editor-created neutral grace playback may use all-null fields;
- playback metadata never changes normal `Voice.events` occupancy.

## SemanticAddressV2

New canonical identity kinds:

```text
grace-group
grace-event
grace-note
```

Each address is bound to contract version, document ID, revision ID, part/staff/measure/voice ancestry and exact nested grace IDs. No renderer coordinate may substitute for semantic addressing.

The v1 address union remains unchanged.

## NotationDocumentV2

V2 keeps existing measure/event/note notation and extends event-level notation. Grace entities receive explicit notation collections.

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
interface GraceEventNotationV2 {
  readonly slash: boolean;
  readonly dots: number;
  readonly beams: readonly BeamSpec[];
  readonly articulations: readonly ArticulationSpec[];
  readonly ornaments: readonly OrnamentSpec[];
}
```

Grace note-level notation reuses accidental/tie/slur semantics under a grace-specific address.

```ts
interface GraceNoteNotationV2 {
  readonly accidental: AccidentalDisplay | null;
  readonly ties: readonly BoundaryMark[];
  readonly slurs: readonly BoundaryMark[];
}
```

V2 root collections add `graceEvents[]` and `graceNotes[]`. There is no separate mutable grace notation authority.

## ArticulationSpec

Frozen initial vocabulary:

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

```ts
type PlacementV2 = 'auto' | 'above' | 'below';

interface ArticulationSpec {
  readonly kind: ArticulationKind;
  readonly placement: PlacementV2;
  readonly direction: 'up' | 'down' | null;
}
```

`direction` is initially admitted only for strong accent. Duplicate identical specs reject. Unsupported vocabulary rejects. `other-articulation` is not a canonical escape hatch.

## OrnamentSpec

Ornaments use a discriminated union.

### Simple ornaments

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
  readonly placement: PlacementV2;
}

interface SimpleOrnamentSpec {
  readonly kind: SimpleOrnamentKind;
  readonly placement: PlacementV2;
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
  readonly placement: PlacementV2;
}
```

Single tremolo carries no relation number. Start/stop forms require a validated relation number and complete endpoints.

### Wavy line

```ts
interface WavyLineOrnamentSpec {
  readonly kind: 'wavy-line';
  readonly type: 'start' | 'continue' | 'stop';
  readonly number: number;
  readonly placement: PlacementV2;
}
```

Broken or ambiguous relation chains fail closed. `other-ornament` is not canonical in the initial v2 contract.

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

- anchor deletion with a grace group rejects unless the operation explicitly resolves the group;
- deleting a grace note targeted by notation removes/rebinds notation atomically or rejects;
- copying grace material requires fresh group/event/note IDs and an explicit destination anchor;
- retiming an anchor retains grace identity only while the canonical anchor event identity survives;
- undo/redo restores the exact score + notation pair.

## Migration rules

### v1 -> v2

```text
Voice.events unchanged
Voice.graceGroups = []
EventNotation.articulations = []
EventNotation.ornaments = []
graceEvents = []
graceNotes = []
```

Document/revision/source identity is preserved for pure schema conversion. No musical data is invented.

### v2 -> v1

Allowed only when all v2-only content is empty. Otherwise throw typed `DOWNGRADE_UNREPRESENTABLE` with exact loss paths. Silent downgrade loss is forbidden.

SSE-01 implements and tests both directions.

## MusicXML mapping

### Grace

MusicXML `<note><grace .../></note>` maps to canonical grace material and does not create a normal timed duration. Source order determines grace order. Surrounding normal note stream determines the anchor only when unambiguous under the admitted importer profile.

The future v2 importer normalizes slash to grace notation, steal-time percentages to canonical rationals, and make-time from active divisions into normalized score time. Ambiguous anchoring rejects.

### Articulations

`<notations><articulations>...</articulations></notations>` maps to `ArticulationSpec[]` for the event attack.

### Ornaments

`<notations><ornaments>...</ornaments></notations>` maps to the typed ornament union. Unknown forms reject rather than disappear.

## Compatibility constraints

- existing v1 serializer/importer behavior must not broaden silently;
- v2 MusicXML uses a separate explicit profile/API until migration/cutover is complete;
- existing SEC-NE regressions remain required;
- Guitar Workspace must explicitly reject or safely project v2-only content; it may not silently alter canonical semantics;
- SesliTab remains a single-session orchestrator;
- renderer manifests add exact semantic tokens rather than infer grace targets from geometry.

## Implementation status

SSE-01 has implemented the separate v2 score/notation/addressing validators and migration substrate. SSE-02 is responsible for the canonical editor-session cutover. SSE-03/04/05 add authoring only after that single-version session boundary exists.

Any proposal to move grace identity out of canonical score state, make renderer state authoritative, silently downgrade v2 semantics, or reuse normal timed events with zero duration is a contract change and requires a new architecture decision.
