import { createStandaloneBrowserAppRuntime } from './index.js';
import {
  browserFileWorkflowCapabilities,
  readMusicXmlBrowserFile,
  pickMusicXmlBrowserFile,
  writeMusicXmlBrowserFile,
  createMusicXmlDownloadArtifact,
  MAX_LOCAL_MUSICXML_BYTES,
  MUSICXML_MIME_TYPE
} from '../../score-editor-browser-file-workflow/src/index.js';

export const SCORE_EDITOR_APP_GLOBAL = 'STScoreEditorApp' as const;

const createGlobalRuntime = () => Object.freeze({
  ...createStandaloneBrowserAppRuntime(),
  fileWorkflow: Object.freeze({
    maxLocalMusicXmlBytes: MAX_LOCAL_MUSICXML_BYTES,
    musicXmlMimeType: MUSICXML_MIME_TYPE,
    capabilities: browserFileWorkflowCapabilities,
    readFile: readMusicXmlBrowserFile,
    pickFile: pickMusicXmlBrowserFile,
    writeFile: writeMusicXmlBrowserFile,
    createDownloadArtifact: createMusicXmlDownloadArtifact
  })
});

const target = globalThis as typeof globalThis & {
  STScoreEditorApp?: ReturnType<typeof createGlobalRuntime>;
};

if (Object.prototype.hasOwnProperty.call(target, SCORE_EDITOR_APP_GLOBAL)) {
  throw new Error('ST_SCORE_EDITOR_APP_ALREADY_DEFINED');
}

Object.defineProperty(target, SCORE_EDITOR_APP_GLOBAL, {
  value: createGlobalRuntime(),
  writable: false,
  configurable: false,
  enumerable: true
});
