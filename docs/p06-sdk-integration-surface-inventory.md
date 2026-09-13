# P06 SDK integration-surface inventory

Status: P06-A inventory complete for stacked product head `b6760566dc7a84621b6e949c08f4fffef09dbc79`.

This document is intentionally read-only in architectural scope. It records the integration surfaces that already exist before P06 adds a public SDK contract. It does not create new mutation authority, change the SesliTab integration, or authorize release/cutover.

## Authority baseline

P06 must preserve these existing boundaries:

- `ScoreDocumentV3` + `NotationDocumentV4` remain the canonical score pair used by the current app path.
- `EditorSessionV4` remains the single unified history/mutation authority.
- `SemanticAddressV3` remains the semantic selection identity.
- renderer, viewport, playback, file/recovery and future audio state are noncanonical capabilities.
- stale revision/render evidence fails closed; renderer DOM/SVG coordinates are not authoring authority.
- presentation-only work must not create history revisions.

## Existing integration surfaces

### 1. Low-level browser runtime

Files:

- `packages/browser-runtime/src/index.ts`
- `packages/browser-runtime/src/global-entry.ts`

Current public-shaped symbols:

- `BROWSER_RUNTIME_VERSION`
- `browserRuntimeProfile`
- `createBrowserRuntime()`
- global `STScoreEditorCoreRuntime`

The runtime exposes low-level document/session construction, render-token selection, score/notation commits, keypad and note-entry helpers. It is versioned at `1.0.0`, but it is not the current V4 standalone product controller. Its profile explicitly denies production, network, persistence, renderer, server-revision, approval and publication authority.

Classification: **legacy/low-level integration surface; do not make this the P06 canonical host facade.** Keep backward compatibility unless a separately approved breaking migration is introduced.

### 2. Standalone browser app controller

File:

- `packages/score-editor-browser-app/src/index.ts`

Current core symbols:

- `SCORE_EDITOR_BROWSER_APP_VERSION`
- `standaloneBrowserAppProfile`
- `createStandaloneScoreEditorController()`
- `StandaloneScoreEditorController`
- `ScoreEditorBrowserAppSnapshot`

The controller already provides the reusable core lifecycle and application operations:

- `getSnapshot()` / `getDocument()`
- `subscribe()`
- `mount()` / `unmount()`
- `newDocument()` / `openMusicXml()` / `adoptValidatedSnapshot()`
- `exportMusicXml()` / `markSaved()`
- semantic `select()`
- `undo()` / `redo()`
- existing bounded V4 authoring commits

The controller delegates canonical edits into the existing app-document / `EditorSessionV4` path rather than owning a second score state.

Classification: **primary P06 reuse candidate.** P06 should wrap/narrow this surface, not replace its canonical mutation path.

### 3. Standalone browser global/product composition

Files:

- `packages/score-editor-browser-app/src/global-entry.ts`
- `packages/score-editor-browser-app/src/mobile-teacher-viewport.ts`
- `scripts/build-browser.mjs`

Current global:

- `STScoreEditorApp`

Important fact: the global currently instantiates `createMobileTeacherViewportStandaloneBrowserAppRuntime()`, i.e. the end of the product feature-composition chain, not the minimal base controller. The browser build manifest therefore describes a bundled standalone product with file/recovery, renderer lifecycle/hit bridge, viewport, playback, export/print, release hardening, authoring features, teacher workflow, mobile toolbar and mobile viewport.

Classification: **standalone product bundle, not the generic P06 SDK contract.** P06 must not equate “bundled in `STScoreEditorApp`” with “required host capability”.

### 4. File capability

Files:

- `packages/score-editor-browser-app/src/file-enabled.ts`
- `packages/score-editor-browser-file-workflow/src/index.ts`

Existing controller capability includes local `.musicxml` / `.xml` open, picker integration, save, download fallback, explicit file association state and feature detection. Compressed MXL is explicitly unsupported in the current P04 boundary.

Classification: **optional host capability.** Failure/unavailability must not disable canonical in-memory editing.

### 5. Recovery capability

Files:

- `packages/score-editor-browser-app/src/recovery-enabled.ts`
- `packages/score-editor-browser-recovery-storage/src/index.ts`
- `packages/score-editor-app-recovery/src/index.ts`

