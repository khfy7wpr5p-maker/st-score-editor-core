import { readFile } from 'node:fs/promises';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

const fail = (message) => {
  throw new Error(message);
};

const authority = await readJson('contracts/authority-boundary-v1.json');
const architecture = await readJson('contracts/editor-core-v1.json');
const pkg = await readJson('package.json');

if (authority.contract !== 'ST_SCORE_EDITOR_AUTHORITY_BOUNDARY') fail('unexpected authority contract');
if (authority.version !== '1.0.0') fail('authority contract version drift');
if (authority.stage !== 'E0') fail('authority contract must remain E0 baseline');

const mustBeTrue = [
  ['source.immutable', authority.source?.immutable],
  ['source.identityRequired', authority.source?.identityRequired],
  ['edits.stableSemanticTargetRequired', authority.edits?.stableSemanticTargetRequired],
  ['edits.typedBoundedCommandRequired', authority.edits?.typedBoundedCommandRequired],
  ['edits.atomicTransactionRequired', authority.edits?.atomicTransactionRequired],
  ['edits.validationRequiredBeforeAcceptance', authority.edits?.validationRequiredBeforeAcceptance],
  ['edits.staleTargetFailsClosed', authority.edits?.staleTargetFailsClosed],
  ['renderer.presentationOnly', authority.renderer?.presentationOnly],
  ['ai.advisoryOnly', authority.ai?.advisoryOnly]
];

for (const [name, value] of mustBeTrue) {
  if (value !== true) fail(`${name} must be true`);
}

const mustBeFalse = [
  ['source.inPlaceRewriteAllowed', authority.source?.inPlaceRewriteAllowed],
  ['canonicalScore.rendererStateAuthoritative', authority.canonicalScore?.rendererStateAuthoritative],
  ['canonicalScore.browserStateAuthoritative', authority.canonicalScore?.browserStateAuthoritative],
  ['edits.partialAuthoritativeApplyAllowed', authority.edits?.partialAuthoritativeApplyAllowed],
  ['renderer.mayMutateCanonicalScore', authority.renderer?.mayMutateCanonicalScore],
  ['renderer.coordinatesMayAddressAuthoritativeEditAlone', authority.renderer?.coordinatesMayAddressAuthoritativeEditAlone],
  ['ai.mayMutateCanonicalScore', authority.ai?.mayMutateCanonicalScore],
  ['ai.mayBypassValidation', authority.ai?.mayBypassValidation],
  ['ai.automaticRepairAuthority', authority.ai?.automaticRepairAuthority],
  ['products.scoreMosaicAuthorityFlowsToGuitarDerivative', authority.products?.scoreMosaicAuthorityFlowsToGuitarDerivative],
  ['products.guitarDerivativeAuthorityFlowsUpstream', authority.products?.guitarDerivativeAuthorityFlowsUpstream],
  ['production.activatedByRepositoryMerge', authority.production?.activatedByRepositoryMerge],
  ['production.publicWriteApiAuthorized', authority.production?.publicWriteApiAuthorized],
  ['production.liveAiEditAuthorityAuthorized', authority.production?.liveAiEditAuthorityAuthorized]
];

for (const [name, value] of mustBeFalse) {
  if (value !== false) fail(`${name} must be false`);
}

const expectedStages = ['E0', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9'];
if (JSON.stringify(architecture.stages) !== JSON.stringify(expectedStages)) fail('stage order drift');
if (architecture.currentStage !== 'E0') fail('architecture currentStage must be E0 during foundation');
if (architecture.musicXml?.isDirectEditorState !== false) fail('MusicXML must not be direct editor state');
if (architecture.musicXml?.safeImportRequired !== true) fail('safe MusicXML import must remain required');

for (const renderer of Object.values(architecture.rendererCandidates ?? {})) {
  if (renderer.admittedDependency !== false) fail('renderer dependency admitted before review');
}

if (pkg.private !== true) fail('package must remain private during foundation');
if (Object.keys(pkg.dependencies ?? {}).length !== 0) fail('E0 runtime dependencies must be empty');
if (Object.keys(pkg.devDependencies ?? {}).length !== 0) fail('E0 dev dependencies must be empty');

console.log('E0 repository contracts: PASS');
