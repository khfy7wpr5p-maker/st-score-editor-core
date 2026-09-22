import type {
  EventAddressV3,
  MeasureAddressV3,
  MeasureFrameAddressV3
} from '../../addressing-v3/src/index.js';
import type { ProfessionalSelectionV1 } from '../../editor-professional-selection-v1/src/index.js';
import {
  SCORE_EDITOR_PROFESSIONAL_WORKSTATION_V1_VERSION,
  clearProfessionalWorkstationSelectionV1,
  commitProfessionalWorkstationClefV1,
  commitProfessionalWorkstationClearToRestV1,
  commitProfessionalWorkstationFrameBarlinesV1,
  commitProfessionalWorkstationKeySignatureV1,
  commitProfessionalWorkstationOctaveTransposeV1,
  commitProfessionalWorkstationSemitoneTransposeV1,
  commitProfessionalWorkstationDiatonicTransposeV1,
  commitProfessionalWorkstationTimeSignatureV1,
  commitProfessionalWorkstationTopologyV1,
  createScoreEditorProfessionalWorkstationV1,
  selectProfessionalEventSetV1,
  selectProfessionalEventSpanV1,
  type ScoreEditorProfessionalWorkstationV1
} from '../../score-editor-professional-workstation-v1/src/index.js';
import {
  createStandaloneScoreEditorController,
  type ScoreEditorBrowserAppSnapshot,
  type StandaloneScoreEditorController,
  type StandaloneScoreEditorControllerOptions
} from '../../score-editor-browser-app/src/index.js';

export const SCORE_EDITOR_BROWSER_PROFESSIONAL_V1_VERSION = '1.0.0' as const;

export interface ScoreEditorBrowserProfessionalSnapshotV1 {
  readonly version: typeof SCORE_EDITOR_BROWSER_PROFESSIONAL_V1_VERSION;
  readonly base: Readonly<ScoreEditorBrowserAppSnapshot>;
  readonly professionalSelectionKind: ProfessionalSelectionV1['kind'] | null;
  readonly professionalSelectionCount: number;
  readonly error: Readonly<{ readonly code: string; readonly message: string }> | null;
}

export type ScoreEditorBrowserProfessionalListenerV1 = (
  snapshot: Readonly<ScoreEditorBrowserProfessionalSnapshotV1>
) => void;

export type ProfessionalOctaveDeltaV1 = Parameters<typeof commitProfessionalWorkstationOctaveTransposeV1>[1];
export type ProfessionalOctaveOptionsV1 = Parameters<typeof commitProfessionalWorkstationOctaveTransposeV1>[2];
export type ProfessionalPitchTransposeOptionsV1 = Parameters<typeof commitProfessionalWorkstationSemitoneTransposeV1>[2];
export type ProfessionalClearOptionsV1 = Parameters<typeof commitProfessionalWorkstationClearToRestV1>[1];
export type ProfessionalStructureOptionsV1 = Parameters<typeof commitProfessionalWorkstationKeySignatureV1>[3];
export type ProfessionalTimeSignatureOptionsV1 = Parameters<typeof commitProfessionalWorkstationTimeSignatureV1>[3];
export type ProfessionalBarlineOptionsV1 = Parameters<typeof commitProfessionalWorkstationFrameBarlinesV1>[3];
export type ProfessionalTopologyOptionsV1 = Parameters<typeof commitProfessionalWorkstationTopologyV1>[2];

