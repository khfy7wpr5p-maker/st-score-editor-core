import {
  createFileEnabledStandaloneBrowserAppRuntime,
  createFileEnabledStandaloneScoreEditorController,
  fileEnabledBrowserAppProfile,
  type FileEnabledStandaloneScoreEditorController
} from './file-enabled.js';
import type { ScoreEditorAppDocument } from '../../score-editor-app-document/src/index.js';
import {
  restoreScoreEditorRecoveryEnvelope,
  type RecoverySha256Provider
} from '../../score-editor-app-recovery/src/index.js';
import {
  createIndexedDbRecoveryRecordStore,
  createRecoveryAutosaveCoordinator,
  scanRecoveryRecordStore,
  MAX_RECOVERY_DOCUMENTS,
  RECOVERY_DB_NAME,
  SCORE_EDITOR_BROWSER_RECOVERY_STORAGE_VERSION,
  type RecoveryAutosaveCoordinator,
  type RecoveryRecordStore,
  type RecoveryScanResult,
  type RecoveryStoredRecord
} from '../../score-editor-browser-recovery-storage/src/index.js';

export const RECOVERY_ENABLED_BROWSER_APP_VERSION = '1.0.0' as const;

export const recoveryEnabledBrowserAppProfile = Object.freeze({
  ...fileEnabledBrowserAppProfile,
  recoveryAutosaveBundled: true,
  browserLocalRecoveryStorage: 'indexedDB' as const,
  recoveryCanonicalAuthority: false,
  recoveryAutoRestore: false,
  persistenceCapable: false
});

export interface BrowserRecoveryControllerState {
  readonly version: typeof RECOVERY_ENABLED_BROWSER_APP_VERSION;
  readonly storageAvailable: boolean;
  readonly autosaveAvailable: boolean;
  readonly validCandidateCount: number;
  readonly rejectedCandidateCount: number;
  readonly lastStoredDocumentId: string | null;
  readonly lastStoredRevisionId: string | null;
  readonly status: { readonly code: string; readonly message: string };
}

export interface RecoveryEnabledControllerOptions {
  readonly store?: RecoveryRecordStore;
  readonly sha256Hex?: RecoverySha256Provider;
  readonly autosaveDelayMs?: number;
  readonly nowEpochMs?: () => number;
}

export interface RecoveryEnabledStandaloneScoreEditorController extends Omit<FileEnabledStandaloneScoreEditorController, 'profile' | 'unmount'> {
  readonly profile: typeof recoveryEnabledBrowserAppProfile;
  readonly getRecoveryState: () => Readonly<BrowserRecoveryControllerState>;
  readonly flushRecovery: () => Promise<Readonly<RecoveryStoredRecord> | null>;
  readonly scanRecoveries: () => Promise<Readonly<RecoveryScanResult>>;
  readonly prepareRecovery: (documentId: string, options?: { readonly allowSameDocumentReplace?: boolean }) => Promise<Readonly<ScoreEditorAppDocument>>;
  readonly deleteRecovery: (documentId: string) => Promise<void>;
  readonly unmount: () => void;
}

export type RecoveryControllerErrorCode =
  | 'RECOVERY_UNAVAILABLE'
  | 'RECOVERY_NOT_FOUND'
  | 'RECOVERY_PREPARE_FAILED';

