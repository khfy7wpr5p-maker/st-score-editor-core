# P10-2C — Exact 4:3 Tuplet Core / Session Mutation

Status: **EXACT 4:3 CORE + SESSION MUTATION IMPLEMENTED / QUALIFICATION PENDING / BROWSER AUTHORING NOT AUTHORIZED**

P10-2C adds a bounded canonical inverse mutation for one profile only:

- exactly four explicit current-revision events;
- exact `4:3` tuplet notation;
- same part/staff/frame/measure/Voice;
- fresh P10-2B admission inside every mutation call;
- exact straight-four event timing copied from P10-2B evidence;
- exact adjacent-neutral-rest action copied from P10-2B evidence.

## Authority

Canonical mutation package:

`editor-four-to-three-tuplet-unretiming-authoring-v4`

Unified session package:

`editor-session-four-to-three-tuplet-unretiming-v4`

P10-2B remains analysis-only. Its canonical mutation and history mutation authority flags remain false.

The existing APP-11J / P10-2 exact 3:2 mutation path is unchanged.

## Mutation contract

One admitted action:

1. validates one exact four-target intent;
2. runs P10-2B admission fresh on the current canonical revision;
3. copies the four admitted onset/duration plans exactly;
4. removes only the owned 4:3 tuplet metadata;
5. applies exactly one admitted adjacent-rest action:
   - `REMOVE_ADJACENT_REST`, or
   - `SHRINK_ADJACENT_REST_FORWARD`;
6. preserves target event/note identity and score topology;
7. validates the resulting canonical pair;
8. returns the first target event rebound to the new revision.

No cached admission evidence is accepted by the public mutation API.

## History

`EditorHistoryV4` remains the sole history authority.

One accepted P10-2C session action creates one unified history revision. Exact Undo restores the original 4:3 score + notation pair, including the original adjacent rest and tuplet marks. Exact Redo restores the straight-four pair.

Rejected actions commit nothing.

## Fail-closed boundary

P10-2C inherits P10-2B rejection for stale/reordered/cross-scope targets, unsupported ratio/boundary, nested/overlapping tuplets, unsupported written bases, dots, beams, ties, selected cross-staff timing, missing/insufficient adjacent rest, and bounded arithmetic failure.

Renderer DOM/SVG/coordinates/tokens are never timing or target authority.

## MusicXML

Imported MusicXML exact 4:3 content uses the same canonical mutation path. Regression evidence preserves imported event IDs, note IDs and `score.source` metadata. The tested result remains representable through the existing V4 renderer projection; no new parser or export authority was added.

## Explicitly not authorized

- generalized `n:m` tuplet mutation;
- arbitrary ratios or cardinalities;
- nested tuplets;
- cross-staff selected tuplet mutation;
- dot/beam/tie-aware unretiming;
- multi-rest balancing;
- measure growth;
- browser authoring;
- optional workstation controls/artifact;
- production/default release;
- public write;
- SesliTab cutover;
- Render/deploy changes.

Browser/product exposure remains a separate design gate.
