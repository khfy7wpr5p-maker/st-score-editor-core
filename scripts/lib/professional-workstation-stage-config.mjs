const retainedBudget = (file, maxBytes, revision) =>
  Object.freeze({ file, maxBytes, revision });

export const PROFESSIONAL_WORKSTATION_RETAINED_BUDGETS = Object.freeze({
  p10_1Workstation: retainedBudget(
    'st-score-editor-professional-workstation.manifest.json',
    604_160,
    'P10-1-COMPOSITION-1'
  ),
  p10_2Workstation: retainedBudget(
    'st-score-editor-p10-2-workstation.manifest.json',
    624_640,
    'P10-2-UNRETIMING-1'
  ),
  p10_3aWorkstation: retainedBudget(
    'st-score-editor-p10-3a-workstation.manifest.json',
    655_360,
    'P10-3A-PITCH-TRANSPOSE-1'
  )
});

export const retainedProfessionalWorkstationBudgets = (...names) =>
  Object.freeze(Object.fromEntries(
    names.map(name => [name, PROFESSIONAL_WORKSTATION_RETAINED_BUDGETS[name]])
  ));

export const professionalWorkstationManifestCapabilities = (stageCapabilities) =>
  Object.freeze({
    canonicalAuthority: false,
    historyAuthority: 'EditorHistoryV4',
    semanticTargetAuthority: 'SemanticAddressV3-current-revision',
    rendererIntegrated: true,
    audioHostIntegrated: true,
    audioEngineBundled: false,
    externalAudioRuntimeRequired: true,
    rendererCoordinateAuthority: false,
    domAuthoringAuthority: false,
    productionDefault: false,
    productionReleaseAuthorized: false,
    seslitabCutoverAuthorized: false,
    physicalDeviceValidationRequired: true,
    physicalDeviceValidationPassed: false,
    ...stageCapabilities
  });
