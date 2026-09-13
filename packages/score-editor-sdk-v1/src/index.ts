import { addressEntityV3, type SemanticAddressV3 } from '../../addressing-v3/src/index.js';
import type { EditorKeypadAction } from '../../editor-keypad/src/index.js';
import type { EditorKeypadV4Options } from '../../editor-keypad-execution-v4/src/index.js';
import type {
  NewAppDocumentOptions,
  OpenMusicXmlAppDocumentOptions
} from '../../score-editor-app-document/src/index.js';
import {
  createStandaloneScoreEditorController,
  type NewScoreToolbarPreset,
  type ScoreEditorBrowserAppSnapshot,
  type StandaloneScoreEditorController
} from '../../score-editor-browser-app/src/index.js';

export const SCORE_EDITOR_SDK_V1_VERSION = '1.0.0' as const;
export const SCORE_EDITOR_SDK_RESULT_V1_VERSION = '1.0.0' as const;

export type ScoreEditorSdkCapabilityIdV1 =
  | 'document'
  | 'history'
  | 'selection'
  | 'authoring'
  | 'renderer'
  | 'files'
  | 'recovery'
  | 'playback'
  | 'teacherWorkflow'
  | 'audioAudition';

export const scoreEditorSdkCapabilitiesV1 = Object.freeze({
  version: SCORE_EDITOR_SDK_V1_VERSION,
  document: true,
  history: true,
  selection: true,
  authoring: true,
  renderer: false,
  files: false,
  recovery: false,
  playback: false,
  teacherWorkflow: false,
  audioAudition: false,
  canonicalAuthority: false,
  historyAuthority: 'EditorSessionV4' as const,
  semanticSelectionAuthority: 'SemanticAddressV3' as const,
  rendererCoordinateAuthority: false,
  networkAuthority: false,
  serverRevisionAuthority: false,
  publicationAuthority: false
});

export interface ScoreEditorSdkRevisionGuardV1 {
  readonly documentId: string;
  readonly revisionId: string;
}

export interface ScoreEditorSdkSnapshotV1 {
  readonly version: typeof SCORE_EDITOR_SDK_V1_VERSION;
  readonly hasDocument: boolean;
  readonly documentId: string | null;
  readonly revisionId: string | null;
  readonly title: string | null;
  readonly origin: string | null;
  readonly dirty: boolean;
  readonly selectionKind: string | null;
  readonly historyPastCount: number;
  readonly historyFutureCount: number;
  readonly statusCode: string;
  readonly statusMessage: string;
}

export interface ScoreEditorSdkSemanticTargetV1 {
  readonly entityKind: 'event' | 'note';
  readonly address: SemanticAddressV3;
}

export type ScoreEditorSdkErrorCodeV1 =
  | 'NO_DOCUMENT'
  | 'STALE_REQUEST'
  | 'UNSUPPORTED_CAPABILITY'
  | 'SDK_DISPOSED'
  | 'SDK_ALREADY_MOUNTED'
  | 'SDK_NOT_MOUNTED'
  | 'SDK_HOST_INVALID'
  | 'SDK_HOST_FAILURE'
  | 'SDK_OPERATION_FAILED';

export interface ScoreEditorSdkErrorV1 {
  readonly version: typeof SCORE_EDITOR_SDK_RESULT_V1_VERSION;
  readonly code: string;
  readonly message: string;
  readonly details: Readonly<Record<string, unknown>>;
}

export type ScoreEditorSdkResultV1<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: Readonly<ScoreEditorSdkErrorV1> };

export interface ScoreEditorSdkNewDocumentOptionsV1 {
  readonly title?: string;
  readonly preset?: NewScoreToolbarPreset;
  readonly idFactory?: () => string;
}

export interface ScoreEditorSdkOpenMusicXmlOptionsV1 {
  readonly title?: string;
  readonly documentId?: string;
  readonly revisionId?: string;
  readonly sha256Hex?: (text: string) => Promise<string>;
}

export interface ScoreEditorSdkKeypadCommitV1 {
  readonly expected: Readonly<ScoreEditorSdkRevisionGuardV1>;
  readonly action: Readonly<EditorKeypadAction>;
  readonly target?: unknown;
  readonly nextRevisionId?: string;
}

