import {
  addressEntityV3,
  type MeasureAddressV3,
  type MeasureFrameAddressV3,
  type SemanticAddressV3
} from '../../addressing-v3/src/index.js';
import type { BarlineSpec, ClefSpec, KeySignature, TimeSignature } from '../../notation-structure/src/index.js';
import {
  createProfessionalRangeToolbarStandaloneBrowserAppRuntimeV1,
  createProfessionalRangeToolbarStandaloneScoreEditorControllerV1,
  professionalRangeToolbarBrowserAppProfile,
  type ProfessionalRangeToolbarOptions,
  type ProfessionalRangeToolbarStandaloneScoreEditorControllerV1
} from '../../score-editor-browser-professional-ui-v1/src/index.js';
import type { ScoreEditorBrowserAppSnapshot } from '../../score-editor-browser-app/src/index.js';

export const PROFESSIONAL_STRUCTURE_INSPECTOR_V1_VERSION = '1.0.0' as const;
export const PROFESSIONAL_STRUCTURE_INSPECTOR_MIN_TOUCH_TARGET_PX = 44 as const;

export const professionalStructureInspectorBrowserAppProfile = Object.freeze({
  ...professionalRangeToolbarBrowserAppProfile,
  professionalStructureInspectorAvailable: true,
  professionalStructureInspectorCanonicalAuthority: false,
  professionalStructureInspectorSelectionAuthority: 'SemanticAddressV3-current-revision' as const,
  professionalStructureInspectorMutationAuthority: 'P08-D-professional-workstation' as const,
  professionalStructureInspectorHistoryAuthority: 'EditorHistoryV4' as const,
  professionalStructureInspectorStaffFields: Object.freeze(['key-signature', 'clef'] as const),
  professionalStructureInspectorFrameFields: Object.freeze(['time-signature', 'barline-repeat'] as const),
  professionalStructureInspectorMinimumTouchTargetPx: PROFESSIONAL_STRUCTURE_INSPECTOR_MIN_TOUCH_TARGET_PX,
  professionalStructureInspectorRendererCoordinateAuthority: false,
  professionalStructureInspectorDomAuthoringAuthority: false,
  professionalStructureInspectorNetworkAuthority: false
});

export interface ProfessionalStructureInspectorOptionsV1 extends ProfessionalRangeToolbarOptions {
  readonly structureRevisionIdFactory?: () => string;
}

export type ProfessionalClefPresetV1 = 'TREBLE' | 'BASS' | 'ALTO' | 'TENOR' | 'PERCUSSION' | 'TAB' | 'NONE';
export type ProfessionalBarlinePresetV1 = 'NONE' | 'REGULAR_RIGHT' | 'FINAL_RIGHT' | 'REPEAT_START' | 'REPEAT_END' | 'REPEAT_BOTH';

export interface ProfessionalStructureInspectorStateV1 {
  readonly version: typeof PROFESSIONAL_STRUCTURE_INSPECTOR_V1_VERSION;
  readonly mounted: boolean;
  readonly hasDocument: boolean;
  readonly selectionKind: SemanticAddressV3['kind'] | null;
  readonly measureTargetId: string | null;
  readonly frameTargetId: string | null;
  readonly canEditStaffStructure: boolean;
  readonly canEditFrameStructure: boolean;
  readonly keySignature: Readonly<KeySignature> | null;
  readonly clef: Readonly<ClefSpec> | null;
  readonly timeSignature: Readonly<TimeSignature> | null;
  readonly barlines: readonly Readonly<BarlineSpec>[];
  readonly lastError: Readonly<{ readonly code: string; readonly message: string }> | null;
}

export type ProfessionalStructureInspectorErrorCodeV1 =
  | 'NO_DOCUMENT'
  | 'STAFF_MEASURE_SELECTION_REQUIRED'
  | 'MEASURE_FRAME_SELECTION_REQUIRED'
  | 'INVALID_CLEF_PRESET'
  | 'INVALID_BARLINE_PRESET'
  | 'INVALID_KEY_SIGNATURE'
  | 'INVALID_TIME_SIGNATURE'
  | 'REVISION_ID_UNAVAILABLE';

