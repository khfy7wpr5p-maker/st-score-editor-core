import { addressEntityV3, type EventAddressV3 } from '../../addressing-v3/src/index.js';
import {
  createEventSpanProfessionalSelectionV1,
  type ProfessionalSelectionV1
} from '../../editor-professional-selection-v1/src/index.js';
import type { TeacherCopySnapshotV4 } from '../../editor-teacher-copy-snapshot-v4/src/index.js';
import {
  SCORE_EDITOR_PROFESSIONAL_WORKSTATION_V1_VERSION,
  type ScoreEditorProfessionalWorkstationV1
} from '../../score-editor-professional-workstation-v1/src/index.js';
import {
  commitProfessionalRangeReplaceWorkstationV1,
  copyProfessionalRangeForReplaceV1,
  type ProfessionalRangeReplaceWorkstationOptionsV1
} from '../../score-editor-professional-range-replace-workstation-v1/src/index.js';
import type { ScoreEditorBrowserAppSnapshot } from '../../score-editor-browser-app/src/index.js';
import type { ProfessionalWorkstationControllerOptionsV1 } from '../../score-editor-browser-professional-workstation-v1/src/index.js';
import {
  createP10_3AProfessionalWorkstationStandaloneScoreEditorControllerV1,
  p10_3aProfessionalWorkstationBrowserAppProfile,
  type P10_3AProfessionalWorkstationStandaloneScoreEditorControllerV1
} from '../../score-editor-browser-professional-workstation-p10-3a-v1/src/index.js';

export const P10_3B_PROFESSIONAL_WORKSTATION_V1_VERSION = '1.0.0' as const;
export const P10_3B_RANGE_REPLACE_CONTROL_MIN_TOUCH_TARGET_PX = 44 as const;

export const P10_3B_RANGE_REPLACE_CONTROL_DEFINITIONS = Object.freeze([
  Object.freeze({ action: 'copy-range' as const, label: 'Copy Range' as const }),
  Object.freeze({ action: 'replace-range' as const, label: 'Replace' as const })
]);

export const P10_3B_RANGE_REPLACE_CONTROL_STYLE = `
[data-st-p10-3b-range-replace-control]{min-width:44px;min-height:44px;flex:0 0 auto;font:inherit;border:1px solid #c9c9cf;background:#fff;border-radius:8px;padding:8px 10px;touch-action:manipulation}
[data-st-p10-3b-range-replace-control]:disabled{opacity:.45}
`;

export const p10_3bProfessionalWorkstationBrowserAppProfile = Object.freeze({
  ...p10_3aProfessionalWorkstationBrowserAppProfile,
  p10_3bWorkstationComposition: true,
  p10_3bWorkstationVersion: P10_3B_PROFESSIONAL_WORKSTATION_V1_VERSION,
  p10_3aQualifiedBasePreserved: true,
  professionalRangeCopyAvailable: true,
  professionalRangeReplaceAvailable: true,
  professionalRangeReplaceCanonicalAuthority: false,
  professionalRangeReplaceHistoryAuthority: 'EditorHistoryV4' as const,
  professionalRangeReplaceRendererCoordinateAuthority: false,
  professionalRangeReplaceDomAuthoringAuthority: false,
  productionDefault: false,
  productionReleaseAuthorized: false,
  seslitabCutoverAuthorized: false
});

export type P10_3BClipboardStateV1 = 'EMPTY' | 'CURRENT' | 'STALE';

export interface P10_3BRangeReplaceStateV1 {
  readonly version: typeof P10_3B_PROFESSIONAL_WORKSTATION_V1_VERSION;
  readonly clipboardState: P10_3BClipboardStateV1;
  readonly clipboardAvailable: boolean;
  readonly clipboardCurrent: boolean;
  readonly clipboardStale: boolean;
  readonly clipboardEventCount: number;
  readonly clipboardNoteCount: number;
  readonly canCopyForReplace: boolean;
  readonly canAttemptReplace: boolean;
  readonly lastError: Readonly<{ readonly code: string; readonly message: string }> | null;
}

