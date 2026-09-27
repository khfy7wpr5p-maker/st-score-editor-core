export const MUSICXML_COMPATIBILITY_POLICY_VERSION = '1.0.0' as const;

export type MusicXmlCompatibilityClass =
  | 'SEMANTIC_REQUIRED'
  | 'IGNORABLE_PRESENTATION_METADATA'
  | 'UNSUPPORTED_SEMANTIC_FAIL_CLOSED';

export interface MusicXmlCompatibilityDecision {
  readonly classification: MusicXmlCompatibilityClass;
  readonly pathClass: string;
  readonly reason: string;
}

const REQUIRED_ELEMENTS = new Set([
  'score-partwise','part-list','score-part','part-name','part','measure','attributes','divisions','key','fifths','time','beats','beat-type','staves','clef','sign','line','clef-octave-change',
  'note','grace','chord','pitch','rest','duration','voice','staff','step','alter','octave','type','dot','accidental','beam','time-modification','actual-notes','normal-notes','tie','notations','tied','slur','tuplet',
  'articulations','accent','strong-accent','staccato','tenuto','detached-legato','staccatissimo','spiccato','scoop','plop','doit','falloff','breath-mark','caesura','stress','unstress','soft-accent',
  'ornaments','trill-mark','turn','delayed-turn','inverted-turn','delayed-inverted-turn','vertical-turn','inverted-vertical-turn','shake','mordent','inverted-mordent','schleifer','haydn','accidental-mark','tremolo','wavy-line',
  'backup','forward','barline','bar-style','repeat'
]);

const REQUIRED_ATTRIBUTES: Readonly<Record<string, ReadonlySet<string>>> = Object.freeze({
  'score-partwise': new Set(['version']),
  'score-part': new Set(['id']),
  part: new Set(['id']),
  measure: new Set(['number','implicit','non-controlling']),
  note: new Set(['id']),
  clef: new Set(['number']),
  barline: new Set(['location']),
  repeat: new Set(['direction']),
  beam: new Set(['number']),
  tie: new Set(['type']),
  tied: new Set(['type','number']),
  slur: new Set(['type','number']),
  tuplet: new Set(['type','number']),
  grace: new Set(['slash','steal-time-previous','steal-time-following','make-time']),
  accent: new Set(['placement']),
  'strong-accent': new Set(['placement','type']),
  staccato: new Set(['placement']),
  tenuto: new Set(['placement']),
  'detached-legato': new Set(['placement']),
  staccatissimo: new Set(['placement']),
  spiccato: new Set(['placement']),
  scoop: new Set(['placement']),
  plop: new Set(['placement']),
  doit: new Set(['placement']),
  falloff: new Set(['placement']),
  'breath-mark': new Set(['placement']),
  caesura: new Set(['placement']),
  stress: new Set(['placement']),
  unstress: new Set(['placement']),
  'soft-accent': new Set(['placement']),
  'trill-mark': new Set(['placement']),
  turn: new Set(['placement']),
  'delayed-turn': new Set(['placement']),
  'inverted-turn': new Set(['placement']),
  'delayed-inverted-turn': new Set(['placement']),
  'vertical-turn': new Set(['placement']),
  'inverted-vertical-turn': new Set(['placement']),
  shake: new Set(['placement']),
  mordent: new Set(['placement']),
  'inverted-mordent': new Set(['placement']),
  schleifer: new Set(['placement']),
  haydn: new Set(['placement']),
  'accidental-mark': new Set(['placement']),
  tremolo: new Set(['type','number','placement']),
  'wavy-line': new Set(['type','number','placement'])
});

const ARTICULATION_ELEMENTS = new Set([
  'accent','strong-accent','staccato','tenuto','detached-legato','staccatissimo','spiccato','scoop','plop','doit','falloff',
  'breath-mark','caesura','stress','unstress','soft-accent'
]);

