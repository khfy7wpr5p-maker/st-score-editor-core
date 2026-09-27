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

const S: MusicXmlCompatibilityClass = 'SEMANTIC_REQUIRED';
const I: MusicXmlCompatibilityClass = 'IGNORABLE_PRESENTATION_METADATA';
const F: MusicXmlCompatibilityClass = 'UNSUPPORTED_SEMANTIC_FAIL_CLOSED';

const E: readonly string[] = [
  'score-partwise','part-list','score-part','part-name','part','measure','attributes','divisions','key','fifths','time','beats','beat-type','staves','clef','sign','line','clef-octave-change',
  'note','grace','chord','pitch','rest','duration','voice','staff','step','alter','octave','type','dot','accidental','beam','time-modification','actual-notes','normal-notes','tie','notations','tied','slur','tuplet',
  'articulations','accent','strong-accent','staccato','tenuto','detached-legato','staccatissimo','spiccato','scoop','plop','doit','falloff','breath-mark','caesura','stress','unstress','soft-accent',
  'ornaments','trill-mark','turn','delayed-turn','inverted-turn','delayed-inverted-turn','vertical-turn','inverted-vertical-turn','shake','mordent','inverted-mordent','schleifer','haydn','accidental-mark','tremolo','wavy-line',
  'backup','forward','barline','bar-style','repeat'
];

const A: Readonly<Record<string, readonly string[]>> = {
  'score-partwise':['version'],'score-part':['id'],part:['id'],measure:['number','implicit','non-controlling'],note:['id'],clef:['number'],barline:['location'],repeat:['direction'],beam:['number'],
  tie:['type'],tied:['type','number'],slur:['type','number'],tuplet:['type','number'],grace:['slash','steal-time-previous','steal-time-following','make-time'],
  accent:['placement'],'strong-accent':['placement','type'],staccato:['placement'],tenuto:['placement'],'detached-legato':['placement'],staccatissimo:['placement'],spiccato:['placement'],
  scoop:['placement'],plop:['placement'],doit:['placement'],falloff:['placement'],'breath-mark':['placement'],caesura:['placement'],stress:['placement'],unstress:['placement'],'soft-accent':['placement'],
  'trill-mark':['placement'],turn:['placement'],'delayed-turn':['placement'],'inverted-turn':['placement'],'delayed-inverted-turn':['placement'],'vertical-turn':['placement'],'inverted-vertical-turn':['placement'],
  shake:['placement'],mordent:['placement'],'inverted-mordent':['placement'],schleifer:['placement'],haydn:['placement'],'accidental-mark':['placement'],tremolo:['type','number','placement'],'wavy-line':['type','number','placement']
};

const ARTS: readonly string[] = [
  'accent','strong-accent','staccato','tenuto','detached-legato','staccatissimo','spiccato','scoop','plop','doit','falloff','breath-mark','caesura','stress','unstress','soft-accent'
];

const d = (
  classification: MusicXmlCompatibilityClass,
  pathClass: string,
  reason: string
): Readonly<MusicXmlCompatibilityDecision> => Object.freeze({ classification, pathClass, reason });

const key = (path: readonly string[], name: string): string => [...path, name].join('/');

export const classifyMusicXmlCompatibilityElement = (
  path: readonly string[],
  name: string,
  uri: string
): Readonly<MusicXmlCompatibilityDecision> => {
  const k = key(path, name);
  if (uri !== '') return d(F, k, 'foreign-element');
  if (E.includes(name)) return d(S, k, 'semantic-element');
  if (
    k === 'score-partwise/identification' ||
    k === 'score-partwise/defaults' ||
    k === 'score-partwise/part-list/score-part/part-abbreviation' ||
    k === 'score-partwise/part-list/score-part/score-instrument' ||
    k === 'score-partwise/part-list/score-part/midi-instrument' ||
    k === 'score-partwise/part/measure/print' ||
    k === 'score-partwise/part/measure/note/stem'
  ) return d(I, k, 'ignored-subtree');
  return d(F, k, 'unsupported-element');
};

export const classifyMusicXmlCompatibilityAttribute = (
  path: readonly string[],
  element: string,
  attribute: string,
  uri: string
): Readonly<MusicXmlCompatibilityDecision> => {
  const k = key(path, element);
  if (uri !== '') return d(F, k, 'foreign-attribute');
  if (A[element]?.includes(attribute) === true) return d(S, k, 'semantic-attribute');
  if (
    (k === 'score-partwise/part/measure' && attribute === 'width') ||
    (k === 'score-partwise/part/measure/note' && attribute === 'default-x') ||
    (k === 'score-partwise/part/measure/note/stem' && attribute === 'default-y') ||
    (
      path.join('/') === 'score-partwise/part/measure/note/notations/articulations' &&
      ARTS.includes(element) &&
      attribute === 'default-y'
    )
  ) return d(I, k, 'ignored-attribute');
  return d(F, k, 'unsupported-attribute');
};
