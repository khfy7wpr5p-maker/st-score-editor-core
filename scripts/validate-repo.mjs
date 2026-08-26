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
const stageIndex = expectedStages.indexOf(architecture.currentStage);
if (stageIndex < 1) fail('architecture currentStage may not regress below E1');
if (architecture.musicXml?.isDirectEditorState !== false) fail('MusicXML must not be direct editor state');
if (architecture.musicXml?.safeImportRequired !== true) fail('safe MusicXML import must remain required');

for (const renderer of Object.values(architecture.rendererCandidates ?? {})) {
  if (renderer.admittedDependency !== false) fail('renderer dependency admitted before review');
}

const admittedTypescript = architecture.buildDependencies?.typescript;
if (admittedTypescript?.version !== '6.0.3') fail('TypeScript architecture pin drift');
if (admittedTypescript?.runtime !== false) fail('TypeScript must remain build-only');
if (admittedTypescript?.license !== 'Apache-2.0') fail('TypeScript license record drift');

if (pkg.private !== true) fail('package must remain private during controlled development');
if (Object.keys(pkg.dependencies ?? {}).length !== 0) fail('runtime dependencies must remain empty at E1');
const devDependencyEntries = Object.entries(pkg.devDependencies ?? {});
if (devDependencyEntries.length !== 1) fail('only the admitted TypeScript dev dependency is allowed at E1');
if (pkg.devDependencies?.typescript !== '6.0.3') fail('TypeScript package pin must equal 6.0.3');

console.log('E1 repository contracts: PASS');