Recovery is browser-local IndexedDB state with explicit preparation/application and revision guards. It explicitly has no canonical authority and no automatic restore authority. Its coordinator is disposed during its `unmount()` override.

Classification: **optional persistence/recovery capability; never canonical authority.** SDK capability negotiation must report it independently from file support.

### 6. Renderer lifecycle capability

Files:

- `packages/score-editor-browser-app/src/renderer-enabled.ts`
- `packages/renderer-contract-v4/src/index.ts`
- `packages/renderer-osmd/src/index.ts`

Existing renderer lifecycle supports explicit host attach/detach and explicit `renderCurrent()`. It records rendered document/revision identity, clears stale presentation after canonical revision changes, rejects stale async render completion, and unsubscribes its own subscription during `unmount()`.

Classification: **optional presentation capability.** Renderer state cannot authorize canonical mutation.

### 7. Generic renderer-hit / semantic-selection bridge

Files:

- `packages/score-editor-browser-app/src/renderer-hit-enabled.ts`
- `packages/editor-renderer-selection-bridge-v4/src/index.ts`
- `packages/editor-renderer-selection-bridge-v4/src/generic-rendered-event.ts`

Existing current P05 path includes generic rendered NOTE/REST targeting. `selectRenderedScoreEventRef()` first requires a current accepted renderer presentation and resolves renderer evidence to a current `SemanticAddressV3`. The selection-only invariant checks that revision and history lengths do not change.

Classification: **optional renderer-selection capability and strong model for P06 stale-evidence behavior.** Do not expose DOM/SVG identity as a public canonical target.

### 8. Playback capability

Files:

- `packages/score-editor-browser-app/src/playback-enabled.ts`
- `packages/playback-plan-v1/src/index.ts`
- `packages/playback-web-audio/src/index.ts`

Existing playback is local browser Web Audio, plan-derived from `ScoreDocumentV3`, noncanonical and not coupled to edit admission. It stops/disposes its transport when revision identity changes and during `unmount()`.

Classification: **optional existing playback capability.** It is not the future ST Score Audio Engine audition contract and must not be repurposed into one implicitly.

### 9. Teacher workflow facade

File:

- `packages/score-editor-browser-app/src/teacher-workflow.ts`

Existing commands include revision-bound copy snapshot, bounded neutral-rest paste overwrite, bounded insert-after-event and octave-only transpose. Mutations route through existing app-document / `EditorSessionV4` operations.

Classification: **optional higher-level workflow capability.** It should not become the foundational SDK mutation authority.

### 10. Product-specific SesliTab host surfaces

Files:

- `packages/seslitab-editor-host/src/index.ts`
- `packages/seslitab-editor-host-v2/src/index.ts`
- `docs/seslitab-editor-integration-contract.md`

The V2 host is tied to older V2 session/document types and explicitly identifies itself as a SesliTab product host.

Classification: **product-specific compatibility surface; excluded from the generic P06 facade.** The active SesliTab freeze remains in force and P06 must not repin or modify that integration.

## Existing version/capability patterns to reuse

The repository already has a consistent family of version constants and frozen profile objects, for example:

- `BROWSER_RUNTIME_VERSION`
- `SCORE_EDITOR_BROWSER_APP_VERSION`
- `FILE_ENABLED_BROWSER_APP_VERSION`
- `RECOVERY_ENABLED_BROWSER_APP_VERSION`
- `RENDERER_ENABLED_BROWSER_APP_VERSION`
- `RENDERER_HIT_ENABLED_BROWSER_APP_VERSION`
- `PLAYBACK_ENABLED_BROWSER_APP_VERSION`
- `TEACHER_WORKFLOW_BROWSER_VERSION`

P06 should consolidate these into a public negotiated capability view rather than inventing unrelated parallel booleans or another mutation controller.

## Lifecycle finding

The current feature chain uses `mount()` / `unmount()` composition, but there is no uniform terminal `dispose()` contract at the base controller level.

Observed cleanup is uneven:

- renderer unsubscribes its revision listener and clears presentation on `unmount()`;
- recovery disposes its autosave coordinator on `unmount()`;
- playback disposes transport on `unmount()`;
- some wrappers subscribe to the base controller without retaining/calling the returned unsubscribe function (for example current file/teacher workflow composition paths).

