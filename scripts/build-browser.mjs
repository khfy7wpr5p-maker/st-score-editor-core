import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const OUT_DIR = 'dist/browser';
const STANDALONE_APP_BUNDLE_MAX_BYTES = 524_288;
const COMMON_FORBIDDEN_TOKENS = [
  'node:', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'navigator.sendBeacon', 'localStorage', 'sessionStorage', 'document.cookie'
];
const CORE_FORBIDDEN_TOKENS = [...COMMON_FORBIDDEN_TOKENS, 'indexedDB'];
const APP_FORBIDDEN_TOKENS = [...COMMON_FORBIDDEN_TOKENS];

await mkdir(OUT_DIR, { recursive: true });

const buildBrowserArtifact = async ({ entryPoint, artifact, manifestFile, globalName, manifest, label, forbiddenTokens, maxBytes = null }) => {
  const outFile = `${OUT_DIR}/${artifact}`;
  const result = await build({ entryPoints: [entryPoint], outfile: outFile, bundle: true, format: 'iife', platform: 'browser', target: ['es2022'], minify: true, sourcemap: false, legalComments: 'eof', metafile: true, logLevel: 'warning' });
  const externalImports = Object.values(result.metafile.outputs).flatMap((output) => output.imports).filter((entry) => entry.external === true);
  if (externalImports.length !== 0) throw new Error(`${label} browser bundle contains external imports: ${JSON.stringify(externalImports)}`);
  const bundle = await readFile(outFile); const text = bundle.toString('utf8');
  for (const token of forbiddenTokens) if (text.includes(token)) throw new Error(`${label} browser bundle contains forbidden capability token: ${token}`);
  if (!text.includes(globalName)) throw new Error(`${label} browser bundle does not expose ${globalName}.`);
  if (maxBytes !== null && bundle.byteLength > maxBytes) throw new Error(`${label} browser bundle exceeds release budget: ${bundle.byteLength} > ${maxBytes}`);
  const description = Object.freeze({ ...manifest, bundler: Object.freeze({ package: 'esbuild', version: '0.28.2', license: 'MIT' }), artifact, format: 'iife', target: 'es2022', global: globalName, externalImports: 0, ...(maxBytes === null ? {} : { maxBytes }), bytes: bundle.byteLength, sha256: createHash('sha256').update(bundle).digest('hex') });
  await writeFile(`${OUT_DIR}/${manifestFile}`, `${JSON.stringify(description, null, 2)}\n`, 'utf8');
  console.log(`${label} browser bundle: PASS (${description.bytes} bytes, sha256 ${description.sha256})`);
};

await buildBrowserArtifact({
  entryPoint: 'packages/browser-runtime/src/global-entry.ts', artifact: 'st-score-editor-core.runtime.js', manifestFile: 'st-score-editor-core.runtime.manifest.json', globalName: 'STScoreEditorCoreRuntime', label: 'E7-H core', forbiddenTokens: CORE_FORBIDDEN_TOKENS,
  manifest: Object.freeze({ contract: 'ST_SCORE_EDITOR_CORE_BROWSER_BUNDLE', version: '1.0.0', runtimeVersion: '1.0.0', networkCapable: false, persistenceCapable: false, recoveryStorageBundled: false, rendererLifecycleBundled: false, serverRevisionAuthority: false, approvalAuthority: false, publicationAuthority: false })
});

