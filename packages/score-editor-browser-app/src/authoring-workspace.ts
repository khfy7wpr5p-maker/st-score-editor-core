import type { Pitch, Rational, ScoreEvent } from '../../score-model/src/index.js';
import {
  addressEntityV3,
  resolveSemanticAddressV3,
  type MeasureAddressV3,
  type SemanticAddressV3
} from '../../addressing-v3/src/index.js';
import {
  ACTIVE_VOICE_ORDINALS_V4,
  activeVoiceAvailabilityV4,
  createActiveVoiceInsertionPositionV4,
  resolveActiveVoiceAddressV4,
  type ActiveVoiceOrdinalV4
} from '../../editor-active-voice-v4/src/index.js';
import {
  createReleaseHardenedStandaloneBrowserAppRuntime,
  createReleaseHardenedStandaloneScoreEditorController,
  releaseHardenedBrowserAppProfile,
  type ReleaseHardenedStandaloneScoreEditorController,
  type ReleaseHardeningControllerOptions
} from './release-hardened.js';

export const AUTHORING_WORKSPACE_VERSION = '1.0.0' as const;
export const AUTHORING_PITCH_STEPS = Object.freeze(['C','D','E','F','G','A','B'] as const);
export const AUTHORING_DURATIONS = Object.freeze([
  Object.freeze({ label: '1', value: Object.freeze({ numerator: 1, denominator: 1 }) }),
  Object.freeze({ label: '1/2', value: Object.freeze({ numerator: 1, denominator: 2 }) }),
  Object.freeze({ label: '1/4', value: Object.freeze({ numerator: 1, denominator: 4 }) }),
  Object.freeze({ label: '1/8', value: Object.freeze({ numerator: 1, denominator: 8 }) }),
  Object.freeze({ label: '1/16', value: Object.freeze({ numerator: 1, denominator: 16 }) })
] as const);

export const authoringWorkspaceBrowserAppProfile = Object.freeze({
  ...releaseHardenedBrowserAppProfile,
  authoringWorkspaceBundled: true,
  authoringWorkspaceCanonicalAuthority: false,
  activeVoicePresentationState: true,
  activeVoiceOrdinals: ACTIVE_VOICE_ORDINALS_V4,
  missingVoiceMaterialization: 'synthetic-proven-measure-only' as const,
  positionNoteEntry: 'explicit-rest-only' as const,
  rendererCoordinateTimingAuthority: false,
  noteEntryHistory: 'EditorSessionV4' as const,
  authoringNetworkAuthority: false
});

export interface AuthoringWorkspaceStatus {
  readonly code: string;
  readonly message: string;
  readonly error: boolean;
}

export interface AuthoringWorkspaceState {
  readonly version: typeof AUTHORING_WORKSPACE_VERSION;
  readonly activeVoiceOrdinal: ActiveVoiceOrdinalV4;
  readonly pitch: Pitch;
  readonly duration: Rational;
  readonly availableVoices: readonly ActiveVoiceOrdinalV4[];
  readonly canEnterAtSelection: boolean;
  readonly status: Readonly<AuthoringWorkspaceStatus> | null;
}

export type AuthoringWorkspaceErrorCode =
  | 'NO_DOCUMENT'
  | 'MEASURE_CONTEXT_REQUIRED'
  | 'EVENT_ANCHOR_REQUIRED'
  | 'VOICE_NOT_PRESENT'
  | 'ENTRY_REST_REQUIRED'
  | 'INVALID_VOICE'
  | 'INVALID_PITCH'
  | 'INVALID_DURATION'
  | 'ID_UNAVAILABLE';

