# Roadmap

## Current source of truth

This file records repository reality. Planned or human-gated capability is not production capability.

## Completed bounded program

- **E0–E7-H — COMPLETE**
- **E8-A/B/C — IMPLEMENTED**
- **E8-D — HUMAN-GATED / NOT AUTHORIZED**
- **SEC-KP-00–10 — COMPLETE**
- **SEC-NE-00–07 — COMPLETE / MERGED** within documented bounded profiles.
- **SEC-NE-XML-ROUNDTRIP — COMPLETE / MERGED.**
- **SEC-NE-08 — COMPLETE / MERGED:** derivative Guitar/TAB authoring companion.
- **SEC-NE-09 — COMPLETE / MERGE CANDIDATE:** single-session SesliTab host integration.

## SEC-NE-09 exact capability

`seslitab-editor-host/1.0.0` composes the product-host boundary around one existing `EditorSessionState`.

- one canonical editor session only;
- exact current render token selection;
- score/notation/keypad/note-entry/history delegation to existing session-controller paths;
- pointer/keyboard/touch converge on identical semantic operations;
- rejected operations return typed errors and do not create fallback mutation;
- playback ownership is separate from editor admission;
- no renderer/DOM coordinate mutation authority;
- no host dual-write;
- no network/persistence/server-revision/publication/production authority.

## Human-gated future work

The bounded autonomous authoring program is complete. Remaining work requires explicit public-contract/product authority decisions:

- grace-note identity/timing schema;
- articulations;
- ornaments;
- whole staff/part topology and cross-staff correspondence;
- E8-D direct external Guitar engine invocation;
- production/public-write, persistence and deployment activation.

## Still fail-closed

- schema-absent advanced notation;
- reverse Guitar/TAB write into canonical score;
- stale result/address reuse;
- renderer-coordinate authoring;
- host dual-write;
- production activation by merge.

`ScoreDocument` remains canonical; notation is same-revision authority; Guitar state remains derivative-only; renderer and host state remain noncanonical.
