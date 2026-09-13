import { performance } from 'node:perf_hooks';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createViewportPresentationLayer } from '../dist/packages/score-editor-browser-app/src/viewport-presentation.js';
import { createMobileTeacherViewportStandaloneScoreEditorController } from '../dist/packages/score-editor-browser-app/src/mobile-teacher-viewport.js';

export const P03_MOBILE_INTERACTION_BENCHMARK_VERSION = '1.0.0';
export const P03_MOBILE_INTERACTION_BENCHMARK_PROFILE = Object.freeze({
  viewportIterations: 4000,
  semanticSelectionIterations: 1000,
  timingGate: 'informational-only-ci-host',
  canonicalHistoryGate: 'exact-zero-extra-history',
  physicalDeviceClaim: false
});

const finiteDuration = value => Number.isFinite(value) && value >= 0 ? value : 0;
const idFactory = () => { let value = 0; return () => `p03-perf-${++value}`; };

export const benchmarkViewportPresentation = ({
  iterations = P03_MOBILE_INTERACTION_BENCHMARK_PROFILE.viewportIterations,
  now = () => performance.now()
} = {}) => {
  if (!Number.isInteger(iterations) || iterations <= 0) throw new RangeError('iterations must be a positive integer');
  const layer = createViewportPresentationLayer();
  for (let index = 0; index < 64; index += 1) {
    layer.panBy(1, 1);
    if (index % 2 === 0) layer.zoomIn(); else layer.zoomOut();
  }
  const startedAt = now();
  for (let index = 0; index < iterations; index += 1) {
    layer.panBy(index % 3, index % 2);
    if (index % 16 === 0) layer.zoomIn();
    else if (index % 16 === 8) layer.zoomOut();
  }
  const durationMs = finiteDuration(now() - startedAt);
  return Object.freeze({
    version: P03_MOBILE_INTERACTION_BENCHMARK_VERSION,
    kind: 'VIEWPORT_PRESENTATION',
    iterations,
    durationMs,
    operationsPerMs: durationMs === 0 ? null : iterations / durationMs,
    canonicalAuthority: layer.canonicalAuthority,
    coordinateAuthoring: layer.coordinateAuthoring,
    finalState: layer.getState()
  });
};

export const benchmarkSemanticSelection = ({
  iterations = P03_MOBILE_INTERACTION_BENCHMARK_PROFILE.semanticSelectionIterations,
  now = () => performance.now()
} = {}) => {
  if (!Number.isInteger(iterations) || iterations <= 0) throw new RangeError('iterations must be a positive integer');
  const controller = createMobileTeacherViewportStandaloneScoreEditorController({
    revisionIdFactory: () => 'rev:p03-perf-unused'
  });
  controller.newDocument({ idFactory: idFactory(), preset: 'GUITAR_TREBLE' });
  const document = controller.getDocument();
  if (document === null) throw new Error('benchmark document was not created');
  const score = document.session.history.present.score;
  const staff = score.parts[0]?.staves.find(candidate => candidate.role === 'standard');
  const event = staff?.measures[0]?.voices[0]?.events[0];
  if (event === undefined) throw new Error('benchmark event was not created');
  const address = addressEntityV3(score, event.id);
  if (address.kind !== 'event') throw new Error('benchmark event address did not resolve');
  const revisionId = score.revision.id;
  const historyPast = document.session.history.past.length;
  const historyFuture = document.session.history.future.length;

  for (let index = 0; index < 32; index += 1) controller.select(address);
  const startedAt = now();
  for (let index = 0; index < iterations; index += 1) controller.select(address);
  const durationMs = finiteDuration(now() - startedAt);
  const after = controller.getDocument();
  if (after === null) throw new Error('benchmark document disappeared');

  return Object.freeze({
    version: P03_MOBILE_INTERACTION_BENCHMARK_VERSION,
    kind: 'SEMANTIC_SELECTION',
    iterations,
    durationMs,
    operationsPerMs: durationMs === 0 ? null : iterations / durationMs,
    revisionIdBefore: revisionId,
    revisionIdAfter: after.session.history.present.score.revision.id,
    historyPastBefore: historyPast,
    historyPastAfter: after.session.history.past.length,
    historyFutureBefore: historyFuture,
    historyFutureAfter: after.session.history.future.length,
    selectionKind: after.session.selection?.kind ?? null,
    physicalDeviceClaim: false
  });
};

export const runP03MobileInteractionBenchmark = options => Object.freeze({
  version: P03_MOBILE_INTERACTION_BENCHMARK_VERSION,
  profile: P03_MOBILE_INTERACTION_BENCHMARK_PROFILE,
  viewport: benchmarkViewportPresentation(options?.viewport),
  semanticSelection: benchmarkSemanticSelection(options?.semanticSelection)
});

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(runP03MobileInteractionBenchmark(), null, 2));
}
