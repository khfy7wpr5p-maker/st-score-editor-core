import type { EventAddressV3 } from '../../addressing-v3/src/index.js';
import {
  commitAppTeacherInsertAfterEvent,
  commitAppTeacherOctaveTranspose,
  commitAppTeacherPasteOverwrite
} from '../../score-editor-app-document/src/index.js';
import {
  createTeacherEventSpanSelectionV4,
  type TeacherEventSpanSelectionV4
} from '../../editor-teacher-event-span-v4/src/index.js';
import {
  createTeacherCopySnapshotV4,
  type TeacherCopySnapshotV4
} from '../../editor-teacher-copy-snapshot-v4/src/index.js';
import { analyzeTeacherPasteDestinationV4 } from '../../editor-teacher-paste-admission-v4/src/index.js';
import { planTeacherPasteIdentitiesV4 } from '../../editor-teacher-paste-identity-plan-v4/src/index.js';
import { analyzeTeacherInsertAfterEventV4 } from '../../editor-teacher-insert-admission-v4/src/index.js';
import {
  analyzeTeacherOctaveTransposeV4,
  type TeacherOctaveDeltaV4
} from '../../editor-teacher-octave-transpose-admission-v4/src/index.js';
import {
  createTripletRetimingStandaloneBrowserAppRuntime,
  createTripletRetimingStandaloneScoreEditorController,
  tripletRetimingBrowserAppProfile,
  type TripletRetimingStandaloneScoreEditorController
} from './triplet-retiming-authoring.js';
import type { ReleaseHardeningControllerOptions } from './release-hardened.js';
import type { ScoreEditorBrowserAppSnapshot } from './index.js';

export const TEACHER_WORKFLOW_BROWSER_VERSION = '1.0.0' as const;

export const teacherWorkflowBrowserAppProfile = Object.freeze({
  ...tripletRetimingBrowserAppProfile,
  teacherWorkflowCommandsBundled: true,
  teacherWorkflowCanonicalAuthority: false,
  teacherWorkflowHistoryAuthority: 'EditorSessionV4' as const,
  teacherWorkflowClipboard: 'revision-bound-read-only-copy-snapshot' as const,
  teacherWorkflowPaste: 'bounded-neutral-rest-overwrite' as const,
  teacherWorkflowInsert: 'bounded-insert-after-event-with-trailing-neutral-rest-capacity' as const,
  teacherWorkflowTranspose: 'octave-only-plus-minus-one-or-two' as const,
  teacherWorkflowRendererCoordinateAuthority: false,
  teacherWorkflowDomAuthoringAuthority: false,
  teacherWorkflowNetworkAuthority: false
});

export interface TeacherWorkflowBrowserState {
  readonly version: typeof TEACHER_WORKFLOW_BROWSER_VERSION;
  readonly clipboardAvailable: boolean;
  readonly clipboardCurrent: boolean;
  readonly clipboardSourceRevisionId: string | null;
  readonly clipboardEventCount: number;
  readonly clipboardNoteCount: number;
}

export type TeacherWorkflowBrowserErrorCode =
  | 'NO_DOCUMENT'
  | 'NO_CLIPBOARD'
  | 'REVISION_ID_UNAVAILABLE';

