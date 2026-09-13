import { readFile, writeFile } from 'node:fs/promises';

const path = 'dist/browser/st-score-editor-app.manifest.json';
const manifest = JSON.parse(await readFile(path, 'utf8'));
const patched = Object.freeze({
  ...manifest,
  noteAuditionAdapterAvailable: true,
  noteAuditionUiAvailable: true,
  audioEngineBundled: false,
  externalAudioPortRequired: true,
  auditionInstruments: Object.freeze(['GRAND_PIANO', 'CLASSICAL_GUITAR']),
  auditionCanonicalMutationAuthority: false,
  auditionHistoryMutationAuthority: false,
  rendererAudioAuthority: false
});
await writeFile(path, `${JSON.stringify(patched, null, 2)}\n`, 'utf8');
console.log('APP audio host manifest: PASS');
