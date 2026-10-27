import fs from 'node:fs';
const lexicon=new Set(fs.readFileSync(new URL('./lexicon.txt',import.meta.url),'utf8').split(/\r?\n/).filter(Boolean));
const cache=new Map();
export const policyDefaults={halfLifeDays:30,emotionHalfLifeDays:7,threshold:0.1,maxItems:6,maxChars:2400,dailyQuota:0,factsMax:2,baselineWeight:0.2,activationWeight:0.25,importanceWeight:0.4,emotionWeight:0.15,autoExpand:true};
export function validatePolicy(input,previous=policyDefaults){
  const p={...policyDefaults,...previous};
  for(const [k,min,max,integer] of [['halfLifeDays',1,3650],['emotionHalfLifeDays',1,365],['threshold',0,1],['maxItems',1,12,true],['maxChars',200,12000,true],['dailyQuota',0,1000,true],['factsMax',0,12,true],...['baselineWeight','activationWeight','importanceWeight','emotionWeight'].map(k=>[k,0,1])])if(k in input){
    if(!Number.isFinite(input[k])||input[k]<min||input[k]>max||(integer&&!Number.isInteger(input[k])))throw Error('召回参数无效：'+k);p[k]=input[k];}
  if('autoExpand'in input){if(typeof input.autoExpand!=='boolean')throw Error('自动扩词须为开关');p.autoExpand=input.autoExpand;}
  if(!['baselineWeight','activationWeight','importanceWeight','emotionWeight'].some(k=>p[k]>0))throw Error('至少保留一个排序权重');
  return p;
}
export function tokenize(text){
  const s=String(text).toLowerCase().slice(0,24000);if(cache.has(s))return new Set(cache.get(s));
  const out=new Set(s.match(/[a-z0-9_]{2,}/g)||[]);
  for(const match of s.matchAll(/[\p{Script=Han}]+/gu)){
    const chars=[...match[0]];
    for(let i=0;i<chars.length;){let word='';for(let n=Math.min(12,chars.length-i);n>0;n--){const w=chars.slice(i,i+n).join('');if(lexicon.has(w)){word=w;break;}}
      if(word){out.add(word);i+=word.length;}else{out.add(chars.slice(i,i+2).join(''));i++;}}
  }
  if(cache.size>=2000)cache.clear();cache.set(s,[...out]);return out;
}
export function retrieve(memories,binding,query,policy,limit,now=Date.now()){
  const p={...policyDefaults,...policy},q=tokenize(query),df=new Map();
  const rows=memories.map(m=>{const terms=tokenize(m.text+' '+(m.keywords||[]).join(' '));for(const w of terms)df.set(w,(df.get(w)||0)+1);return {m,terms};});
  const rarity=w=>1+Math.log((rows.length+1)/((df.get(w)||0)+1));
  const denominator=[...q].reduce((s,w)=>s+rarity(w),0)||1;
  const scored=rows.map(({m,terms})=>{
    const hits=[...q].filter(w=>terms.has(w));const evidence=hits.reduce((s,w)=>s+rarity(w),0)/denominator;
    const stable=m.stable??['fact','preference','relationship'].includes(m.kind);
    const related=m.subjects.includes('self')||m.subjects.some(id=>binding.actorIds.includes(id));
    const age=Math.max(0,now-m.lastMentionedAt)/86400000;
    const freshness=stable?1:2**(-age/p.halfLifeDays);
    const emotion=Math.min(1,Math.max(0,Number(m.emotion)||0))*2**(-age/p.emotionHalfLifeDays);
    const score=evidence*2+Number(related)*p.baselineWeight+freshness*p.activationWeight+m.importance*p.importanceWeight+emotion*p.emotionWeight;
    const eligible=evidence>=p.threshold&&hits.length>0||stable&&related;
    return {m,score,hits,evidence,freshness,stable,reason:eligible?'候选':'相关证据不足'};
  }).sort((a,b)=>b.score-a.score);
  let chars=0,facts=0;const selected=[];const cap=Math.min(12,Math.max(1,Number(limit)||p.maxItems));
  for(const r of scored){if(r.reason!=='候选')continue;
    if(selected.length>=cap)r.reason='超过条数上限';
    else if(r.stable&&facts>=p.factsMax)r.reason='长期事实名额已满';
    else if(chars+r.m.text.length>p.maxChars)r.reason='超过字数预算';
    else{r.reason='已选中';chars+=r.m.text.length;if(r.stable)facts++;selected.push({...structuredClone(r.m),score:r.score,matched:r.hits.length,crossChat:r.m.chatId!==binding.chatId});}
  }
  return {selected,trace:{at:now,query:String(query).slice(0,1000),terms:[...q],chars,rows:scored.slice(0,200).map(r=>({id:r.m.id,text:r.m.text.slice(0,240),score:r.score,evidence:r.evidence,matched:r.hits,freshness:r.freshness,reason:r.reason}))}};
}
