# P06 versioned generic SDK contract

Status: P06-E conformance/migration contract for SDK `1.0.0`.

This document defines the reusable public boundary created by P06. It does not authorize production release, SesliTab cutover, protected-branch merge, or a second score/history authority.

## Public entry

Generic consumers use only:

- `packages/score-editor-sdk-v1/public.ts`

Consumers must not depend on `score-editor-browser-app`, `score-editor-app-document`, `EditorSessionV4`, renderer internals, recovery storage internals, or SesliTab host packages.

## Version negotiation

The negotiation contract is `1.0.0` and currently supports SDK contract `1.0.0`.

A host submits an ordered bounded `acceptedVersions` set. Negotiation succeeds only when the current supported contract is explicitly accepted. Otherwise it returns a typed `INCOMPATIBLE_SDK_VERSION`; malformed/empty requests return `INVALID_VERSION_REQUEST`.

There is no silent fallback to an unrequested version.

## Canonical authority

The SDK is an integration boundary, not a score authority.

- `ScoreDocumentV3` + `NotationDocumentV4` remain the canonical score pair.
- `EditorSessionV4` remains the unified history authority.
- `SemanticAddressV3` remains exact semantic identity.
- Public canonical mutations delegate to existing V4 controller/session operations.
- Public consumers do not receive the underlying controller, app document or session as mutation escape hatches.
- One accepted canonical edit continues to create one unified history revision according to the admitted operation contract.

## Revision-bound requests

Operations that act on an existing document require the current `{ documentId, revisionId }` guard.

- stale document or revision identity returns `STALE_REQUEST`;
- automatic retargeting is forbidden;
- semantic target enumeration is read-only and revision-bound;
- presentation identities, coordinates, SVG/DOM ids and renderer-local objects are never accepted as canonical edit identity.

## Capability negotiation

The base SDK exposes document, history, semantic selection and bounded authoring. Renderer, files, recovery, playback, teacher workflow and audio audition remain optional capabilities.

Optional capability absence is local: `UNSUPPORTED_CAPABILITY` must not globally block safe canonical editing.

Audio audition is a separate capability from playback. P06 does not import an audio implementation into Editor Core.

## Lifecycle

The generic host lifecycle is headless and presentation-only:

- `mount(host)` attaches one version-compatible host;
- `update()` explicitly asks the mounted host to refresh;
- `unmount()` detaches the host but keeps the SDK reusable;
- `dispose()` is terminal and idempotent, clears SDK-managed subscriptions, detaches any host and rejects later mutations/lifecycle actions with `SDK_DISPOSED`.

Host/subscriber callback failures are recorded as diagnostics and cannot retroactively invalidate a canonical mutation that already succeeded.

Lifecycle operations must not create score-history revisions.

## Public conformance rules

A conforming host:

1. imports only the public SDK entry;
2. negotiates/validates the contract version rather than inferring support from globals or DOM shape;
3. checks capabilities before depending on optional behavior;
4. carries exact document/revision guards for revision-bound operations;
5. treats semantic target addresses as revision-bound values;
6. never derives canonical identity from renderer geometry;
7. allows renderer/playback/recovery/audio failures to degrade independently;
8. disposes subscriptions and host resources deterministically;
9. does not access server/publication authority through the SDK because none is granted;
10. does not couple generic integration code to SesliTab.

## Migration policy

SDK `1.x` changes are additive only unless a separately approved breaking-contract change is created.

Allowed within `1.x`:

- new optional capabilities that default to unavailable;
- new result/error codes for newly introduced operations;
- additive immutable fields whose absence is explicitly tolerated by older consumers;
- new public helpers that do not bypass existing canonical/session authority.

Not allowed within `1.x` without a separately approved breaking change:

- removal or renaming of existing public fields/operations;
- changing an existing field's meaning or authority;
- changing a previously optional capability into an unconditional host requirement;
- weakening stale-revision fail-closed behavior;
- exposing direct mutable score/session/history ownership;
- converting presentation/audio state into canonical authority.

Once an external product consumes the public SDK, incompatible changes require a new major contract plus an explicit migration path and approval. Backward-compatible support remains the default.

## Neutral example

`examples/p06-generic-sdk-host.mjs` demonstrates the intended consumer path through the public entry only:

- mount a neutral host;
- create/export a seed score;
- open MusicXML;
- enumerate and select a revision-bound semantic event;
- perform one admitted canonical edit;
- undo through unified history;
- observe renderer/playback as independent unavailable capabilities;
- unmount and dispose.

The example contains no SesliTab-specific code and imports no private Editor Core package path.

## Release boundary

Passing P06 conformance tests means the generic SDK contract is development-green. It does not imply standalone release PASS, complete physical-device validation, teacher-pilot acceptance, SesliTab cutover authorization, or production deployment approval.