export type ScoreEditorSdkListenerV1 = (snapshot: Readonly<ScoreEditorSdkSnapshotV1>) => void;

export interface ScoreEditorSdkHostV1 {
  readonly contractVersion: typeof SCORE_EDITOR_SDK_V1_VERSION;
  readonly onMount: (snapshot: Readonly<ScoreEditorSdkSnapshotV1>) => void;
  readonly onUpdate: (snapshot: Readonly<ScoreEditorSdkSnapshotV1>) => void;
  readonly onUnmount: () => void;
}

export type ScoreEditorSdkLifecyclePhaseV1 = 'CREATED' | 'MOUNTED' | 'UNMOUNTED' | 'DISPOSED';

export interface ScoreEditorSdkLifecycleStateV1 {
  readonly version: typeof SCORE_EDITOR_SDK_V1_VERSION;
  readonly phase: ScoreEditorSdkLifecyclePhaseV1;
  readonly mounted: boolean;
  readonly disposed: boolean;
  readonly listenerErrorCount: number;
  readonly lastListenerError: Readonly<{ readonly code: string; readonly message: string }> | null;
  readonly lastHostError: Readonly<{ readonly code: string; readonly message: string }> | null;
}

export interface ScoreEditorSdkV1 {
  readonly version: typeof SCORE_EDITOR_SDK_V1_VERSION;
  readonly capabilities: typeof scoreEditorSdkCapabilitiesV1;
  readonly getSnapshot: () => Readonly<ScoreEditorSdkSnapshotV1>;
  readonly getRevisionGuard: () => Readonly<ScoreEditorSdkRevisionGuardV1> | null;
  readonly subscribe: (listener: ScoreEditorSdkListenerV1) => () => void;
  readonly supports: (capability: ScoreEditorSdkCapabilityIdV1) => boolean;
  readonly requireCapability: (capability: ScoreEditorSdkCapabilityIdV1) => Readonly<ScoreEditorSdkResultV1<true>>;
  readonly lifecycle: Readonly<{
    getState: () => Readonly<ScoreEditorSdkLifecycleStateV1>;
    mount: (host: ScoreEditorSdkHostV1) => Readonly<ScoreEditorSdkResultV1<Readonly<ScoreEditorSdkLifecycleStateV1>>>;
    update: () => Readonly<ScoreEditorSdkResultV1<Readonly<ScoreEditorSdkLifecycleStateV1>>>;
    unmount: () => Readonly<ScoreEditorSdkResultV1<Readonly<ScoreEditorSdkLifecycleStateV1>>>;
    dispose: () => Readonly<ScoreEditorSdkResultV1<Readonly<ScoreEditorSdkLifecycleStateV1>>>;
  }>;
  readonly document: Readonly<{
    newDocument: (options?: ScoreEditorSdkNewDocumentOptionsV1) => Readonly<ScoreEditorSdkResultV1<Readonly<ScoreEditorSdkSnapshotV1>>>;
    openMusicXml: (musicXml: string, options?: ScoreEditorSdkOpenMusicXmlOptionsV1) => Promise<Readonly<ScoreEditorSdkResultV1<Readonly<ScoreEditorSdkSnapshotV1>>>>;
    exportMusicXml: (expected: Readonly<ScoreEditorSdkRevisionGuardV1>) => Readonly<ScoreEditorSdkResultV1<string>>;
  }>;
  readonly selection: Readonly<{
    listTargets: (expected: Readonly<ScoreEditorSdkRevisionGuardV1>) => Readonly<ScoreEditorSdkResultV1<readonly Readonly<ScoreEditorSdkSemanticTargetV1>[]>>;
    select: (
      address: SemanticAddressV3 | null,
      expected: Readonly<ScoreEditorSdkRevisionGuardV1>
    ) => Readonly<ScoreEditorSdkResultV1<Readonly<ScoreEditorSdkSnapshotV1>>>;
  }>;
  readonly history: Readonly<{
    undo: (expected: Readonly<ScoreEditorSdkRevisionGuardV1>) => Readonly<ScoreEditorSdkResultV1<Readonly<ScoreEditorSdkSnapshotV1>>>;
    redo: (expected: Readonly<ScoreEditorSdkRevisionGuardV1>) => Readonly<ScoreEditorSdkResultV1<Readonly<ScoreEditorSdkSnapshotV1>>>;
  }>;
  readonly authoring: Readonly<{
    commitKeypad: (request: Readonly<ScoreEditorSdkKeypadCommitV1>) => Readonly<ScoreEditorSdkResultV1<Readonly<ScoreEditorSdkSnapshotV1>>>;
  }>;
}

