import { readFile } from 'node:fs/promises';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const fail = (message) => { throw new Error(message); };
const authority = await readJson('contracts/authority-boundary-v1.json');
const architecture = await readJson('contracts/editor-core-v1.json');
const pkg = await readJson('package.json');
const tsconfig = await readJson('tsconfig.json');

if (authority.contract !== 'ST_SCORE_EDITOR_AUTHORITY_BOUNDARY' || authority.version !== '1.0.0' || authority.stage !== 'E0') fail('authority baseline drift');
const mustBeTrue = [
 ['source.immutable',authority.source?.immutable],['source.identityRequired',authority.source?.identityRequired],
 ['edits.stableSemanticTargetRequired',authority.edits?.stableSemanticTargetRequired],['edits.typedBoundedCommandRequired',authority.edits?.typedBoundedCommandRequired],
 ['edits.atomicTransactionRequired',authority.edits?.atomicTransactionRequired],['edits.validationRequiredBeforeAcceptance',authority.edits?.validationRequiredBeforeAcceptance],
 ['edits.staleTargetFailsClosed',authority.edits?.staleTargetFailsClosed],['renderer.presentationOnly',authority.renderer?.presentationOnly],['ai.advisoryOnly',authority.ai?.advisoryOnly]
];
for (const [name,value] of mustBeTrue) if (value !== true) fail(`${name} must be true`);
const mustBeFalse = [
 ['source.inPlaceRewriteAllowed',authority.source?.inPlaceRewriteAllowed],['canonicalScore.rendererStateAuthoritative',authority.canonicalScore?.rendererStateAuthoritative],
 ['canonicalScore.browserStateAuthoritative',authority.canonicalScore?.browserStateAuthoritative],['edits.partialAuthoritativeApplyAllowed',authority.edits?.partialAuthoritativeApplyAllowed],
 ['renderer.mayMutateCanonicalScore',authority.renderer?.mayMutateCanonicalScore],['renderer.coordinatesMayAddressAuthoritativeEditAlone',authority.renderer?.coordinatesMayAddressAuthoritativeEditAlone],
 ['ai.mayMutateCanonicalScore',authority.ai?.mayMutateCanonicalScore],['ai.mayBypassValidation',authority.ai?.mayBypassValidation],['ai.automaticRepairAuthority',authority.ai?.automaticRepairAuthority],
 ['production.activatedByRepositoryMerge',authority.production?.activatedByRepositoryMerge],['production.publicWriteApiAuthorized',authority.production?.publicWriteApiAuthorized],['production.liveAiEditAuthorityAuthorized',authority.production?.liveAiEditAuthorityAuthorized]
];
for (const [name,value] of mustBeFalse) if (value !== false) fail(`${name} must be false`);

const expectedStages=['E0','E1','E2','E3','E4','E5','E6','E7','E8','E9'];
if (JSON.stringify(architecture.stages)!==JSON.stringify(expectedStages)) fail('stage order drift');
if (expectedStages.indexOf(architecture.currentStage)<4) fail('architecture currentStage may not regress below E4');
if (architecture.musicXml?.isDirectEditorState!==false || architecture.musicXml?.safeImportRequired!==true || architecture.musicXml?.e2Subset?.unsupportedSemanticsFailClosed!==true) fail('MusicXML safety boundary drift');
const addressing=architecture.addressing;
if (addressing?.contractVersion!=='1.0.0'||addressing?.revisionBound!==true||addressing?.ancestryBound!==true||addressing?.rendererCoordinatesAuthoritative!==false||addressing?.staleRevisionFailsClosed!==true||addressing?.pathMismatchFailsClosed!==true) fail('addressing boundary drift');
const editing=architecture.editing;
if (editing?.commandVersion!=='1.0.0'||editing?.transactionVersion!=='1.0.0'||editing?.maxCommandsPerTransaction!==256||editing?.atomic!==true||editing?.baseRevisionRequired!==true||editing?.partialApplyAllowed!==false||editing?.canonicalValidationBeforeAcceptance!==true) fail('edit transaction contract drift');
if (JSON.stringify(editing?.supportedCommands)!==JSON.stringify(['SET_NOTE_PITCH','SET_EVENT_DURATION','REPLACE_EVENT_WITH_REST','REPLACE_REST_WITH_NOTE','ADD_CHORD_TONE','REMOVE_CHORD_TONE'])) fail('edit command set drift');
const history=architecture.history;
if (history?.contractVersion!=='1.0.0'||history?.snapshotBased!==true||history?.directParentCommitRequired!==true||history?.undoRedoImmutable!==true||history?.redoClearedOnCommit!==true) fail('history contract drift');

for (const renderer of Object.values(architecture.rendererCandidates??{})) if (renderer.admittedDependency!==false) fail('renderer dependency admitted before E6 review');
if (architecture.buildDependencies?.typescript?.version!=='6.0.3'||architecture.buildDependencies?.typescript?.runtime!==false||architecture.buildDependencies?.typescript?.license!=='Apache-2.0') fail('TypeScript admission drift');
if (architecture.runtimeDependencies?.saxes?.version!=='6.0.0'||architecture.runtimeDependencies?.saxes?.license!=='ISC'||architecture.runtimeDependencies?.saxes?.authority!=='XML_PARSER_ONLY') fail('saxes admission drift');
if (architecture.runtimeDependencies?.xmlchars?.version!=='2.2.0'||architecture.runtimeDependencies?.xmlchars?.license!=='MIT') fail('xmlchars admission drift');
if (pkg.private!==true) fail('package must remain private');
const runtimeDependencies=Object.entries(pkg.dependencies??{}).sort(([a],[b])=>a.localeCompare(b));
if (JSON.stringify(runtimeDependencies)!==JSON.stringify([['saxes','6.0.0'],['xmlchars','2.2.0']])) fail('runtime dependency drift');
if (JSON.stringify(pkg.devDependencies??{})!==JSON.stringify({typescript:'6.0.3'})) fail('dev dependency drift');
if (tsconfig.compilerOptions?.skipLibCheck!==false) fail('skipLibCheck must remain false');
if (JSON.stringify(tsconfig.compilerOptions?.paths?.saxes)!==JSON.stringify(['./types/saxes-6.0.0-compat.d.ts'])) fail('saxes facade drift');
console.log('E4 repository contracts: PASS');
