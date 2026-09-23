import { addressEntityV3 } from '../../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../../dist/packages/score-model-v3/src/index.js';
import {
  createNotationDocumentV4,
  emptyNotationDocumentV4
} from '../../dist/packages/notation-structure-v4/src/index.js';
import { createNewScoreEditorAppDocument } from '../../dist/packages/score-editor-app-document/src/index.js';
import { createEventSpanProfessionalSelectionV1 } from '../../dist/packages/editor-professional-selection-v1/src/index.js';
import {
  analyzeProfessionalRangeReplaceV1,
  createProfessionalRangeCopySnapshotV1,
  planProfessionalRangeReplaceIdentitiesV1
} from '../../dist/packages/editor-professional-range-replace-v1/src/index.js';

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

const fixtureIds = prefix => {
  let value=0;
  return () => `${prefix}-${++value}`;
};

const baseScore = (preset, prefix) =>
  createNewScoreEditorAppDocument({
    preset,
    idFactory:fixtureIds(prefix)
  }).session.history.present.score;

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
  const raw=structuredClone(baseScore(preset,'p10-3b-compact'));
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
  const raw=structuredClone(baseScore('GUITAR_TREBLE','p10-3b-identity'));
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

  const frame=structuredClone(raw.measureFrames[0]);
  if (frame === undefined) throw new Error('P10_3B_FRAME_FIXTURE_MISSING');
  frame.id='p10-3b-frame-2';
  frame.ordinal=2;
  frame.displayNumber='2';
  raw.measureFrames.push(frame);

  const measure=structuredClone(staff.measures[0]);
  if (measure === undefined) throw new Error('P10_3B_MEASURE_FIXTURE_MISSING');
  measure.id='p10-3b-measure-2';
  measure.frameId=frame.id;
  measure.voices=measure.voices.map((voice,index)=>({
    ...voice,
    id:`p10-3b-m2-voice-${index + 1}`,
    events:[
      note('m2-a','m2-na',q(0,1),q(1,2),'D'),
      note('m2-b','m2-nb',q(1,2),q(1,2),'F')
    ],
    graceGroups:[]
  }));
  staff.measures.push(measure);

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