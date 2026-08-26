import { MusicXmlError } from './errors.js';

export const MUSICXML_PROCESSING_BUDGET_VERSION = '1.0.0' as const;

export interface MusicXmlProcessingLimits {
  readonly maxBytes: number;
  readonly maxDepth: number;
  readonly maxElements: number;
  readonly maxAttributes: number;
  readonly maxTextBytes: number;
  readonly maxMeasures: number;
  readonly maxEvents: number;
  readonly maxProcessingMilliseconds: number;
}

export const DEFAULT_MUSICXML_PROCESSING_LIMITS: Readonly<MusicXmlProcessingLimits> = Object.freeze({
  maxBytes: 5 * 1024 * 1024,
  maxDepth: 128,
  maxElements: 100_000,
  maxAttributes: 200_000,
  maxTextBytes: 4 * 1024 * 1024,
  maxMeasures: 2_000,
  maxEvents: 50_000,
  maxProcessingMilliseconds: 10_000
});

export interface MusicXmlProcessingOptions {
  readonly limits?: Partial<MusicXmlProcessingLimits>;
  readonly signal?: AbortSignal;
  readonly now?: () => number;
}

export interface MusicXmlProcessingRuntime {
  readonly limits: Readonly<MusicXmlProcessingLimits>;
  readonly checkpoint: (label: string) => void;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const validateLimit = (field: keyof MusicXmlProcessingLimits, value: unknown): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new MusicXmlError(
      'Processing budget limits must be positive safe integers.',
      'INVALID_CONFIGURATION',
      { field, value }
    );
  }
  return value;
};

export const createMusicXmlProcessingLimits = (
  overrides: Partial<MusicXmlProcessingLimits> = {}
): Readonly<MusicXmlProcessingLimits> => {
  if (!isPlainObject(overrides)) {
    throw new MusicXmlError('Processing budget overrides must be a plain object.', 'INVALID_CONFIGURATION');
  }
  const allowed = new Set(Object.keys(DEFAULT_MUSICXML_PROCESSING_LIMITS));
  for (const key of Object.keys(overrides)) {
    if (!allowed.has(key)) {
      throw new MusicXmlError('Processing budget contains an unknown field.', 'INVALID_CONFIGURATION', { field: key });
    }
  }

  const limits = Object.fromEntries(
    Object.entries(DEFAULT_MUSICXML_PROCESSING_LIMITS).map(([field, defaultValue]) => {
      const key = field as keyof MusicXmlProcessingLimits;
      return [key, validateLimit(key, overrides[key] ?? defaultValue)];
    })
  ) as unknown as MusicXmlProcessingLimits;

  return Object.freeze(limits);
};

export const createMusicXmlProcessingRuntime = (
  options: MusicXmlProcessingOptions = {}
): MusicXmlProcessingRuntime => {
  const limits = createMusicXmlProcessingLimits(options.limits ?? {});
  const now = options.now ?? Date.now;
  const startedAt = now();

  const checkpoint = (label: string): void => {
    if (options.signal?.aborted === true) {
      throw new MusicXmlError('MusicXML processing was aborted.', 'PROCESSING_ABORTED', { label });
    }
    const elapsed = now() - startedAt;
    if (!Number.isFinite(elapsed) || elapsed < 0) {
      throw new MusicXmlError('Processing clock returned an invalid elapsed time.', 'INVALID_CONFIGURATION', { label, elapsed });
    }
    if (elapsed > limits.maxProcessingMilliseconds) {
      throw new MusicXmlError('MusicXML processing exceeded the configured deadline.', 'PROCESSING_TIMEOUT', {
        label,
        limit: limits.maxProcessingMilliseconds,
        observed: elapsed
      });
    }
  };

  return Object.freeze({ limits, checkpoint });
};
