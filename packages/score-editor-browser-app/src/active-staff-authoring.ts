import type { Rational, ScoreEvent } from '../../score-model/src/index.js';
import {
  addressEntityV3,
  resolveSemanticAddressV3,
  type SemanticAddressV3
} from '../../addressing-v3/src/index.js';
import {
  createSelectedNoteEditingStandaloneBrowserAppRuntime,
  createSelectedNoteEditingStandaloneScoreEditorController,
  selectedNoteEditingBrowserAppProfile,
  type SelectedNoteEditingStandaloneScoreEditorController
} from './selected-note-editing.js';
import type { ReleaseHardeningControllerOptions } from './release-hardened.js';

export const ACTIVE_STAFF_AUTHORING_VERSION = '1.0.0' as const;

export const activeStaffAuthoringBrowserAppProfile = Object.freeze({
  ...selectedNoteEditingBrowserAppProfile,
  activeStaffAuthoringBundled: true,
  activeStaffCanonicalAuthority: false,
  activeStaffSelection: 'same-part-same-frame-semantic-only' as const,
  activeStaffHistoryMutationAuthority: false,
  activeStaffVoiceMaterializationAuthority: false,
  newScoreInitialSelection: 'first-standard-staff-first-frame-voice1-explicit-event' as const,
  newScoreInitialSelectionHistoryMutationAuthority: false,
  activeStaffRendererCoordinateAuthority: false,
  activeStaffNetworkAuthority: false
});

export type ActiveStaffAuthoringErrorCode =
  | 'NO_DOCUMENT'
  | 'STAFF_CONTEXT_REQUIRED'
  | 'STAFF_NOT_AVAILABLE'
  | 'TARGET_FRAME_MISSING';