const success = <T>(value: T): Readonly<ScoreEditorSdkResultV1<T>> =>
  Object.freeze({ ok: true as const, value });

const failure = (
  code: string,
  message: string,
  details: Record<string, unknown> = {}
): Readonly<ScoreEditorSdkResultV1<never>> => Object.freeze({
  ok: false as const,
  error: Object.freeze({
    version: SCORE_EDITOR_SDK_RESULT_V1_VERSION,
    code,
    message,
    details: Object.freeze({ ...details })
  })
});

const errorRecord = (
  error: unknown,
  fallbackCode: string,
  fallbackMessage: string
): Readonly<{ readonly code: string; readonly message: string }> => {
  const record = error !== null && typeof error === 'object'
    ? error as { readonly code?: unknown; readonly message?: unknown }
    : null;
  return Object.freeze({
    code: typeof record?.code === 'string' && record.code.length > 0 ? record.code : fallbackCode,
    message: typeof record?.message === 'string' && record.message.length > 0 ? record.message : fallbackMessage
  });
};

const snapshot = (controller: StandaloneScoreEditorController): Readonly<ScoreEditorSdkSnapshotV1> => {
  const appSnapshot = controller.getSnapshot();
  const document = controller.getDocument();
  return Object.freeze({
    version: SCORE_EDITOR_SDK_V1_VERSION,
    hasDocument: appSnapshot.hasDocument,
    documentId: document?.session.history.present.score.id ?? null,
    revisionId: appSnapshot.revisionId,
    title: appSnapshot.title,
    origin: appSnapshot.origin,
    dirty: appSnapshot.dirty,
    selectionKind: appSnapshot.selectionKind,
    historyPastCount: document?.session.history.past.length ?? 0,
    historyFutureCount: document?.session.history.future.length ?? 0,
    statusCode: appSnapshot.statusCode,
    statusMessage: appSnapshot.statusMessage
  });
};

const guard = (controller: StandaloneScoreEditorController): Readonly<ScoreEditorSdkRevisionGuardV1> | null => {
  const document = controller.getDocument();
  if (document === null) return null;
  return Object.freeze({
    documentId: document.session.history.present.score.id,
    revisionId: document.session.history.present.score.revision.id
  });
};

const semanticTargets = (controller: StandaloneScoreEditorController): readonly Readonly<ScoreEditorSdkSemanticTargetV1>[] => {
  const document = controller.getDocument();
  if (document === null) return Object.freeze([]);
  const score = document.session.history.present.score;
  const targets: Readonly<ScoreEditorSdkSemanticTargetV1>[] = [];
  for (const part of score.parts) {
    for (const staff of part.staves) {
      if (staff.role === 'tablature-linked') continue;
      for (const measure of staff.measures) {
        for (const voice of measure.voices) {
          for (const event of voice.events) {
            targets.push(Object.freeze({ entityKind: 'event', address: addressEntityV3(score, event.id) }));
            if (event.kind === 'note') {
              targets.push(Object.freeze({ entityKind: 'note', address: addressEntityV3(score, event.note.id) }));
            } else if (event.kind === 'chord') {
              for (const note of event.notes) {
                targets.push(Object.freeze({ entityKind: 'note', address: addressEntityV3(score, note.id) }));
              }
            }
          }
        }
      }
    }
  }
  return Object.freeze(targets);
};

const guardFailure = (
  controller: StandaloneScoreEditorController,
  expected: Readonly<ScoreEditorSdkRevisionGuardV1>
): Readonly<ScoreEditorSdkResultV1<never>> | null => {
  const current = guard(controller);
  if (current === null) {
    return failure('NO_DOCUMENT', 'This SDK operation requires an active canonical score document.');
  }
  if (current.documentId !== expected.documentId || current.revisionId !== expected.revisionId) {
    return failure(
      'STALE_REQUEST',
      'The SDK request does not target the current canonical document revision.',
      {
        expectedDocumentId: expected.documentId,
        expectedRevisionId: expected.revisionId,
        currentDocumentId: current.documentId,
        currentRevisionId: current.revisionId
      }
    );
  }
  return null;
};

