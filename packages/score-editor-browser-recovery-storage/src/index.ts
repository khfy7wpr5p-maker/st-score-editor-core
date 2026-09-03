import type { ScoreEditorAppDocument } from '../../score-editor-app-document/src/index.js';
import {
  createScoreEditorRecoveryEnvelope,
  serializeScoreEditorRecoveryEnvelope,
  validateScoreEditorRecoveryEnvelope,
  type RecoverySha256Provider,
  type ScoreEditorRecoveryEnvelope
} from '../../score-editor-app-recovery/src/index.js';

export const SCORE_EDITOR_BROWSER_RECOVERY_STORAGE_VERSION = '1.0.0' as const;
export const RECOVERY_DB_NAME = 'st-score-editor-recovery-v1';
export const RECOVERY_STORE_NAME = 'recovery-records';
export const MAX_RECOVERY_DOCUMENTS = 8;

export interface RecoveryStoredRecord {
  readonly version: typeof SCORE_EDITOR_BROWSER_RECOVERY_STORAGE_VERSION;
  readonly documentId: string;
  readonly revisionId: string;
  readonly createdAtEpochMs: number;
  readonly envelopeJson: string;
}

export interface RecoveryRecordStore {
  readonly put: (record: Readonly<RecoveryStoredRecord>) => Promise<void>;
  readonly list: () => Promise<readonly unknown[]>;
  readonly delete: (documentId: string) => Promise<void>;
  readonly clear: () => Promise<void>;
}

export interface RecoveryCandidate {
  readonly record: Readonly<RecoveryStoredRecord>;
  readonly envelope: Readonly<ScoreEditorRecoveryEnvelope>;
}

export interface RejectedRecoveryRecord {
  readonly documentId: string | null;
  readonly code: string;
  readonly message: string;
}

export interface RecoveryScanResult {
  readonly valid: readonly Readonly<RecoveryCandidate>[];
  readonly rejected: readonly Readonly<RejectedRecoveryRecord>[];
}

export interface RecoveryAutosaveSource {
  readonly getDocument: () => Readonly<ScoreEditorAppDocument> | null;
  readonly subscribe: (listener: () => void) => () => void;
}

export interface RecoveryAutosaveCoordinator {
  readonly version: typeof SCORE_EDITOR_BROWSER_RECOVERY_STORAGE_VERSION;
  readonly flush: () => Promise<Readonly<RecoveryStoredRecord> | null>;
  readonly scan: () => Promise<Readonly<RecoveryScanResult>>;
  readonly deleteRecovery: (documentId: string) => Promise<void>;
  readonly dispose: () => void;
}

export type RecoveryStorageErrorCode =
  | 'RECOVERY_STORAGE_UNAVAILABLE'
  | 'RECOVERY_STORAGE_FAILED'
  | 'RECOVERY_RECORD_INVALID';

export class RecoveryStorageError extends Error {
  readonly code: RecoveryStorageErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: RecoveryStorageErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'RecoveryStorageError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

const parseRecord = (raw: unknown): Readonly<RecoveryStoredRecord> => {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new RecoveryStorageError('Recovery storage record must be an object.', 'RECOVERY_RECORD_INVALID');
  }
  const value = raw as Record<string, unknown>;
  if (
    value.version !== SCORE_EDITOR_BROWSER_RECOVERY_STORAGE_VERSION ||
    typeof value.documentId !== 'string' || !ID.test(value.documentId) ||
    typeof value.revisionId !== 'string' || !ID.test(value.revisionId) ||
    typeof value.createdAtEpochMs !== 'number' || !Number.isSafeInteger(value.createdAtEpochMs) || value.createdAtEpochMs < 0 ||
    typeof value.envelopeJson !== 'string'
  ) {
    throw new RecoveryStorageError('Recovery storage record fields are invalid.', 'RECOVERY_RECORD_INVALID');
  }
  return Object.freeze({
    version: SCORE_EDITOR_BROWSER_RECOVERY_STORAGE_VERSION,
    documentId: value.documentId,
    revisionId: value.revisionId,
    createdAtEpochMs: value.createdAtEpochMs,
    envelopeJson: value.envelopeJson
  });
};

