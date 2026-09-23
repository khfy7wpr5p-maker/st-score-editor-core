import { openMobileWebKitArtifact } from './lib/mobile-webkit-artifact-harness.mjs';

const harness = await openMobileWebKitArtifact({
  htmlFile: 'st-score-editor-p10-3b-workstation.html',
  scriptFile: 'st-score-editor-p10-3b-workstation.js',
  portErrorCode: 'P10_3B_WEBKIT_SERVER_PORT_MISSING'
});
const { page, errors } = harness;

try {
  await page.waitForFunction(() =>
    Boolean(globalThis.STScoreEditorP10_3BWorkstationController?.getP10_3BRangeReplaceState)
  );

  const boot = await page.evaluate(() => ({
    composed: globalThis.STScoreEditorP10_3BWorkstation?.profile?.p10_3bWorkstationComposition ?? false,
    p10_3aPreserved: globalThis.STScoreEditorP10_3BWorkstation?.profile?.p10_3aQualifiedBasePreserved ?? false,
    copy: globalThis.STScoreEditorP10_3BWorkstation?.profile?.professionalRangeCopyAvailable ?? false,
    replace: globalThis.STScoreEditorP10_3BWorkstation?.profile?.professionalRangeReplaceAvailable ?? false,
    canonicalAuthority: globalThis.STScoreEditorP10_3BWorkstation?.profile?.professionalRangeReplaceCanonicalAuthority ?? true,
    rendererAuthority: globalThis.STScoreEditorP10_3BWorkstation?.profile?.professionalRangeReplaceRendererCoordinateAuthority ?? true,
    domAuthority: globalThis.STScoreEditorP10_3BWorkstation?.profile?.professionalRangeReplaceDomAuthoringAuthority ?? true,
    productionDefault: globalThis.STScoreEditorP10_3BWorkstation?.profile?.productionDefault ?? true,
    releaseAuthorized: globalThis.STScoreEditorP10_3BWorkstation?.profile?.productionReleaseAuthorized ?? true,
    cutoverAuthorized: globalThis.STScoreEditorP10_3BWorkstation?.profile?.seslitabCutoverAuthorized ?? true
  }));
  if (
    !boot.composed || !boot.p10_3aPreserved || !boot.copy || !boot.replace ||
    boot.canonicalAuthority !== false || boot.rendererAuthority !== false ||
    boot.domAuthority !== false || boot.productionDefault !== false ||
    boot.releaseAuthorized !== false || boot.cutoverAuthorized !== false
  ) {
    throw new Error(`P10-3B bootstrap mismatch ${JSON.stringify(boot)}`);
  }

  const setup = await page.evaluate(async () => {
    const c = globalThis.STScoreEditorP10_3BWorkstationController;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
  <part id="P1"><measure number="1">
    <attributes>
      <divisions>16</divisions>
      <key><fifths>0</fifths></key>
      <time><beats>4</beats><beat-type>4</beat-type></time>
      <clef><sign>G</sign><line>2</line></clef>
    </attributes>
    <note><pitch><step>C</step><octave>4</octave></pitch><duration>8</duration><voice>1</voice><type>eighth</type></note>
    <note><pitch><step>E</step><octave>4</octave></pitch><duration>8</duration><voice>1</voice><type>eighth</type></note>
    <note><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>16th</type></note>
    <note><rest/><duration>4</duration><voice>1</voice><type>16th</type></note>
    <note><pitch><step>A</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>16th</type></note>
    <note><pitch><step>B</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>16th</type></note>
    <note><pitch><step>F</step><octave>4</octave></pitch><duration>32</duration><voice>1</voice><type>half</type></note>
  </measure></part>
</score-partwise>`;
    await c.openLocalFile({
      name: 'p10-3b-webkit.musicxml',
      size: new TextEncoder().encode(xml).byteLength,
      type: 'application/vnd.recordare.musicxml+xml',
      text: async () => xml
    });
    const d = c.getDocument();
    const score = d.session.history.present.score;
    const staff = score.parts[0].staves.find(item => item.role === 'standard');
    const events = staff.measures[0].voices[0].events;
    const addresses = events.map(event =>
      d.session.renderRequest.manifest.entries
        .find(entry => entry.address.kind === 'event' && entry.address.eventId === event.id)?.address ?? null
    );
    return {
      ok: events.length === 7 && addresses.every(Boolean),
      eventIds: events.map(event => event.id),
      addresses,
      beforeCanonical: JSON.stringify({
        score: d.session.history.present.score,
        notation: d.session.history.present.notation
      }),
      beforePast: d.session.history.past.length
    };
  });
  if (!setup.ok) throw new Error(`P10-3B import setup mismatch ${JSON.stringify(setup)}`);

  for (const action of ['copy-range-mobile','replace-range-mobile']) {
    const button = page.locator(`[data-st-p10-3b-range-replace-control="${action}"]`);
    if (await button.count() !== 1) {
      throw new Error(`P10-3B control count mismatch ${action}: ${await button.count()}`);
    }
    if (!(await button.isDisabled())) {
      throw new Error(`P10-3B control must be disabled before semantic range selection: ${action}`);
    }
    const box = await button.boundingBox();
    if (box === null || box.height < 44 || box.width < 44) {
      throw new Error(`P10-3B control touch target mismatch ${action}: ${JSON.stringify(box)}`);
    }
  }

  const selectByIds = async (firstId, lastId) => {
    const result = await page.evaluate(({ firstId, lastId }) => {
      const c = globalThis.STScoreEditorP10_3BWorkstationController;
      const d = c.getDocument();
      const resolve = eventId => d.session.renderRequest.manifest.entries
        .find(entry => entry.address.kind === 'event' && entry.address.eventId === eventId)?.address;
      const first = resolve(firstId);
      const last = resolve(lastId);
      if (!first || !last) throw new Error('P10_3B_RANGE_ADDRESS_MISSING');
      return c.professional.selectEventSpan(first, last);
    }, { firstId, lastId });
    if (result.error !== null) {
      throw new Error(`P10-3B semantic selection failed ${JSON.stringify(result.error)}`);
    }
  };

  await selectByIds(setup.eventIds[0], setup.eventIds[1]);
  const copyButton = page.locator('[data-st-p10-3b-range-replace-control="copy-range-mobile"]');
  await page.waitForFunction(() =>
    globalThis.STScoreEditorP10_3BWorkstationController.getP10_3BRangeReplaceState().canCopyForReplace
  );
  if (await copyButton.isDisabled()) throw new Error('P10-3B Copy button did not enable');
  await copyButton.click();

  const copied = await page.evaluate(() =>
    globalThis.STScoreEditorP10_3BWorkstationController.getP10_3BRangeReplaceState()
  );
  if (
    copied.clipboardState !== 'CURRENT' ||
    copied.clipboardEventCount !== 2 ||
    copied.clipboardNoteCount !== 2
  ) {
    throw new Error(`P10-3B clipboard mismatch after Copy ${JSON.stringify(copied)}`);
  }

  await selectByIds(setup.eventIds[2], setup.eventIds[5]);
  await page.waitForFunction(() =>
    globalThis.STScoreEditorP10_3BWorkstationController.getP10_3BRangeReplaceState().canAttemptReplace
  );
  const replaceButton = page.locator('[data-st-p10-3b-range-replace-control="replace-range-mobile"]');
  if (await replaceButton.isDisabled()) throw new Error('P10-3B Replace button did not enable');
  await replaceButton.click();

  const replaced = await page.evaluate(({ sourceIds, destinationIds, beforePast }) => {
    const c = globalThis.STScoreEditorP10_3BWorkstationController;
    const d = c.getDocument();
    const canonical = {
      score: d.session.history.present.score,
      notation: d.session.history.present.notation
    };
    const json = JSON.stringify(canonical);
    const selection = c.professional.getProfessionalSelection();
    const state = c.getP10_3BRangeReplaceState();
    return {
      canonical: JSON.stringify(canonical),
      sourcePreserved: sourceIds.every(id => json.includes(id)),
      destinationRemoved: destinationIds.every(id => !json.includes(id)),
      revisionId: d.session.history.present.score.revision.id,
      past: d.session.history.past.length,
      selectionKind: selection?.kind ?? null,
      selectedIds: selection?.targets?.map(target => target.eventId) ?? [],
      selectedRevisionIds: selection?.targets?.map(target => target.revisionId) ?? [],
      clipboardState: state.clipboardState,
      error: state.lastError,
      beforePast
    };
  }, {
    sourceIds: setup.eventIds.slice(0,2),
    destinationIds: setup.eventIds.slice(2,6),
    beforePast: setup.beforePast
  });
  if (
    replaced.error !== null ||
    !replaced.sourcePreserved ||
    !replaced.destinationRemoved ||
    replaced.past !== replaced.beforePast + 1 ||
    replaced.selectionKind !== 'EVENT_SPAN' ||
    replaced.selectedIds.length !== 2 ||
    replaced.selectedRevisionIds.some(id => id !== replaced.revisionId) ||
    replaced.clipboardState !== 'STALE'
  ) {
    throw new Error(`P10-3B Replace mismatch ${JSON.stringify(replaced)}`);
  }

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  const undone = await page.evaluate(() => {
    const c = globalThis.STScoreEditorP10_3BWorkstationController;
    const d = c.getDocument();
    return {
      canonical: JSON.stringify({
        score: d.session.history.present.score,
        notation: d.session.history.present.notation
      }),
      professionalSelection: c.professional.getProfessionalSelection(),
      clipboardState: c.getP10_3BRangeReplaceState().clipboardState
    };
  });
  if (
    undone.canonical !== setup.beforeCanonical ||
    undone.professionalSelection !== null ||
    undone.clipboardState !== 'STALE'
  ) {
    throw new Error(`P10-3B Undo mismatch ${JSON.stringify(undone)}`);
  }

  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  const redone = await page.evaluate(() => {
    const c = globalThis.STScoreEditorP10_3BWorkstationController;
    const d = c.getDocument();
    return {
      canonical: JSON.stringify({
        score: d.session.history.present.score,
        notation: d.session.history.present.notation
      }),
      clipboardState: c.getP10_3BRangeReplaceState().clipboardState
    };
  });
  if (redone.canonical !== replaced.canonical || redone.clipboardState !== 'STALE') {
    throw new Error('P10-3B Redo did not restore exact post-Replace canonical snapshot/clipboard state');
  }

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await selectByIds(setup.eventIds[0], setup.eventIds[1]);
  await page.waitForFunction(() =>
    globalThis.STScoreEditorP10_3BWorkstationController.getP10_3BRangeReplaceState().canCopyForReplace
  );
  await page.locator('[data-st-p10-3b-range-replace-control="copy-range-mobile"]').click();
  await selectByIds(setup.eventIds[2], setup.eventIds[3]);

  const beforeMismatch = await page.evaluate(() => {
    const c = globalThis.STScoreEditorP10_3BWorkstationController;
    const d = c.getDocument();
    return {
      canonical: JSON.stringify({
        score: d.session.history.present.score,
        notation: d.session.history.present.notation
      }),
      past: d.session.history.past.length,
      future: d.session.history.future.length
    };
  });
  await page.locator('[data-st-p10-3b-range-replace-control="replace-range-mobile"]').click();
  const mismatch = await page.evaluate(() => {
    const c = globalThis.STScoreEditorP10_3BWorkstationController;
    const d = c.getDocument();
    const selection = c.professional.getProfessionalSelection();
    return {
      canonical: JSON.stringify({
        score: d.session.history.present.score,
        notation: d.session.history.present.notation
      }),
      past: d.session.history.past.length,
      future: d.session.history.future.length,
      state: c.getP10_3BRangeReplaceState(),
      selectionKind: selection?.kind ?? null
    };
  });
  if (
    mismatch.state.lastError?.code !== 'REPLACE_EXTENT_MISMATCH' ||
    mismatch.canonical !== beforeMismatch.canonical ||
    mismatch.past !== beforeMismatch.past ||
    mismatch.future !== beforeMismatch.future ||
    mismatch.state.clipboardState !== 'CURRENT' ||
    mismatch.selectionKind !== 'EVENT_SPAN'
  ) {
    throw new Error(`P10-3B mismatch failure contract broke ${JSON.stringify({beforeMismatch,mismatch})}`);
  }

  if (errors.length !== 0) {
    throw new Error(`P10-3B browser console errors ${JSON.stringify(errors)}`);
  }

  console.log('P10-3B Professional Range Replace WebKit regression: PASS');
} finally {
  await harness.close();
}