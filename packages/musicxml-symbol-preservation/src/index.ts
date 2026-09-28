import { SaxesParser } from 'saxes';
import {
  createMusicXmlProcessingRuntime,
  type MusicXmlProcessingOptions
} from '../../musicxml/src/processing.js';
import {
  normalizeMusicXmlInput,
  type MusicXmlInput
} from '../../musicxml/src/xmlSafety.js';
import {
  createPreservedMusicXmlSymbolV1,
  NORMALIZED_IMPORT_ENVELOPE_VERSION,
  type PreservedMusicXmlSymbolV1
} from '../../musicxml-import-contract/src/index.js';
import {
  PARTITURA_HANDLED_TECHNICAL_SYMBOLS,
  REVIEWED_GUITAR_TECHNICAL_SYMBOLS,
  partituraHandledTechnicalSymbolSet,
  reviewedGuitarTechnicalSymbolSet
} from './guitarTechnical.js';

export {
  PARTITURA_HANDLED_TECHNICAL_SYMBOLS,
  REVIEWED_GUITAR_TECHNICAL_SYMBOLS
} from './guitarTechnical.js';

export interface MusicXmlSymbolPreservationOptionsV1 extends MusicXmlProcessingOptions {
  readonly sourceIdentity: string;
  readonly additionalReviewedElements?: readonly string[];
}

export interface MusicXmlSymbolPreservationResultV1 {
  readonly version: typeof NORMALIZED_IMPORT_ENVELOPE_VERSION;
  readonly sourceIdentity: string;
  readonly symbols: readonly Readonly<PreservedMusicXmlSymbolV1>[];
}

type Frame = {
  readonly name: string;
  readonly sourcePath: string;
  readonly childCounts: Map<string, number>;
  readonly attributes: Record<string, string>;
  readonly measureNumber: string | null;
  readonly sourceNoteId: string | null;
  readonly inTechnical: boolean;
  readonly inStaffDetails: boolean;
  readonly preserved: boolean;
  text: string;
};

const nonEmpty = (value: string, label: string): string => {
  if (value.trim() === '') throw new TypeError(`${label} must be a non-empty string.`);
  return value;
};

const occurrencePath = (
  parent: Frame | undefined,
  rootCounts: Map<string, number>,
  name: string
): string => {
  const counts = parent?.childCounts ?? rootCounts;
  const index = counts.get(name) ?? 0;
  counts.set(name, index + 1);
  const segment = `${name}[${index}]`;
  return parent === undefined ? segment : `${parent.sourcePath}/${segment}`;
};

export const extractPreservedMusicXmlSymbolsV1 = (
  input: MusicXmlInput,
  options: MusicXmlSymbolPreservationOptionsV1
): Readonly<MusicXmlSymbolPreservationResultV1> => {
  const sourceIdentity = nonEmpty(options.sourceIdentity, 'MusicXML source identity');
  const runtime = createMusicXmlProcessingRuntime(options);
  const normalized = normalizeMusicXmlInput(input, runtime);
  const reviewed = new Set<string>(reviewedGuitarTechnicalSymbolSet());
  for (const name of options.additionalReviewedElements ?? []) {
    reviewed.add(nonEmpty(name, 'Additional reviewed MusicXML element'));
  }
  const partituraHandled = partituraHandledTechnicalSymbolSet();
  const parser = new SaxesParser({ xmlns: true });
  const frames: Frame[] = [];
  const rootCounts = new Map<string, number>();
  const symbols: Readonly<PreservedMusicXmlSymbolV1>[] = [];
  let elements = 0;
  let attributes = 0;
  let textBytes = 0;

  parser.on('error', error => { throw error; });
  parser.on('opentag', tag => {
    runtime.checkpoint('ps:o');
    const depth = frames.length + 1;
    if (depth > runtime.limits.maxDepth) throw new RangeError('MusicXML preservation depth limit exceeded.');
    if (++elements > runtime.limits.maxElements) throw new RangeError('MusicXML preservation element limit exceeded.');

    const name = tag.local || tag.name;
    const uri = tag.uri || '';
    if (uri !== '') throw new TypeError(`Foreign namespace is not reviewed for preservation: ${name}`);

    const parent = frames.at(-1);
    const rawAttributes = Object.values(tag.attributes);
    attributes += rawAttributes.length;
    if (attributes > runtime.limits.maxAttributes) throw new RangeError('MusicXML preservation attribute limit exceeded.');

    const attrs: Record<string, string> = {};
    for (const item of rawAttributes) {
      const attributeName = item.local || item.name;
      if ((item.uri || '') !== '') throw new TypeError(`Foreign attribute namespace is not reviewed for preservation: ${attributeName}`);
      attrs[attributeName] = item.value;
    }

    const inTechnical = name === 'technical' || parent?.inTechnical === true;
    const inStaffDetails = name === 'staff-details' || parent?.inStaffDetails === true;
    const isReviewed = reviewed.has(name);

    if (
      inTechnical &&
      name !== 'technical' &&
      !isReviewed &&
      !partituraHandled.has(name)
    ) {
      throw new TypeError(`Unreviewed MusicXML technical symbol: ${name}`);
    }
    if (
      inStaffDetails &&
      name !== 'staff-details' &&
      !isReviewed
    ) {
      throw new TypeError(`Unreviewed MusicXML staff-details symbol: ${name}`);
    }

    const measureNumber =
      name === 'measure'
        ? attrs.number ?? parent?.measureNumber ?? null
        : parent?.measureNumber ?? null;
    const sourceNoteId =
      name === 'note'
        ? attrs.id ?? null
        : parent?.sourceNoteId ?? null;

    frames.push({
      name,
      sourcePath: occurrencePath(parent, rootCounts, name),
      childCounts: new Map<string, number>(),
      attributes: attrs,
      measureNumber,
      sourceNoteId,
      inTechnical,
      inStaffDetails,
      preserved: isReviewed,
      text: ''
    });
  });

  const appendText = (text: string): void => {
    runtime.checkpoint('ps:t');
    textBytes += new TextEncoder().encode(text).byteLength;
    if (textBytes > runtime.limits.maxTextBytes) throw new RangeError('MusicXML preservation text limit exceeded.');
    const frame = frames.at(-1);
    if (frame !== undefined) frame.text += text;
  };
  parser.on('text', appendText);
  parser.on('cdata', appendText);

  parser.on('closetag', () => {
    runtime.checkpoint('ps:c');
    const frame = frames.pop();
    if (frame === undefined) throw new TypeError('Invalid MusicXML preservation stack.');
    if (!frame.preserved) return;
    const text = frame.text.trim();
    symbols.push(createPreservedMusicXmlSymbolV1({
      element: frame.name,
      sourcePath: frame.sourcePath,
      measureNumber: frame.measureNumber,
      sourceNoteId: frame.sourceNoteId,
      attributes: frame.attributes,
      text: text === '' ? null : text,
      provenance: {
        sourceIdentity,
        parser: 'raw-musicxml-preservation-v1'
      }
    }));
  });

  try {
    parser.write(normalized.xml).close();
  } catch (error) {
    if (error instanceof TypeError || error instanceof RangeError) throw error;
    throw new TypeError('Invalid MusicXML for symbol preservation.');
  }

  if (frames.length !== 0) throw new TypeError('Invalid MusicXML preservation stack.');

  return Object.freeze({
    version: NORMALIZED_IMPORT_ENVELOPE_VERSION,
    sourceIdentity,
    symbols: Object.freeze([...symbols])
  });
};
