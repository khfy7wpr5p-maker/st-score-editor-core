import type { Rational, ScoreEvent } from '../../score-model/src/index.js';
import {
  addressEntityV3,
  resolveSemanticAddressV3,
  type SemanticAddressV3
} from '../../addressing-v3/src/index.js';
import {
  createMeasureFrameAuthoringStandaloneBrowserAppRuntime,
  createMeasureFrameAuthoringStandaloneScoreEditorController,
  measureFrameAuthoringBrowserAppProfile,
  type MeasureFrameAuthoringStandaloneScoreEditorController
} from './measure-frame-authoring.js';
import type { ReleaseHardeningControllerOptions } from './release-hardened.js';

export const MEASURE_NAVIGATION_VERSION = '1.0.0' as const;

export const measureNavigationBrowserAppProfile = Object.freeze({
  ...measureFrameAuthoringBrowserAppProfile,
  measureNavigationBundled: true,
  measureNavigationCanonicalAuthority: false,
  measureNavigationSelection: 'same-part-same-staff-adjacent-frame-semantic-only' as const,
  measureNavigationHistoryMutationAuthority: false,
  measureNavigationVoiceMaterializationAuthority: false,
  measureNavigationOnsetCarry: 'exact-containing-event-when-available' as const,
  importedMusicXmlMeasureNavigation: true,
  measureNavigationRendererCoordinateAuthority: false,
  measureNavigationNetworkAuthority: false
});

export interface MeasureNavigationState {
  readonly version: typeof MEASURE_NAVIGATION_VERSION;
  readonly activeFrameId: string | null;
  readonly activeFrameOrdinal: number | null;
  readonly activeFrameDisplayNumber: string | null;
  readonly measureFrameCount: number;
  readonly canPrevious: boolean;
  readonly canNext: boolean;
  readonly status: 'READY' | 'NO_DOCUMENT' | 'FRAME_CONTEXT_REQUIRED';
}

export type MeasureNavigationDirection = 'PREVIOUS' | 'NEXT';
export type MeasureNavigationErrorCode =
  | 'NO_DOCUMENT'
  | 'FRAME_CONTEXT_REQUIRED'
  | 'TARGET_FRAME_NOT_AVAILABLE'
  | 'TARGET_STAFF_MEASURE_MISSING';