const resultFromSnapshot = (
  controller: StandaloneScoreEditorController,
  appSnapshot: Readonly<ScoreEditorBrowserAppSnapshot>
): Readonly<ScoreEditorSdkResultV1<Readonly<ScoreEditorSdkSnapshotV1>>> => {
  if (appSnapshot.error !== null) {
    return failure(appSnapshot.error.code, appSnapshot.error.message);
  }
  return success(snapshot(controller));
};

const resultFromThrown = (error: unknown): Readonly<ScoreEditorSdkResultV1<never>> => {
  const record = errorRecord(error, 'SDK_OPERATION_FAILED', 'SDK operation failed.');
  return failure(record.code, record.message);
};

const capabilityAvailable = (capability: ScoreEditorSdkCapabilityIdV1): boolean => {
  switch (capability) {
    case 'document': return scoreEditorSdkCapabilitiesV1.document;
    case 'history': return scoreEditorSdkCapabilitiesV1.history;
    case 'selection': return scoreEditorSdkCapabilitiesV1.selection;
    case 'authoring': return scoreEditorSdkCapabilitiesV1.authoring;
    case 'renderer': return scoreEditorSdkCapabilitiesV1.renderer;
    case 'files': return scoreEditorSdkCapabilitiesV1.files;
    case 'recovery': return scoreEditorSdkCapabilitiesV1.recovery;
    case 'playback': return scoreEditorSdkCapabilitiesV1.playback;
    case 'teacherWorkflow': return scoreEditorSdkCapabilitiesV1.teacherWorkflow;
    case 'audioAudition': return scoreEditorSdkCapabilitiesV1.audioAudition;
  }
};

const validHost = (host: unknown): host is ScoreEditorSdkHostV1 => {
  if (host === null || typeof host !== 'object') return false;
  const value = host as Partial<ScoreEditorSdkHostV1>;
  return value.contractVersion === SCORE_EDITOR_SDK_V1_VERSION &&
    typeof value.onMount === 'function' &&
    typeof value.onUpdate === 'function' &&
    typeof value.onUnmount === 'function';
};

