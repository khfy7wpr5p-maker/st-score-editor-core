import { createHash } from 'node:crypto';
import { createScoreEditorSdkV1 } from '../dist/packages/score-editor-sdk-v1/public.js';

const sha256Hex = async text => createHash('sha256').update(new TextEncoder().encode(text)).digest('hex');

const deterministicIds = () => {
  let index = 0;
  return () => `generic-${++index}`;
};

const expectOk = (result, label) => {
  if (!result.ok) throw new Error(`${label}: ${result.error.code}: ${result.error.message}`);
  return result.value;
};

export const runP06GenericSdkHostExample = async () => {
  const sdk = createScoreEditorSdkV1();
  const snapshots = [];
  const host = Object.freeze({
    contractVersion: '1.0.0',
    onMount: snapshot => { snapshots.push(Object.freeze({ phase: 'mount', snapshot })); },
    onUpdate: snapshot => { snapshots.push(Object.freeze({ phase: 'update', snapshot })); },
    onUnmount: () => { snapshots.push(Object.freeze({ phase: 'unmount', snapshot: null })); }
  });

  expectOk(sdk.lifecycle.mount(host), 'mount');

  expectOk(sdk.document.newDocument({
    title: 'P06 generic seed',
    preset: 'GUITAR_TREBLE',
    idFactory: deterministicIds()
  }), 'new document');

  const seedGuard = sdk.getRevisionGuard();
  if (seedGuard === null) throw new Error('seed revision guard missing');
  const seedXml = expectOk(sdk.document.exportMusicXml(seedGuard), 'export seed');

  await sdk.document.openMusicXml(seedXml, {
    title: 'P06 generic imported score',
    documentId: 'doc:p06-generic-open',
    revisionId: 'rev:p06-generic-open',
    sha256Hex
  }).then(result => expectOk(result, 'open MusicXML'));

  const openedGuard = sdk.getRevisionGuard();
  if (openedGuard === null) throw new Error('opened revision guard missing');
  const targets = expectOk(sdk.selection.listTargets(openedGuard), 'list semantic targets');
  const eventTarget = targets.find(target => target.entityKind === 'event');
  if (eventTarget === undefined) throw new Error('generic example requires one semantic event target');

  expectOk(sdk.selection.select(eventTarget.address, openedGuard), 'select event');
  const edited = expectOk(sdk.authoring.commitKeypad({
    expected: openedGuard,
    action: Object.freeze({ version: '1.0.0', actionId: 'duration.quarter' }),
    nextRevisionId: 'rev:p06-generic-edit'
  }), 'edit event duration');

  const editedGuard = sdk.getRevisionGuard();
  if (editedGuard === null || editedGuard.revisionId !== 'rev:p06-generic-edit') {
    throw new Error('generic edit did not produce the requested canonical revision');
  }
  if (edited.historyPastCount < 1) throw new Error('generic edit did not enter unified history');

  const undone = expectOk(sdk.history.undo(editedGuard), 'undo edit');

  const degraded = Object.freeze({
    rendererAvailable: sdk.supports('renderer'),
    playbackAvailable: sdk.supports('playback'),
    rendererResult: sdk.requireCapability('renderer'),
    playbackResult: sdk.requireCapability('playback')
  });

  expectOk(sdk.lifecycle.unmount(), 'unmount');
  expectOk(sdk.lifecycle.dispose(), 'dispose');

  return Object.freeze({
    sdkVersion: sdk.version,
    openedRevisionId: openedGuard.revisionId,
    editedRevisionId: editedGuard.revisionId,
    undoRevisionId: undone.revisionId,
    undoFutureCount: undone.historyFutureCount,
    snapshots: Object.freeze([...snapshots]),
    degraded
  });
};
