import type { EditorStatus } from '../../editor-ui-contract/src/index.js';

export const EDITOR_ACCESSIBILITY_VERSION='1.0.0' as const;
export type EditorFocusRegion='toolbar'|'parts'|'score'|'inspector'|'status';
export type EditorKeyboardAction=
  | {readonly type:'FOCUS_NEXT_REGION'}
  | {readonly type:'FOCUS_PREVIOUS_REGION'}
  | {readonly type:'FOCUS_SCORE'}
  | {readonly type:'REQUEST_UNDO'}
  | {readonly type:'REQUEST_REDO'}
  | {readonly type:'REQUEST_ESCAPE'};

export interface KeyboardGesture {
  readonly key:string;
  readonly altKey:boolean;
  readonly ctrlKey:boolean;
  readonly metaKey:boolean;
  readonly shiftKey:boolean;
}
export interface AccessibleRegionModel {
  readonly region:EditorFocusRegion;
  readonly role:'toolbar'|'navigation'|'region'|'complementary'|'status';
  readonly label:string;
}
export interface AccessibilityModel {
  readonly version:typeof EDITOR_ACCESSIBILITY_VERSION;
  readonly regions:readonly AccessibleRegionModel[];
  readonly announcement:{readonly text:string;readonly politeness:'off'|'polite'|'assertive'};
}

const regions=Object.freeze<readonly AccessibleRegionModel[]>([
  Object.freeze({region:'toolbar',role:'toolbar',label:'Notation tools'}),
  Object.freeze({region:'parts',role:'navigation',label:'Score parts and staves'}),
  Object.freeze({region:'score',role:'region',label:'Score editor'}),
  Object.freeze({region:'inspector',role:'complementary',label:'Selected score item properties'}),
  Object.freeze({region:'status',role:'status',label:'Editor status'})
]);

export const createAccessibilityModel=(status:EditorStatus):Readonly<AccessibilityModel>=>Object.freeze({
  version:EDITOR_ACCESSIBILITY_VERSION,
  regions,
  announcement:Object.freeze({
    text:status.message,
    politeness:status.message.length===0?'off':status.level==='error'?'assertive':'polite'
  })
});

export const nextFocusRegion=(current:EditorFocusRegion|null,direction:1|-1):EditorFocusRegion=>{
  const order:readonly EditorFocusRegion[]=['toolbar','parts','score','inspector','status'];
  if(current===null)return direction===1?'toolbar':'status';
  const index=order.indexOf(current);const next=(index+direction+order.length)%order.length;return order[next]!;
};

const exactGesture=(value:KeyboardGesture):boolean=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&JSON.stringify(Object.keys(value).sort())===JSON.stringify(['altKey','ctrlKey','key','metaKey','shiftKey']);
export const interpretKeyboardGesture=(gesture:KeyboardGesture):Readonly<EditorKeyboardAction>|null=>{
  if(!exactGesture(gesture)||typeof gesture.key!=='string'||typeof gesture.altKey!=='boolean'||typeof gesture.ctrlKey!=='boolean'||typeof gesture.metaKey!=='boolean'||typeof gesture.shiftKey!=='boolean')return null;
  const modifier=gesture.ctrlKey||gesture.metaKey;
  if(modifier&&!gesture.altKey&&gesture.key.toLowerCase()==='z')return Object.freeze({type:gesture.shiftKey?'REQUEST_REDO':'REQUEST_UNDO'} as const);
  if(!modifier&&!gesture.altKey&&gesture.key==='F6')return Object.freeze({type:gesture.shiftKey?'FOCUS_PREVIOUS_REGION':'FOCUS_NEXT_REGION'} as const);
  if(!modifier&&!gesture.altKey&&!gesture.shiftKey&&gesture.key==='Escape')return Object.freeze({type:'REQUEST_ESCAPE'} as const);
  if(!modifier&&!gesture.altKey&&!gesture.shiftKey&&gesture.key==='F7')return Object.freeze({type:'FOCUS_SCORE'} as const);
  return null;
};
