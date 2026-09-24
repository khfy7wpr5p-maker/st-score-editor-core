export const openMusicXmlLocalFile = async (
  page,
  controllerGlobal,
  xml,
  fileName
) => page.evaluate(async ({ controllerGlobal, xml, fileName }) => {
  const controller = globalThis[controllerGlobal];
  if (controller === undefined || controller === null) {
    throw new Error(`WEBKIT_CONTROLLER_MISSING:${controllerGlobal}`);
  }
  await controller.openLocalFile({
    name: fileName,
    size: new Blob([xml]).size,
    type: 'application/vnd.recordare.musicxml+xml',
    text: async () => xml
  });
}, { controllerGlobal, xml, fileName });

export const selectEventById = async (
  page,
  controllerGlobal,
  eventId,
  missingCode
) => page.evaluate(({ controllerGlobal, eventId, missingCode }) => {
  const controller = globalThis[controllerGlobal];
  if (controller === undefined || controller === null) {
    throw new Error(`WEBKIT_CONTROLLER_MISSING:${controllerGlobal}`);
  }
  const documentValue = controller.getDocument();
  let target = null;
  for (const entry of documentValue.session.renderRequest.manifest.entries) {
    const address = entry.address;
    if (address.kind === 'event' && address.eventId === eventId) {
      target = address;
      break;
    }
  }
  if (target === null) throw new Error(`${missingCode}:${eventId}`);
  controller.select(target);
}, { controllerGlobal, eventId, missingCode });

export const readControllerSnapshot = async (
  page,
  controllerGlobal
) => page.evaluate(({ controllerGlobal }) => {
  const controller = globalThis[controllerGlobal];
  if (controller === undefined || controller === null) {
    throw new Error(`WEBKIT_CONTROLLER_MISSING:${controllerGlobal}`);
  }
  const documentValue = controller.getDocument();
  const { session } = documentValue;
  const present = session.history.present;
  const notation = present.notation;

  const musical = {
    parts: present.score.parts,
    frames: notation.frames.map(({ notation: value }) => value),
    measures: notation.measures.map(({ notation: value }) => value),
    events: notation.events.map(({ target, notation: value }) => ({
      eventId: target.eventId,
      notation: value
    })),
    notes: notation.notes.map(({ target, notation: value }) => ({
      noteId: target.noteId,
      notation: value
    })),
    graceEvents: notation.graceEvents.map(({ target, notation: value }) => ({
      graceEventId: target.graceEventId,
      notation: value
    })),
    graceNotes: notation.graceNotes.map(({ target, notation: value }) => ({
      graceNoteId: target.graceNoteId,
      notation: value
    })),
    crossStaffPlacements: notation.crossStaffPlacements.map(({ source, displayStaffId }) => ({
      eventId: source.eventId,
      displayStaffId
    }))
  };

  return {
    canonical: JSON.stringify(Object.fromEntries(
      ['score', 'notation'].map(key => [key, present[key])
    )),
    musical: JSON.stringify(musical),
    past: session.history.past.length,
    status: session.status.code
  };
}, { controllerGlobal });

export const clickHistoryAndReadSnapshot = async (
  page,
  controllerGlobal,
  label
) => {
  await page.getByRole('button', { name: label, exact: true }).click();
  return readControllerSnapshot(page, controllerGlobal);
};