export class ProfessionalStructureInspectorErrorV1 extends Error {
  readonly code: ProfessionalStructureInspectorErrorCodeV1;
  constructor(message: string, code: ProfessionalStructureInspectorErrorCodeV1) {
    super(message);
    this.name = 'ProfessionalStructureInspectorErrorV1';
    this.code = code;
    Object.freeze(this);
  }
}

export const PROFESSIONAL_STRUCTURE_INSPECTOR_STYLE = `
.stse-professional-structure{margin-top:12px;padding-top:12px;border-top:1px solid #e0e0e4}
.stse-professional-structure h3{font-size:13px;margin:0 0 8px}
.stse-professional-structure-grid{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;align-items:center}
.stse-professional-structure label{font-size:12px;color:#5f5f67}
.stse-professional-structure select,.stse-professional-structure input,.stse-professional-structure button{font:inherit;min-height:44px;border:1px solid #c9c9cf;background:#fff;border-radius:8px;padding:7px 9px;touch-action:manipulation}
.stse-professional-structure button{min-width:64px;cursor:pointer}
.stse-professional-structure button:disabled,.stse-professional-structure select:disabled,.stse-professional-structure input:disabled{opacity:.45;cursor:not-allowed}
.stse-professional-meter-fields{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:5px}
.stse-professional-structure-context{font-size:11px;color:#6c6c73;margin:0 0 8px;overflow-wrap:anywhere}
@media(max-width:760px){.stse-professional-structure{margin-top:8px;padding-top:8px}.stse-professional-structure-grid{grid-template-columns:minmax(0,1fr) auto}}
`;

const CLEF_PRESETS: Readonly<Record<Exclude<ProfessionalClefPresetV1, 'NONE'>, Readonly<ClefSpec>>> = Object.freeze({
  TREBLE: Object.freeze({ sign: 'G', line: 2, octaveChange: 0 }),
  BASS: Object.freeze({ sign: 'F', line: 4, octaveChange: 0 }),
  ALTO: Object.freeze({ sign: 'C', line: 3, octaveChange: 0 }),
  TENOR: Object.freeze({ sign: 'C', line: 4, octaveChange: 0 }),
  PERCUSSION: Object.freeze({ sign: 'percussion', line: 3, octaveChange: 0 }),
  TAB: Object.freeze({ sign: 'TAB', line: 5, octaveChange: 0 })
});

const BARLINE_PRESETS: Readonly<Record<ProfessionalBarlinePresetV1, readonly Readonly<BarlineSpec>[]>> = Object.freeze({
  NONE: Object.freeze([]),
  REGULAR_RIGHT: Object.freeze([Object.freeze({ location: 'right', style: 'regular', repeat: null })]),
  FINAL_RIGHT: Object.freeze([Object.freeze({ location: 'right', style: 'light-heavy', repeat: null })]),
  REPEAT_START: Object.freeze([Object.freeze({ location: 'left', style: 'heavy-light', repeat: 'forward' })]),
  REPEAT_END: Object.freeze([Object.freeze({ location: 'right', style: 'light-heavy', repeat: 'backward' })]),
  REPEAT_BOTH: Object.freeze([
    Object.freeze({ location: 'left', style: 'heavy-light', repeat: 'forward' }),
    Object.freeze({ location: 'right', style: 'light-heavy', repeat: 'backward' })
  ])
});

const browserRevisionId = (): string => {
  const cryptoValue = globalThis.crypto as Crypto | undefined;
  if (cryptoValue === undefined || typeof cryptoValue.randomUUID !== 'function') {
    throw new ProfessionalStructureInspectorErrorV1(
      'Browser randomUUID support is required for professional structure edit revisions.',
      'REVISION_ID_UNAVAILABLE'
    );
  }
  return `rev:${cryptoValue.randomUUID()}`;
};

const errorInfo = (error: unknown): Readonly<{ readonly code: string; readonly message: string }> => {
  const record = error !== null && typeof error === 'object'
    ? error as { readonly code?: unknown; readonly name?: unknown; readonly message?: unknown }
    : null;
  return Object.freeze({
    code: typeof record?.code === 'string'
      ? record.code
      : typeof record?.name === 'string'
        ? record.name
        : 'PROFESSIONAL_STRUCTURE_OPERATION_FAILED',
    message: typeof record?.message === 'string'
      ? record.message
      : 'Professional structure operation failed.'
  });
};