export type P10_3BProfessionalWorkstationStandaloneScoreEditorControllerV1 =
  Omit<P10_3AProfessionalWorkstationStandaloneScoreEditorControllerV1, 'profile' | 'mount' | 'unmount'> & {
    readonly profile: typeof p10_3bProfessionalWorkstationBrowserAppProfile;
    readonly getP10_3BRangeReplaceState: () => Readonly<P10_3BRangeReplaceStateV1>;
    readonly copyProfessionalRangeForReplace: () => Readonly<ScoreEditorBrowserAppSnapshot>;
    readonly replaceProfessionalRange: (
      options?: ProfessionalRangeReplaceWorkstationOptionsV1
    ) => Readonly<ScoreEditorBrowserAppSnapshot>;
    readonly mount: (root: HTMLElement) => void;
    readonly unmount: () => void;
    readonly disposeP10_3BRangeReplaceControls: () => void;
  };

const errorInfo = (
  error: unknown
): Readonly<{ readonly code: string; readonly message: string }> => {
  const value = error !== null && typeof error === 'object'
    ? error as { readonly code?: unknown; readonly message?: unknown; readonly name?: unknown }
    : null;
  const code = typeof value?.code === 'string' && value.code.length > 0
    ? value.code
    : typeof value?.name === 'string' && value.name.length > 0
      ? value.name
      : 'PROFESSIONAL_RANGE_REPLACE_FAILED';
  const technical = typeof value?.message === 'string' && value.message.length > 0
    ? value.message
    : 'Professional range replacement failed.';
  const messages: Readonly<Record<string, string>> = Object.freeze({
    SELECTION_KIND_UNSUPPORTED: 'Replace için kesintisiz bir aralık seçin.',
    CLIPBOARD_STALE: 'Nota değiştiği için kopyalanan aralık artık güncel değil. Yeniden kopyalayın.',
    REPLACE_EXTENT_MISMATCH: 'Kaynak ve hedef aralığın toplam süresi aynı olmalıdır.',
    SOURCE_DESTINATION_OVERLAP: 'Kaynak ve hedef aralık birbiriyle çakışamaz.',
    SOURCE_RELATION_UNSUPPORTED: 'Kaynak aralık güvenli şekilde taşınamayan bağlı nota işaretleri içeriyor.',
    DESTINATION_RELATION_UNSUPPORTED: 'Hedef aralık güvenli şekilde değiştirilemeyen bağlı nota işaretleri içeriyor.'
  });
  return Object.freeze({ code, message: messages[code] ?? technical });
};

const browserRevisionId = (): string => {
  const cryptoValue = globalThis.crypto as Crypto | undefined;
  if (cryptoValue === undefined || typeof cryptoValue.randomUUID !== 'function') {
    throw Object.assign(
      new Error('Browser randomUUID support is required for a P10-3B range replacement revision.'),
      { code: 'REVISION_ID_UNAVAILABLE' }
    );
  }
  return `p10-3b:${cryptoValue.randomUUID()}`;
};

const eventAddressById = (
  controller: P10_3AProfessionalWorkstationStandaloneScoreEditorControllerV1,
  eventId: string
): EventAddressV3 => {
  const documentValue = controller.getDocument();
  if (documentValue === null) {
    throw Object.assign(new Error('No active score document.'), { code: 'NO_DOCUMENT' });
  }
  const address = addressEntityV3(documentValue.session.history.present.score, eventId);
  if (address.kind !== 'event') {
    throw Object.assign(new Error('Professional range endpoint is not a current event.'), {
      code: 'RANGE_TARGET_INVALID'
    });
  }
  return address;
};