const requestResult = <T>(request: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  request.addEventListener('success', () => resolve(request.result), { once: true });
  request.addEventListener('error', () => reject(request.error ?? new Error('IndexedDB request failed.')), { once: true });
});

const transactionDone = (transaction: IDBTransaction): Promise<void> => new Promise((resolve, reject) => {
  transaction.addEventListener('complete', () => resolve(), { once: true });
  transaction.addEventListener('abort', () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.')), { once: true });
  transaction.addEventListener('error', () => reject(transaction.error ?? new Error('IndexedDB transaction failed.')), { once: true });
});

const openDatabase = async (factory: IDBFactory): Promise<IDBDatabase> => {
  const request = factory.open(RECOVERY_DB_NAME, 1);
  request.addEventListener('upgradeneeded', () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(RECOVERY_STORE_NAME)) {
      database.createObjectStore(RECOVERY_STORE_NAME, { keyPath: 'documentId' });
    }
  });
  return requestResult(request);
};

const storageFailure = (operation: string, error: unknown): RecoveryStorageError =>
  error instanceof RecoveryStorageError
    ? error
    : new RecoveryStorageError(`Recovery storage ${operation} failed.`, 'RECOVERY_STORAGE_FAILED', {
        cause: error instanceof Error ? error.message : String(error)
      });

export const createIndexedDbRecoveryRecordStore = (
  factory: IDBFactory | undefined = globalThis.indexedDB
): Readonly<RecoveryRecordStore> => {
  if (factory === undefined) {
    throw new RecoveryStorageError('IndexedDB is unavailable for browser-local recovery.', 'RECOVERY_STORAGE_UNAVAILABLE');
  }
  const withDatabase = async <T>(operation: (database: IDBDatabase) => Promise<T>): Promise<T> => {
    let database: IDBDatabase | null = null;
    try {
      database = await openDatabase(factory);
      return await operation(database);
    } catch (error) {
      throw storageFailure('operation', error);
    } finally {
      database?.close();
    }
  };
  return Object.freeze({
    put: async (record: Readonly<RecoveryStoredRecord>) => withDatabase(async (database) => {
      const transaction = database.transaction(RECOVERY_STORE_NAME, 'readwrite');
      transaction.objectStore(RECOVERY_STORE_NAME).put(parseRecord(record));
      await transactionDone(transaction);
    }),
    list: async () => withDatabase(async (database) => {
      const transaction = database.transaction(RECOVERY_STORE_NAME, 'readonly');
      const result = await requestResult(transaction.objectStore(RECOVERY_STORE_NAME).getAll());
      await transactionDone(transaction);
      return Object.freeze([...result]);
    }),
    delete: async (documentId: string) => withDatabase(async (database) => {
      const transaction = database.transaction(RECOVERY_STORE_NAME, 'readwrite');
      transaction.objectStore(RECOVERY_STORE_NAME).delete(documentId);
      await transactionDone(transaction);
    }),
    clear: async () => withDatabase(async (database) => {
      const transaction = database.transaction(RECOVERY_STORE_NAME, 'readwrite');
      transaction.objectStore(RECOVERY_STORE_NAME).clear();
      await transactionDone(transaction);
    })
  });
};

export const scanRecoveryRecordStore = async (
  store: RecoveryRecordStore,
  options: { readonly sha256Hex?: RecoverySha256Provider } = {}
): Promise<Readonly<RecoveryScanResult>> => {
  const valid: Readonly<RecoveryCandidate>[] = [];
  const rejected: Readonly<RejectedRecoveryRecord>[] = [];
  for (const raw of await store.list()) {
    let record: Readonly<RecoveryStoredRecord>;
    try {
      record = parseRecord(raw);
      const envelope = await validateScoreEditorRecoveryEnvelope(record.envelopeJson, options);
      if (envelope.payload.documentId !== record.documentId || envelope.payload.revisionId !== record.revisionId || envelope.payload.createdAtEpochMs !== record.createdAtEpochMs) {
        throw new RecoveryStorageError('Stored recovery metadata disagrees with the validated envelope.', 'RECOVERY_RECORD_INVALID');
      }
      valid.push(Object.freeze({ record, envelope }));
    } catch (error) {
      const value = error as { readonly code?: unknown; readonly message?: unknown };
      rejected.push(Object.freeze({
        documentId: raw !== null && typeof raw === 'object' && !Array.isArray(raw) && typeof (raw as Record<string, unknown>).documentId === 'string'
          ? (raw as Record<string, unknown>).documentId as string
          : null,
        code: typeof value?.code === 'string' ? value.code : 'RECOVERY_RECORD_INVALID',
        message: typeof value?.message === 'string' ? value.message : 'Recovery record was rejected.'
      }));
    }
  }
  valid.sort((a, b) => b.record.createdAtEpochMs - a.record.createdAtEpochMs || a.record.documentId.localeCompare(b.record.documentId));
  return Object.freeze({ valid: Object.freeze(valid), rejected: Object.freeze(rejected) });
};