const measureIdFromSelection = (selection: SemanticAddressV3 | null): string | null => {
  if (selection === null) return null;
  switch (selection.kind) {
    case 'measure':
    case 'voice':
    case 'event':
    case 'note':
    case 'grace-group':
    case 'grace-event':
    case 'grace-note':
      return selection.measureId;
    default:
      return null;
  }
};

const frameIdFromSelection = (selection: SemanticAddressV3 | null): string | null => {
  if (selection === null) return null;
  if (selection.kind === 'measure-frame') return selection.frameId;
  switch (selection.kind) {
    case 'measure':
    case 'voice':
    case 'event':
    case 'note':
    case 'grace-group':
    case 'grace-event':
    case 'grace-note':
      return selection.frameId;
    default:
      return null;
  }
};

const measureTarget = (
  base: ProfessionalRangeToolbarStandaloneScoreEditorControllerV1
): MeasureAddressV3 | null => {
  const document = base.getDocument();
  if (document === null) return null;
  const id = measureIdFromSelection(document.session.selection);
  if (id === null) return null;
  const address = addressEntityV3(document.session.history.present.score, id);
  return address.kind === 'measure' ? address : null;
};

const frameTarget = (
  base: ProfessionalRangeToolbarStandaloneScoreEditorControllerV1
): MeasureFrameAddressV3 | null => {
  const document = base.getDocument();
  if (document === null) return null;
  const id = frameIdFromSelection(document.session.selection);
  if (id === null) return null;
  const address = addressEntityV3(document.session.history.present.score, id);
  return address.kind === 'measure-frame' ? address : null;
};

const parseKey = (value: number | null): Readonly<KeySignature> | null => {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || value < -7 || value > 7) {
    throw new ProfessionalStructureInspectorErrorV1(
      'Key signature fifths must be an integer from -7 through 7.',
      'INVALID_KEY_SIGNATURE'
    );
  }
  return Object.freeze({ fifths: value });
};

const parseMeter = (beats: number, beatType: number): Readonly<TimeSignature> => {
  if (!Number.isSafeInteger(beats) || beats < 1 || beats > 32 || ![1, 2, 4, 8, 16, 32, 64].includes(beatType)) {
    throw new ProfessionalStructureInspectorErrorV1(
      'Time signature must use beats 1..32 and a supported power-of-two beat type.',
      'INVALID_TIME_SIGNATURE'
    );
  }
  return Object.freeze({ beats, beatType });
};

const clefForPreset = (preset: ProfessionalClefPresetV1): Readonly<ClefSpec> | null => {
  if (preset === 'NONE') return null;
  const value = CLEF_PRESETS[preset];
  if (value === undefined) {
    throw new ProfessionalStructureInspectorErrorV1('Clef preset is unsupported.', 'INVALID_CLEF_PRESET');
  }
  return value;
};

const barlinesForPreset = (preset: ProfessionalBarlinePresetV1): readonly Readonly<BarlineSpec>[] => {
  const value = BARLINE_PRESETS[preset];
  if (value === undefined) {
    throw new ProfessionalStructureInspectorErrorV1('Barline preset is unsupported.', 'INVALID_BARLINE_PRESET');
  }
  return value;
};

export interface ProfessionalStructureInspectorStandaloneScoreEditorControllerV1 extends Omit<ProfessionalRangeToolbarStandaloneScoreEditorControllerV1, 'profile' | 'mount' | 'unmount'> {
  readonly profile: typeof professionalStructureInspectorBrowserAppProfile;
  readonly getProfessionalStructureInspectorState: () => Readonly<ProfessionalStructureInspectorStateV1>;
  readonly setProfessionalKeySignature: (fifths: number | null) => Readonly<ScoreEditorBrowserAppSnapshot>;
  readonly setProfessionalClefPreset: (preset: ProfessionalClefPresetV1) => Readonly<ScoreEditorBrowserAppSnapshot>;
  readonly setProfessionalTimeSignature: (beats: number, beatType: number) => Readonly<ScoreEditorBrowserAppSnapshot>;
  readonly setProfessionalBarlinePreset: (preset: ProfessionalBarlinePresetV1) => Readonly<ScoreEditorBrowserAppSnapshot>;
  readonly mount: (root: HTMLElement) => void;
  readonly unmount: () => void;
  readonly disposeProfessionalStructureInspector: () => void;
}