Therefore P06-C must introduce an idempotent terminal `dispose()` semantics at the SDK boundary and conformance tests for repeated lifecycle cycles. `unmount()` should remain reusable presentation detachment; `dispose()` should be terminal host cleanup. This must be implemented without adding a second canonical history/state owner.

## Minimal P06 public-surface proposal

P06-B should expose one small versioned generic host contract built on the existing standalone V4 controller path.

Proposed conceptual surface:

```ts
interface ScoreEditorSdkV1 {
  readonly version: '1.0.0';
  readonly capabilities: ScoreEditorSdkCapabilitiesV1;
  readonly getSnapshot: () => ScoreEditorSdkSnapshotV1;
  readonly subscribe: (listener: ScoreEditorSdkListenerV1) => () => void;
  readonly mount: (root: HTMLElement) => ScoreEditorSdkResultV1<void>;
  readonly unmount: () => ScoreEditorSdkResultV1<void>;
  readonly dispose: () => ScoreEditorSdkResultV1<void>;
  readonly document: ScoreEditorSdkDocumentCapabilityV1;
  readonly history: ScoreEditorSdkHistoryCapabilityV1;
  readonly selection: ScoreEditorSdkSelectionCapabilityV1;
  readonly authoring: ScoreEditorSdkAuthoringCapabilityV1;
  readonly renderer?: ScoreEditorSdkRendererCapabilityV1;
  readonly files?: ScoreEditorSdkFileCapabilityV1;
  readonly recovery?: ScoreEditorSdkRecoveryCapabilityV1;
  readonly playback?: ScoreEditorSdkPlaybackCapabilityV1;
  readonly teacherWorkflow?: ScoreEditorSdkTeacherWorkflowCapabilityV1;
}
```

This shape is normative only at the architectural level until P06-B contract tests pin exact TypeScript names.

### Required contract rules

1. Every public surface reports a contract version.
2. Capability presence is explicit. A host must not infer support from DOM/global shape.
3. Unsupported optional capabilities return typed capability errors or are absent according to one documented rule; they must not globally block safe editing.
4. All canonical mutations delegate to the existing V4 app/controller/session paths.
5. SDK snapshot identity includes exact current document/revision identity where a document is open.
6. Requests carrying document/revision/render evidence reject stale identity; no automatic retargeting.
7. `mount`/`unmount` affect host presentation only; `dispose` performs terminal listener/resource cleanup and does not create a history revision.
8. Repeated `dispose` is safe and deterministic; post-dispose mutating/lifecycle calls fail with one typed `SDK_DISPOSED` error.
9. Renderer, playback, recovery and future audio capabilities are independently attachable/degradable.
10. No SesliTab-specific type or internal private-path import is required by the generic example.

## Public vs internal recommendation

Safe public candidates:

- versioned immutable SDK metadata/capabilities;
- stable snapshot/document/revision identity;
- lifecycle (`mount`, `unmount`, terminal `dispose`);
- document open/new/export through existing app controller;
- semantic selection through `SemanticAddressV3`-compatible validated input;
- undo/redo and existing bounded authoring commands routed through V4;
- independently negotiated renderer/file/recovery/playback/teacher-workflow capabilities.

Keep internal/private in P06:

- renderer DOM/SVG IDs and geometry;
- renderer-local objects as edit identity;
- direct mutation of score/notation documents outside existing controllers;
- direct `EditorSessionV4` history replacement by hosts;
- IndexedDB implementation details;
- playback transport/audio-context internals;
- SesliTab-specific host wrappers;
- future ST Score Audio Engine implementation and duplicated `AuditionRequest` types.

## Audio seam (P06-F preparation only)

P06 may reserve an optional capability key/attachment point for future audio audition, but it must not define a competing audio request schema or implementation before the external `st-score-audio-engine` package publishes its green versioned contract. Existing browser playback remains a separate capability.

## P06-A exit gate

PASS for inventory/proposal purposes when this document is reviewed against the exact stacked product head and CI for the documentation branch is green.

P06-B may then implement the smallest typed contract necessary to prove version negotiation, typed results/errors, current document/revision identity, capability reporting and preservation of `EditorSessionV4` mutation authority. P06-C lifecycle implementation should follow as a separately reviewable step if it changes controller cleanup semantics.