export const createScoreEditorSdkV1 = (): Readonly<ScoreEditorSdkV1> => {
  const controller = createStandaloneScoreEditorController();
  let phase: ScoreEditorSdkLifecyclePhaseV1 = 'CREATED';
  let mountedHost: ScoreEditorSdkHostV1 | null = null;
  let mountedHostUnsubscribe: (() => void) | null = null;
  let listenerErrorCount = 0;
  let lastListenerError: Readonly<{ readonly code: string; readonly message: string }> | null = null;
  let lastHostError: Readonly<{ readonly code: string; readonly message: string }> | null = null;
  const subscriptionCleanups = new Set<() => void>();

  const lifecycleState = (): Readonly<ScoreEditorSdkLifecycleStateV1> => Object.freeze({
    version: SCORE_EDITOR_SDK_V1_VERSION,
    phase,
    mounted: mountedHost !== null,
    disposed: phase === 'DISPOSED',
    listenerErrorCount,
    lastListenerError,
    lastHostError
  });

  const disposedFailure = (): Readonly<ScoreEditorSdkResultV1<never>> | null =>
    phase === 'DISPOSED'
      ? failure('SDK_DISPOSED', 'The SDK instance has been disposed and cannot perform this operation.')
      : null;

  const recordListenerError = (error: unknown): void => {
    listenerErrorCount += 1;
    lastListenerError = errorRecord(error, 'SDK_LISTENER_FAILURE', 'An SDK subscriber failed.');
  };

  const recordHostError = (error: unknown): Readonly<{ readonly code: string; readonly message: string }> => {
    lastHostError = errorRecord(error, 'SDK_HOST_FAILURE', 'The SDK host callback failed.');
    return lastHostError;
  };

  const cleanupMountedHost = (): ScoreEditorSdkHostV1 | null => {
    const host = mountedHost;
    mountedHostUnsubscribe?.();
    mountedHostUnsubscribe = null;
    mountedHost = null;
    return host;
  };

  const safeSubscribe = (listener: ScoreEditorSdkListenerV1): (() => void) => {
    if (phase === 'DISPOSED') return () => undefined;
    let active = true;
    const baseUnsubscribe = controller.subscribe(() => {
      if (!active || phase === 'DISPOSED') return;
      try {
        listener(snapshot(controller));
      } catch (error) {
        recordListenerError(error);
      }
    });
    const cleanup = (): void => {
      if (!active) return;
      active = false;
      baseUnsubscribe();
      subscriptionCleanups.delete(cleanup);
    };
    subscriptionCleanups.add(cleanup);
    return cleanup;
  };

  const mountHost = (host: ScoreEditorSdkHostV1): Readonly<ScoreEditorSdkResultV1<Readonly<ScoreEditorSdkLifecycleStateV1>>> => {
    const disposed = disposedFailure();
    if (disposed !== null) return disposed;
    if (!validHost(host)) {
      return failure('SDK_HOST_INVALID', 'The host does not implement the versioned P06 SDK host contract.');
    }
    if (mountedHost !== null) {
      return failure('SDK_ALREADY_MOUNTED', 'The SDK is already mounted to a host.');
    }
    try {
      host.onMount(snapshot(controller));
    } catch (error) {
      const recorded = recordHostError(error);
      return failure('SDK_HOST_FAILURE', recorded.message, { causeCode: recorded.code });
    }
    mountedHost = host;
    phase = 'MOUNTED';
    mountedHostUnsubscribe = controller.subscribe(() => {
      if (phase !== 'MOUNTED' || mountedHost !== host) return;
      try {
        host.onUpdate(snapshot(controller));
      } catch (error) {
        recordHostError(error);
      }
    });
    return success(lifecycleState());
  };

  const updateHost = (): Readonly<ScoreEditorSdkResultV1<Readonly<ScoreEditorSdkLifecycleStateV1>>> => {
    const disposed = disposedFailure();
    if (disposed !== null) return disposed;
    const host = mountedHost;
    if (host === null) return failure('SDK_NOT_MOUNTED', 'The SDK has no mounted host to update.');
    try {
      host.onUpdate(snapshot(controller));
      return success(lifecycleState());
    } catch (error) {
      const recorded = recordHostError(error);
      return failure('SDK_HOST_FAILURE', recorded.message, { causeCode: recorded.code });
    }
  };

  const unmountHost = (): Readonly<ScoreEditorSdkResultV1<Readonly<ScoreEditorSdkLifecycleStateV1>>> => {
    const disposed = disposedFailure();
    if (disposed !== null) return disposed;
    const host = cleanupMountedHost();
    phase = 'UNMOUNTED';
    if (host === null) return success(lifecycleState());
    try {
      host.onUnmount();
      return success(lifecycleState());
    } catch (error) {
      const recorded = recordHostError(error);
      return failure('SDK_HOST_FAILURE', recorded.message, { causeCode: recorded.code });
    }
  };

  const dispose = (): Readonly<ScoreEditorSdkResultV1<Readonly<ScoreEditorSdkLifecycleStateV1>>> => {
    if (phase === 'DISPOSED') return success(lifecycleState());
    const host = cleanupMountedHost();
    if (host !== null) {
      try {
        host.onUnmount();
      } catch (error) {
        recordHostError(error);
      }
    }
    for (const cleanup of [...subscriptionCleanups]) cleanup();
    controller.unmount();
    phase = 'DISPOSED';
    return success(lifecycleState());
  };

  const sdk: ScoreEditorSdkV1 = {
    version: SCORE_EDITOR_SDK_V1_VERSION,
    capabilities: scoreEditorSdkCapabilitiesV1,
    getSnapshot: () => snapshot(controller),
    getRevisionGuard: () => guard(controller),
    subscribe: safeSubscribe,
    supports: capabilityAvailable,
    requireCapability: (capability) => capabilityAvailable(capability)
      ? success(true as const)
      : failure(
          'UNSUPPORTED_CAPABILITY',
          `SDK capability ${capability} is not available in this host.`,
          { capability }
        ),
    lifecycle: Object.freeze({
      getState: lifecycleState,
      mount: mountHost,
      update: updateHost,
      unmount: unmountHost,
      dispose
    }),
    document: Object.freeze({
      newDocument: (options: ScoreEditorSdkNewDocumentOptionsV1 = {}) => {
        const disposed = disposedFailure();
        if (disposed !== null) return disposed;
        const input: NewAppDocumentOptions = {
          ...(options.title === undefined ? {} : { title: options.title }),
          ...(options.preset === undefined ? {} : { preset: options.preset }),
          ...(options.idFactory === undefined ? {} : { idFactory: options.idFactory })
        };
        try {
          return resultFromSnapshot(controller, controller.newDocument(input));
        } catch (error) {
          return resultFromThrown(error);
        }
      },
      openMusicXml: async (musicXml: string, options: ScoreEditorSdkOpenMusicXmlOptionsV1 = {}) => {
        const disposed = disposedFailure();
        if (disposed !== null) return disposed;
        const input: OpenMusicXmlAppDocumentOptions = {
          ...(options.title === undefined ? {} : { title: options.title }),
          ...(options.documentId === undefined ? {} : { documentId: options.documentId }),
          ...(options.revisionId === undefined ? {} : { revisionId: options.revisionId }),
          ...(options.sha256Hex === undefined ? {} : { sha256Hex: options.sha256Hex })
        };
        try {
          return resultFromSnapshot(controller, await controller.openMusicXml(musicXml, input));
        } catch (error) {
          return resultFromThrown(error);
        }
      },
      exportMusicXml: (expected: Readonly<ScoreEditorSdkRevisionGuardV1>) => {
        const disposed = disposedFailure();
        if (disposed !== null) return disposed;
        const rejected = guardFailure(controller, expected);
        if (rejected !== null) return rejected;
        try {
          return success(controller.exportMusicXml());
        } catch (error) {
          return resultFromThrown(error);
        }
      }
    }),
    selection: Object.freeze({
      listTargets: (expected: Readonly<ScoreEditorSdkRevisionGuardV1>) => {
        const disposed = disposedFailure();
        if (disposed !== null) return disposed;
        const rejected = guardFailure(controller, expected);
        if (rejected !== null) return rejected;
        return success(semanticTargets(controller));
      },
      select: (address: SemanticAddressV3 | null, expected: Readonly<ScoreEditorSdkRevisionGuardV1>) => {
        const disposed = disposedFailure();
        if (disposed !== null) return disposed;
        const rejected = guardFailure(controller, expected);
        if (rejected !== null) return rejected;
        try {
          return resultFromSnapshot(controller, controller.select(address));
        } catch (error) {
          return resultFromThrown(error);
        }
      }
    }),
    history: Object.freeze({
      undo: (expected: Readonly<ScoreEditorSdkRevisionGuardV1>) => {
        const disposed = disposedFailure();
        if (disposed !== null) return disposed;
        const rejected = guardFailure(controller, expected);
        if (rejected !== null) return rejected;
        try {
          return resultFromSnapshot(controller, controller.undo());
        } catch (error) {
          return resultFromThrown(error);
        }
      },
      redo: (expected: Readonly<ScoreEditorSdkRevisionGuardV1>) => {
        const disposed = disposedFailure();
        if (disposed !== null) return disposed;
        const rejected = guardFailure(controller, expected);
        if (rejected !== null) return rejected;
        try {
          return resultFromSnapshot(controller, controller.redo());
        } catch (error) {
          return resultFromThrown(error);
        }
      }
    }),
    authoring: Object.freeze({
      commitKeypad: (request: Readonly<ScoreEditorSdkKeypadCommitV1>) => {
        const disposed = disposedFailure();
        if (disposed !== null) return disposed;
        const rejected = guardFailure(controller, request.expected);
        if (rejected !== null) return rejected;
        const options: EditorKeypadV4Options | undefined = request.nextRevisionId === undefined
          ? undefined
          : Object.freeze({ nextRevisionId: request.nextRevisionId });
        try {
          return resultFromSnapshot(
            controller,
            controller.commitKeypad(request.action, request.target ?? null, options)
          );
        } catch (error) {
          return resultFromThrown(error);
        }
      }
    })
  };

  return Object.freeze(sdk);
};