export class TeacherWorkflowBrowserError extends Error {
  readonly code: TeacherWorkflowBrowserErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: TeacherWorkflowBrowserErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'TeacherWorkflowBrowserError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

export interface TeacherWorkflowControllerOptions extends ReleaseHardeningControllerOptions {
  readonly revisionIdFactory?: () => string;
}

const browserRevisionId = (): string => {
  const cryptoValue = globalThis.crypto as Crypto | undefined;
  if (cryptoValue === undefined || typeof cryptoValue.randomUUID !== 'function') {
    throw new TeacherWorkflowBrowserError(
      'Browser randomUUID support is required for teacher workflow edit revisions.',
      'REVISION_ID_UNAVAILABLE'
    );
  }
  return `rev:${cryptoValue.randomUUID()}`;
};

export interface TeacherWorkflowStandaloneScoreEditorController extends Omit<TripletRetimingStandaloneScoreEditorController, 'profile'> {
  readonly profile: typeof teacherWorkflowBrowserAppProfile;
  readonly getTeacherWorkflowState: () => Readonly<TeacherWorkflowBrowserState>;
  readonly copyTeacherSpan: (start: EventAddressV3, stop: EventAddressV3) => Readonly<TeacherWorkflowBrowserState>;
  readonly clearTeacherClipboard: () => Readonly<TeacherWorkflowBrowserState>;
  readonly pasteTeacherClipboardOverwrite: (destination: EventAddressV3) => Readonly<ScoreEditorBrowserAppSnapshot>;
  readonly insertTeacherClipboardAfter: (anchor: EventAddressV3) => Readonly<ScoreEditorBrowserAppSnapshot>;
  readonly transposeTeacherSpanByOctaves: (
    start: EventAddressV3,
    stop: EventAddressV3,
    octaveDelta: TeacherOctaveDeltaV4
  ) => Readonly<ScoreEditorBrowserAppSnapshot>;
}

export const createTeacherWorkflowStandaloneScoreEditorController = (
  options: TeacherWorkflowControllerOptions = {}
): Readonly<TeacherWorkflowStandaloneScoreEditorController> => {
  const base = createTripletRetimingStandaloneScoreEditorController(options);
  const revisionIdFactory = options.revisionIdFactory ?? browserRevisionId;
  let clipboard: Readonly<TeacherCopySnapshotV4> | null = null;

  const requireDocument = () => {
    const document = base.getDocument();
    if (document === null) {
      throw new TeacherWorkflowBrowserError('Create or open a score before using teacher workflow commands.', 'NO_DOCUMENT');
    }
    return document;
  };

  const state = (): Readonly<TeacherWorkflowBrowserState> => {
    const document = base.getDocument();
    const currentRevisionId = document?.session.history.present.score.revision.id ?? null;
    return Object.freeze({
      version: TEACHER_WORKFLOW_BROWSER_VERSION,
      clipboardAvailable: clipboard !== null,
      clipboardCurrent: clipboard !== null && currentRevisionId === clipboard.sourceRevisionId,
      clipboardSourceRevisionId: clipboard?.sourceRevisionId ?? null,
      clipboardEventCount: clipboard?.eventCount ?? 0,
      clipboardNoteCount: clipboard?.noteCount ?? 0
    });
  };

  const currentClipboard = (): Readonly<TeacherCopySnapshotV4> => {
    if (clipboard === null) {
      throw new TeacherWorkflowBrowserError('Copy a teacher event span before Paste or Insert.', 'NO_CLIPBOARD');
    }
    return clipboard;
  };

  const span = (start: EventAddressV3, stop: EventAddressV3): Readonly<TeacherEventSpanSelectionV4> => {
    const document = requireDocument();
    return createTeacherEventSpanSelectionV4(document.session.history.present.score, start, stop);
  };

  base.subscribe(() => {
    if (clipboard === null) return;
    const revisionId = base.getDocument()?.session.history.present.score.revision.id ?? null;
    if (revisionId !== clipboard.sourceRevisionId) clipboard = null;
  });

  const controller: TeacherWorkflowStandaloneScoreEditorController = {
    ...base,
    profile: teacherWorkflowBrowserAppProfile,
    getTeacherWorkflowState: state,
    copyTeacherSpan: (start, stop) => {
      const document = requireDocument();
      const selection = createTeacherEventSpanSelectionV4(
        document.session.history.present.score,
        start,
        stop
      );
      clipboard = createTeacherCopySnapshotV4(
        document.session.history.present.score,
        document.session.history.present.notation,
        selection
      );
      return state();
    },
    clearTeacherClipboard: () => {
      clipboard = null;
      return state();
    },
    pasteTeacherClipboardOverwrite: (destination) => {
      const document = requireDocument();
      const snapshot = currentClipboard();
      const score = document.session.history.present.score;
      const notation = document.session.history.present.notation;
      const admission = analyzeTeacherPasteDestinationV4(score, notation, snapshot, destination);
      const nextRevisionId = revisionIdFactory();
      const identityPlan = planTeacherPasteIdentitiesV4(
        score,
        notation,
        snapshot,
        admission,
        nextRevisionId
      );
      const nextDocument = commitAppTeacherPasteOverwrite(
        document,
        snapshot,
        admission,
        identityPlan
      );
      return base.adoptValidatedSnapshot(nextDocument);
    },
    insertTeacherClipboardAfter: (anchor) => {
      const document = requireDocument();
      const snapshot = currentClipboard();
      const score = document.session.history.present.score;
      const notation = document.session.history.present.notation;
      const admission = analyzeTeacherInsertAfterEventV4(score, notation, snapshot, anchor);
      const nextDocument = commitAppTeacherInsertAfterEvent(
        document,
        snapshot,
        admission,
        revisionIdFactory()
      );
      return base.adoptValidatedSnapshot(nextDocument);
    },
    transposeTeacherSpanByOctaves: (start, stop, octaveDelta) => {
      const document = requireDocument();
      const selection = span(start, stop);
      const admission = analyzeTeacherOctaveTransposeV4(
        document.session.history.present.score,
        document.session.history.present.notation,
        selection,
        octaveDelta
      );
      const nextDocument = commitAppTeacherOctaveTranspose(
        document,
        selection,
        admission,
        Object.freeze({ nextRevisionId: revisionIdFactory() })
      );
      return base.adoptValidatedSnapshot(nextDocument);
    }
  };

  return Object.freeze(controller);
};

export const createTeacherWorkflowStandaloneBrowserAppRuntime = () => {
  const base = createTripletRetimingStandaloneBrowserAppRuntime();
  return Object.freeze({
    ...base,
    profile: teacherWorkflowBrowserAppProfile,
    createController: createTeacherWorkflowStandaloneScoreEditorController,
    teacherWorkflow: Object.freeze({
      version: TEACHER_WORKFLOW_BROWSER_VERSION,
      bundled: true,
      canonicalAuthority: false,
      historyAuthority: 'EditorSessionV4',
      clipboard: 'revision-bound-read-only-copy-snapshot',
      paste: 'bounded-neutral-rest-overwrite',
      insert: 'bounded-insert-after-event-with-trailing-neutral-rest-capacity',
      transpose: 'octave-only-plus-minus-one-or-two',
      rendererCoordinateAuthority: false,
      domAuthoringAuthority: false,
      networkAuthority: false
    })
  });
};
