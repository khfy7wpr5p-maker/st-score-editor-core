import test from 'node:test';
import assert from 'node:assert/strict';
import {
  P03_MOBILE_INTERACTION_BENCHMARK_PROFILE,
  benchmarkSemanticSelection,
  benchmarkViewportPresentation,
  runP03MobileInteractionBenchmark
} from '../scripts/p03-mobile-interaction-benchmark.mjs';

test('P03-PERF01 viewport benchmark measures presentation operations without canonical authority',()=>{
  const result=benchmarkViewportPresentation({iterations:250});
  assert.equal(result.kind,'VIEWPORT_PRESENTATION');
  assert.equal(result.iterations,250);
  assert.equal(Number.isFinite(result.durationMs),true);
  assert.equal(result.durationMs>=0,true);
  assert.equal(result.canonicalAuthority,false);
  assert.equal(result.coordinateAuthoring,false);
  assert.equal(result.finalState.mounted,false);
  assert.equal(result.finalState.zoom>=0.25 && result.finalState.zoom<=4,true);
});

test('P03-PERF01 semantic-selection benchmark has exact zero canonical/history growth',()=>{
  const result=benchmarkSemanticSelection({iterations:100});
  assert.equal(result.kind,'SEMANTIC_SELECTION');
  assert.equal(result.iterations,100);
  assert.equal(Number.isFinite(result.durationMs),true);
  assert.equal(result.durationMs>=0,true);
  assert.equal(result.revisionIdAfter,result.revisionIdBefore);
  assert.equal(result.historyPastAfter,result.historyPastBefore);
  assert.equal(result.historyFutureAfter,result.historyFutureBefore);
  assert.equal(result.selectionKind,'event');
  assert.equal(result.physicalDeviceClaim,false);
});

test('P03-PERF01 default benchmark emits reproducible metric schema without pretending CI timing is a device gate',()=>{
  const result=runP03MobileInteractionBenchmark({
    viewport:{iterations:500},
    semanticSelection:{iterations:150}
  });
  assert.equal(result.profile.timingGate,'informational-only-ci-host');
  assert.equal(result.profile.canonicalHistoryGate,'exact-zero-extra-history');
  assert.equal(result.profile.physicalDeviceClaim,false);
  assert.equal(result.viewport.iterations,500);
  assert.equal(result.semanticSelection.iterations,150);
  assert.equal(result.semanticSelection.revisionIdAfter,result.semanticSelection.revisionIdBefore);
  console.log(`P03-PERF01 metrics ${JSON.stringify({viewportMs:result.viewport.durationMs,viewportOpsPerMs:result.viewport.operationsPerMs,semanticSelectionMs:result.semanticSelection.durationMs,semanticSelectionOpsPerMs:result.semanticSelection.operationsPerMs})}`);
});

test('P03-PERF01 benchmark profile keeps meaningful workload sizes separate from timing pass/fail',()=>{
  assert.equal(P03_MOBILE_INTERACTION_BENCHMARK_PROFILE.viewportIterations,4000);
  assert.equal(P03_MOBILE_INTERACTION_BENCHMARK_PROFILE.semanticSelectionIterations,1000);
  assert.equal(P03_MOBILE_INTERACTION_BENCHMARK_PROFILE.timingGate,'informational-only-ci-host');
  assert.equal(P03_MOBILE_INTERACTION_BENCHMARK_PROFILE.physicalDeviceClaim,false);
});
