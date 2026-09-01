export const EDITOR_KEYPAD_CONTRACT_VERSION = '1.0.0' as const;
export const EDITOR_KEYPAD_MODE = 'EXISTING_SCORE_CORRECTION' as const;

export const EDITOR_KEYPAD_ACTION_IDS = Object.freeze([
  'duration.whole',
  'duration.half',
  'duration.quarter',
  'duration.eighth',
  'duration.16th',
  'duration.32nd',
  'rest.whole',
  'rest.half',
  'rest.quarter',
  'rest.eighth',
  'rest.16th',
  'rest.32nd',
  'accidental.flat',
  'accidental.natural',
  'accidental.sharp',
  'dot.set.0',
  'dot.set.1',
  'dot.set.2',
  'dot.set.3',
  'tuplet.triplet',
  'tie.edit',
  'slur.edit'
] as const);

export type EditorKeypadActionId = typeof EDITOR_KEYPAD_ACTION_IDS[number];
export type EditorKeypadGroupId = 'duration' | 'rests' | 'accidentals' | 'dots' | 'tuplets' | 'connections';
export type EditorKeypadHostPrimitiveHint = 'tie' | 'slur';

export interface EditorKeypadAction {
  readonly version: typeof EDITOR_KEYPAD_CONTRACT_VERSION;
  readonly actionId: EditorKeypadActionId;
}

export interface EditorKeypadGlyphDescriptor {
  readonly smuflGlyphName: string;
  readonly repeat: 1 | 2 | 3;
}

export interface EditorKeypadActionDescriptor {
  readonly actionId: EditorKeypadActionId;
  readonly accessibleLabelKey: string;
  readonly glyph: Readonly<EditorKeypadGlyphDescriptor> | null;
  readonly hostPrimitiveHint: EditorKeypadHostPrimitiveHint | null;
}

export interface EditorKeypadGroupDescriptor {
  readonly id: EditorKeypadGroupId;
  readonly accessibleLabelKey: string;
  readonly actions: readonly Readonly<EditorKeypadActionDescriptor>[];
}

export interface EditorKeypadManifest {
  readonly version: typeof EDITOR_KEYPAD_CONTRACT_VERSION;
  readonly mode: typeof EDITOR_KEYPAD_MODE;
  readonly semanticAuthority: 'ACTION_ID_ONLY';
  readonly glyphMetadataAuthority: false;
  readonly rawGlyphCodepointsIncluded: false;
  readonly fontAssetsIncluded: false;
  readonly groups: readonly Readonly<EditorKeypadGroupDescriptor>[];
}

export type EditorKeypadContractErrorCode = 'INVALID_ACTION' | 'MANIFEST_INVARIANT';

export class EditorKeypadContractError extends Error {
  readonly code: EditorKeypadContractErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(message: string, code: EditorKeypadContractErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'EditorKeypadContractError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const actionIdSet = new Set<string>(EDITOR_KEYPAD_ACTION_IDS);

const exactFields = (value: unknown, fields: readonly string[], label: string): Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new EditorKeypadContractError(`${label} must be an object.`, 'INVALID_ACTION');
  }
  const record = value as Record<string, unknown>;
  const observed = Object.keys(record).sort();
  const expected = [...fields].sort();
  if (JSON.stringify(observed) !== JSON.stringify(expected)) {
    throw new EditorKeypadContractError(`${label} field set is invalid.`, 'INVALID_ACTION', { observed, expected });
  }
  return record;
};

const glyph = (smuflGlyphName: string, repeat: 1 | 2 | 3 = 1): Readonly<EditorKeypadGlyphDescriptor> =>
  Object.freeze({ smuflGlyphName, repeat });

const descriptor = (
  actionId: EditorKeypadActionId,
  accessibleLabelKey: string,
  glyphValue: Readonly<EditorKeypadGlyphDescriptor> | null,
  hostPrimitiveHint: EditorKeypadHostPrimitiveHint | null = null
): Readonly<EditorKeypadActionDescriptor> => Object.freeze({
  actionId,
  accessibleLabelKey,
  glyph: glyphValue,
  hostPrimitiveHint
});

const group = (
  id: EditorKeypadGroupId,
  accessibleLabelKey: string,
  actions: readonly Readonly<EditorKeypadActionDescriptor>[]
): Readonly<EditorKeypadGroupDescriptor> => Object.freeze({
  id,
  accessibleLabelKey,
  actions: Object.freeze([...actions])
});

