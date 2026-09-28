export const MUSICXML_COMPATIBILITY_POLICY_VERSION = '1.0.0' as const;

export type MusicXmlCompatibilityClass =
  | 'SEMANTIC_REQUIRED'
  | 'IGNORABLE_PRESENTATION_METADATA'
  | 'UNSUPPORTED_SEMANTIC_FAIL_CLOSED';

export type MusicXmlImportDisposition =
  | 'CANONICAL_EDITABLE'
  | 'PRESERVED_RENDERABLE'
  | 'UNSUPPORTED_SEMANTIC_FAIL_CLOSED';

export const importDispositionForMusicXmlCompatibilityClass = (
  classification: MusicXmlCompatibilityClass
): MusicXmlImportDisposition => {
  switch (classification) {
    case 'SEMANTIC_REQUIRED':
      return 'CANONICAL_EDITABLE';
    case 'IGNORABLE_PRESENTATION_METADATA':
      return 'PRESERVED_RENDERABLE';
    case 'UNSUPPORTED_SEMANTIC_FAIL_CLOSED':
      return 'UNSUPPORTED_SEMANTIC_FAIL_CLOSED';
  }
};

export interface MusicXmlCompatibilityDecision {
  readonly classification: MusicXmlCompatibilityClass;
  readonly pathClass: string;
  readonly reason: string;
}

const E = '|score-partwise|part-list|score-part|part-name|part|measure|attributes|divisions|key|fifths|time|beats|beat-type|staves|clef|sign|line|clef-octave-change|note|grace|chord|pitch|rest|duration|voice|staff|step|alter|octave|type|dot|accidental|beam|time-modification|actual-notes|normal-notes|tie|notations|tied|slur|tuplet|articulations|accent|strong-accent|staccato|tenuto|detached-legato|staccatissimo|spiccato|scoop|plop|doit|falloff|breath-mark|caesura|stress|unstress|soft-accent|ornaments|trill-mark|turn|delayed-turn|inverted-turn|delayed-inverted-turn|vertical-turn|inverted-vertical-turn|shake|mordent|inverted-mordent|schleifer|haydn|accidental-mark|tremolo|wavy-line|backup|forward|barline|bar-style|repeat|';
const A = '|score-partwise@version|score-part@id|part@id|measure@number|measure@implicit|measure@non-controlling|note@id|clef@number|barline@location|repeat@direction|beam@number|tie@type|tied@type|tied@number|slur@type|slur@number|tuplet@type|tuplet@number|grace@slash|grace@steal-time-previous|grace@steal-time-following|grace@make-time|strong-accent@type|tremolo@type|tremolo@number|wavy-line@type|wavy-line@number|';
const PLACEMENT = '|accent|strong-accent|staccato|tenuto|detached-legato|staccatissimo|spiccato|scoop|plop|doit|falloff|breath-mark|caesura|stress|unstress|soft-accent|trill-mark|turn|delayed-turn|inverted-turn|delayed-inverted-turn|vertical-turn|inverted-vertical-turn|shake|mordent|inverted-mordent|schleifer|haydn|accidental-mark|tremolo|wavy-line|';
const ART = '|accent|strong-accent|staccato|tenuto|detached-legato|staccatissimo|spiccato|scoop|plop|doit|falloff|breath-mark|caesura|stress|unstress|soft-accent|';

const has = (set: string, value: string): boolean => set.includes(`|${value}|`);
const path = (parts: readonly string[]): string => parts.join('/');

export type MusicXmlCompatibilityCode = 0 | 1 | 2;

export const musicXmlCompatibilityElementCodeAt = (
  p: string,
  name: string,
  uri: string
): MusicXmlCompatibilityCode => {
  if (uri !== '') return 2;
  if (has(E, name)) return 0;
  if (
    (p === 'score-partwise' && (name === 'identification' || name === 'defaults')) ||
    (p === 'score-partwise/part-list/score-part' && (name === 'part-abbreviation' || name === 'score-instrument' || name === 'midi-instrument')) ||
    (p === 'score-partwise/part/measure' && name === 'print') ||
    (p === 'score-partwise/part/measure/note' && name === 'stem')
  ) return 1;
  return 2;
};

export const musicXmlCompatibilityAttributeCodeAt = (
  p: string,
  element: string,
  attribute: string,
  uri: string
): MusicXmlCompatibilityCode => {
  if (uri !== '') return 2;
  if ((attribute === 'placement' && has(PLACEMENT, element)) || has(A, `${element}@${attribute}`)) return 0;
  if (
    (p === 'score-partwise/part' && element === 'measure' && attribute === 'width') ||
    (p === 'score-partwise/part/measure' && element === 'note' && attribute === 'default-x') ||
    (p === 'score-partwise/part/measure/note' && element === 'stem' && attribute === 'default-y') ||
    (p === 'score-partwise/part/measure/note/notations/articulations' && has(ART, element) && attribute === 'default-y')
  ) return 1;
  return 2;
};

export const musicXmlCompatibilityElementCode = (
  parts: readonly string[],
  name: string,
  uri: string
): MusicXmlCompatibilityCode => musicXmlCompatibilityElementCodeAt(path(parts), name, uri);

export const musicXmlCompatibilityAttributeCode = (
  parts: readonly string[],
  element: string,
  attribute: string,
  uri: string
): MusicXmlCompatibilityCode => musicXmlCompatibilityAttributeCodeAt(path(parts), element, attribute, uri);

const CLASSES: readonly MusicXmlCompatibilityClass[] = [
  'SEMANTIC_REQUIRED',
  'IGNORABLE_PRESENTATION_METADATA',
  'UNSUPPORTED_SEMANTIC_FAIL_CLOSED'
];
const REASONS = ['required', 'reviewed presentation/metadata', 'unsupported or unclassified'] as const;

const decision = (
  parts: readonly string[],
  name: string,
  code: MusicXmlCompatibilityCode
): Readonly<MusicXmlCompatibilityDecision> => Object.freeze({
  classification: CLASSES[code]!,
  pathClass: [...parts, name].join('/'),
  reason: REASONS[code]
});

export const classifyMusicXmlCompatibilityElement = (
  parts: readonly string[],
  name: string,
  uri: string
): Readonly<MusicXmlCompatibilityDecision> =>
  decision(parts, name, musicXmlCompatibilityElementCode(parts, name, uri));

export const classifyMusicXmlCompatibilityAttribute = (
  parts: readonly string[],
  element: string,
  attribute: string,
  uri: string
): Readonly<MusicXmlCompatibilityDecision> =>
  decision(parts, element, musicXmlCompatibilityAttributeCode(parts, element, attribute, uri));