export const createP10_3BProfessionalWorkstationStandaloneScoreEditorControllerV1 = (
  options: ProfessionalWorkstationControllerOptionsV1 = {}
): Readonly<P10_3BProfessionalWorkstationStandaloneScoreEditorControllerV1> => {
  const base = createP10_3AProfessionalWorkstationStandaloneScoreEditorControllerV1(options);
  const revisionIdFactory = options.professionalRevisionIdFactory
    ?? options.revisionIdFactory
    ?? browserRevisionId;

  let clipboardState: P10_3BClipboardStateV1 = 'EMPTY';
  let clipboard: Readonly<TeacherCopySnapshotV4> | null = null;
  let lastError: Readonly<{ readonly code: string; readonly message: string }> | null = null;
  let root: HTMLElement | null = null;
  let disposed = false;
  let lastDocumentId = base.getDocument()?.session.history.present.score.id ?? null;
  let lastRevisionId = base.getSnapshot().revisionId;

  const clearClipboard = (): void => {
    clipboardState = 'EMPTY';
    clipboard = null;
  };

  const staleClipboard = (): void => {
    if (clipboardState === 'CURRENT') clipboardState = 'STALE';
  };

  const currentProfessionalSelection = (): Readonly<ProfessionalSelectionV1> | null =>
    base.professional.getProfessionalSelection();

  const rangeSelection = (): Readonly<ProfessionalSelectionV1> | null => {
    const existing = currentProfessionalSelection();
    if (existing !== null) return existing;
    const range = base.getProfessionalRangeToolbarState();
    if (
      !range.rangeReady ||
      range.rangeStartEventId === null ||
      range.rangeStopEventId === null
    ) return null;
    const documentValue = base.getDocument();
    if (documentValue === null) return null;
    return createEventSpanProfessionalSelectionV1(
      documentValue.session.history.present.score,
      eventAddressById(base, range.rangeStartEventId),
      eventAddressById(base, range.rangeStopEventId)
    );
  };

  const currentWorkstation = (
    selection: ProfessionalSelectionV1
  ): Readonly<ScoreEditorProfessionalWorkstationV1> => {
    const documentValue = base.getDocument();
    if (documentValue === null) {
      throw Object.assign(new Error('No active score document.'), { code: 'NO_DOCUMENT' });
    }
    return Object.freeze({
      version: SCORE_EDITOR_PROFESSIONAL_WORKSTATION_V1_VERSION,
      document: documentValue,
      professionalSelection: selection
    });
  };

  const state = (): Readonly<P10_3BRangeReplaceStateV1> => {
    const selection = rangeSelection();
    const current = clipboardState === 'CURRENT';
    return Object.freeze({
      version: P10_3B_PROFESSIONAL_WORKSTATION_V1_VERSION,
      clipboardState,
      clipboardAvailable: clipboardState !== 'EMPTY',
      clipboardCurrent: current,
      clipboardStale: clipboardState === 'STALE',
      clipboardEventCount: clipboard?.eventCount ?? 0,
      clipboardNoteCount: clipboard?.noteCount ?? 0,
      canCopyForReplace: selection?.kind === 'EVENT_SPAN',
      canAttemptReplace: current && selection?.kind === 'EVENT_SPAN',
      lastError
    });
  };

  const snapshotWithError = (): Readonly<ScoreEditorBrowserAppSnapshot> =>
    lastError === null
      ? base.getSnapshot()
      : Object.freeze({ ...base.getSnapshot(), error: lastError });

  const nextOptions = (
    provided?: ProfessionalRangeReplaceWorkstationOptionsV1
  ): ProfessionalRangeReplaceWorkstationOptionsV1 =>
    provided ?? Object.freeze({ nextRevisionId: revisionIdFactory() });

  const copyRange = (): Readonly<ScoreEditorBrowserAppSnapshot> => {
    try {
      const selection = rangeSelection();
      if (selection === null) {
        throw Object.assign(new Error('Önce bir nota aralığı seçin.'), { code: 'RANGE_NOT_READY' });
      }
      const next = copyProfessionalRangeForReplaceV1(currentWorkstation(selection));
      clipboard = next;
      clipboardState = 'CURRENT';
      lastError = null;
      decorate();
      return base.getSnapshot();
    } catch (error) {
      clearClipboard();
      lastError = errorInfo(error);
      decorate();
      return snapshotWithError();
    }
  };

  const replaceRange = (
    provided?: ProfessionalRangeReplaceWorkstationOptionsV1
  ): Readonly<ScoreEditorBrowserAppSnapshot> => {
    try {
      if (clipboardState !== 'CURRENT' || clipboard === null) {
        throw Object.assign(
          new Error(clipboardState === 'STALE'
            ? 'Nota değiştiği için kopyalanan aralık artık güncel değil. Yeniden kopyalayın.'
            : 'Önce kaynak aralığı kopyalayın.'),
          { code: clipboardState === 'STALE' ? 'CLIPBOARD_STALE' : 'REPLACE_CLIPBOARD_EMPTY' }
        );
      }
      const selection = rangeSelection();
      if (selection === null) {
        throw Object.assign(new Error('Önce hedef nota aralığını seçin.'), { code: 'RANGE_NOT_READY' });
      }
      if (selection.kind !== 'EVENT_SPAN') {
        throw Object.assign(new Error('Replace için kesintisiz bir aralık seçin.'), {
          code: 'SELECTION_KIND_UNSUPPORTED'
        });
      }

      const result = commitProfessionalRangeReplaceWorkstationV1(
        currentWorkstation(selection),
        clipboard,
        nextOptions(provided)
      );
      const adopted = base.adoptValidatedSnapshot(result.document);
      if (adopted.error !== null) {
        throw Object.assign(new Error(adopted.error.message), { code: adopted.error.code });
      }
      if (result.professionalSelection?.kind === 'EVENT_SPAN') {
        const selected = base.professional.selectEventSpan(
          result.professionalSelection.anchor,
          result.professionalSelection.focus
        );
        if (selected.error !== null) {
          throw Object.assign(new Error(selected.error.message), { code: selected.error.code });
        }
      }
      staleClipboard();
      lastError = null;
      decorate();
      return base.getSnapshot();
    } catch (error) {
      const info = errorInfo(error);
      if (info.code === 'CLIPBOARD_STALE') staleClipboard();
      lastError = info;
      decorate();
      return snapshotWithError();
    }
  };

  const addButton = (
    owner: Document,
    parent: HTMLElement,
    action: string,
    label: string,
    ariaLabel: string,
    disabled: boolean,
    handler: () => void
  ): void => {
    const button = owner.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.setAttribute('aria-label', ariaLabel);
    button.setAttribute('data-st-p10-3b-range-replace-control', action);
    button.disabled = disabled;
    button.addEventListener('click', handler);
    parent.append(button);
  };

  const decorate = (): void => {
    if (root === null || disposed) return;
    const app = root.querySelector<HTMLElement>('[data-st-score-editor-app]');
    if (app === null) return;
    app.querySelectorAll('[data-st-p10-3b-range-replace-control]').forEach(node => node.remove());
    if (app.querySelector('[data-st-p10-3b-range-replace-style]') === null) {
      const style = app.ownerDocument.createElement('style');
      style.setAttribute(
        'data-st-p10-3b-range-replace-style',
        P10_3B_PROFESSIONAL_WORKSTATION_V1_VERSION
      );
      style.textContent = P10_3B_RANGE_REPLACE_CONTROL_STYLE;
      app.append(style);
    }

    const current = state();
    const owner = app.ownerDocument;
    const toolbar = app.querySelector<HTMLElement>('[data-st-professional-range-toolbar]');
    if (toolbar !== null) {
      addButton(
        owner, toolbar, 'copy-range', 'Copy Range',
        'Copy professional range for replacement',
        !current.canCopyForReplace,
        () => { controller.copyProfessionalRangeForReplace(); }
      );
      addButton(
        owner, toolbar, 'replace-range', 'Replace',
        'Replace professional range from copied range',
        !current.canAttemptReplace,
        () => { controller.replaceProfessionalRange(); }
      );
    }

    const mobile = app.querySelector<HTMLElement>('[data-st-mobile-teacher-toolbar]');
    if (mobile !== null) {
      addButton(
        owner, mobile, 'copy-range-mobile', 'Copy',
        'Copy professional range for replacement',
        !current.canCopyForReplace,
        () => { controller.copyProfessionalRangeForReplace(); }
      );
      addButton(
        owner, mobile, 'replace-range-mobile', 'Replace',
        'Replace professional range from copied range',
        !current.canAttemptReplace,
        () => { controller.replaceProfessionalRange(); }
      );
    }

    if (lastError !== null) {
      const status = app.querySelector<HTMLElement>('.stse-status');
      const statusCode = status?.querySelector<HTMLElement>('strong') ?? null;
      const statusMessage = status?.querySelector<HTMLElement>('.stse-status-message') ?? null;
      if (statusCode !== null) {
        statusCode.textContent = lastError.code;
        statusCode.classList.add('stse-error');
      }
      if (statusMessage !== null) statusMessage.textContent = lastError.message;
    }
  };

  const unsubscribeBase = base.subscribe((snapshot) => {
    if (disposed) return;
    const documentValue = base.getDocument();
    const documentId = documentValue?.session.history.present.score.id ?? null;
    if (documentId !== lastDocumentId) {
      clearClipboard();
      lastDocumentId = documentId;
    } else if (snapshot.revisionId !== lastRevisionId) {
      staleClipboard();
    }
    lastRevisionId = snapshot.revisionId;
    decorate();
  });

  const controller = {
    ...base,
    profile: p10_3bProfessionalWorkstationBrowserAppProfile,
    getP10_3BRangeReplaceState: state,
    copyProfessionalRangeForReplace: copyRange,
    replaceProfessionalRange: replaceRange,
    mount: (nextRoot: HTMLElement) => {
      if (disposed) throw Object.assign(new Error('P10-3B controller is disposed.'), { code: 'CONTROLLER_DISPOSED' });
      base.mount(nextRoot);
      root = nextRoot;
      decorate();
    },
    unmount: () => {
      clearClipboard();
      lastError = null;
      root = null;
      base.unmount();
    }
  };

  return Object.freeze({
    ...controller,
    disposeP10_3BRangeReplaceControls: () => {
      if (disposed) return;
      disposed = true;
      root = null;
      clearClipboard();
      lastError = null;
      unsubscribeBase();
      base.disposeP10_3APitchControls();
    }
  }) as Readonly<P10_3BProfessionalWorkstationStandaloneScoreEditorControllerV1>;
};

export const createP10_3BProfessionalWorkstationStandaloneBrowserAppRuntimeV1 = () => Object.freeze({
  runtimeVersion: P10_3B_PROFESSIONAL_WORKSTATION_V1_VERSION,
  profile: p10_3bProfessionalWorkstationBrowserAppProfile,
  createController: createP10_3BProfessionalWorkstationStandaloneScoreEditorControllerV1,
  p10_3bWorkstation: Object.freeze({
    version: P10_3B_PROFESSIONAL_WORKSTATION_V1_VERSION,
    p10_3aQualifiedBasePreserved: true,
    rangeCopyAvailable: true,
    rangeReplaceAvailable: true,
    canonicalAuthority: false,
    historyAuthority: 'EditorHistoryV4',
    rendererCoordinateAuthority: false,
    domAuthoringAuthority: false,
    productionDefault: false,
    productionReleaseAuthorized: false,
    seslitabCutoverAuthorized: false
  })
});
