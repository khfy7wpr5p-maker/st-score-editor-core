export { parseMusicXmlV2Tree } from './parser.js';
export type { ParsedMusicXmlV2Result } from './parser.js';

export {
  importNotationMusicXmlV2 as importNotationMusicXmlV2Legacy
} from './importer.js';
export type { NotationMusicXmlV2ImportResult } from './importer.js';
export { serializeNotationMusicXmlV2 } from './serializer.js';

export {
  MUSICXML_NOTE_IDENTITY_BRIDGE_VERSION,
  importNotationMusicXmlV2PreservingNoteIds,
  importNotationMusicXmlV2PreservingNoteIds as importNotationMusicXmlV2
} from './identity.js';
