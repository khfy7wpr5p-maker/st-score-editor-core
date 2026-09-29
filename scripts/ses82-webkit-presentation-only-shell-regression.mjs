import { openMobileWebKitArtifact } from './lib/mobile-webkit-artifact-harness.mjs';

const harness = await openMobileWebKitArtifact({
  htmlFile: 'st-score-editor-app.html',
  scriptFile: 'st-score-editor-app.js',
  portErrorCode: 'SES82_WEBKIT_SERVER_PORT_MISSING'
});
const { page } = harness;

try {
  await page.getByRole('button', { name: 'New', exact: true }).click();

  const result = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const appBefore = document.querySelector('[data-st-score-editor-app]');
    if (!(appBefore instanceof HTMLElement)) throw new Error('SES82_APP_BEFORE_MISSING');

    const sentinel = document.createElement('span');
    sentinel.setAttribute('data-ses82-shell-sentinel', '1');
    sentinel.hidden = true;
    appBefore.append(sentinel);

    const historyBefore = controller.getDocument().session.history.past.length;
    controller.select(null);

    const documentAfter = controller.getDocument();
    const appAfter = document.querySelector('[data-st-score-editor-app]');
    return {
      sameAppNode: appAfter === appBefore,
      sentinelPreserved: sentinel.isConnected && appAfter?.contains(sentinel) === true,
      selectionKind: documentAfter.session.selection?.kind ?? null,
      historyBefore,
      historyAfter: documentAfter.session.history.past.length
    };
  });

  if (result.selectionKind !== null || result.historyAfter !== result.historyBefore) {
    throw new Error(`SES-82 selection semantics changed: ${JSON.stringify(result)}`);
  }
  if (!result.sameAppNode || !result.sentinelPreserved) {
    throw new Error(`SES-82 presentation-only selection rebuilt the full shell: ${JSON.stringify(result)}`);
  }

  console.log('SES-82 WebKit presentation-only shell regression: PASS');
} finally {
  await harness.close();
}
