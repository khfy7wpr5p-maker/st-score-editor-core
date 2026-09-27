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

const REQUIRED_ELEMENTS: readonly string[] = [
  'score-partwise','part-list','score-part','part-name','part','measure','attributes','divisions','key','fifths','time','beats','beat-type','staves','clef','sign','line','clef-octave-change',
  'note','grace','chord','pitch','rest','duration','voice','staff','step','alter','octave','type','dot','accidental','beam','time-modification','actual-notes','normal-notes','tie','notations','tied','slur','tuplet',
  'articulations','accent','strong-accent','staccato','tenuto','detached-legato','staccatissimo','spiccato','scoop','plop','doit','falloff','breath-mark','caesura','stress','unstress','soft-accent',
  'ornaments','trill-mark','turn','delayed-turn','inverted-turn','delayed-inverted-turn','vertical-turn','inverted-vertical-turn','shake','mordent','inverted-mordent','schleifer','haydn','accidental-mark','tremolo','wavy-line',
  'backup','forward','barline','bar-style','repeat'
];

const REQUIRED_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
  'score-partwise': ['version'],
  'score-part': ['id'],
  part: ['id'],
  measure: ['number','implicit','non-controlling'],
  note: ['id'],
  clef: ['number'],
  barline: ['location'],
  repeat: ['direction'],
  beam: ['number'],
  tie: ['type'],
  tied: ['type','number'],
  slur: ['type','number'],
  tuplet: ['type','number'],
  grace: ['slash','steal-time-previous','steal-time-following','make-time'],
  accent: ['placement'],
  'strong-accent': ['placement','type'],
  staccato: ['placement'],
  tenuto: ['placement'],
  'detached-legato': ['placement'],
  staccatissimo: ['placement'],
  spiccato: ['placement'],
  scoop: ['placement'],
  plop: ['placement'],
  doit: ['placement'],
  falloff: ['placement'],
  'breath-mark': ['placement'],
  caesura: ['placement'],
  stress: ['placement'],
  unstress: ['placement'],
  'soft-accent': ['placement'],
  'trill-mark': ['placement'],
  turn: ['placement'],
  'delayed-turn': ['placement'],
  'inverted-turn': ['placement'],
  'delayed-inverted-turn': ['placement'],
  'vertical-turn': ['placement'],
  'inverted-vertical-turn': ['placement'],
  shake: ['placement'],
  mordent: ['placement'],
  'inverted-mordent': ['placement'],
  schleifer: ['placement'],
  haydn: ['placement'],
  'accidental-mark': ['placement'],
  tremolo: ['type','number','placement'],
  'wavy-line': ['type','number','placement']
};

const ARTICULATION_ELEMENTS: readonly string[] = [
  'accent','strong-accent','staccato','tenuto','detached-legato','staccatissimo','spiccato','scoop','plop','doit','falloff',
  'breath-mark','caesura','stress','unstress','soft-accent'
];

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
    ARTICULATION_ELEMENTS.includes(element) &&
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
  if (REQUIRED_ELEMENTS.includes(name)) {
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
  if (REQUIRED_ATTRIBUTES[element]?.includes(attribute) === true) {
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
