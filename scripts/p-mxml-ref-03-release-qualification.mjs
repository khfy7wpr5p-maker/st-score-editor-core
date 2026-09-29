import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { createSingleNotePartituraEnvelopeV1 } from './lib/p-mxml-ref-03-envelope-fixture.mjs';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import {
  routeMusicXmlImportV1,
  routeMusicXmlImportV2CompatibleV1
} from '../dist/packages/musicxml-import-router/src/index.js';
import {
  openMusicXmlScoreEditorAppDocument,
  selectAppSemanticAddress,
  commitAppTopologyIntent,
  navigateAppDocumentHistory
} from '../dist/packages/score-editor-app-document/src/index.js';

export const P_MXML_REF_03_RELEASE_QUALIFICATION_VERSION = '1.0.0';

const fixture = new URL(
  '../corpus/fixtures/musicxml-compatibility/ses-90-guitar-tab-technical.musicxml',
  import.meta.url
);
const encoder = new TextEncoder();
const sha256 = value => createHash('sha256').update(encoder.encode(value)).digest('hex');
const sourceFor = value => Object.freeze({
  sha256: sha256(value),
  format: 'musicxml',
  byteLength: encoder.encode(value).byteLength
});
const shaProvider = async value => sha256(value);
const finiteDuration = value => Number.isFinite(value) && value >= 0 ? value : 0;

const envelopeFor = sourceIdentity => createSingleNotePartituraEnvelopeV1(sourceIdentity);

const firstSelectableAddress = score => {
  const part = score.parts[0];
  const staff = part?.staves[0];
  const measure = staff?.measures[0];
  const voice = measure?.voices[0];
  const event = voice?.events.find(candidate => candidate.kind === 'note' || candidate.kind === 'chord');
  if (event === undefined) throw new Error('SES-91 fixture has no selectable pitched event.');
  const address = addressEntityV3(score, event.id);
  if (address.kind !== 'event') throw new Error('SES-91 event address did not resolve.');
  return address;
};

export const createSes91V2FallbackLoader = (onFallback = () => {}) => (
  xml,
  options
) => routeMusicXmlImportV2CompatibleV1(xml, {
  ...options,
  partituraFallback: async request => {
    onFallback(request);
    return envelopeFor(request.sourceIdentity);
  }
});

export const runPartituraIsolationQualification = async ({
  now = () => performance.now()
} = {}) => {
  const musicXml = await readFile(fixture, 'utf8');

  let routeFallbackCalls = 0;
  const importStarted = now();
  const routed = await routeMusicXmlImportV1(musicXml, {
    source: sourceFor(musicXml),
    documentId: 'doc:ses-91-route',
    revisionId: 'rev:ses-91-route',
    partituraFallback: async request => {
      routeFallbackCalls += 1;
      return envelopeFor(request.sourceIdentity);
    }
  });
  const openImportMs = finiteDuration(now() - importStarted);

  let appFallbackCalls = 0;
  const load = createSes91V2FallbackLoader(() => { appFallbackCalls += 1; });

  let document = await openMusicXmlScoreEditorAppDocument(musicXml, {
    documentId: 'doc:ses-91-app',
    revisionId: 'rev:ses-91-imported',
    sha256Hex: shaProvider,
    load
  });
  const importedRevision = document.session.history.present.score.revision.id;
  const historyBefore = document.session.history.past.length;
  const fallbackCallsBefore = appFallbackCalls;

  const interactionStarted = now();
  const address = firstSelectableAddress(document.session.history.present.score);
  const selected = selectAppSemanticAddress(document, address);
  const selectionPreservesRevision =
    selected.session.history.present.score.revision.id === importedRevision &&
    selected.session.history.past.length === historyBefore;

  const part = selected.session.history.present.score.parts[0];
  if (part === undefined) throw new Error('SES-91 fixture has no part.');
  document = commitAppTopologyIntent(selected, {
    version: '1.0.0',
    type: 'RENAME_PART_OR_INSTRUMENT',
    target: addressEntityV3(selected.session.history.present.score, part.id),
    partName: 'Qualified Guitar',
    instrumentName: 'Qualified Guitar',
    instrumentShortName: 'Gtr.'
  }, { nextRevisionId: 'rev:ses-91-edit' });

  const editedRevision = document.session.history.present.score.revision.id;
  const editCreatesOneRevision =
    editedRevision === 'rev:ses-91-edit' &&
    document.session.history.past.length === historyBefore + 1;

  document = navigateAppDocumentHistory(document, 'UNDO');
  const undoRestoresImportedRevision =
    document.session.history.present.score.revision.id === importedRevision;

  document = navigateAppDocumentHistory(document, 'REDO');
  const redoRestoresEditedRevision =
    document.session.history.present.score.revision.id === editedRevision;

  const renderRequest = document.session.renderRequest;
  const renderRequestCurrent =
    renderRequest.documentId === document.session.history.present.score.id &&
    renderRequest.revisionId === editedRevision;

  const interactionMs = finiteDuration(now() - interactionStarted);
  const fallbackCallsAfter = appFallbackCalls;

  return Object.freeze({
    version: P_MXML_REF_03_RELEASE_QUALIFICATION_VERSION,
    open: Object.freeze({
      route: routed.route,
      fallbackCalls: routeFallbackCalls,
      canonicalRevision: routed.score.revision.id
    }),
    interaction: Object.freeze({
      fallbackCallsBefore,
      fallbackCallsAfter,
      fallbackCallsDuringInteraction: fallbackCallsAfter - fallbackCallsBefore,
      selectionPreservesRevision,
      editCreatesOneRevision,
      undoRestoresImportedRevision,
      redoRestoresEditedRevision,
      renderRequestCurrent
    }),
    timing: Object.freeze({
      policy: 'INFORMATIONAL_SEPARATE_DOMAINS',
      openImportMs,
      interactionMs,
      thresholdClaimed: false,
      ses82LatencyClaimedFixed: false
    }),
    release: Object.freeze({
      physicalDeviceClaim: false,
      productionReleaseAuthorized: false,
      seslitabCutoverAuthorized: false
    })
  });
};

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(await runPartituraIsolationQualification(), null, 2));
}