export class RecoveryControllerError extends Error {
  readonly code: RecoveryControllerErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: RecoveryControllerErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'RecoveryControllerError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const controllerDocumentId = (controller: FileEnabledStandaloneScoreEditorController): string | null =>
  controller.getDocument()?.session.history.present.score.id ?? null;

export const createRecoveryEnabledStandaloneScoreEditorController = (
  options: RecoveryEnabledControllerOptions = {}
): Readonly<RecoveryEnabledStandaloneScoreEditorController> => {
  const base = createFileEnabledStandaloneScoreEditorController();
  let store: RecoveryRecordStore | null = options.store ?? null;
  let coordinator: Readonly<RecoveryAutosaveCoordinator> | null = null;
  let validCandidateCount = 0;
  let rejectedCandidateCount = 0;
  let lastStoredDocumentId: string | null = null;
  let lastStoredRevisionId: string | null = null;
  let status = Object.freeze({ code: 'RECOVERY_INITIALIZING', message: 'Recovery initialization pending.' });

  if (store === null) {
    try {
      store = createIndexedDbRecoveryRecordStore();
    } catch {
      store = null;
    }
  }

  if (store !== null) {
    coordinator = createRecoveryAutosaveCoordinator(
      Object.freeze({
        getDocument: base.getDocument,
        subscribe: (listener: () => void) => base.subscribe(() => { listener(); })
      }),
      store,
      {
        ...(options.sha256Hex === undefined ? {} : { sha256Hex: options.sha256Hex }),
        ...(options.autosaveDelayMs === undefined ? {} : { autosaveDelayMs: options.autosaveDelayMs }),
        ...(options.nowEpochMs === undefined ? {} : { nowEpochMs: options.nowEpochMs })
      }
    );
    status = Object.freeze({ code: 'RECOVERY_READY', message: 'Browser-local recovery autosave is ready.' });
  } else {
    status = Object.freeze({ code: 'RECOVERY_UNAVAILABLE', message: 'Browser-local recovery storage is unavailable; editing remains available.' });
  }

  const requireCoordinator = (): Readonly<RecoveryAutosaveCoordinator> => {
    if (coordinator === null) {
      throw new RecoveryControllerError('Browser-local recovery storage is unavailable.', 'RECOVERY_UNAVAILABLE');
    }
    return coordinator;
  };

  const scan = async (): Promise<Readonly<RecoveryScanResult>> => {
    const result = await requireCoordinator().scan();
    validCandidateCount = result.valid.length;
    rejectedCandidateCount = result.rejected.length;
    status = Object.freeze({
      code: 'RECOVERY_SCAN_COMPLETE',
      message: `${result.valid.length} valid recovery candidate(s); ${result.rejected.length} rejected record(s).`
    });
    return result;
  };

  const controller: RecoveryEnabledStandaloneScoreEditorController = Object.freeze({
    ...base,
    profile: recoveryEnabledBrowserAppProfile,
    getRecoveryState: () => Object.freeze({
      version: RECOVERY_ENABLED_BROWSER_APP_VERSION,
      storageAvailable: store !== null,
      autosaveAvailable: coordinator !== null,
      validCandidateCount,
      rejectedCandidateCount,
      lastStoredDocumentId,
      lastStoredRevisionId,
      status
    }),
    flushRecovery: async () => {
      const record = await requireCoordinator().flush();
      if (record !== null) {
        lastStoredDocumentId = record.documentId;
        lastStoredRevisionId = record.revisionId;
        status = Object.freeze({ code: 'RECOVERY_STORED', message: `Recovery snapshot stored for revision ${record.revisionId}.` });
      }
      return record;
    },
    scanRecoveries: scan,
    prepareRecovery: async (documentId: string, prepareOptions = {}) => {
      try {
        const result = await scan();
        const candidate = result.valid.find((value) => value.record.documentId === documentId);
        if (candidate === undefined) {
          throw new RecoveryControllerError('Requested recovery document was not found.', 'RECOVERY_NOT_FOUND', { documentId });
        }
        const recovered = restoreScoreEditorRecoveryEnvelope(candidate.envelope, {
          activeDocumentId: controllerDocumentId(base),
          allowSameDocumentReplace: prepareOptions.allowSameDocumentReplace === true
        });
        status = Object.freeze({ code: 'RECOVERY_PREPARED', message: `Recovery prepared for ${documentId}; live document was not replaced.` });
        return recovered;
      } catch (error) {
        if (error instanceof RecoveryControllerError) throw error;
        const value = error as { readonly code?: unknown; readonly message?: unknown };
        throw new RecoveryControllerError(
          typeof value?.message === 'string' ? value.message : 'Recovery preparation failed.',
          'RECOVERY_PREPARE_FAILED',
          { causeCode: typeof value?.code === 'string' ? value.code : null, documentId }
        );
      }
    },
    deleteRecovery: async (documentId: string) => {
      await requireCoordinator().deleteRecovery(documentId);
      if (lastStoredDocumentId === documentId) {
        lastStoredDocumentId = null;
        lastStoredRevisionId = null;
      }
      status = Object.freeze({ code: 'RECOVERY_DELETED', message: `Recovery record deleted for ${documentId}.` });
    },
    unmount: () => {
      coordinator?.dispose();
      base.unmount();
    }
  });

  return controller;
};

export const createRecoveryEnabledStandaloneBrowserAppRuntime = () => {
  const base = createFileEnabledStandaloneBrowserAppRuntime();
  return Object.freeze({
    ...base,
    profile: recoveryEnabledBrowserAppProfile,
    createController: createRecoveryEnabledStandaloneScoreEditorController,
    recovery: Object.freeze({
      version: SCORE_EDITOR_BROWSER_RECOVERY_STORAGE_VERSION,
      databaseName: RECOVERY_DB_NAME,
      maxDocuments: MAX_RECOVERY_DOCUMENTS,
      createIndexedDbStore: createIndexedDbRecoveryRecordStore,
      scanStore: scanRecoveryRecordStore,
      autoRestore: false,
      canonicalAuthority: false
    })
  });
};