export class ActiveStaffAuthoringError extends Error {
  readonly code: ActiveStaffAuthoringErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: ActiveStaffAuthoringErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ActiveStaffAuthoringError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

export interface ActiveStaffChoice {
  readonly staffId: string;
  readonly ordinal: number;
}

export interface ActiveStaffAuthoringState {
  readonly version: typeof ACTIVE_STAFF_AUTHORING_VERSION;
  readonly activeStaffId: string | null;
  readonly activeStaffOrdinal: number | null;
  readonly availableStaffs: readonly Readonly<ActiveStaffChoice>[];
  readonly hasFrameContext: boolean;
}

type StaffContext = Readonly<{
  partId: string;
  staffId: string;
  frameId: string | null;
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

export interface ActiveStaffAuthoringStandaloneScoreEditorController extends Omit<SelectedNoteEditingStandaloneScoreEditorController, 'profile' | 'mount' | 'unmount'> {
  readonly profile: typeof activeStaffAuthoringBrowserAppProfile;
  readonly getActiveStaffState: () => Readonly<ActiveStaffAuthoringState>;
  readonly setActiveStaff: (staffId: string) => Readonly<ActiveStaffAuthoringState>;
  readonly mount: (root: HTMLElement) => void;
  readonly unmount: () => void;
}

export const createActiveStaffAuthoringStandaloneScoreEditorController = (
  options: ReleaseHardeningControllerOptions = {}
): Readonly<ActiveStaffAuthoringStandaloneScoreEditorController> => {
  const base = createSelectedNoteEditingStandaloneScoreEditorController(options);
  let root: HTMLElement | null = null;

  const currentContext = (): StaffContext | null => {
    const documentValue = base.getDocument();
    if (documentValue === null) return null;
    const score = documentValue.session.history.present.score;
    const selection = documentValue.session.selection;
    if (selection === null || selection.kind === 'document' || selection.kind === 'measure-frame' || selection.kind === 'part') return null;

    const partId = selection.partId;
    const staffId = selection.staffId;
    if (selection.kind === 'staff') return Object.freeze({ partId, staffId, frameId: null, onset: null });
    if (!frameBearing(selection)) return null;

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
    return Object.freeze({ partId, staffId, frameId: selection.frameId, onset });
  };

  const availableFor = (context: StaffContext | null): readonly Readonly<ActiveStaffChoice>[] => {
    const documentValue = base.getDocument();
    if (documentValue === null || context === null) return Object.freeze([]);
    const part = documentValue.session.history.present.score.parts.find(item => item.id === context.partId);
    if (part === undefined) return Object.freeze([]);
    return Object.freeze(part.staves
      .filter(staff => staff.role === 'standard')
      .map(staff => Object.freeze({ staffId: staff.id, ordinal: staff.ordinal })));
  };

  const state = (): Readonly<ActiveStaffAuthoringState> => {
    const context = currentContext();
    const availableStaffs = availableFor(context);
    const active = context === null ? null : availableStaffs.find(item => item.staffId === context.staffId) ?? null;
    return Object.freeze({
      version: ACTIVE_STAFF_AUTHORING_VERSION,
      activeStaffId: active?.staffId ?? null,
      activeStaffOrdinal: active?.ordinal ?? null,
      availableStaffs,
      hasFrameContext: context?.frameId !== null && context?.frameId !== undefined
    });
  };

  const selectInitialNewScoreAnchor = (): void => {
    const documentValue = base.getDocument();
    if (documentValue === null || documentValue.origin !== 'NEW') return;
    const score = documentValue.session.history.present.score;
    const staff = score.parts[0]?.staves.find(item => item.role === 'standard');
    if (staff === undefined || staff.role !== 'standard') return;
    const measure = staff.measures[0];
    const voice = measure?.voices.find(item => item.ordinal === 1) ?? measure?.voices[0];
    const event = voice?.events[0];
    const targetId = event?.id ?? voice?.id ?? measure?.id ?? staff.id;
    base.select(addressEntityV3(score, targetId));
  };

  const decorate = (): void => {
    if (root === null) return;
    const palette = root.querySelector<HTMLElement>('[data-st-authoring-palette]');
    if (palette === null) return;
    palette.querySelector('[data-st-active-staff-authoring]')?.remove();
    const owner = palette.ownerDocument;
    const current = state();
    const group = owner.createElement('div');
    group.className = 'stse-authoring-group';
    group.setAttribute('data-st-active-staff-authoring', ACTIVE_STAFF_AUTHORING_VERSION);
    group.setAttribute('aria-label', 'Staff');
    for (const choice of current.availableStaffs) {
      const button = owner.createElement('button');
      button.type = 'button';
      button.textContent = `S${choice.ordinal}`;
      button.setAttribute('aria-label', `Staff ${choice.ordinal}`);
      button.setAttribute('aria-pressed', current.activeStaffId === choice.staffId ? 'true' : 'false');
      button.disabled = !current.hasFrameContext;
      button.addEventListener('click', () => { controller.setActiveStaff(choice.staffId); });
      group.append(button);
    }
    palette.prepend(group);
  };

  base.subscribe(() => { decorate(); });

  const controller: ActiveStaffAuthoringStandaloneScoreEditorController = {
    ...base,
    profile: activeStaffAuthoringBrowserAppProfile,
    newDocument: (newOptions) => {
      const snapshot = base.newDocument(newOptions);
      if (snapshot.error === null) selectInitialNewScoreAnchor();
      decorate();
      return base.getSnapshot();
    },
    getActiveStaffState: state,
    setActiveStaff: (staffId) => {
      const documentValue = base.getDocument();
      if (documentValue === null) throw new ActiveStaffAuthoringError('Create or open a score first.', 'NO_DOCUMENT');
      const score = documentValue.session.history.present.score;
      const context = currentContext();
      if (context === null || context.frameId === null) {
        throw new ActiveStaffAuthoringError('Select a measure, voice or timed score event before switching Staff.', 'STAFF_CONTEXT_REQUIRED');
      }
      const part = score.parts.find(item => item.id === context.partId);
      const targetStaff = part?.staves.find(item => item.id === staffId && item.role === 'standard');
      if (targetStaff === undefined || targetStaff.role !== 'standard') {
        throw new ActiveStaffAuthoringError('Requested Staff is not an available standard staff in the selected part.', 'STAFF_NOT_AVAILABLE', { staffId, partId: context.partId });
      }
      const targetMeasure = targetStaff.measures.find(measure => measure.frameId === context.frameId);
      if (targetMeasure === undefined) {
        throw new ActiveStaffAuthoringError('Requested Staff has no measure in the selected measure frame.', 'TARGET_FRAME_MISSING', { staffId, frameId: context.frameId });
      }

      const activeVoiceOrdinal = base.getAuthoringState().activeVoiceOrdinal;
      const targetVoice = targetMeasure.voices.find(voice => voice.ordinal === activeVoiceOrdinal);
      let targetId = targetMeasure.id;
      if (targetVoice !== undefined) {
        targetId = targetVoice.id;
        if (context.onset !== null) {
          const event = containingEvent(targetVoice.events, context.onset);
          if (event !== null) targetId = event.id;
        }
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

export const createActiveStaffAuthoringStandaloneBrowserAppRuntime = () => {
  const base = createSelectedNoteEditingStandaloneBrowserAppRuntime();
  return Object.freeze({
    ...base,
    profile: activeStaffAuthoringBrowserAppProfile,
    createController: createActiveStaffAuthoringStandaloneScoreEditorController,
    activeStaffAuthoring: Object.freeze({
      version: ACTIVE_STAFF_AUTHORING_VERSION,
      bundled: true,
      canonicalAuthority: false,
      selection: 'same-part-same-frame-semantic-only',
      historyMutationAuthority: false,
      voiceMaterializationAuthority: false,
      newScoreInitialSelection: 'first-standard-staff-first-frame-voice1-explicit-event',
      newScoreInitialSelectionHistoryMutationAuthority: false,
      rendererCoordinateAuthority: false,
      networkAuthority: false
    })
  });
};
