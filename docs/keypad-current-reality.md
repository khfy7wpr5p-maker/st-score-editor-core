# SEC-KP-00 — Keypad Current Reality and Semantic Gap Freeze

Date: 2026-09-01
Baseline reviewed: `main@63bfede0fc8e42ba3c6e86d29a9991bd69add269`
Scope: documentation-only semantic freeze; no runtime behavior change.

## Fresh-read result

- Default branch is `main`; the reviewed HEAD is `63bfede0fc8e42ba3c6e86d29a9991bd69add269` (`E8-C: read-only CanonicalTabResult evidence ingestion (#20)`).
- No open pull requests or issues were observed during the fresh read.
- The latest `main` CI run for the reviewed HEAD completed successfully.
- The GitHub branch-protection endpoint was not readable by the installed integration. Repository rulesets returned an empty list. This document therefore does not claim that branch protection is enabled or disabled; development continues through branch + PR + CI regardless.
- Runtime dependencies remain exactly `saxes@6.0.0` and `xmlchars@2.2.0`; build-only dependencies remain `esbuild@0.28.2` and `typescript@6.0.3`.
- The browser runtime remains local-only: no network, persistence, renderer, server-revision, approval, or publication authority.

## Canonical duration semantics

`ScoreEvent.duration` is a positive, reduced `Rational`. MusicXML notation serialization converts a rational duration into MusicXML units as:

`durationUnits = rational * 4 * divisions`

Therefore the frozen simple-value keypad mappings are:

| Musical value | Canonical Rational |
| --- | --- |
| whole | `1/1` |
| half | `1/2` |
| quarter | `1/4` |
| eighth | `1/8` |
| 16th | `1/16` |
| 32nd | `1/32` |

The score-model validator requires positive reduced duration rationals but does not enforce a time-signature-based measure-fill invariant. It also does not reject same-voice overlap. The E5 notation serializer separately rejects same-voice overlap and rejects timing that requires MusicXML divisions above its admitted bound.

### Augmentation dots

Dots are revision-bound notation metadata (`EventNotation.dots`, admitted range `0..3`). They are not canonical timing authority.

Repository tests establish that canonical duration already contains the effective temporal duration while dots describe notation presentation: an event with canonical duration `3/8` and `dots: 1` serializes the same `3/8` timing plus one `<dot/>` marker. Therefore a keypad action that changes a dotted note value must keep canonical duration and dot metadata mutually consistent; changing only `SET_DOTS` is not sufficient when the intended musical duration changes.

For a base duration `B`, the admitted exact total durations are frozen as:

- 0 dots: `B`
- 1 dot: `3/2 * B`
- 2 dots: `7/4 * B`
- 3 dots: `15/8 * B`

All results must be reduced canonical rationals before entering E4.

### Tuplets

Tuplet notation is stored as `TupletSpec { actualNotes, normalNotes, marks }` on an event. The serializer emits `<time-modification>` from this metadata, but the event's exact canonical `duration` remains the timing authority. Existing repository evidence uses an event duration of `1/12` with a `3:2` tuplet marker, confirming the separation between exact canonical timing and tuplet notation metadata.

Consequences for the keypad contract:

- `SET_TUPLET` alone may change notation metadata but must not be treated as sufficient to create a musically complete triplet correction when event timing must also change.
- Triplet creation/removal needs explicit deterministic event/range semantics plus timing validation.
- Nearest-event, SVG-proximity, or renderer-coordinate grouping is forbidden.

## Score and notation transaction reality

### Existing score path

`EditorScoreIntent` is runtime validated and currently supports:

- `SET_PITCH`
- `SET_DURATION`
- `REPLACE_WITH_REST`
- `REPLACE_REST_WITH_NOTE`
- `ADD_CHORD_TONE`
- `REMOVE_CHORD_TONE`

It delegates to the E4 edit transaction layer. E4 transactions are atomic and support up to 256 score commands in one revision.

### Existing notation path

`EditorNotationIntent` is runtime validated and currently supports:

- `SET_TIME_SIGNATURE`
- `SET_KEY_SIGNATURE`
- `SET_CLEF`
- `SET_BARLINES`
- `SET_DOTS`
- `SET_BEAMS`
- `SET_TUPLET`
- `SET_ACCIDENTAL`
- `SET_TIES`
- `SET_SLURS`

It delegates to E7-E1 notation transactions. E7-E1 transactions are atomic and support up to 256 notation commands in one revision.

### Cross-layer atomicity gap

The score and notation transaction systems are individually atomic but they are separate revision-producing paths. The session controller exposes separate `commitSessionScoreIntent` and `commitSessionNotationIntent` methods. There is currently no public primitive that can apply score commands and notation commands as one user action with one shared revision.

A Sibelius-style keypad therefore requires an additive bounded composite transaction/orchestration layer. It must:

