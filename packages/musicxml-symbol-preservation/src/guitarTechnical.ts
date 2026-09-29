export const REVIEWED_GUITAR_TECHNICAL_SYMBOLS = Object.freeze([
  'string',
  'fret',
  'bend',
  'bend-alter',
  'pre-bend',
  'release',
  'hammer-on',
  'pull-off',
  'harmonic',
  'natural',
  'artificial',
  'base-pitch',
  'touching-pitch',
  'sounding-pitch',
  'pluck',
  'golpe',
  'staff-details',
  'staff-lines',
  'staff-tuning',
  'tuning-step',
  'tuning-alter',
  'tuning-octave'
] as const);

export const PARTITURA_HANDLED_TECHNICAL_SYMBOLS = Object.freeze([
  'fingering'
] as const);

export const reviewedGuitarTechnicalSymbolSet = (): ReadonlySet<string> =>
  new Set<string>(REVIEWED_GUITAR_TECHNICAL_SYMBOLS);

export const partituraHandledTechnicalSymbolSet = (): ReadonlySet<string> =>
  new Set<string>(PARTITURA_HANDLED_TECHNICAL_SYMBOLS);