export const createProfessionalStructureInspectorStandaloneScoreEditorControllerV1 = (
  options: ProfessionalStructureInspectorOptionsV1 = {}
): Readonly<ProfessionalStructureInspectorStandaloneScoreEditorControllerV1> => {
  const base = createProfessionalRangeToolbarStandaloneScoreEditorControllerV1(options);
  const revisionIdFactory = options.structureRevisionIdFactory ?? options.professionalRevisionIdFactory ?? options.revisionIdFactory ?? browserRevisionId;
  let root: HTMLElement | null = null;
  let disposed = false;
  let lastError: Readonly<{ readonly code: string; readonly message: string }> | null = null;

  const state = (): Readonly<ProfessionalStructureInspectorStateV1> => {
    const document = base.getDocument();
    const selection = document?.session.selection ?? null;
    const measure = measureTarget(base);
    const frame = frameTarget(base);
    const notation = document?.session.history.present.notation ?? null;
    const measureNotation = measure === null || notation === null
      ? null
      : notation.measures.find(entry => entry.target.measureId === measure.measureId)?.notation ?? null;
    const frameNotation = frame === null || notation === null
      ? null
      : notation.frames.find(entry => entry.target.frameId === frame.frameId)?.notation ?? null;
    return Object.freeze({
      version: PROFESSIONAL_STRUCTURE_INSPECTOR_V1_VERSION,
      mounted: root !== null,
      hasDocument: document !== null,
      selectionKind: selection?.kind ?? null,
      measureTargetId: measure?.measureId ?? null,
      frameTargetId: frame?.frameId ?? null,
      canEditStaffStructure: measure !== null,
      canEditFrameStructure: frame !== null,
      keySignature: measureNotation?.keySignature ?? null,
      clef: measureNotation?.clef ?? null,
      timeSignature: frameNotation?.timeSignature ?? null,
      barlines: Object.freeze([...(frameNotation?.barlines ?? [])]),
      lastError: lastError ?? base.professional.getSnapshot().error
    });
  };

  const requireMeasure = (): MeasureAddressV3 => {
    const target = measureTarget(base);
    if (target === null) {
      throw new ProfessionalStructureInspectorErrorV1(
        'Select a current-revision staff measure, voice, event or note before editing key/clef.',
        'STAFF_MEASURE_SELECTION_REQUIRED'
      );
    }
    return target;
  };

  const requireFrame = (): MeasureFrameAddressV3 => {
    const target = frameTarget(base);
    if (target === null) {
      throw new ProfessionalStructureInspectorErrorV1(
        'Select a current-revision measure frame or a descendant before editing meter/barlines.',
        'MEASURE_FRAME_SELECTION_REQUIRED'
      );
    }
    return target;
  };

  const perform = (
    operation: () => Readonly<{ readonly base: Readonly<ScoreEditorBrowserAppSnapshot>; readonly error: Readonly<{ readonly code: string; readonly message: string }> | null }>
  ): Readonly<ScoreEditorBrowserAppSnapshot> => {
    try {
      const result = operation();
      lastError = result.error === null ? null : Object.freeze({ ...result.error });
      decorate();
      return result.base;
    } catch (error) {
      lastError = errorInfo(error);
      decorate();
      return base.getSnapshot();
    }
  };

  const setKeySignature = (fifths: number | null): Readonly<ScoreEditorBrowserAppSnapshot> => perform(() =>
    base.professional.setKeySignature(requireMeasure(), parseKey(fifths), { nextRevisionId: revisionIdFactory() })
  );

  const setClefPreset = (preset: ProfessionalClefPresetV1): Readonly<ScoreEditorBrowserAppSnapshot> => perform(() =>
    base.professional.setClef(requireMeasure(), clefForPreset(preset), { nextRevisionId: revisionIdFactory() })
  );

  const setTimeSignature = (beats: number, beatType: number): Readonly<ScoreEditorBrowserAppSnapshot> => perform(() =>
    base.professional.setTimeSignature(requireFrame(), parseMeter(beats, beatType), { nextRevisionId: revisionIdFactory() })
  );

  const setBarlinePreset = (preset: ProfessionalBarlinePresetV1): Readonly<ScoreEditorBrowserAppSnapshot> => perform(() =>
    base.professional.setFrameBarlines(requireFrame(), barlinesForPreset(preset), { nextRevisionId: revisionIdFactory() })
  );

  const option = (owner: Document, value: string, label: string): HTMLOptionElement => {
    const element = owner.createElement('option');
    element.value = value;
    element.textContent = label;
    return element;
  };

  const fieldRow = (
    owner: Document,
    grid: HTMLElement,
    control: HTMLElement,
    buttonLabel: string,
    buttonAria: string,
    disabled: boolean,
    action: () => void
  ): void => {
    grid.append(control);
    const button = owner.createElement('button');
    button.type = 'button';
    button.textContent = buttonLabel;
    button.setAttribute('aria-label', buttonAria);
    button.disabled = disabled;
    button.addEventListener('click', action);
    grid.append(button);
  };

  const decorate = (): void => {
    if (root === null || disposed) return;
    const app = root.querySelector<HTMLElement>('[data-st-score-editor-app]');
    if (app === null) return;
    if (app.querySelector('[data-st-professional-structure-style]') === null) {
      const style = app.ownerDocument.createElement('style');
      style.setAttribute('data-st-professional-structure-style', PROFESSIONAL_STRUCTURE_INSPECTOR_V1_VERSION);
      style.textContent = PROFESSIONAL_STRUCTURE_INSPECTOR_STYLE;
      app.append(style);
    }
    app.querySelector('[data-st-professional-structure-inspector]')?.remove();

    const owner = app.ownerDocument;
    const current = state();
    const panel = owner.createElement('section');
    panel.className = 'stse-professional-structure';
    panel.setAttribute('data-st-professional-structure-inspector', PROFESSIONAL_STRUCTURE_INSPECTOR_V1_VERSION);
    panel.setAttribute('aria-label', 'Professional score structure');
    const heading = owner.createElement('h3');
    heading.textContent = 'Score structure';
    panel.append(heading);
    const context = owner.createElement('p');
    context.className = 'stse-professional-structure-context';
    context.textContent = current.measureTargetId !== null
      ? `Measure ${current.measureTargetId}`
      : current.frameTargetId !== null
        ? `Frame ${current.frameTargetId}`
        : 'Select a measure, event or note';
    panel.append(context);
    const grid = owner.createElement('div');
    grid.className = 'stse-professional-structure-grid';

    const key = owner.createElement('select');
    key.setAttribute('aria-label', 'Key signature fifths');
    key.disabled = !current.canEditStaffStructure;
    key.append(option(owner, 'none', 'Key: none'));
    for (let fifths = -7; fifths <= 7; fifths += 1) key.append(option(owner, String(fifths), `Key fifths: ${fifths}`));
    key.value = current.keySignature === null ? 'none' : String(current.keySignature.fifths);
    fieldRow(owner, grid, key, 'Apply', 'Apply key signature', !current.canEditStaffStructure, () => {
      const value = key.value === 'none' ? null : Number(key.value);
      controller.setProfessionalKeySignature(value);
    });

    const clef = owner.createElement('select');
    clef.setAttribute('aria-label', 'Clef preset');
    clef.disabled = !current.canEditStaffStructure;
    for (const [value, label] of [
      ['TREBLE','Clef: treble'],['BASS','Clef: bass'],['ALTO','Clef: alto'],['TENOR','Clef: tenor'],
      ['PERCUSSION','Clef: percussion'],['TAB','Clef: TAB'],['NONE','Clef: none']
    ] as const) clef.append(option(owner, value, label));
    fieldRow(owner, grid, clef, 'Apply', 'Apply clef preset', !current.canEditStaffStructure, () => {
      controller.setProfessionalClefPreset(clef.value as ProfessionalClefPresetV1);
    });

    const meter = owner.createElement('div');
    meter.className = 'stse-professional-meter-fields';
    const beats = owner.createElement('input');
    beats.type = 'number';
    beats.min = '1';
    beats.max = '32';
    beats.step = '1';
    beats.setAttribute('aria-label', 'Time signature beats');
    beats.value = String(current.timeSignature?.beats ?? 4);
    beats.disabled = !current.canEditFrameStructure;
    const beatType = owner.createElement('select');
    beatType.setAttribute('aria-label', 'Time signature beat type');
    for (const denominator of [1,2,4,8,16,32,64]) beatType.append(option(owner, String(denominator), `/${denominator}`));
    beatType.value = String(current.timeSignature?.beatType ?? 4);
    beatType.disabled = !current.canEditFrameStructure;
    meter.append(beats, beatType);
    fieldRow(owner, grid, meter, 'Apply', 'Apply time signature', !current.canEditFrameStructure, () => {
      controller.setProfessionalTimeSignature(Number(beats.value), Number(beatType.value));
    });

    const barline = owner.createElement('select');
    barline.setAttribute('aria-label', 'Barline and repeat preset');
    barline.disabled = !current.canEditFrameStructure;
    for (const [value, label] of [
      ['NONE','Barline: none'],['REGULAR_RIGHT','Barline: regular'],['FINAL_RIGHT','Barline: final'],
      ['REPEAT_START','Repeat: start'],['REPEAT_END','Repeat: end'],['REPEAT_BOTH','Repeat: both']
    ] as const) barline.append(option(owner, value, label));
    fieldRow(owner, grid, barline, 'Apply', 'Apply barline or repeat preset', !current.canEditFrameStructure, () => {
      controller.setProfessionalBarlinePreset(barline.value as ProfessionalBarlinePresetV1);
    });

    panel.append(grid);
    const side = app.querySelector<HTMLElement>('.stse-side');
    if (side === null) app.append(panel);
    else side.append(panel);
  };

  const unsubscribeBase = base.subscribe(() => {
    if (!disposed) decorate();
  });

  const controller: ProfessionalStructureInspectorStandaloneScoreEditorControllerV1 = {
    ...base,
    profile: professionalStructureInspectorBrowserAppProfile,
    getProfessionalStructureInspectorState: state,
    setProfessionalKeySignature: setKeySignature,
    setProfessionalClefPreset: setClefPreset,
    setProfessionalTimeSignature: setTimeSignature,
    setProfessionalBarlinePreset: setBarlinePreset,
    mount: (nextRoot) => {
      if (disposed) throw new ProfessionalStructureInspectorErrorV1('Professional structure inspector has been disposed.', 'NO_DOCUMENT');
      base.mount(nextRoot);
      root = nextRoot;
      decorate();
    },
    unmount: () => {
      lastError = null;
      root = null;
      base.unmount();
    },
    disposeProfessionalStructureInspector: () => {
      if (disposed) return;
      disposed = true;
      root = null;
      unsubscribeBase();
      base.disposeProfessionalRangeToolbar();
    }
  };

  return Object.freeze(controller);
};

export const createProfessionalStructureInspectorStandaloneBrowserAppRuntimeV1 = () => {
  const base = createProfessionalRangeToolbarStandaloneBrowserAppRuntimeV1();
  return Object.freeze({
    ...base,
    profile: professionalStructureInspectorBrowserAppProfile,
    createController: createProfessionalStructureInspectorStandaloneScoreEditorControllerV1,
    professionalStructureInspector: Object.freeze({
      version: PROFESSIONAL_STRUCTURE_INSPECTOR_V1_VERSION,
      available: true,
      canonicalAuthority: false,
      semanticSelectionOnly: true,
      staffFields: Object.freeze(['key-signature','clef'] as const),
      frameFields: Object.freeze(['time-signature','barline-repeat'] as const),
      mutationAuthority: 'P08-D-professional-workstation',
      historyAuthority: 'EditorHistoryV4',
      minimumTouchTargetPx: PROFESSIONAL_STRUCTURE_INSPECTOR_MIN_TOUCH_TARGET_PX,
      rendererCoordinateAuthority: false,
      domAuthoringAuthority: false,
      networkAuthority: false
    })
  });
};