export interface ScoreEditorBrowserProfessionalControllerV1 {
  readonly version: typeof SCORE_EDITOR_BROWSER_PROFESSIONAL_V1_VERSION;
  readonly base: Readonly<StandaloneScoreEditorController>;
  readonly getSnapshot: () => Readonly<ScoreEditorBrowserProfessionalSnapshotV1>;
  readonly getProfessionalSelection: () => Readonly<ProfessionalSelectionV1> | null;
  readonly subscribe: (listener: ScoreEditorBrowserProfessionalListenerV1) => () => void;
  readonly selectEventSpan: (
    anchor: EventAddressV3,
    focus: EventAddressV3
  ) => Readonly<ScoreEditorBrowserProfessionalSnapshotV1>;
  readonly selectEventSet: (
    targets: readonly EventAddressV3[]
  ) => Readonly<ScoreEditorBrowserProfessionalSnapshotV1>;
  readonly clearProfessionalSelection: () => Readonly<ScoreEditorBrowserProfessionalSnapshotV1>;
  readonly transposeOctaves: (
    octaveDelta: ProfessionalOctaveDeltaV1,
    options: ProfessionalOctaveOptionsV1
  ) => Readonly<ScoreEditorBrowserProfessionalSnapshotV1>;
  readonly transposeSemitones: (
    delta: number,
    options: ProfessionalPitchTransposeOptionsV1
  ) => Readonly<ScoreEditorBrowserProfessionalSnapshotV1>;
  readonly transposeDiatonically: (
    steps: number,
    options: ProfessionalPitchTransposeOptionsV1
  ) => Readonly<ScoreEditorBrowserProfessionalSnapshotV1>;
  readonly clearToRest: (
    options: ProfessionalClearOptionsV1
  ) => Readonly<ScoreEditorBrowserProfessionalSnapshotV1>;
  readonly setKeySignature: (
    target: MeasureAddressV3,
    value: unknown,
    options: ProfessionalStructureOptionsV1
  ) => Readonly<ScoreEditorBrowserProfessionalSnapshotV1>;
  readonly setClef: (
    target: MeasureAddressV3,
    value: unknown,
    options: ProfessionalStructureOptionsV1
  ) => Readonly<ScoreEditorBrowserProfessionalSnapshotV1>;
  readonly setTimeSignature: (
    target: MeasureFrameAddressV3,
    value: unknown,
    options: ProfessionalTimeSignatureOptionsV1
  ) => Readonly<ScoreEditorBrowserProfessionalSnapshotV1>;
  readonly setFrameBarlines: (
    target: MeasureFrameAddressV3,
    value: unknown,
    options: ProfessionalBarlineOptionsV1
  ) => Readonly<ScoreEditorBrowserProfessionalSnapshotV1>;
  readonly commitTopology: (
    intent: unknown,
    options: ProfessionalTopologyOptionsV1
  ) => Readonly<ScoreEditorBrowserProfessionalSnapshotV1>;
  readonly dispose: () => void;
}

export type ScoreEditorBrowserProfessionalV1ErrorCode =
  | 'NO_DOCUMENT'
  | 'DISPOSED'
  | 'BASE_ADOPTION_FAILED'
  | 'PROFESSIONAL_OPERATION_FAILED';

export class ScoreEditorBrowserProfessionalV1Error extends Error {
  readonly code: ScoreEditorBrowserProfessionalV1ErrorCode;
  constructor(message: string, code: ScoreEditorBrowserProfessionalV1ErrorCode) {
    super(message);
    this.name = 'ScoreEditorBrowserProfessionalV1Error';
    this.code = code;
    Object.freeze(this);
  }
}

const errorInfo = (
  error: unknown,
  fallbackCode: string = 'PROFESSIONAL_OPERATION_FAILED'
): Readonly<{ readonly code: string; readonly message: string }> => {
  const value = error !== null && typeof error === 'object'
    ? error as { readonly code?: unknown; readonly message?: unknown; readonly name?: unknown }
    : null;
  const code = typeof value?.code === 'string' && value.code.length > 0
    ? value.code
    : typeof value?.name === 'string' && value.name.length > 0
      ? value.name
      : fallbackCode;
  const message = typeof value?.message === 'string' && value.message.length > 0
    ? value.message
    : 'Professional browser operation failed.';
  return Object.freeze({ code, message });
};