export class AuthoringWorkspaceError extends Error {
  readonly code: AuthoringWorkspaceErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: AuthoringWorkspaceErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'AuthoringWorkspaceError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const AUTHORING_STYLE = `
.stse-authoring-palette{display:flex;gap:6px;flex:0 0 auto}.stse-authoring-group{display:flex;gap:4px;padding-right:8px;border-right:1px solid #e0e0e4;align-items:center}.stse-authoring-group button,.stse-authoring-group select{font:inherit;border:1px solid #c9c9cf;background:#fff;border-radius:7px;padding:7px 9px;cursor:pointer}.stse-authoring-group button[aria-pressed="true"]{font-weight:750;outline:2px solid currentColor;outline-offset:-2px}.stse-authoring-group button:disabled,.stse-authoring-group select:disabled{opacity:.45;cursor:not-allowed}.stse-authoring-octave{width:52px}
`;

type PitchStep = typeof AUTHORING_PITCH_STEPS[number];
const ZERO = Object.freeze({ numerator: 0, denominator: 1 }) as Rational;

const abs = (value: bigint): bigint => value < 0n ? -value : value;
const gcd = (left: bigint, right: bigint): bigint => {
  let a = abs(left), b = abs(right);
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
};
const rational = (numerator: bigint, denominator: bigint): Rational => {
  if (numerator < 0n || denominator <= 0n) throw new AuthoringWorkspaceError('Authoring rational is invalid.', 'INVALID_DURATION');
  const divisor = gcd(numerator, denominator);
  const n = numerator / divisor, d = denominator / divisor;
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (n > max || d > max) throw new AuthoringWorkspaceError('Authoring rational exceeds safe bounds.', 'INVALID_DURATION');
  return Object.freeze({ numerator: Number(n), denominator: Number(d) });
};
const compare = (left: Rational, right: Rational): number => {
  const l = BigInt(left.numerator) * BigInt(right.denominator);
  const r = BigInt(right.numerator) * BigInt(left.denominator);
  return l < r ? -1 : l > r ? 1 : 0;
};
const add = (left: Rational, right: Rational): Rational => rational(
  BigInt(left.numerator) * BigInt(right.denominator) + BigInt(right.numerator) * BigInt(left.denominator),
  BigInt(left.denominator) * BigInt(right.denominator)
);
const eventEnd = (event: ScoreEvent): Rational => add(event.onset, event.duration);

const statusFromError = (error: unknown): Readonly<AuthoringWorkspaceStatus> => {
  const value = error !== null && typeof error === 'object' ? error as { readonly code?: unknown; readonly message?: unknown; readonly name?: unknown } : null;
  return Object.freeze({
    code: typeof value?.code === 'string' ? value.code : typeof value?.name === 'string' ? value.name : 'AUTHORING_FAILED',
    message: typeof value?.message === 'string' ? value.message : 'Authoring action failed.',
    error: true
  });
};
const okStatus = (code: string, message: string): Readonly<AuthoringWorkspaceStatus> => Object.freeze({ code, message, error: false });

const freshId = (prefix: string): string => {
  const cryptoValue = globalThis.crypto as Crypto | undefined;
  if (cryptoValue === undefined || typeof cryptoValue.randomUUID !== 'function') {
    throw new AuthoringWorkspaceError('Browser randomUUID support is required for authoring identities.', 'ID_UNAVAILABLE');
  }
  return `${prefix}:${cryptoValue.randomUUID()}`;
};

const measureAddressFor = (
  score: NonNullable<ReturnType<ReleaseHardenedStandaloneScoreEditorController['getDocument']>>['session']['history']['present']['score'],
  selection: SemanticAddressV3 | null
): MeasureAddressV3 => {
  if (selection === null) throw new AuthoringWorkspaceError('Select a score event or measure before choosing a Voice.', 'MEASURE_CONTEXT_REQUIRED');
  let measureId: string | null = null;
  switch (selection.kind) {
    case 'measure': measureId = selection.measureId; break;
    case 'voice':
    case 'event':
    case 'note':
    case 'grace-group':
    case 'grace-event':
    case 'grace-note': measureId = selection.measureId; break;
    default: break;
  }
  if (measureId === null) throw new AuthoringWorkspaceError('Current selection has no measure context.', 'MEASURE_CONTEXT_REQUIRED', { kind: selection.kind });
  const address = addressEntityV3(score, measureId);
  if (address.kind !== 'measure') throw new AuthoringWorkspaceError('Measure context did not resolve canonically.', 'MEASURE_CONTEXT_REQUIRED');
  return address;
};

const anchorEventFor = (
  score: NonNullable<ReturnType<ReleaseHardenedStandaloneScoreEditorController['getDocument']>>['session']['history']['present']['score'],
  selection: SemanticAddressV3 | null
): Readonly<{ address: Extract<SemanticAddressV3, { kind: 'event' }>; event: ScoreEvent }> => {
  if (selection === null || (selection.kind !== 'event' && selection.kind !== 'note')) {
    throw new AuthoringWorkspaceError('Select a timed score event before entering a note.', 'EVENT_ANCHOR_REQUIRED');
  }
  const eventAddress = selection.kind === 'event' ? selection : addressEntityV3(score, selection.eventId);
  if (eventAddress.kind !== 'event') throw new AuthoringWorkspaceError('Selection event identity did not resolve.', 'EVENT_ANCHOR_REQUIRED');
  const resolved = resolveSemanticAddressV3(score, eventAddress);
  if (resolved.kind !== 'event') throw new AuthoringWorkspaceError('Selection did not resolve to a timed event.', 'EVENT_ANCHOR_REQUIRED');
  return Object.freeze({ address: eventAddress, event: resolved.value });
};

const voiceOrdinalForSelection = (
  score: NonNullable<ReturnType<ReleaseHardenedStandaloneScoreEditorController['getDocument']>>['session']['history']['present']['score'],
  selection: SemanticAddressV3 | null
): ActiveVoiceOrdinalV4 | null => {
  if (selection === null) return null;
  let voiceId: string | null = null;
  switch (selection.kind) {
    case 'voice':
    case 'event':
    case 'note':
    case 'grace-group':
    case 'grace-event':
    case 'grace-note': voiceId = selection.voiceId; break;
    default: return null;
  }
  const address = addressEntityV3(score, voiceId);
  if (address.kind !== 'voice') return null;
  const resolved = resolveSemanticAddressV3(score, address);
  if (resolved.kind !== 'voice') return null;
  return (ACTIVE_VOICE_ORDINALS_V4 as readonly number[]).includes(resolved.value.ordinal)
    ? resolved.value.ordinal as ActiveVoiceOrdinalV4
    : null;
};

const containingEvent = (events: readonly ScoreEvent[], onset: Rational): ScoreEvent | null =>
  events.find(event => compare(event.onset, onset) <= 0 && compare(onset, eventEnd(event)) < 0) ?? null;

export interface AuthoringWorkspaceStandaloneScoreEditorController extends Omit<ReleaseHardenedStandaloneScoreEditorController, 'profile' | 'mount' | 'unmount'> {
  readonly profile: typeof authoringWorkspaceBrowserAppProfile;
  readonly getAuthoringState: () => Readonly<AuthoringWorkspaceState>;
  readonly setActiveVoice: (ordinal: number) => Readonly<AuthoringWorkspaceState>;
  readonly setEntryPitch: (step: string, alter: number, octave: number) => Readonly<AuthoringWorkspaceState>;
  readonly setEntryDuration: (duration: Rational) => Readonly<AuthoringWorkspaceState>;
  readonly enterNoteAtSelection: () => Readonly<AuthoringWorkspaceState>;
  readonly mount: (root: HTMLElement) => void;
  readonly unmount: () => void;
}

export const createAuthoringWorkspaceStandaloneScoreEditorController = (
  options: ReleaseHardeningControllerOptions = {}
): Readonly<AuthoringWorkspaceStandaloneScoreEditorController> => {
  const base = createReleaseHardenedStandaloneScoreEditorController(options);
  let root: HTMLElement | null = null;
  let activeVoiceOrdinal: ActiveVoiceOrdinalV4 = 1;
  let pitch: Pitch = Object.freeze({ step: 'C', alter: 0, octave: 4 });
  let duration: Rational = Object.freeze({ numerator: 1, denominator: 4 });
  let status: Readonly<AuthoringWorkspaceStatus> | null = null;
  let observedDocumentId: string | null = null;

  const currentAvailability = (): readonly ActiveVoiceOrdinalV4[] => {
    const document = base.getDocument();
    if (document === null || document.session.selection === null) return Object.freeze([]);
    try {
      const measure = measureAddressFor(document.session.history.present.score, document.session.selection);
      return activeVoiceAvailabilityV4(document.session.history.present.score, measure);
    } catch {
      return Object.freeze([]);
    }
  };

  const canEnter = (): boolean => {
    const document = base.getDocument();
    if (document === null) return false;
    try {
      const anchor = anchorEventFor(document.session.history.present.score, document.session.selection);
      const measure = measureAddressFor(document.session.history.present.score, anchor.address);
      const voiceAddress = resolveActiveVoiceAddressV4(document.session.history.present.score, measure, activeVoiceOrdinal);
      const voice = resolveSemanticAddressV3(document.session.history.present.score, voiceAddress);
      if (voice.kind !== 'voice') return false;
      const end = add(anchor.event.onset, duration);
      return voice.value.events.some(event => event.kind === 'rest' && compare(event.onset, anchor.event.onset) <= 0 && compare(end, eventEnd(event)) <= 0);
    } catch {
      return false;
    }
  };

  const state = (): Readonly<AuthoringWorkspaceState> => Object.freeze({
    version: AUTHORING_WORKSPACE_VERSION,
    activeVoiceOrdinal,
    pitch: Object.freeze({ ...pitch }),
    duration: Object.freeze({ ...duration }),
    availableVoices: currentAvailability(),
    canEnterAtSelection: canEnter(),
    status
  });

  const syncFromDocument = (): void => {
    const document = base.getDocument();
    const documentId = document?.session.history.present.score.id ?? null;
    if (documentId !== observedDocumentId) {
      observedDocumentId = documentId;
      activeVoiceOrdinal = 1;
      pitch = Object.freeze({ step: 'C', alter: 0, octave: 4 });
      duration = Object.freeze({ numerator: 1, denominator: 4 });
      status = null;
    }
    if (document !== null) {
      const ordinal = voiceOrdinalForSelection(document.session.history.present.score, document.session.selection);
      if (ordinal !== null) activeVoiceOrdinal = ordinal;
    }
  };

  const decorateStatus = (app: HTMLElement): void => {
    if (status === null) return;
    const footer = app.querySelector<HTMLElement>('.stse-status');
    const code = footer?.querySelector<HTMLElement>('strong');
    const message = footer?.querySelector<HTMLElement>('.stse-status-message');
    if (code !== null && code !== undefined) {
      code.textContent = status.code;
      code.classList.toggle('stse-error', status.error);
    }
    if (message !== null && message !== undefined) message.textContent = status.message;
  };

  const makeButton = (
    owner: Document,
    label: string,
    ariaLabel: string,
    pressed: boolean,
    disabled: boolean,
    onClick: () => void
  ): HTMLButtonElement => {
    const button = owner.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.setAttribute('aria-label', ariaLabel);
    button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    button.disabled = disabled;
    button.addEventListener('click', onClick);
    return button;
  };

  const decorate = (): void => {
    if (root === null) return;
    syncFromDocument();
    const app = root.querySelector<HTMLElement>('[data-st-score-editor-app]');
    if (app === null) return;
    if (app.querySelector('[data-st-authoring-workspace-style]') === null) {
      const style = app.ownerDocument.createElement('style');
      style.setAttribute('data-st-authoring-workspace-style', AUTHORING_WORKSPACE_VERSION);
      style.textContent = AUTHORING_STYLE;
      app.append(style);
    }
    const keypad = app.querySelector<HTMLElement>('.stse-keypad');
    if (keypad === null || keypad.querySelector('[data-st-authoring-palette]') !== null) {
      decorateStatus(app);
      return;
    }
    const owner = app.ownerDocument;
    const palette = owner.createElement('div');
    palette.className = 'stse-authoring-palette';
    palette.setAttribute('data-st-authoring-palette', AUTHORING_WORKSPACE_VERSION);
    palette.setAttribute('aria-label', 'Note entry');

    const document = base.getDocument();
    let hasMeasureContext = false;
    if (document !== null) {
      try { measureAddressFor(document.session.history.present.score, document.session.selection); hasMeasureContext = true; } catch { /* no measure selection */ }
    }

    const voices = owner.createElement('div'); voices.className = 'stse-authoring-group'; voices.setAttribute('aria-label', 'Voice');
    for (const ordinal of ACTIVE_VOICE_ORDINALS_V4) {
      voices.append(makeButton(owner, `V${ordinal}`, `Voice ${ordinal}`, activeVoiceOrdinal === ordinal, !hasMeasureContext, () => { controller.setActiveVoice(ordinal); }));
    }

    const pitches = owner.createElement('div'); pitches.className = 'stse-authoring-group'; pitches.setAttribute('aria-label', 'Pitch');
    for (const step of AUTHORING_PITCH_STEPS) {
      pitches.append(makeButton(owner, step, `Pitch ${step}`, pitch.step === step, document === null, () => { controller.setEntryPitch(step, pitch.alter, pitch.octave); }));
    }

    const accidentals = owner.createElement('div'); accidentals.className = 'stse-authoring-group'; accidentals.setAttribute('aria-label', 'Accidental');
    for (const item of [{ label: '♭', alter: -1 }, { label: '♮', alter: 0 }, { label: '♯', alter: 1 }]) {
      accidentals.append(makeButton(owner, item.label, item.alter === -1 ? 'Flat' : item.alter === 0 ? 'Natural' : 'Sharp', pitch.alter === item.alter, document === null, () => { controller.setEntryPitch(pitch.step, item.alter, pitch.octave); }));
    }
    const octave = owner.createElement('select'); octave.className = 'stse-authoring-octave'; octave.setAttribute('aria-label', 'Octave'); octave.disabled = document === null;
    for (let value = 2; value <= 6; value += 1) {
      const option = owner.createElement('option'); option.value = String(value); option.textContent = String(value); octave.append(option);
    }
    octave.value = String(Math.min(6, Math.max(2, pitch.octave)));
    octave.addEventListener('change', () => { controller.setEntryPitch(pitch.step, pitch.alter, Number(octave.value)); });
    accidentals.append(octave);

    const durations = owner.createElement('div'); durations.className = 'stse-authoring-group'; durations.setAttribute('aria-label', 'Entry duration');
    for (const item of AUTHORING_DURATIONS) {
      const selected = item.value.numerator === duration.numerator && item.value.denominator === duration.denominator;
      durations.append(makeButton(owner, item.label, `Duration ${item.label}`, selected, document === null, () => { controller.setEntryDuration(item.value); }));
    }

    const entry = owner.createElement('div'); entry.className = 'stse-authoring-group'; entry.setAttribute('aria-label', 'Enter note');
    const enter = makeButton(owner, 'Note', 'Enter note at selected event time', false, !canEnter(), () => { controller.enterNoteAtSelection(); });
    enter.setAttribute('data-st-enter-note', 'true');
    entry.append(enter);

    palette.append(voices, pitches, accidentals, durations, entry);
    keypad.prepend(palette);
    decorateStatus(app);
  };

  const authoringAction = (operation: () => void): Readonly<AuthoringWorkspaceState> => {
    try {
      operation();
    } catch (error) {
      status = statusFromError(error);
    }
    decorate();
    return state();
  };

  base.subscribe(() => { decorate(); });

  const controller: AuthoringWorkspaceStandaloneScoreEditorController = {
    ...base,
    profile: authoringWorkspaceBrowserAppProfile,
    getAuthoringState: state,
    setActiveVoice: (rawOrdinal) => authoringAction(() => {
      if (!(ACTIVE_VOICE_ORDINALS_V4 as readonly number[]).includes(rawOrdinal)) {
        throw new AuthoringWorkspaceError('Voice must be between 1 and 5.', 'INVALID_VOICE', { rawOrdinal });
      }
      const ordinal = rawOrdinal as ActiveVoiceOrdinalV4;
      const document = base.getDocument();
      if (document === null) throw new AuthoringWorkspaceError('Create or open a score first.', 'NO_DOCUMENT');
      const score = document.session.history.present.score;
      const selection = document.session.selection;
      const measure = measureAddressFor(score, selection);
      let anchorOnset: Rational = ZERO;
      try { anchorOnset = anchorEventFor(score, selection).event.onset; } catch { /* measure/voice selection uses measure start for selection only */ }
      const available = activeVoiceAvailabilityV4(score, measure);
      if (!available.includes(ordinal)) {
        const result = base.commitVoiceMaterialization({
          version: '1.0.0',
          type: 'MATERIALIZE_VOICE',
          target: measure,
          voiceOrdinal: ordinal,
          voiceId: freshId('voice'),
          restEventId: freshId('event')
        }, { nextRevisionId: freshId('rev') });
        if (result.error !== null) throw Object.assign(new Error(result.error.message), { code: result.error.code });
      }
      activeVoiceOrdinal = ordinal;
      const nextDocument = base.getDocument();
      if (nextDocument === null) throw new AuthoringWorkspaceError('Active document disappeared.', 'NO_DOCUMENT');
      const nextScore = nextDocument.session.history.present.score;
      const nextMeasure = addressEntityV3(nextScore, measure.measureId);
      if (nextMeasure.kind !== 'measure') throw new AuthoringWorkspaceError('Measure context became invalid.', 'MEASURE_CONTEXT_REQUIRED');
      const voiceAddress = resolveActiveVoiceAddressV4(nextScore, nextMeasure, ordinal);
      const resolvedVoice = resolveSemanticAddressV3(nextScore, voiceAddress);
      if (resolvedVoice.kind !== 'voice') throw new AuthoringWorkspaceError('Active Voice did not resolve.', 'VOICE_NOT_PRESENT');
      const event = containingEvent(resolvedVoice.value.events, anchorOnset);
      base.select(event === null ? voiceAddress : addressEntityV3(nextScore, event.id));
      status = okStatus('ACTIVE_VOICE_READY', `Voice ${ordinal} is active.`);
    }),
    setEntryPitch: (rawStep, alter, octave) => authoringAction(() => {
      if (!(AUTHORING_PITCH_STEPS as readonly string[]).includes(rawStep) || !Number.isInteger(alter) || alter < -2 || alter > 2 || !Number.isInteger(octave) || octave < -1 || octave > 9) {
        throw new AuthoringWorkspaceError('Pitch selection is outside the admitted score pitch domain.', 'INVALID_PITCH');
      }
      pitch = Object.freeze({ step: rawStep as PitchStep, alter, octave });
      status = okStatus('ENTRY_PITCH_READY', `${rawStep}${alter === 0 ? '' : alter > 0 ? '#' : 'b'}${octave}`);
    }),
    setEntryDuration: (rawDuration) => authoringAction(() => {
      const admitted = AUTHORING_DURATIONS.some(item => item.value.numerator === rawDuration.numerator && item.value.denominator === rawDuration.denominator);
      if (!admitted) throw new AuthoringWorkspaceError('Duration is not in the bounded note-entry palette.', 'INVALID_DURATION');
      duration = Object.freeze({ numerator: rawDuration.numerator, denominator: rawDuration.denominator });
      status = okStatus('ENTRY_DURATION_READY', `Duration ${rawDuration.numerator}/${rawDuration.denominator}.`);
    }),
    enterNoteAtSelection: () => authoringAction(() => {
      const document = base.getDocument();
      if (document === null) throw new AuthoringWorkspaceError('Create or open a score first.', 'NO_DOCUMENT');
      const score = document.session.history.present.score;
      const anchor = anchorEventFor(score, document.session.selection);
      const measure = measureAddressFor(score, anchor.address);
      let voiceAddress;
      try { voiceAddress = resolveActiveVoiceAddressV4(score, measure, activeVoiceOrdinal); }
      catch { throw new AuthoringWorkspaceError(`Voice ${activeVoiceOrdinal} is not present. Activate it first.`, 'VOICE_NOT_PRESENT'); }
      const resolvedVoice = resolveSemanticAddressV3(score, voiceAddress);
      if (resolvedVoice.kind !== 'voice') throw new AuthoringWorkspaceError('Active Voice did not resolve canonically.', 'VOICE_NOT_PRESENT');
      const end = add(anchor.event.onset, duration);
      const rests = resolvedVoice.value.events.filter(event => event.kind === 'rest' && compare(event.onset, anchor.event.onset) <= 0 && compare(end, eventEnd(event)) <= 0);
      if (rests.length !== 1) throw new AuthoringWorkspaceError('Active Voice has no single explicit rest covering the selected note window.', 'ENTRY_REST_REQUIRED', { restCount: rests.length });
      const rest = rests[0]!;
      const position = createActiveVoiceInsertionPositionV4(score, measure, activeVoiceOrdinal, anchor.event.onset);
      const result = base.commitPositionNoteEntry(position, {
        version: '1.0.0',
        type: 'ENTER_NOTE_AT_POSITION',
        noteId: freshId('note'),
        pitch,
        duration,
        leadingRestEventId: compare(anchor.event.onset, rest.onset) > 0 ? freshId('event') : null,
        trailingRestEventId: compare(end, eventEnd(rest)) < 0 ? freshId('event') : null
      }, { nextRevisionId: freshId('rev') });
      if (result.error !== null) throw Object.assign(new Error(result.error.message), { code: result.error.code });
      status = okStatus('NOTE_ENTERED', `Note entered in Voice ${activeVoiceOrdinal}.`);
    }),
    mount: (nextRoot) => { root = nextRoot; base.mount(nextRoot); decorate(); },
    unmount: () => { root = null; base.unmount(); }
  };
  return Object.freeze(controller);
};

export const createAuthoringWorkspaceStandaloneBrowserAppRuntime = () => {
  const base = createReleaseHardenedStandaloneBrowserAppRuntime();
  return Object.freeze({
    ...base,
    profile: authoringWorkspaceBrowserAppProfile,
    createController: createAuthoringWorkspaceStandaloneScoreEditorController,
    authoringWorkspace: Object.freeze({
      version: AUTHORING_WORKSPACE_VERSION,
      bundled: true,
      canonicalAuthority: false,
      activeVoiceOrdinals: ACTIVE_VOICE_ORDINALS_V4,
      pitchSteps: AUTHORING_PITCH_STEPS,
      durations: AUTHORING_DURATIONS,
      missingVoiceMaterialization: 'synthetic-proven-measure-only',
      positionNoteEntry: 'explicit-rest-only',
      rendererCoordinateTimingAuthority: false,
      history: 'EditorSessionV4',
      networkAuthority: false
    })
  });
};
