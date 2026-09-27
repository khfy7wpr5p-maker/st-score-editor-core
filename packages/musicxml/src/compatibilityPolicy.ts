export const MUSICXML_COMPATIBILITY_POLICY_VERSION='1.0.0' as const;
export type MusicXmlCompatibilityClass='SEMANTIC_REQUIRED'|'IGNORABLE_PRESENTATION_METADATA'|'UNSUPPORTED_SEMANTIC_FAIL_CLOSED';
export interface MusicXmlCompatibilityDecision{readonly classification:MusicXmlCompatibilityClass;readonly pathClass:string;readonly reason:string;}
export type MusicXmlCompatibilityCode=0|1|2|3|4|5;

const E='|score-partwise|part-list|score-part|part-name|part|measure|attributes|divisions|key|fifths|time|beats|beat-type|staves|clef|sign|line|clef-octave-change|note|grace|chord|pitch|rest|duration|voice|staff|step|alter|octave|type|dot|accidental|beam|time-modification|actual-notes|normal-notes|tie|notations|tied|slur|tuplet|articulations|accent|strong-accent|staccato|tenuto|detached-legato|staccatissimo|spiccato|scoop|plop|doit|falloff|breath-mark|caesura|stress|unstress|soft-accent|ornaments|trill-mark|turn|delayed-turn|inverted-turn|delayed-inverted-turn|vertical-turn|inverted-vertical-turn|shake|mordent|inverted-mordent|schleifer|haydn|accidental-mark|tremolo|wavy-line|backup|forward|barline|bar-style|repeat|';
const A:Readonly<Record<string,string>>={
  'score-partwise':'|version|','score-part':'|id|',part:'|id|',measure:'|number|implicit|non-controlling|',note:'|id|',clef:'|number|',barline:'|location|',repeat:'|direction|',beam:'|number|',
  tie:'|type|',tied:'|type|number|',slur:'|type|number|',tuplet:'|type|number|',grace:'|slash|steal-time-previous|steal-time-following|make-time|',
  accent:'|placement|','strong-accent':'|placement|type|',staccato:'|placement|',tenuto:'|placement|','detached-legato':'|placement|',staccatissimo:'|placement|',spiccato:'|placement|',
  scoop:'|placement|',plop:'|placement|',doit:'|placement|',falloff:'|placement|','breath-mark':'|placement|',caesura:'|placement|',stress:'|placement|',unstress:'|placement|','soft-accent':'|placement|',
  'trill-mark':'|placement|',turn:'|placement|','delayed-turn':'|placement|','inverted-turn':'|placement|','delayed-inverted-turn':'|placement|','vertical-turn':'|placement|','inverted-vertical-turn':'|placement|',
  shake:'|placement|',mordent:'|placement|','inverted-mordent':'|placement|',schleifer:'|placement|',haydn:'|placement|','accidental-mark':'|placement|',tremolo:'|type|number|placement|','wavy-line':'|type|number|placement|'
};
const ARTS='|accent|strong-accent|staccato|tenuto|detached-legato|staccatissimo|spiccato|scoop|plop|doit|falloff|breath-mark|caesura|stress|unstress|soft-accent|';
const IG='|score-partwise/identification|score-partwise/defaults|score-partwise/part-list/score-part/part-abbreviation|score-partwise/part-list/score-part/score-instrument|score-partwise/part-list/score-part/midi-instrument|score-partwise/part/measure/print|';
const key=(p:readonly string[],n:string):string=>[...p,n].join('/');

export const musicXmlCompatibilityElementCode=(p:readonly string[],n:string,u:string):MusicXmlCompatibilityCode=>{
  if(u!=='')return 2;if(E.includes('|'+n+'|'))return 0;
  const k=key(p,n);
  if(k==='score-partwise/part/measure/note/stem')return 5;
  if(k==='score-partwise/part/measure/note/notehead')return 3;
  if(k==='score-partwise/part/measure/attributes/staff-details')return 4;
  return IG.includes('|'+k+'|')?1:2;
};
export const musicXmlCompatibilityAttributeCode=(p:readonly string[],e:string,a:string,u:string):MusicXmlCompatibilityCode=>{
  if(u!=='')return 2;if(A[e]?.includes('|'+a+'|')===true)return 0;
  const k=key(p,e);
  return (k==='score-partwise/part/measure'&&a==='width')||(k==='score-partwise/part/measure/note'&&a==='default-x')||(k==='score-partwise/part/measure/note/stem'&&a==='default-y')||(p.join('/')==='score-partwise/part/measure/note/notations/articulations'&&ARTS.includes('|'+e+'|')&&a==='default-y')?1:2;
};
const pub=(c:MusicXmlCompatibilityCode,k:string):Readonly<MusicXmlCompatibilityDecision>=>Object.freeze({classification:c===0?'SEMANTIC_REQUIRED':c===1||c===5?'IGNORABLE_PRESENTATION_METADATA':'UNSUPPORTED_SEMANTIC_FAIL_CLOSED',pathClass:k,reason:c===0?'required':c===1||c===5?'ignored':'unsupported'});
export const classifyMusicXmlCompatibilityElement=(p:readonly string[],n:string,u:string):Readonly<MusicXmlCompatibilityDecision>=>pub(musicXmlCompatibilityElementCode(p,n,u),key(p,n));
export const classifyMusicXmlCompatibilityAttribute=(p:readonly string[],e:string,a:string,u:string):Readonly<MusicXmlCompatibilityDecision>=>pub(musicXmlCompatibilityAttributeCode(p,e,a,u),key(p,e));