export const attachProfessionalWorkstationToBrowserControllerV1 = (
  base: StandaloneScoreEditorController
): Readonly<ScoreEditorBrowserProfessionalControllerV1> => {
  let professionalSelection: Readonly<ProfessionalSelectionV1> | null = null;
  let lastError: Readonly<{ readonly code: string; readonly message: string }> | null = null;
  let lastRevisionId = base.getSnapshot().revisionId;
  let adoptingProfessionalResult = false;
  let disposed = false;
  const listeners = new Set<ScoreEditorBrowserProfessionalListenerV1>();

  const assertLive = (): void => {
    if (disposed) {
      throw new ScoreEditorBrowserProfessionalV1Error(
        'Professional browser controller has been disposed.',
        'DISPOSED'
      );
    }
  };

  const currentWorkstation = (): Readonly<ScoreEditorProfessionalWorkstationV1> => {
    assertLive();
    const document = base.getDocument();
    if (document === null) {
      throw new ScoreEditorBrowserProfessionalV1Error(
        'Professional authoring requires an active score document.',
        'NO_DOCUMENT'
      );
    }
    return Object.freeze({
      version: SCORE_EDITOR_PROFESSIONAL_WORKSTATION_V1_VERSION,
      document,
      professionalSelection
    });
  };

  const snapshot = (): Readonly<ScoreEditorBrowserProfessionalSnapshotV1> => Object.freeze({
    version: SCORE_EDITOR_BROWSER_PROFESSIONAL_V1_VERSION,
    base: base.getSnapshot(),
    professionalSelectionKind: professionalSelection?.kind ?? null,
    professionalSelectionCount: professionalSelection?.targets.length ?? 0,
    error: lastError
  });

  const notify = (): Readonly<ScoreEditorBrowserProfessionalSnapshotV1> => {
    const value = snapshot();
    for (const listener of listeners) listener(value);
    return value;
  };

  const runLocal = (
    operation: (workstation: Readonly<ScoreEditorProfessionalWorkstationV1>) => Readonly<ScoreEditorProfessionalWorkstationV1>
  ): Readonly<ScoreEditorBrowserProfessionalSnapshotV1> => {
    try {
      const result = operation(currentWorkstation());
      professionalSelection = result.professionalSelection;
      lastError = null;
    } catch (error) {
      lastError = errorInfo(error);
    }
    return notify();
  };

  const adoptProfessionalResult = (
    result: Readonly<ScoreEditorProfessionalWorkstationV1>
  ): Readonly<ScoreEditorBrowserProfessionalSnapshotV1> => {
    adoptingProfessionalResult = true;
    try {
      const adopted = base.adoptValidatedSnapshot(result.document);
      lastRevisionId = adopted.revisionId;
      if (adopted.error !== null) {
        professionalSelection = null;
        lastError = Object.freeze({
          code: adopted.error.code || 'BASE_ADOPTION_FAILED',
          message: adopted.error.message
        });
      } else {
        professionalSelection = result.professionalSelection;
        lastError = null;
      }
    } finally {
      adoptingProfessionalResult = false;
    }
    return notify();
  };

  const runCommit = (
    operation: (workstation: Readonly<ScoreEditorProfessionalWorkstationV1>) => Readonly<ScoreEditorProfessionalWorkstationV1>
  ): Readonly<ScoreEditorBrowserProfessionalSnapshotV1> => {
    try {
      return adoptProfessionalResult(operation(currentWorkstation()));
    } catch (error) {
      lastError = errorInfo(error);
      return notify();
    }
  };

  const unsubscribeBase = base.subscribe((baseSnapshot) => {
    if (disposed) return;
    const revisionChanged = baseSnapshot.revisionId !== lastRevisionId;
    lastRevisionId = baseSnapshot.revisionId;
    if (adoptingProfessionalResult) return;
    if (revisionChanged) professionalSelection = null;
    if (baseSnapshot.error !== null) lastError = Object.freeze({ ...baseSnapshot.error });
    notify();
  });

  const controller: ScoreEditorBrowserProfessionalControllerV1 = {
    version: SCORE_EDITOR_BROWSER_PROFESSIONAL_V1_VERSION,
    base,
    getSnapshot: snapshot,
    getProfessionalSelection: () => professionalSelection,
    subscribe: (listener) => {
      assertLive();
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    selectEventSpan: (anchor, focus) => runLocal((workstation) =>
      selectProfessionalEventSpanV1(workstation, anchor, focus)
    ),
    selectEventSet: (targets) => runLocal((workstation) =>
      selectProfessionalEventSetV1(workstation, targets)
    ),
    clearProfessionalSelection: () => runLocal((workstation) =>
      clearProfessionalWorkstationSelectionV1(workstation)
    ),
    transposeOctaves: (octaveDelta, options) => runCommit((workstation) =>
      commitProfessionalWorkstationOctaveTransposeV1(workstation, octaveDelta, options)
    ),
    transposeSemitones: (delta, options) => runCommit((workstation) =>
      commitProfessionalWorkstationSemitoneTransposeV1(workstation, delta, options)
    ),
    transposeDiatonically: (steps, options) => runCommit((workstation) =>
      commitProfessionalWorkstationDiatonicTransposeV1(workstation, steps, options)
    ),
    clearToRest: (options) => runCommit((workstation) =>
      commitProfessionalWorkstationClearToRestV1(workstation, options)
    ),
    setKeySignature: (target, value, options) => runCommit((workstation) =>
      commitProfessionalWorkstationKeySignatureV1(workstation, target, value, options)
    ),
    setClef: (target, value, options) => runCommit((workstation) =>
      commitProfessionalWorkstationClefV1(workstation, target, value, options)
    ),
    setTimeSignature: (target, value, options) => runCommit((workstation) =>
      commitProfessionalWorkstationTimeSignatureV1(workstation, target, value, options)
    ),
    setFrameBarlines: (target, value, options) => runCommit((workstation) =>
      commitProfessionalWorkstationFrameBarlinesV1(workstation, target, value, options)
    ),
    commitTopology: (intent, options) => runCommit((workstation) =>
      commitProfessionalWorkstationTopologyV1(workstation, intent, options)
    ),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      unsubscribeBase();
      listeners.clear();
      professionalSelection = null;
      lastError = null;
    }
  };

  return Object.freeze(controller);
};

export const createProfessionalStandaloneScoreEditorControllerV1 = (
  options: StandaloneScoreEditorControllerOptions = {}
): Readonly<ScoreEditorBrowserProfessionalControllerV1> =>
  attachProfessionalWorkstationToBrowserControllerV1(createStandaloneScoreEditorController(options));
