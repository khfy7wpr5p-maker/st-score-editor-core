import test from 'node:test';
import assert from 'node:assert/strict';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createNotationDocumentV4, emptyNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import { createEditorSessionV4 } from '../dist/packages/editor-session-controller-v4/src/index.js';
import {
  createScoreEditorProfessionalWorkstationV1,
  selectProfessionalEventSpanV1,
  selectProfessionalEventSetV1
} from '../dist/packages/score-editor-professional-workstation-v1/src/index.js';
import {
  copyProfessionalRangeForReplaceV1,
  commitProfessionalRangeReplaceWorkstationV1
} from '../dist/packages/score-editor-professional-range-replace-workstation-v1/src/index.js';
import { createCompactRangeReplaceScore } from './helpers/p10-3b-fixtures.mjs';

const workstationFixture=()=>{
  const score=createCompactRangeReplaceScore({
    revisionId:'p10-3b-workstation-rev-1',
    parentId:'p10-3b-workstation-parent'
  });
  const notation=createNotationDocumentV4(score,emptyNotationDocumentV4(score));
  const session=createEditorSessionV4(score,notation);
  const document=Object.freeze({
    version:'1.0.0',
    title:'P10-3B Workstation',
    origin:'NEW',
    session,
    savedRevisionId:score.revision.id,
    dirty:false
  });
  return {
    score,notation,
    workstation:createScoreEditorProfessionalWorkstationV1(document)
  };
};

test('P10-3B workstation Copy requires a professional selection',()=>{
  const x=workstationFixture();
  assert.throws(()=>copyProfessionalRangeForReplaceV1(x.workstation));
});

test('P10-3B workstation Copy uses the current EVENT_SPAN and returns TeacherCopySnapshotV4 without history mutation',()=>{
  const x=workstationFixture();
  const source=selectProfessionalEventSpanV1(
    x.workstation,
    addressEntityV3(x.score,'src-a'),
    addressEntityV3(x.score,'src-b')
  );
  const before=JSON.stringify(source.document.session.history);
  const snapshot=copyProfessionalRangeForReplaceV1(source);
  assert.equal(snapshot.kind,'TEACHER_COPY_SNAPSHOT');
  assert.deepEqual(snapshot.segments[0].events.map(event=>event.sourceEventId),['src-a','src-b']);
  assert.equal(JSON.stringify(source.document.session.history),before);
});

test('P10-3B workstation Copy rejects EVENT_SET for Replace',()=>{
  const x=workstationFixture();
  const set=selectProfessionalEventSetV1(x.workstation,[
    addressEntityV3(x.score,'src-a'),
    addressEntityV3(x.score,'src-b')
  ]);
  assert.throws(()=>copyProfessionalRangeForReplaceV1(set));
});

test('P10-3B workstation Replace orchestrates admission/identity/session and returns the fresh replacement span',()=>{
  const x=workstationFixture();
  const source=selectProfessionalEventSpanV1(
    x.workstation,
    addressEntityV3(x.score,'src-a'),
    addressEntityV3(x.score,'src-b')
  );
  const snapshot=copyProfessionalRangeForReplaceV1(source);
  const destination=selectProfessionalEventSpanV1(
    source,
    addressEntityV3(x.score,'dst-a'),
    addressEntityV3(x.score,'dst-d')
  );
  const result=commitProfessionalRangeReplaceWorkstationV1(
    destination,
    snapshot,
    {nextRevisionId:'p10-3b-workstation-rev-2'}
  );

  assert.equal(result.document.session.history.past.length,1);
  assert.equal(result.document.session.history.present.score.revision.id,'p10-3b-workstation-rev-2');
  assert.equal(result.document.dirty,true);
  assert.equal(result.professionalSelection.kind,'EVENT_SPAN');
  assert.equal(result.professionalSelection.targets.length,2);
  assert.equal(result.professionalSelection.anchor.revisionId,'p10-3b-workstation-rev-2');
  assert.equal(result.document.session.status.code,'PROFESSIONAL_RANGE_REPLACE_EDIT_COMMITTED');
});

test('P10-3B workstation Replace leaves source identities/content present while destination identities disappear',()=>{
  const x=workstationFixture();
  const source=selectProfessionalEventSpanV1(
    x.workstation,
    addressEntityV3(x.score,'src-a'),
    addressEntityV3(x.score,'src-b')
  );
  const snapshot=copyProfessionalRangeForReplaceV1(source);
  const destination=selectProfessionalEventSpanV1(
    source,
    addressEntityV3(x.score,'dst-a'),
    addressEntityV3(x.score,'dst-d')
  );
  const result=commitProfessionalRangeReplaceWorkstationV1(
    destination,
    snapshot,
    {nextRevisionId:'p10-3b-workstation-rev-3'}
  );
  const json=JSON.stringify(result.document.session.history.present.score);
  assert.equal(json.includes('src-a'),true);
  assert.equal(json.includes('src-b'),true);
  assert.equal(json.includes('dst-a'),false);
  assert.equal(json.includes('dst-b'),false);
  assert.equal(json.includes('dst-c'),false);
  assert.equal(json.includes('dst-d'),false);
});