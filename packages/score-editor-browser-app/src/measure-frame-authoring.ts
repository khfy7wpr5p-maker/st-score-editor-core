import { addressEntityV3 } from '../../addressing-v3/src/index.js';
import {
  activeStaffAuthoringBrowserAppProfile,
  createActiveStaffAuthoringStandaloneBrowserAppRuntime,
  createActiveStaffAuthoringStandaloneScoreEditorController,
  type ActiveStaffAuthoringStandaloneScoreEditorController
} from './active-staff-authoring.js';
import type { ReleaseHardeningControllerOptions } from './release-hardened.js';

export const MEASURE_FRAME_AUTHORING_VERSION = '1.0.0' as const;

export const measureFrameAuthoringBrowserAppProfile = Object.freeze({
  ...activeStaffAuthoringBrowserAppProfile,
  measureFrameAuthoringBundled: true,
  measureFrameAuthoringCanonicalAuthority: false,
  measureFrameAppend: 'synthetic-new-score-end-only' as const,
  measureFrameMeterProofRequired: true,
  measureFrameHistory: 'EditorSessionV4' as const,
  importedMusicXmlAutomaticMeasureGrowth: false,
  measureFrameRendererCoordinateAuthority: false,
  measureFrameNetworkAuthority: false
});

export interface MeasureFrameAuthoringState {
  readonly version: typeof MEASURE_FRAME_AUTHORING_VERSION;
  readonly canAppendMeasure: boolean;
  readonly measureFrameCount: number;
  readonly status: 'READY' | 'NO_DOCUMENT' | 'ORIGIN_NOT_ADMITTED' | 'METER_EVIDENCE_MISSING';
}

export type MeasureFrameAuthoringErrorCode =
  | 'NO_DOCUMENT'
  | 'ORIGIN_NOT_ADMITTED'
  | 'METER_EVIDENCE_MISSING'
  | 'ID_UNAVAILABLE';

export class MeasureFrameAuthoringError extends Error {
  readonly code: MeasureFrameAuthoringErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: MeasureFrameAuthoringErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'MeasureFrameAuthoringError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const freshId = (prefix: string): string => {
  const cryptoValue = globalThis.crypto as Crypto | undefined;
  if (cryptoValue === undefined || typeof cryptoValue.randomUUID !== 'function') {
    throw new MeasureFrameAuthoringError('Browser randomUUID support is required for measure-frame identities.', 'ID_UNAVAILABLE');
  }
  return `${prefix}:${cryptoValue.randomUUID()}`;
};

const hasEffectiveMeter = (
  documentValue: NonNullable<ReturnType<ActiveStaffAuthoringStandaloneScoreEditorController['getDocument']>>
): boolean => {
  const score = documentValue.session.history.present.score;
  const declarations = new Map(documentValue.session.history.present.notation.frames.map(entry => [entry.target.frameId, entry.notation.timeSignature]));
  let active = null as { beats: number; beatType: number } | null;
  for (const frame of score.measureFrames) {
    const declaration = declarations.get(frame.id);
    if (declaration !== undefined && declaration !== null) active = declaration;
    if (active === null) return false;
  }
  return active !== null;
};

export interface MeasureFrameAuthoringStandaloneScoreEditorController extends Omit<ActiveStaffAuthoringStandaloneScoreEditorController, 'profile' | 'mount' | 'unmount'> {
  readonly profile: typeof measureFrameAuthoringBrowserAppProfile;
  readonly getMeasureFrameAuthoringState: () => Readonly<MeasureFrameAuthoringState>;
  readonly appendMeasure: () => Readonly<MeasureFrameAuthoringState>;
  readonly mount: (root: HTMLElement) => void;
  readonly unmount: () => void;
}

