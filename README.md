# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for ST score products.

## Current reality

The bounded SEC-NE authoring program is **COMPLETE / MERGED through SEC-NE-09**. The approved SCORE-SCHEMA-EXPANSION program has now entered implementation.

- **SSE-00 — COMPLETE / MERGED:** vNext score/notation contract and migration policy frozen and explicitly approved.
- **SSE-01 — COMPLETE / MERGE CANDIDATE:** additive v2 score, notation, addressing and guarded migration substrate.
- **SSE-02 — NEXT:** cut one editor session over to one canonical v2 score+notation pair without parallel mutable v1/v2 authority.

## SSE-01 dual-version substrate

Version 1 remains supported and unchanged. SSE-01 adds separate public contracts rather than broadening v1 exact-key unions:

- `score-model-v2` — `ScoreDocumentV2 2.0.0`, including voice-owned canonical `graceGroups`;
- `addressing-v2` — revision-bound `2.0.0` addresses including `grace-group`, `grace-event` and `grace-note`;
- `notation-structure-v2` — `NotationDocumentV2 2.0.0`, typed articulation/ornament vocabularies and grace notation collections;
- `schema-migration-v1-v2` — deterministic migration and loss-guarded downgrade.

A pure v1 -> v2 conversion preserves document, revision and source identity, leaves normal timed events unchanged, initializes `graceGroups`, articulations, ornaments and grace notation as empty collections, and does not pretend a musical edit occurred.

A v2 -> v1 downgrade is allowed only when every v2-only semantic is empty. Grace material, articulations, ornaments or grace notation produce typed `DOWNGRADE_UNREPRESENTABLE` evidence with exact loss paths rather than being discarded.

Grace material is not a zero-duration timed event. It remains canonical but outside normal measure occupancy, anchored to an exact normal event in the same voice.

## Active editor runtime boundary

SSE-01 provides dual-version validation/migration substrate only. Existing editor session/history/browser/SesliTab composition still operates on the v1 canonical pair until SSE-02 explicitly cuts a session over to v2. No session may maintain independently mutable v1 and v2 canonical states.

## Authority and dependencies

Canonical musical state remains versioned `ScoreDocument`; notation remains same-revision `NotationDocument`. MusicXML/OMR/Guitar remain exchange/evidence/derivative state. Renderer and SesliTab remain noncanonical.

Runtime dependencies remain only `saxes@6.0.0` and `xmlchars@2.2.0`. SSE-01 adds no dependency and does not activate persistence, network/server authority, production/public write, staff/part topology or E8-D external Guitar engine invocation.