export class MeasureNavigationError extends Error {
  readonly code: MeasureNavigationErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: MeasureNavigationErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'MeasureNavigationError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

type MeasureContext = Readonly<{
  partId: string;
  staffId: string;
  frameId: string;
  onset: Rational | null;
}>;

const ZERO = Object.freeze({ numerator: 0, denominator: 1 }) as Rational;
const compare = (left: Rational, right: Rational): number => {
  const l = BigInt(left.numerator) * BigInt(right.denominator);
  const r = BigInt(right.numerator) * BigInt(left.denominator);
  return l < r ? -1 : l > r ? 1 : 0;
};
const add = (left: Rational, right: Rational): Rational => {
  const numerator = BigInt(left.numerator) * BigInt(right.denominator) + BigInt(right.numerator) * BigInt(left.denominator);
  const denominator = BigInt(left.denominator) * BigInt(right.denominator);
  const gcd = (a: bigint, b: bigint): bigint => {
    let x = a < 0n ? -a : a, y = b < 0n ? -b : b;
    while (y !== 0n) [x, y] = [y, x % y];
    return x;
  };
  const divisor = gcd(numerator, denominator);
  return Object.freeze({ numerator: Number(numerator / divisor), denominator: Number(denominator / divisor) });
};
const containingEvent = (events: readonly ScoreEvent[], onset: Rational): ScoreEvent | null =>
  events.find(event => compare(event.onset, onset) <= 0 && compare(onset, add(event.onset, event.duration)) < 0) ?? null;

const frameBearing = (selection: SemanticAddressV3): selection is Exclude<SemanticAddressV3, { kind: 'document' | 'measure-frame' | 'part' | 'staff' }> =>
  selection.kind !== 'document' && selection.kind !== 'measure-frame' && selection.kind !== 'part' && selection.kind !== 'staff';

export interface MeasureNavigationStandaloneScoreEditorController extends Omit<MeasureFrameAuthoringStandaloneScoreEditorController, 'profile' | 'mount' | 'unmount'> {
  readonly profile: typeof measureNavigationBrowserAppProfile;
  readonly getMeasureNavigationState: () => Readonly<MeasureNavigationState>;
  readonly navigateMeasure: (direction: MeasureNavigationDirection) => Readonly<MeasureNavigationState>;
  readonly mount: (root: HTMLElement) => void;
  readonly unmount: () => void;
}

export const createMeasureNavigationStandaloneScoreEditorController = (
  options: ReleaseHardeningControllerOptions = {}
): Readonly<MeasureNavigationStandaloneScoreEditorController> => {
  const base = createMeasureFrameAuthoringStandaloneScoreEditorController(options);
  let root: HTMLElement | null = null;

  const currentContext = (): MeasureContext | null => {
    const documentValue = base.getDocument();
    if (documentValue === null) return null;
    const score = documentValue.session.history.present.score;
    const selection = documentValue.session.selection;
    if (selection === null || !frameBearing(selection)) return null;

    let onset: Rational | null = null;
    if (selection.kind === 'event' || selection.kind === 'note') {
      const eventAddress = addressEntityV3(score, selection.eventId);
      if (eventAddress.kind === 'event') {
        const resolved = resolveSemanticAddressV3(score, eventAddress);
        if (resolved.kind === 'event') onset = resolved.value.onset;
      }
    } else if (selection.kind === 'measure' || selection.kind === 'voice') {
      onset = ZERO;
    }
    return Object.freeze({ partId: selection.partId, staffId: selection.staffId, frameId: selection.frameId, onset });
  };

  const hasTargetMeasure = (context: MeasureContext, frameId: string): boolean => {
    const documentValue = base.getDocument();
    if (documentValue === null) return false;
    const part = documentValue.session.history.present.score.parts.find(item => item.id === context.partId);
    const staff = part?.staves.find(item => item.id === context.staffId);
    return staff?.measures.some(measure => measure.frameId === frameId) ?? false;
  };

  const state = (): Readonly<MeasureNavigationState> => {
    const documentValue = base.getDocument();
    if (documentValue === null) {
      return Object.freeze({
        version: MEASURE_NAVIGATION_VERSION,
        activeFrameId: null,
        activeFrameOrdinal: null,
        activeFrameDisplayNumber: null,
        measureFrameCount: 0,
        canPrevious: false,
        canNext: false,
        status: 'NO_DOCUMENT'
      });
    }
    const score = documentValue.session.history.present.score;
    const context = currentContext();
    if (context === null) {
      return Object.freeze({
        version: MEASURE_NAVIGATION_VERSION,
        activeFrameId: null,
        activeFrameOrdinal: null,
        activeFrameDisplayNumber: null,
        measureFrameCount: score.measureFrames.length,
        canPrevious: false,
        canNext: false,
        status: 'FRAME_CONTEXT_REQUIRED'
      });
    }
    const index = score.measureFrames.findIndex(frame => frame.id === context.frameId);
    if (index < 0) {
      return Object.freeze({
        version: MEASURE_NAVIGATION_VERSION,
        activeFrameId: null,
        activeFrameOrdinal: null,
        activeFrameDisplayNumber: null,
        measureFrameCount: score.measureFrames.length,
        canPrevious: false,
        canNext: false,
        status: 'FRAME_CONTEXT_REQUIRED'
      });
    }
    const frame = score.measureFrames[index];
    const previous = index > 0 ? score.measureFrames[index - 1] : undefined;
    const next = index + 1 < score.measureFrames.length ? score.measureFrames[index + 1] : undefined;
    return Object.freeze({
      version: MEASURE_NAVIGATION_VERSION,
      activeFrameId: frame?.id ?? null,
      activeFrameOrdinal: frame?.ordinal ?? null,
      activeFrameDisplayNumber: frame?.displayNumber ?? null,
      measureFrameCount: score.measureFrames.length,
      canPrevious: previous !== undefined && hasTargetMeasure(context, previous.id),
      canNext: next !== undefined && hasTargetMeasure(context, next.id),
      status: 'READY'
    });
  };

  const decorate = (): void => {
    if (root === null) return;
    const palette = root.querySelector<HTMLElement>('[data-st-authoring-palette]');
    if (palette === null) return;
    palette.querySelector('[data-st-measure-navigation]')?.remove();
    const owner = palette.ownerDocument;
    const current = state();
    const group = owner.createElement('div');
    group.className = 'stse-authoring-group';
    group.setAttribute('data-st-measure-navigation', MEASURE_NAVIGATION_VERSION);
    group.setAttribute('aria-label', 'Measure navigation');

    const previous = owner.createElement('button');
    previous.type = 'button';
    previous.textContent = '‹';
    previous.setAttribute('aria-label', 'Previous measure');
    previous.disabled = !current.canPrevious;
    previous.addEventListener('click', () => { controller.navigateMeasure('PREVIOUS'); });

    const indicator = owner.createElement('span');
    indicator.setAttribute('data-st-active-measure', 'true');
    const ordinal = current.activeFrameOrdinal === null ? '–' : String(current.activeFrameOrdinal);
    indicator.textContent = `M${ordinal}/${current.measureFrameCount}`;
    indicator.setAttribute('aria-label', current.activeFrameOrdinal === null
      ? `No active measure of ${current.measureFrameCount}`
      : `Measure ${current.activeFrameOrdinal} of ${current.measureFrameCount}`);

    const next = owner.createElement('button');
    next.type = 'button';
    next.textContent = '›';
    next.setAttribute('aria-label', 'Next measure');
    next.disabled = !current.canNext;
    next.addEventListener('click', () => { controller.navigateMeasure('NEXT'); });

    group.append(previous, indicator, next);
    palette.append(group);
  };

  base.subscribe(() => { decorate(); });

  const controller: MeasureNavigationStandaloneScoreEditorController = {
    ...base,
    profile: measureNavigationBrowserAppProfile,
    getMeasureNavigationState: state,
    navigateMeasure: (direction) => {
      const documentValue = base.getDocument();
      if (documentValue === null) throw new MeasureNavigationError('Create or open a score first.', 'NO_DOCUMENT');
      const score = documentValue.session.history.present.score;
      const context = currentContext();
      if (context === null) {
        throw new MeasureNavigationError('Select a measure, voice or timed score event before navigating measures.', 'FRAME_CONTEXT_REQUIRED');
      }
      const currentIndex = score.measureFrames.findIndex(frame => frame.id === context.frameId);
      const offset = direction === 'PREVIOUS' ? -1 : 1;
      const targetFrame = currentIndex < 0 ? undefined : score.measureFrames[currentIndex + offset];
      if (targetFrame === undefined) {
        throw new MeasureNavigationError('Requested adjacent measure frame is not available.', 'TARGET_FRAME_NOT_AVAILABLE', {
          direction,
          frameId: context.frameId
        });
      }

      const part = score.parts.find(item => item.id === context.partId);
      const staff = part?.staves.find(item => item.id === context.staffId);
      const targetMeasure = staff?.measures.find(measure => measure.frameId === targetFrame.id);
      if (targetMeasure === undefined) {
        throw new MeasureNavigationError('Selected Staff has no measure in the requested global measure frame.', 'TARGET_STAFF_MEASURE_MISSING', {
          staffId: context.staffId,
          frameId: targetFrame.id
        });
      }

      const activeVoiceOrdinal = base.getAuthoringState().activeVoiceOrdinal;
      const targetVoice = targetMeasure.voices.find(voice => voice.ordinal === activeVoiceOrdinal);
      let targetId = targetMeasure.id;
      if (targetVoice !== undefined) {
        targetId = targetVoice.id;
        const event = context.onset === null ? targetVoice.events[0] ?? null : containingEvent(targetVoice.events, context.onset);
        if (event !== null) targetId = event.id;
      }
      base.select(addressEntityV3(score, targetId));
      decorate();
      return state();
    },
    mount: (nextRoot) => { root = nextRoot; base.mount(nextRoot); decorate(); },
    unmount: () => { root = null; base.unmount(); }
  };

  return Object.freeze(controller);
};

export const createMeasureNavigationStandaloneBrowserAppRuntime = () => {
  const base = createMeasureFrameAuthoringStandaloneBrowserAppRuntime();
  return Object.freeze({
    ...base,
    profile: measureNavigationBrowserAppProfile,
    createController: createMeasureNavigationStandaloneScoreEditorController,
    measureNavigation: Object.freeze({
      version: MEASURE_NAVIGATION_VERSION,
      bundled: true,
      canonicalAuthority: false,
      selection: 'same-part-same-staff-adjacent-frame-semantic-only',
      historyMutationAuthority: false,
      voiceMaterializationAuthority: false,
      onsetCarry: 'exact-containing-event-when-available',
      importedMusicXmlNavigation: true,
      rendererCoordinateAuthority: false,
      networkAuthority: false
    })
  });
};
