import type { SemanticAddressV3 } from '../../addressing-v3/src/index.js';
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
  readonly statusCode: string;
  readonly statusMessage: string;
}

export type ScoreEditorSdkErrorCodeV1 =
  | 'NO_DOCUMENT'
  | 'STALE_REQUEST'
  | 'UNSUPPORTED_CAPABILITY'
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

export interface ScoreEditorSdkV1 {
  readonly version: typeof SCORE_EDITOR_SDK_V1_VERSION;
  readonly capabilities: typeof scoreEditorSdkCapabilitiesV1;
  readonly getSnapshot: () => Readonly<ScoreEditorSdkSnapshotV1>;
  readonly getRevisionGuard: () => Readonly<ScoreEditorSdkRevisionGuardV1> | null;
  readonly subscribe: (listener: ScoreEditorSdkListenerV1) => () => void;
  readonly supports: (capability: ScoreEditorSdkCapabilityIdV1) => boolean;
  readonly requireCapability: (capability: ScoreEditorSdkCapabilityIdV1) => Readonly<ScoreEditorSdkResultV1<true>>;
  readonly document: Readonly<{
    newDocument: (options?: ScoreEditorSdkNewDocumentOptionsV1) => Readonly<ScoreEditorSdkResultV1<Readonly<ScoreEditorSdkSnapshotV1>>>;
    openMusicXml: (musicXml: string, options?: ScoreEditorSdkOpenMusicXmlOptionsV1) => Promise<Readonly<ScoreEditorSdkResultV1<Readonly<ScoreEditorSdkSnapshotV1>>>>;
    exportMusicXml: (expected: Readonly<ScoreEditorSdkRevisionGuardV1>) => Readonly<ScoreEditorSdkResultV1<string>>;
  }>;
  readonly selection: Readonly<{
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

const resultFromThrown = <T>(error: unknown): Readonly<ScoreEditorSdkResultV1<T>> => {
  const record = error !== null && typeof error === 'object'
    ? error as { readonly code?: unknown; readonly message?: unknown }
    : null;
  return failure(
    typeof record?.code === 'string' && record.code.length > 0 ? record.code : 'SDK_OPERATION_FAILED',
    typeof record?.message === 'string' && record.message.length > 0 ? record.message : 'SDK operation failed.'
  );
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

export const createScoreEditorSdkV1 = (): Readonly<ScoreEditorSdkV1> => {
  const controller = createStandaloneScoreEditorController();

  const sdk: ScoreEditorSdkV1 = {
    version: SCORE_EDITOR_SDK_V1_VERSION,
    capabilities: scoreEditorSdkCapabilitiesV1,
    getSnapshot: () => snapshot(controller),
    getRevisionGuard: () => guard(controller),
    subscribe: (listener) => controller.subscribe(() => { listener(snapshot(controller)); }),
    supports: capabilityAvailable,
    requireCapability: (capability) => capabilityAvailable(capability)
      ? success(true as const)
      : failure(
          'UNSUPPORTED_CAPABILITY',
          `SDK capability ${capability} is not available in this host.`,
          { capability }
        ),
    document: Object.freeze({
      newDocument: (options: ScoreEditorSdkNewDocumentOptionsV1 = {}) => {
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
      select: (address: SemanticAddressV3 | null, expected: Readonly<ScoreEditorSdkRevisionGuardV1>) => {
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
        const rejected = guardFailure(controller, expected);
        if (rejected !== null) return rejected;
        try {
          return resultFromSnapshot(controller, controller.undo());
        } catch (error) {
          return resultFromThrown(error);
        }
      },
      redo: (expected: Readonly<ScoreEditorSdkRevisionGuardV1>) => {
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