export const createMeasureFrameAuthoringStandaloneScoreEditorController = (
  options: ReleaseHardeningControllerOptions = {}
): Readonly<MeasureFrameAuthoringStandaloneScoreEditorController> => {
  const base = createActiveStaffAuthoringStandaloneScoreEditorController(options);
  let root: HTMLElement | null = null;

  const state = (): Readonly<MeasureFrameAuthoringState> => {
    const documentValue = base.getDocument();
    if (documentValue === null) {
      return Object.freeze({ version: MEASURE_FRAME_AUTHORING_VERSION, canAppendMeasure: false, measureFrameCount: 0, status: 'NO_DOCUMENT' });
    }
    const score = documentValue.session.history.present.score;
    if (documentValue.origin !== 'NEW' || score.source.format !== 'synthetic') {
      return Object.freeze({ version: MEASURE_FRAME_AUTHORING_VERSION, canAppendMeasure: false, measureFrameCount: score.measureFrames.length, status: 'ORIGIN_NOT_ADMITTED' });
    }
    if (!hasEffectiveMeter(documentValue)) {
      return Object.freeze({ version: MEASURE_FRAME_AUTHORING_VERSION, canAppendMeasure: false, measureFrameCount: score.measureFrames.length, status: 'METER_EVIDENCE_MISSING' });
    }
    return Object.freeze({ version: MEASURE_FRAME_AUTHORING_VERSION, canAppendMeasure: true, measureFrameCount: score.measureFrames.length, status: 'READY' });
  };

  const decorate = (): void => {
    if (root === null) return;
    const palette = root.querySelector<HTMLElement>('[data-st-authoring-palette]');
    if (palette === null) return;
    palette.querySelector('[data-st-measure-frame-authoring]')?.remove();
    const owner = palette.ownerDocument;
    const group = owner.createElement('div');
    group.className = 'stse-authoring-group';
    group.setAttribute('data-st-measure-frame-authoring', MEASURE_FRAME_AUTHORING_VERSION);
    group.setAttribute('aria-label', 'Measure');
    const button = owner.createElement('button');
    button.type = 'button';
    button.textContent = '+';
    button.setAttribute('aria-label', 'Add measure');
    button.disabled = !state().canAppendMeasure;
    button.addEventListener('click', () => { controller.appendMeasure(); });
    group.append(button);
    palette.append(group);
  };

  base.subscribe(() => { decorate(); });

  const controller: MeasureFrameAuthoringStandaloneScoreEditorController = {
    ...base,
    profile: measureFrameAuthoringBrowserAppProfile,
    getMeasureFrameAuthoringState: state,
    appendMeasure: () => {
      const documentValue = base.getDocument();
      if (documentValue === null) throw new MeasureFrameAuthoringError('Create a score first.', 'NO_DOCUMENT');
      const before = state();
      if (before.status === 'ORIGIN_NOT_ADMITTED') {
        throw new MeasureFrameAuthoringError('Measure growth is admitted only for new synthetic scores.', 'ORIGIN_NOT_ADMITTED');
      }
      if (before.status === 'METER_EVIDENCE_MISSING') {
        throw new MeasureFrameAuthoringError('Measure growth requires proven effective meter.', 'METER_EVIDENCE_MISSING');
      }
      if (!before.canAppendMeasure) throw new MeasureFrameAuthoringError('Measure growth is not currently admitted.', 'ORIGIN_NOT_ADMITTED');

      const score = documentValue.session.history.present.score;
      const contentStaffs = score.parts.flatMap(part => part.staves.filter(staff => staff.role !== 'tablature-linked'));
      const activeStaffId = base.getActiveStaffState().activeStaffId;
      const anchorStaff = contentStaffs.find(staff => staff.id === activeStaffId && staff.role === 'standard') ??
        contentStaffs.find(staff => staff.role === 'standard') ?? contentStaffs[0];
      if (anchorStaff === undefined) throw new MeasureFrameAuthoringError('No content staff is available for measure growth.', 'ORIGIN_NOT_ADMITTED');

      const frameId = freshId('frame');
      const staffRestIds = contentStaffs.map(staff => Object.freeze({
        staffId: staff.id,
        measureId: freshId('measure'),
        voiceId: freshId('voice'),
        restEventId: freshId('event')
      }));
      const anchorPlan = staffRestIds.find(plan => plan.staffId === anchorStaff.id);
      if (anchorPlan === undefined) throw new MeasureFrameAuthoringError('Measure identity plan lost the active staff.', 'ORIGIN_NOT_ADMITTED');

      const result = base.commitTopology({
        version: '1.0.0',
        type: 'APPEND_SYNTHETIC_MEASURE_FRAME',
        target: addressEntityV3(score, score.id),
        frameId,
        displayNumber: String(score.measureFrames.length + 1),
        staffRestIds
      }, { nextRevisionId: freshId('rev') });
      if (result.error !== null) throw Object.assign(new Error(result.error.message), { code: result.error.code });

      const nextDocument = base.getDocument();
      if (nextDocument === null) throw new MeasureFrameAuthoringError('Measure growth lost the active document.', 'NO_DOCUMENT');
      base.select(addressEntityV3(nextDocument.session.history.present.score, anchorPlan.restEventId));
      decorate();
      return state();
    },
    mount: (nextRoot) => { root = nextRoot; base.mount(nextRoot); decorate(); },
    unmount: () => { root = null; base.unmount(); }
  };

  return Object.freeze(controller);
};

export const createMeasureFrameAuthoringStandaloneBrowserAppRuntime = () => {
  const base = createActiveStaffAuthoringStandaloneBrowserAppRuntime();
  return Object.freeze({
    ...base,
    profile: measureFrameAuthoringBrowserAppProfile,
    createController: createMeasureFrameAuthoringStandaloneScoreEditorController,
    measureFrameAuthoring: Object.freeze({
      version: MEASURE_FRAME_AUTHORING_VERSION,
      bundled: true,
      canonicalAuthority: false,
      append: 'synthetic-new-score-end-only',
      meterProofRequired: true,
      history: 'EditorSessionV4',
      importedMusicXmlAutomaticGrowth: false,
      rendererCoordinateAuthority: false,
      networkAuthority: false
    })
  });
};
