import { readFile } from 'node:fs/promises';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const fail = (message) => { throw new Error(message); };

const authority = await readJson('contracts/authority-boundary-v1.json');
const architecture = await readJson('contracts/editor-core-v1.json');
const pkg = await readJson('package.json');
const tsconfig = await readJson('tsconfig.json');

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
for (const [name, value] of mustBeTrue) if (value !== true) fail(`${name} must be true`);

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
for (const [name, value] of mustBeFalse) if (value !== false) fail(`${name} must be false`);

const expectedStages = ['E0', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9'];
if (JSON.stringify(architecture.stages) !== JSON.stringify(expectedStages)) fail('stage order drift');
const stageIndex = expectedStages.indexOf(architecture.currentStage);
if (stageIndex < 3) fail('architecture currentStage may not regress below E3');

if (architecture.musicXml?.isDirectEditorState !== false) fail('MusicXML must not be direct editor state');
if (architecture.musicXml?.safeImportRequired !== true) fail('safe MusicXML import must remain required');
if (architecture.musicXml?.semanticRoundTripRequiredBeforeE2Close !== true) fail('E2 semantic round trip gate must remain required');
if (architecture.musicXml?.e2Subset?.root !== 'score-partwise') fail('E2 root boundary drift');
if (architecture.musicXml?.e2Subset?.unsupportedSemanticsFailClosed !== true) fail('unsupported MusicXML semantics must fail closed');
if (architecture.musicXml?.e2Subset?.sourceIdentityVerifiedByCaller !== true) fail('caller source identity boundary drift');

const addressing = architecture.addressing;
if (addressing?.contractVersion !== '1.0.0') fail('addressing contract version drift');
if (addressing?.revisionBound !== true) fail('semantic addresses must remain revision-bound');
if (addressing?.ancestryBound !== true) fail('semantic addresses must remain ancestry-bound');
if (addressing?.rendererCoordinatesAuthoritative !== false) fail('renderer coordinates may not be authoritative');
if (addressing?.staleRevisionFailsClosed !== true) fail('stale revision must fail closed');
if (addressing?.pathMismatchFailsClosed !== true) fail('address path mismatch must fail closed');
if (addressing?.selectionSnapshotImmutable !== true) fail('selection snapshot must remain immutable');
if (JSON.stringify(addressing?.addressKinds) !== JSON.stringify(['document','part','staff','measure','voice','event','note'])) fail('address kind drift');

for (const renderer of Object.values(architecture.rendererCandidates ?? {})) {
  if (renderer.admittedDependency !== false) fail('renderer dependency admitted before E6 review');
}
const admittedTypescript = architecture.buildDependencies?.typescript;
if (admittedTypescript?.version !== '6.0.3' || admittedTypescript?.runtime !== false || admittedTypescript?.license !== 'Apache-2.0') fail('TypeScript admission drift');
if (architecture.runtimeDependencies?.saxes?.version !== '6.0.0' || architecture.runtimeDependencies?.saxes?.license !== 'ISC' || architecture.runtimeDependencies?.saxes?.authority !== 'XML_PARSER_ONLY') fail('saxes admission drift');
if (architecture.runtimeDependencies?.xmlchars?.version !== '2.2.0' || architecture.runtimeDependencies?.xmlchars?.license !== 'MIT') fail('xmlchars admission drift');

if (pkg.private !== true) fail('package must remain private during controlled development');
const runtimeDependencies = Object.entries(pkg.dependencies ?? {}).sort(([a], [b]) => a.localeCompare(b));
if (JSON.stringify(runtimeDependencies) !== JSON.stringify([['saxes','6.0.0'],['xmlchars','2.2.0']])) fail('runtime dependency drift');
if (JSON.stringify(pkg.devDependencies ?? {}) !== JSON.stringify({ typescript: '6.0.3' })) fail('dev dependency drift');
if (tsconfig.compilerOptions?.skipLibCheck !== false) fail('skipLibCheck must remain false');
if (JSON.stringify(tsconfig.compilerOptions?.paths?.saxes) !== JSON.stringify(['./types/saxes-6.0.0-compat.d.ts'])) fail('saxes facade path drift');
if (!(tsconfig.include ?? []).includes('types/**/*.d.ts')) fail('compatibility declarations must remain included');

console.log('E3 repository contracts: PASS');
