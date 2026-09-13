# P06-G — SDK Rollout Feature Flags

Status: implementation candidate

Date: 2026-09-13

## Purpose

P06 optional integrations use two independent gates:

1. **capability availability** — the current SDK build actually provides the integration,
2. **rollout flag** — the host explicitly requests that optional integration.

An optional feature is enabled only when both are true. A flag can never manufacture a capability.

## Optional feature ids

- `renderer`
- `files`
- `recovery`
- `playback`
- `teacherWorkflow`
- `audioAudition`

All rollout flags default to `false`.

## State model

Each feature resolves to one of:

- `FLAG_DISABLED` — capability may or may not exist, but rollout is not requested,
- `CAPABILITY_UNAVAILABLE` — host requested the feature, but this SDK build does not provide it,
- `ENABLED` — host requested the feature and the SDK provides it.

This separation prevents silent fallback and false capability claims.

## P06-F interaction

`audioAudition` remains capability-unavailable while P06-F is blocked by the external Audio Engine distribution gate. Setting `audioAudition: true` therefore resolves to `CAPABILITY_UNAVAILABLE`; it does not import an unpublished audio package and does not create a local substitute contract.

## Authority

The rollout gate has no canonical score authority. Reading flag state must not change document identity, revision identity, selection, history, export state, or canonical semantics.

The rollout gate is a host-level admission mechanism only. Canonical edits remain owned by `EditorSessionV4` and semantic targets remain revision-bound.
