import { webcrypto } from 'node:crypto';

import { addressEntityV3 } from '../../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../../dist/packages/score-model-v3/src/index.js';
import {
  createNotationDocumentV4,
  emptyNotationDocumentV4
} from '../../dist/packages/notation-structure-v4/src/index.js';
import { createMeasureFrameAuthoringStandaloneScoreEditorController } from '../../dist/packages/score-editor-browser-app/src/measure-frame-authoring.js';
import { createEventSpanProfessionalSelectionV1 } from '../../dist/packages/editor-professional-selection-v1/src/index.js';
import {
  analyzeProfessionalRangeReplaceV1,
  createProfessionalRangeCopySnapshotV1,
  planProfessionalRangeReplaceIdentitiesV1
} from '../../dist/packages/editor-professional-range-replace-v1/src/index.js';

if (globalThis.crypto === undefined) {
  globalThis.crypto=webcrypto;
}

export const q = (numerator, denominator) => ({ numerator, denominator });
export const pitch = (step='C', alter=0, octave=4) => ({ step, alter, octave });
export const note = (id, noteId, onset, duration, step='C') => ({
  id, kind:'note', onset, duration, note:{ id:noteId, pitch:pitch(step) }
});
export const rest = (id, onset, duration) => ({ id, kind:'rest', onset, duration });
export const chord = (id, onset, duration, defs) => ({
  id, kind:'chord', onset, duration,
  notes:defs.map(([noteId, step, alter=0, octave=4]) => ({
    id:noteId,
    pitch:pitch(step, alter, octave)
  }))
});
export const eventNotation = (overrides={}) => ({
  dots:0, beams:[], tuplet:null, articulations:[], ornaments:[], ...overrides
});
export const noteNotation = (overrides={}) => ({
  accidental:null, ties:[], slurs:[], ...overrides
});

export const span = (score, start, stop) => createEventSpanProfessionalSelectionV1(
  score,
  addressEntityV3(score, start),
  addressEntityV3(score, stop)
);

const requireStandardStaff = score => {
  const staff=score.parts[0]?.staves.find(item=>item.role==='standard');
  if (staff === undefined) throw new Error('P10_3B_STANDARD_STAFF_FIXTURE_MISSING');
  return staff;
};

const requireVoice = (staff, measureIndex) => {
  const voice=staff.measures[measureIndex]?.voices[0];
  if (voice === undefined) {
    throw new Error(`P10_3B_VOICE_FIXTURE_MISSING:${measureIndex}`);
  }
  return voice;
};

export const createCompactRangeReplaceScore = ({
  revisionId,
  parentId,
  preset='GUITAR_TREBLE'
}) => {
  const controller=createMeasureFrameAuthoringStandaloneScoreEditorController();
  controller.newDocument({preset});
  const raw=structuredClone(controller.getDocument().session.history.present.score);
  raw.revision={id:revisionId,parentId};
  const staff=requireStandardStaff(raw);
  requireVoice(staff,0).events=[
    note('src-a','src-na',q(0,1),q(1,8),'C'),
    chord('src-b',q(1,8),q(1,8),[['src-nb1','E'],['src-nb2','G']]),
    note('dst-a','dst-na',q(1,4),q(1,16),'A'),
    rest('dst-b',q(5,16),q(1,16)),
    chord('dst-c',q(3,8),q(1,16),[['dst-nc1','C'],['dst-nc2','E']]),
    note('dst-d','dst-nd',q(7,16),q(1,16),'B'),
    note('tail','tail-note',q(1,2),q(1,2),'F')
  ];
  return createScoreDocumentV3(raw);
};

export const createIdentityRangeReplaceScore = () => {
  const controller=createMeasureFrameAuthoringStandaloneScoreEditorController();
  controller.newDocument({preset:'GUITAR_TREBLE'});
  controller.appendMeasure();
  const raw=structuredClone(controller.getDocument().session.history.present.score);
  raw.revision={id:'p10-3b-id-rev-1',parentId:'p10-3b-id-parent'};
  const staff=requireStandardStaff(raw);
  requireVoice(staff,0).events=[
    note('src-a','src-na',q(0,1),q(1,4),'C'),
    chord('src-b',q(1,4),q(1,4),[['src-nb1','E'],['src-nb2','G']]),
    note('dst-a','dst-na',q(1,2),q(1,8),'A'),
    rest('dst-b',q(5,8),q(1,8)),
    chord('dst-c',q(3,4),q(1,8),[['dst-nc1','C'],['dst-nc2','E']]),
    note('dst-d','dst-nd',q(7,8),q(1,8),'B')
  ];
  requireVoice(staff,1).events=[
    note('m2-a','m2-na',q(0,1),q(1,2),'D'),
    note('m2-b','m2-nb',q(1,2),q(1,2),'F')
  ];
  return createScoreDocumentV3(raw);
};

export const createBasicRangeReplaceNotation = score => {
  const empty=emptyNotationDocumentV4(score);
  return createNotationDocumentV4(score,{
    ...empty,
    events:[
      {
        target:addressEntityV3(score,'src-a'),
        notation:eventNotation({
          articulations:[{kind:'staccato',placement:'auto',direction:null}]
        })
      },
      {
        target:addressEntityV3(score,'dst-a'),
        notation:eventNotation({
          articulations:[{kind:'tenuto',placement:'below',direction:null}]
        })
      }
    ],
    notes:[
      {
        target:addressEntityV3(score,'src-na'),
        notation:noteNotation({accidental:'natural'})
      },
      {
        target:addressEntityV3(score,'dst-na'),
        notation:noteNotation({accidental:'flat'})
      }
    ]
  });
};

export const prepareRangeReplaceFacts = ({
  score,
  notation=emptyNotationDocumentV4(score),
  nextRevisionId,
  backward=false
}) => {
  const source=span(score,'src-a','src-b');
  const destination=backward
    ? span(score,'dst-d','dst-a')
    : span(score,'dst-a','dst-d');
  const snapshot=createProfessionalRangeCopySnapshotV1(score,notation,source);
  const admission=analyzeProfessionalRangeReplaceV1(score,notation,snapshot,destination);
  const identityPlan=nextRevisionId === undefined
    ? null
    : planProfessionalRangeReplaceIdentitiesV1(
        score,notation,snapshot,destination,admission,nextRevisionId
      );
  return {score,notation,source,destination,snapshot,admission,identityPlan};
};