1. validate one semantic keypad action against the current revision-bound selection;
2. construct all required score and notation mutations before commit;
3. reject the entire candidate if either side is invalid;
4. produce exactly one new canonical revision and one notation document bound to that same revision;
5. commit exactly one unified history snapshot;
6. never expose a partially committed score-only or notation-only intermediate revision.

Existing E4 and E7-E1 validation/apply logic should be reused where possible, but their present public functions cannot simply be called sequentially because each creates its own revision.

## Accidental correction freeze

Canonical pitch is `Pitch { step, alter, octave }`. `SET_ACCIDENTAL` changes only `NoteNotation.accidental` display metadata.

Therefore:

- `accidental.sharp`, `accidental.flat`, and `accidental.natural` keypad correction actions must explicitly define the canonical `Pitch.alter` result.
- A display accidental must never be presented as a pitch correction by itself.
- If the action requires both canonical pitch alteration and explicit accidental display metadata, both belong to one composite revision.
- V1 must not guess an enharmonic respelling or change `step`/`octave`; it changes only the explicit alteration policy frozen for the selected note.

V1 canonical alteration policy:

- flat -> `alter = -1`, display `flat`
- natural -> `alter = 0`, display `natural`
- sharp -> `alter = 1`, display `sharp`

Double-flat/double-sharp remain outside V1 keypad scope even though the notation model can represent them.

## Rest correction freeze

`REPLACE_EVENT_WITH_REST` preserves event id, onset, and current duration. A rest-duration keypad press may need both event replacement and a duration change. Those operations already exist as E4 commands and can be placed in one E4 transaction, but the high-level keypad action does not yet exist.

If the selected event is already a rest, only the duration change is required. If it is note/chord, replacement plus duration change must be atomic.

## Selection continuity reality

Current successful score and notation commits clear `session.selection` and `session.inspector`. Undo/redo also clears selection.

Safe keypad chaining requires an additive post-commit rebind rule:

- never reuse the old `SemanticAddress` with its stale revision id;
- retain the selected stable entity id only as a re-resolution key;
- after a successful revision, call canonical addressing against the new score and rebuild a fresh address/snapshot only if the exact entity still exists with the expected kind;
- if replacement/deletion changes or removes the selected entity identity and no exact successor is explicitly produced, clear selection;
- any ambiguity clears selection;
- undo/redo continue to clear selection in V1.

The existing E4 `REPLACE_EVENT_WITH_REST` preserves the event id, so an event-level selection can be deterministically rebound. A note-level selection does not survive note/chord -> rest replacement and must be cleared unless a later explicit successor contract is introduced.

## Renderer/editor authority boundary

The existing renderer request/hit-manifest design already has the correct authority direction:

1. Editor Core emits a revision-bound render request and opaque hit manifest.
2. Rendering Layer performs visual hit testing.
3. Host returns an opaque hit token.
4. Editor Core resolves the token against the current render request.
5. The resulting revision-bound `SemanticAddress` is the only edit target.

DOM ids, SVG coordinates, renderer objects, glyph codepoints, and `ScoreNoteRef`-style visual references are not canonical identity.

## SMuFL / Bravura freeze

Editor Core must own semantic descriptor metadata only. It must not bundle Bravura, VexFlow, Smoosic, CSS, or another renderer/editor.

A keypad descriptor may optionally carry a verified SMuFL glyph name. Raw guessed private-use codepoints are not admitted. Glyph availability or font failure must not change the semantic action or its accessible label.

No new dependency is required for SEC-KP-00/01. If an external SMuFL metadata package is later proposed, dependency/license/provenance review is a human stop gate.

## Frozen capability gaps

| Capability | Existing primitive | Keypad status |
| --- | --- | --- |
| simple duration | `SET_DURATION` | ready for semantic mapping |
| note -> rest | `REPLACE_WITH_REST` | needs high-level rest+duration composition |
| rest duration | `SET_DURATION` | ready for semantic mapping |
| flat/natural/sharp pitch correction | `SET_PITCH` + `SET_ACCIDENTAL` | needs cross-layer composite revision |
| dots 0..3 | `SET_DOTS` | needs canonical duration consistency policy |
| triplet metadata | `SET_TUPLET` | primitive exists; complete correction needs explicit group/timing semantics |
| tie | `SET_TIES` | primitive exists; keypad needs explicit endpoints |
| slur | `SET_SLURS` | primitive exists; keypad needs explicit endpoints |
| repeated keypad edits | session controller | blocked by selection clearing; deterministic rebind needed |
| browser keypad surface | browser runtime | additive manifest + bounded commit entry point needed |
| real SMuFL glyph drawing | host/UI | intentionally outside Editor Core |

## Public-contract impact

SEC-KP-00 introduces no public runtime contract change.

Future keypad work must be additive. Existing E7/E8 public functions and authority constraints stay valid. A new keypad package/runtime surface may be added without changing the meaning of current score intents, notation intents, history, render-token selection, Guitar Workspace evidence, or browser safety properties.

## Exit gate

SEC-KP-00 is frozen when this document and the machine-readable capability matrix are merged with CI green. No runtime behavior change is part of this work package.