const pruneRecoveryRecords = async (store: RecoveryRecordStore): Promise<void> => {
  const records: Readonly<RecoveryStoredRecord>[] = [];
  for (const raw of await store.list()) {
    try { records.push(parseRecord(raw)); } catch { /* rejected records are not silently deleted */ }
  }
  records.sort((a, b) => b.createdAtEpochMs - a.createdAtEpochMs || a.documentId.localeCompare(b.documentId));
  for (const record of records.slice(MAX_RECOVERY_DOCUMENTS)) await store.delete(record.documentId);
};

export const createRecoveryAutosaveCoordinator = (
  source: RecoveryAutosaveSource,
  store: RecoveryRecordStore,
  options: {
    readonly sha256Hex?: RecoverySha256Provider;
    readonly nowEpochMs?: () => number;
    readonly autosaveDelayMs?: number;
  } = {}
): Readonly<RecoveryAutosaveCoordinator> => {
  const delay = options.autosaveDelayMs ?? 750;
  if (!Number.isSafeInteger(delay) || delay < 0 || delay > 60_000) {
    throw new RecoveryStorageError('Autosave delay is outside the admitted range.', 'RECOVERY_RECORD_INVALID');
  }
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastStoredRevisionId: string | null = null;
  let pendingRevisionId: string | null = null;

  const eligible = (): Readonly<ScoreEditorAppDocument> | null => {
    const document = source.getDocument();
    if (document === null || !document.dirty || document.session.history.past.length === 0) return null;
    return document;
  };

  const schedule = (): void => {
    if (disposed) return;
    const document = eligible();
    if (document === null) return;
    const revisionId = document.session.history.present.score.revision.id;
    if (revisionId === lastStoredRevisionId || revisionId === pendingRevisionId) return;
    pendingRevisionId = revisionId;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void flush(); }, delay);
  };

  const flush = async (): Promise<Readonly<RecoveryStoredRecord> | null> => {
    if (disposed) return null;
    const document = eligible();
    if (document === null) { pendingRevisionId = null; return null; }
    const documentId = document.session.history.present.score.id;
    const revisionId = document.session.history.present.score.revision.id;
    if (revisionId === lastStoredRevisionId) { pendingRevisionId = null; return null; }
    const envelope = await createScoreEditorRecoveryEnvelope(document, {
      nowEpochMs: options.nowEpochMs?.() ?? Date.now(),
      ...(options.sha256Hex === undefined ? {} : { sha256Hex: options.sha256Hex })
    });
    const current = eligible();
    if (current === null || current.session.history.present.score.id !== documentId || current.session.history.present.score.revision.id !== revisionId) {
      pendingRevisionId = null;
      schedule();
      return null;
    }
    const record = Object.freeze({
      version: SCORE_EDITOR_BROWSER_RECOVERY_STORAGE_VERSION,
      documentId,
      revisionId,
      createdAtEpochMs: envelope.payload.createdAtEpochMs,
      envelopeJson: serializeScoreEditorRecoveryEnvelope(envelope)
    });
    await store.put(record);
    await pruneRecoveryRecords(store);
    lastStoredRevisionId = revisionId;
    pendingRevisionId = null;
    return record;
  };

  const unsubscribe = source.subscribe(schedule);
  schedule();
  return Object.freeze({
    version: SCORE_EDITOR_BROWSER_RECOVERY_STORAGE_VERSION,
    flush,
    scan: () => scanRecoveryRecordStore(store, options.sha256Hex === undefined ? {} : { sha256Hex: options.sha256Hex }),
    deleteRecovery: (documentId: string) => store.delete(documentId),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      unsubscribe();
    }
  });
};