const pathEquals = (path: readonly string[], expected: readonly string[]): boolean =>
  path.length === expected.length && path.every((value, index) => value === expected[index]);

const elementPathClass = (path: readonly string[], name: string): string =>
  [...path, name].join('/');

const decision = (
  classification: MusicXmlCompatibilityClass,
  pathClass: string,
  reason: string
): Readonly<MusicXmlCompatibilityDecision> =>
  Object.freeze({ classification, pathClass, reason });

const isIgnorableElement = (path: readonly string[], name: string): boolean => {
  if (pathEquals(path, ['score-partwise']) && (name === 'identification' || name === 'defaults')) return true;
  if (
    pathEquals(path, ['score-partwise','part-list','score-part']) &&
    (name === 'part-abbreviation' || name === 'score-instrument' || name === 'midi-instrument')
  ) return true;
  if (pathEquals(path, ['score-partwise','part','measure']) && name === 'print') return true;
  if (pathEquals(path, ['score-partwise','part','measure','note']) && name === 'stem') return true;
  return false;
};

const isIgnorableAttribute = (
  path: readonly string[],
  element: string,
  attribute: string
): boolean => {
  if (pathEquals(path, ['score-partwise','part']) && element === 'measure' && attribute === 'width') return true;
  if (pathEquals(path, ['score-partwise','part','measure']) && element === 'note' && attribute === 'default-x') return true;
  if (pathEquals(path, ['score-partwise','part','measure','note']) && element === 'stem' && attribute === 'default-y') return true;
  if (
    pathEquals(path, ['score-partwise','part','measure','note','notations','articulations']) &&
    ARTICULATION_ELEMENTS.has(element) &&
    attribute === 'default-y'
  ) return true;
  return false;
};

export const classifyMusicXmlCompatibilityElement = (
  path: readonly string[],
  name: string,
  uri: string
): Readonly<MusicXmlCompatibilityDecision> => {
  const pathClass = elementPathClass(path, name);
  if (uri !== '') {
    return decision(
      'UNSUPPORTED_SEMANTIC_FAIL_CLOSED',
      pathClass,
      'foreign MusicXML element namespace is not admitted'
    );
  }
  if (REQUIRED_ELEMENTS.has(name)) {
    return decision(
      'SEMANTIC_REQUIRED',
      pathClass,
      'element belongs to the current bounded MusicXML semantic profile'
    );
  }
  if (isIgnorableElement(path, name)) {
    return decision(
      'IGNORABLE_PRESENTATION_METADATA',
      pathClass,
      'exact reviewed noncanonical MusicXML presentation or metadata subtree'
    );
  }
  return decision(
    'UNSUPPORTED_SEMANTIC_FAIL_CLOSED',
    pathClass,
    'element is outside the reviewed compatibility profile'
  );
};

export const classifyMusicXmlCompatibilityAttribute = (
  path: readonly string[],
  element: string,
  attribute: string,
  uri: string
): Readonly<MusicXmlCompatibilityDecision> => {
  const pathClass = elementPathClass(path, element);
  if (uri !== '') {
    return decision(
      'UNSUPPORTED_SEMANTIC_FAIL_CLOSED',
      pathClass,
      'foreign MusicXML attribute namespace is not admitted'
    );
  }
  if (REQUIRED_ATTRIBUTES[element]?.has(attribute) === true) {
    return decision(
      'SEMANTIC_REQUIRED',
      pathClass,
      'attribute belongs to the current bounded MusicXML semantic profile'
    );
  }
  if (isIgnorableAttribute(path, element, attribute)) {
    return decision(
      'IGNORABLE_PRESENTATION_METADATA',
      pathClass,
      'exact reviewed noncanonical MusicXML presentation attribute'
    );
  }
  return decision(
    'UNSUPPORTED_SEMANTIC_FAIL_CLOSED',
    pathClass,
    'attribute is outside the reviewed compatibility profile'
  );
};