await buildBrowserArtifact({
  entryPoint: 'packages/score-editor-browser-app/src/global-entry.ts', artifact: 'st-score-editor-app.js', manifestFile: 'st-score-editor-app.manifest.json', globalName: 'STScoreEditorApp', label: 'APP-10O standalone app', forbiddenTokens: APP_FORBIDDEN_TOKENS, maxBytes: STANDALONE_APP_BUNDLE_MAX_BYTES,
  manifest: Object.freeze({
    contract: 'ST_SCORE_EDITOR_APP_BROWSER_BUNDLE', version: '1.0.0', runtimeVersion: '1.0.0', standaloneProduct: true,
    canonicalAuthority: false, networkCapable: false, persistenceCapable: false,
    rendererAuthority: false, rendererBundled: false, rendererLifecycleBundled: true, rendererImplementationBundled: false,
    rendererAutoRender: false, rendererFamily: 'osmd', rendererExactHostVersion: '2.1.1', staleRenderResultRejected: true,
    semanticRendererHitBridgeBundled: true, rendererHitCanonicalInput: 'opaque-renderer-request-v4-manifest-token', rendererDomSvgCoordinateAuthority: false, staleRendererHitRejected: true,
    viewportNavigationBundled: true, viewportPresentationOnly: true, viewportCanonicalAuthority: false, coordinateAuthoring: false, viewportZoomRange: [0.25, 4], viewportZoomStep: 0.25, viewportInputModes: ['touch', 'pointer', 'keyboard'], responsiveViewportProfiles: ['iphone', 'ipad', 'desktop'],
    fileWorkflowBundled: true, recoveryAutosaveBundled: true, browserLocalRecoveryStorage: 'indexedDB', recoveryCanonicalAuthority: false, recoveryAutoRestore: false, recoveryExplicitApply: true, recoveryApplyRevisionGuard: true, recoveryMaxDocuments: 8,
    playbackBundled: true, playbackCanonicalAuthority: false, playbackEditorAdmissionCoupled: false, playbackNetworkCapable: false, playbackPlanSource: 'ScoreDocumentV3', playbackOutput: 'browser-web-audio-local', playbackDefaultTempoBpm: 120, playbackTempoRange: [20, 300], playbackGraceSemantics: 'deferred-partial', playbackCursorMutationAuthority: false,
    exportPrintBundled: true, musicXmlExportCanonicalAuthority: false, musicXmlExportMarksSaved: false, printCanonicalAuthority: false, printRequiresCurrentRendererRevision: true, printNetworkCapable: false, pdfWorkflow: 'browser-print-dialog-save-as-pdf', pdfBytesGenerated: false,
    releaseHardeningBundled: true, hardeningCanonicalAuthority: false, hardeningHistoryMutationAuthority: false, hardeningNetworkAuthority: false, dynamicViewportUnits: true, safeAreaInsets: true, coarsePointerTargetMinCssPx: 44, focusVisibleStyling: true, reducedMotionStyling: true, resizeOrientationReapplyPresentation: true, pageHideRecoveryFlush: true, accessibilityStatusLiveRegion: true,
    authoringWorkspaceBundled: true, authoringWorkspaceCanonicalAuthority: false, activeVoicePresentationState: true, activeVoiceOrdinals: [1, 2, 3, 4, 5], missingVoiceMaterialization: 'synthetic-proven-measure-only', positionNoteEntry: 'explicit-rest-only', rendererCoordinateTimingAuthority: false, noteEntryHistory: 'EditorSessionV4', authoringNetworkAuthority: false,
    selectedNoteEditingBundled: true, selectedNoteEditingCanonicalAuthority: false, selectedPitchEdit: 'exact-note-selection-only', selectedDurationEdit: 'exact-pitched-event-only', selectedDelete: 'single-note-to-rest-or-exact-chord-tone', selectedEditingHistory: 'EditorSessionV4', selectedEditingRendererCoordinateAuthority: false, selectedEditingNetworkAuthority: false,
    activeStaffAuthoringBundled: true, activeStaffCanonicalAuthority: false, activeStaffSelection: 'same-part-same-frame-semantic-only', activeStaffHistoryMutationAuthority: false, activeStaffVoiceMaterializationAuthority: false, newScoreInitialSelection: 'first-standard-staff-first-frame-voice1-explicit-event', newScoreInitialSelectionHistoryMutationAuthority: false, activeStaffRendererCoordinateAuthority: false, activeStaffNetworkAuthority: false,
    measureFrameAuthoringBundled: true, measureFrameAuthoringCanonicalAuthority: false, measureFrameAppend: 'synthetic-new-score-end-only', measureFrameMeterProofRequired: true, measureFrameHistory: 'EditorSessionV4', importedMusicXmlAutomaticMeasureGrowth: false, measureFrameRendererCoordinateAuthority: false, measureFrameNetworkAuthority: false,
    measureNavigationBundled: true, measureNavigationCanonicalAuthority: false, measureNavigationSelection: 'same-part-same-staff-adjacent-frame-semantic-only', measureNavigationHistoryMutationAuthority: false, measureNavigationVoiceMaterializationAuthority: false, measureNavigationOnsetCarry: 'exact-containing-event-when-available', importedMusicXmlMeasureNavigation: true, measureNavigationRendererCoordinateAuthority: false, measureNavigationNetworkAuthority: false,
    chordToneAuthoringBundled: true, chordToneAuthoringCanonicalAuthority: false, chordToneAdd: 'exact-pitched-event-palette-pitch-one-tone-per-action', chordToneSelectionAfterAdd: 'new-exact-note', chordToneHistory: 'EditorSessionV4', chordToneRendererCoordinateAuthority: false, chordToneNetworkAuthority: false,
    articulationTogglesBundled: true, articulationTogglesCanonicalAuthority: false, articulationToggleKinds: ['staccato', 'accent', 'tenuto'], articulationToggleTarget: 'exact-selected-pitched-event-or-note-parent-event', articulationNewSpec: 'auto-placement-null-direction', articulationExistingKindRemoval: 'single-exact-existing-spec-only', articulationAmbiguousKindFailClosed: true, articulationToggleHistory: 'EditorSessionV4', articulationRendererCoordinateAuthority: false, articulationNetworkAuthority: false,
    localOrnamentTogglesBundled: true, localOrnamentTogglesCanonicalAuthority: false, localOrnamentToggleKinds: ['trill-mark', 'turn', 'mordent'], localOrnamentToggleTarget: 'exact-selected-pitched-event-or-note-parent-event', localOrnamentNewSpec: 'auto-placement-empty-accidental-marks', localOrnamentExistingKindRemoval: 'single-exact-existing-spec-only', localOrnamentAmbiguousKindFailClosed: true, localOrnamentSpanningRelationAuthority: false, localOrnamentGraceTargetAuthority: false, localOrnamentToggleHistory: 'EditorSessionV4', localOrnamentRendererCoordinateAuthority: false, localOrnamentNetworkAuthority: false,
    explicitAccidentalsBundled: true, explicitAccidentalsCanonicalAuthority: false, explicitAccidentalKinds: ['flat', 'natural', 'sharp'], explicitAccidentalTarget: 'exact-selected-note-only', explicitAccidentalMutation: 'canonical-pitch-alter-plus-note-notation-accidental-atomic', explicitAccidentalStepOctaveMutationAuthority: false, explicitAccidentalAdvancedKeypadTargetAuthority: false, explicitAccidentalHistory: 'EditorSessionV4', explicitAccidentalRendererCoordinateAuthority: false, explicitAccidentalNetworkAuthority: false,
    extendedArticulationTogglesBundled: true, extendedArticulationTogglesCanonicalAuthority: false, extendedArticulationToggleKinds: ['strong-accent', 'staccatissimo', 'spiccato'], extendedArticulationToggleTarget: 'exact-selected-pitched-event-or-note-parent-event', extendedArticulationNewSpec: 'auto-placement-null-direction', extendedArticulationExistingKindRemoval: 'single-exact-existing-spec-only', extendedArticulationAmbiguousKindFailClosed: true, extendedArticulationGraceTargetAuthority: false, extendedArticulationToggleHistory: 'EditorSessionV4', extendedArticulationRendererCoordinateAuthority: false, extendedArticulationNetworkAuthority: false,
    extendedLocalOrnamentTogglesBundled: true, extendedLocalOrnamentTogglesCanonicalAuthority: false, extendedLocalOrnamentToggleKinds: ['inverted-turn', 'inverted-mordent', 'shake'], extendedLocalOrnamentToggleTarget: 'exact-selected-pitched-event-or-note-parent-event', extendedLocalOrnamentNewSpec: 'auto-placement-empty-accidental-marks', extendedLocalOrnamentExistingKindRemoval: 'single-exact-existing-spec-only', extendedLocalOrnamentAmbiguousKindFailClosed: true, extendedLocalOrnamentSpanningRelationAuthority: false, extendedLocalOrnamentGraceTargetAuthority: false, extendedLocalOrnamentToggleHistory: 'EditorSessionV4', extendedLocalOrnamentRendererCoordinateAuthority: false, extendedLocalOrnamentNetworkAuthority: false,
    browserContractTargets: ['ios-safari', 'ipad-safari', 'desktop-safari', 'chromium', 'firefox'], manualDeviceValidationRequired: true, standaloneReleaseGatePassed: false, seslitabCutoverAuthorized: false, serverRevisionAuthority: false, publicationAuthority: false, entryHtml: 'st-score-editor-app.html'
  })
});

const standaloneHtml = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>ST Score Editor</title><style>html,body,#st-score-editor-app-root{margin:0;width:100%;height:100%;min-height:100%;}body{overflow:hidden;overscroll-behavior:none;}@supports(height:100dvh){html,body,#st-score-editor-app-root{height:100dvh;min-height:100dvh;}}</style></head><body><div id="st-score-editor-app-root"></div><script src="./st-score-editor-app.js"></script><script>(() => { const root=document.getElementById('st-score-editor-app-root'); if(!root||!globalThis.STScoreEditorApp) throw new Error('ST_SCORE_EDITOR_APP_BOOTSTRAP_FAILED'); const controller=globalThis.STScoreEditorApp.createController(); controller.mount(root); Object.defineProperty(globalThis,'STScoreEditorAppController',{value:controller,writable:false,configurable:false}); })();</script></body></html>`;
await writeFile(`${OUT_DIR}/st-score-editor-app.html`, standaloneHtml, 'utf8');
console.log('APP-10O standalone HTML: PASS');