const groups: readonly Readonly<EditorKeypadGroupDescriptor>[] = Object.freeze([
  group('duration', 'keypad.group.duration', [
    descriptor('duration.whole', 'keypad.duration.whole', glyph('noteWhole')),
    descriptor('duration.half', 'keypad.duration.half', glyph('noteHalfUp')),
    descriptor('duration.quarter', 'keypad.duration.quarter', glyph('noteQuarterUp')),
    descriptor('duration.eighth', 'keypad.duration.eighth', glyph('note8thUp')),
    descriptor('duration.16th', 'keypad.duration.16th', glyph('note16thUp')),
    descriptor('duration.32nd', 'keypad.duration.32nd', glyph('note32ndUp'))
  ]),
  group('rests', 'keypad.group.rests', [
    descriptor('rest.whole', 'keypad.rest.whole', glyph('restWhole')),
    descriptor('rest.half', 'keypad.rest.half', glyph('restHalf')),
    descriptor('rest.quarter', 'keypad.rest.quarter', glyph('restQuarter')),
    descriptor('rest.eighth', 'keypad.rest.eighth', glyph('rest8th')),
    descriptor('rest.16th', 'keypad.rest.16th', glyph('rest16th')),
    descriptor('rest.32nd', 'keypad.rest.32nd', glyph('rest32nd'))
  ]),
  group('accidentals', 'keypad.group.accidentals', [
    descriptor('accidental.flat', 'keypad.accidental.flat', glyph('accidentalFlat')),
    descriptor('accidental.natural', 'keypad.accidental.natural', glyph('accidentalNatural')),
    descriptor('accidental.sharp', 'keypad.accidental.sharp', glyph('accidentalSharp'))
  ]),
  group('dots', 'keypad.group.dots', [
    descriptor('dot.set.0', 'keypad.dot.set.0', null),
    descriptor('dot.set.1', 'keypad.dot.set.1', glyph('augmentationDot')),
    descriptor('dot.set.2', 'keypad.dot.set.2', glyph('augmentationDot', 2)),
    descriptor('dot.set.3', 'keypad.dot.set.3', glyph('augmentationDot', 3))
  ]),
  group('tuplets', 'keypad.group.tuplets', [
    descriptor('tuplet.triplet', 'keypad.tuplet.triplet', glyph('tuplet3'))
  ]),
  group('connections', 'keypad.group.connections', [
    descriptor('tie.edit', 'keypad.tie.edit', null, 'tie'),
    descriptor('slur.edit', 'keypad.slur.edit', null, 'slur')
  ])
]);

const assertManifest = (manifest: EditorKeypadManifest): void => {
  const seenGroups = new Set<string>();
  const seenActions = new Set<string>();
  for (const item of manifest.groups) {
    if (seenGroups.has(item.id)) throw new EditorKeypadContractError('Keypad manifest contains a duplicate group.', 'MANIFEST_INVARIANT', { groupId: item.id });
    seenGroups.add(item.id);
    if (item.accessibleLabelKey.length === 0) throw new EditorKeypadContractError('Keypad group label key is empty.', 'MANIFEST_INVARIANT', { groupId: item.id });
    for (const action of item.actions) {
      if (!actionIdSet.has(action.actionId)) throw new EditorKeypadContractError('Keypad manifest contains an unknown action id.', 'MANIFEST_INVARIANT', { actionId: action.actionId });
      if (seenActions.has(action.actionId)) throw new EditorKeypadContractError('Keypad manifest contains a duplicate action id.', 'MANIFEST_INVARIANT', { actionId: action.actionId });
      seenActions.add(action.actionId);
      if (action.accessibleLabelKey.length === 0) throw new EditorKeypadContractError('Keypad action label key is empty.', 'MANIFEST_INVARIANT', { actionId: action.actionId });
      if (action.glyph !== null) {
        if (!/^[A-Za-z][A-Za-z0-9]*$/.test(action.glyph.smuflGlyphName)) throw new EditorKeypadContractError('SMuFL glyph metadata must contain a glyph name, not a codepoint.', 'MANIFEST_INVARIANT', { actionId: action.actionId });
        if (![1, 2, 3].includes(action.glyph.repeat)) throw new EditorKeypadContractError('SMuFL glyph repeat is outside admitted bounds.', 'MANIFEST_INVARIANT', { actionId: action.actionId });
      }
      if (action.glyph !== null && action.hostPrimitiveHint !== null) throw new EditorKeypadContractError('An action cannot request both a SMuFL glyph and host primitive.', 'MANIFEST_INVARIANT', { actionId: action.actionId });
    }
  }
  if (seenActions.size !== EDITOR_KEYPAD_ACTION_IDS.length) throw new EditorKeypadContractError('Keypad manifest does not cover the complete admitted action set.', 'MANIFEST_INVARIANT', { observed: seenActions.size, expected: EDITOR_KEYPAD_ACTION_IDS.length });
};

const manifest: Readonly<EditorKeypadManifest> = Object.freeze({
  version: EDITOR_KEYPAD_CONTRACT_VERSION,
  mode: EDITOR_KEYPAD_MODE,
  semanticAuthority: 'ACTION_ID_ONLY',
  glyphMetadataAuthority: false,
  rawGlyphCodepointsIncluded: false,
  fontAssetsIncluded: false,
  groups
});

assertManifest(manifest);

export const getEditorKeypadManifest = (): Readonly<EditorKeypadManifest> => manifest;

export const parseEditorKeypadAction = (input: unknown): Readonly<EditorKeypadAction> => {
  const record = exactFields(input, ['version', 'actionId'], 'EditorKeypadAction');
  if (record.version !== EDITOR_KEYPAD_CONTRACT_VERSION || typeof record.actionId !== 'string' || !actionIdSet.has(record.actionId)) {
    throw new EditorKeypadContractError('Editor keypad action version or action id is unsupported.', 'INVALID_ACTION', { actionId: record.actionId });
  }
  return Object.freeze({ version: EDITOR_KEYPAD_CONTRACT_VERSION, actionId: record.actionId as EditorKeypadActionId });
};

export const descriptorForEditorKeypadAction = (actionId: EditorKeypadActionId): Readonly<EditorKeypadActionDescriptor> => {
  for (const item of manifest.groups) {
    const found = item.actions.find((action) => action.actionId === actionId);
    if (found !== undefined) return found;
  }
  throw new EditorKeypadContractError('Admitted keypad action has no descriptor.', 'MANIFEST_INVARIANT', { actionId });
};
