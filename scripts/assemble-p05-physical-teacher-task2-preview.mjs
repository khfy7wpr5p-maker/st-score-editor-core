import { copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assembleStableRestV2PreviewCli } from './assemble-app09b-preview-stable-rest-v2.mjs';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const defaultOutputDir = path.join(repoRoot, 'dist', 'browser');
const fixtureSource = path.join(repoRoot, 'corpus', 'fixtures', 'p05-synthetic-teacher-edit.musicxml');
const fixtureName = 'p05-synthetic-teacher-edit.musicxml';

export const validateP05PhysicalTask2AppManifest = (manifest) => {
  const failures = [];
  const requireEqual = (field, expected) => {
    if (manifest?.[field] !== expected) failures.push(`${field}=${String(manifest?.[field])}`);
  };

  requireEqual('teacherWorkflowCommandsBundled', true);
  requireEqual('teacherWorkflowHistoryAuthority', 'EditorSessionV4');
  requireEqual('teacherWorkflowPaste', 'bounded-neutral-rest-overwrite');
  requireEqual('teacherWorkflowRendererCoordinateAuthority', false);
  requireEqual('teacherWorkflowDomAuthoringAuthority', false);
  requireEqual('mobileTeacherToolbarBundled', true);
  requireEqual('mobileTeacherToolbarSelectionAuthority', 'SemanticAddressV3-current-revision');
  requireEqual('mobileTeacherToolbarRendererCoordinateAuthority', false);
  requireEqual('mobileTeacherToolbarDomAuthoringAuthority', false);
  requireEqual('mobileTeacherViewportBundled', true);
  requireEqual('manualDeviceValidationRequired', true);
  requireEqual('standaloneReleaseGatePassed', false);
  requireEqual('seslitabCutoverAuthorized', false);

  if (failures.length !== 0) {
    throw new Error(`P05 physical Task 2 preview manifest is not admissible: ${failures.join(', ')}`);
  }
  return Object.freeze({
    teacherToolbar: true,
    historyAuthority: 'EditorSessionV4',
    pastePolicy: 'bounded-neutral-rest-overwrite',
    semanticSelectionOnly: true,
    physicalValidationStillRequired: true,
    releaseAuthorized: false
  });
};

export async function assembleP05PhysicalTask2PreviewCli({
  runtimeDir,
  outputDir = defaultOutputDir,
  includeIosDiagnostic = process.env.ST_APP09B_IOS_DEVICE_DIAGNOSTIC === '1',
  refreshRendererRuntime = process.env.ST_APP09B_REFRESH_RENDERER_RUNTIME === '1'
} = {}) {
  const result = await assembleStableRestV2PreviewCli({
    runtimeDir,
    outputDir,
    includeIosDiagnostic,
    refreshRendererRuntime
  });

  const appManifest = JSON.parse(await readFile(path.join(outputDir, 'st-score-editor-app.manifest.json'), 'utf8'));
  const pilotContract = validateP05PhysicalTask2AppManifest(appManifest);
  await copyFile(fixtureSource, path.join(outputDir, fixtureName));

  const physicalManifest = Object.freeze({
    contract: 'ST_SCORE_EDITOR_P05_PHYSICAL_TEACHER_TASK2_PREVIEW',
    version: '1.0.0',
    entryHtml: result.entryHtml,
    fixture: fixtureName,
    requiredPhysicalSequence: Object.freeze(['select-C', 'start', 'select-D', 'copy', 'select-trailing-rest', 'paste-once', 'undo-once']),
    teacherToolbarRequired: true,
    restTouchPath: 'unique-current-revision-canonical-rest-fail-closed',
    rendererCoordinateAuthoringAuthority: false,
    domAuthoringAuthority: false,
    canonicalMutationAuthority: 'existing-teacher-workflow-v4',
    historyAuthority: 'EditorSessionV4',
    physicalDevicePassClaim: false,
    teacherPilotPassClaim: false,
    releaseAuthority: false,
    seslitabCutoverAuthorized: false,
    pilotContract
  });
  await writeFile(
    path.join(outputDir, 'p05-physical-teacher-task2-preview.manifest.json'),
    `${JSON.stringify(physicalManifest, null, 2)}\n`,
    'utf8'
  );
  return Object.freeze({ ...result, physicalTask2: physicalManifest });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const runtimeDir = process.env.ST_SCORE_RENDERER_RUNTIME_DIR;
  const result = await assembleP05PhysicalTask2PreviewCli({ runtimeDir });
  console.log(`P05 physical teacher Task 2 preview assembly: PASS (${result.renderer.rendererSourceRevision}, teacher-toolbar + rest-touch-v2, physical PASS still required)`);
}
