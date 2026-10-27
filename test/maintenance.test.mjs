import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Database } from '../lib/store.js';
import { Memory } from '../lib/core.js';
import { Maintenance, explicitDate, scanDocuments, historyText } from '../lib/maintenance.js';
import { tokenize, validatePolicy } from '../lib/retrieval.js';

function fixture(t,model=async()=>({keywords:['海边','大海']})){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'nia-maintenance-')),db=new Database(root),memory=new Memory(db);
  const agent={session:{id:'s1',snapshotEvents:()=>[]},options:{provider:'fake',model:'fake'}};
  const ctx={agents:{get:id=>id==='s1'?agent:null,list:()=>[agent]}};
  memory.people('nia',[{id:'alice',name:'同名'},{id:'bob',name:'同名'}]);
  memory.bind({sessionId:'s1',personaId:'nia',chatId:'private-alice',actorIds:['alice'],ownerActorId:'alice',preview:false});
  memory.bind({sessionId:'s2',personaId:'nia',chatId:'group',actorIds:['bob'],preview:false});
  const manager=new Maintenance(memory,ctx,{model,home:root});
  t.after(()=>{manager.close();db.close();assert.equal(path.dirname(root),os.tmpdir());assert.ok(path.basename(root).startsWith('nia-maintenance-'));fs.rmSync(root,{recursive:true});});
  const add=(text='去海边',extra={})=>{const p=manager.manual({sessionId:'s1',text,subjects:['alice'],kind:'event',visibility:'private',...extra});manager.apply(p.id,p.changes.map(c=>c.id));return p.changes[0].id;};
  return {root,db,memory,manager,ctx,agent,add};
}
test('dictionary boundaries, expanded terms, configurable budget and private diagnostics',t=>{
  const {memory,db,add}=fixture(t);assert.equal(tokenize('车站').has('车'),false);
  const id=add('我喜欢看海');db.transaction(d=>{d.memories[id].keywords=['海边'];d.policy=validatePolicy({maxItems:1,maxChars:200});});
  assert.equal(memory.recall('s1','海边')[0].id,id);assert.equal(memory.recall('s2','海边').length,0);
  assert.equal(memory.traces.get('s2').rows.length,0);assert.equal(memory.traces.get('s1').rows[0].reason,'已选中');
  assert.throws(()=>validatePolicy({halfLifeDays:0}));assert.throws(()=>validatePolicy({maxItems:2.5}));
});
test('manual edits are evidence-bearing reports and undo refuses to clobber later changes',t=>{
  const {manager,db,memory,add}=fixture(t);const id=add();const original=structuredClone(db.data.memories[id]);
  const p=manager.manual({sessionId:'s1',id,text:'改成去山里',subjects:['alice'],kind:'event',visibility:'private'});
  assert.equal(db.data.memories[id].text,original.text);manager.apply(p.id,[id]);assert.equal(db.data.memories[id].status,'reported');
  assert.throws(()=>memory.remember('s1',{text:'已经完成',subjects:['alice'],evidenceIds:db.data.memories[id].evidenceIds,kind:'event',status:'completed'}));
  manager.undo(p.id);assert.deepEqual(db.data.memories[id],original);
  const q=manager.manual({sessionId:'s1',id,text:'另一个修改',subjects:['alice'],kind:'event',visibility:'private'});manager.apply(q.id,[id]);
  db.transaction(d=>{d.memories[id].keywords=['新修改'];});assert.throws(()=>manager.undo(q.id),/后续修改/);
  assert.throws(()=>manager.manual({sessionId:'s2',id,text:'不能改',subjects:['alice'],kind:'event',visibility:'private'}));
});
test('document import preserves source, dates, scope, deduplication and reversible batches',t=>{
  const {manager,db,root}=fixture(t);const file=path.join(root,'notes.md');fs.writeFileSync(file,'# 档案\n- 2026-10-20 去海边。\n- 喜欢雨天看海。');
  assert.equal(scanDocuments(file).rows.length,2);assert.equal(explicitDate('2026-02-31'),null);
  const scan=manager.scan({sessionId:'s1',path:file});assert.equal(Object.keys(db.data.memories).length,0);
  const p=manager.importPlan({planId:scan.id,selected:scan.candidates.map(c=>c.id),subjects:['alice'],visibility:'private'});
  manager.apply(p.id,p.changes.map(c=>c.id));const rows=Object.values(db.data.memories);assert.equal(rows.length,2);assert.ok(rows[0].occurredAt);assert.equal(rows[0].status,'reported');
  manager.undo(p.id);assert.ok(Object.values(db.data.memories).every(m=>m.deletedAt));
  assert.throws(()=>manager.importPlan({planId:scan.id,selected:scan.candidates.map(c=>c.id),subjects:['alice'],visibility:'private'}),/已导入/);
});
test('stale plans reject concurrent changes; duplicate merges require the whole group',t=>{
  const {manager,db,add}=fixture(t);const a=add('喜欢下雨天去海边散步'),b=add('喜欢下雨天去海边散步');
  const p=manager.duplicates('s1',[a,b]);assert.equal(p.changes.length,2);assert.throws(()=>manager.apply(p.id,[a]),/整组/);
  manager.apply(p.id,[a,b]);assert.equal(db.data.memories[b].supersededBy,a);manager.undo(p.id);assert.equal(db.data.memories[b].supersededBy,null);
  const q=manager.manual({sessionId:'s1',id:a,text:'新正文',subjects:['alice'],kind:'event',visibility:'private'});db.transaction(d=>{d.memories[a].text='并发修改';});assert.throws(()=>manager.apply(q.id,[a]),/新变化/);
});
test('model jobs preview first, validate outputs, retry only unfinished rows and respect cancellation',async t=>{
  let calls=0;const {manager,db,add}=fixture(t,async()=>{calls++;if(calls===2)throw Error('测试失败');return {keywords:['海边']};});
  const a=add('第一条'),b=add('第二条');const j=manager.start({sessionId:'s1',task:'expand',ids:[a,b]});await manager.jobs.get(j.id).promise;
  const failed=manager.jobs.get(j.id);assert.equal(failed.status,'failed');assert.equal(failed.done,1);assert.equal(db.data.memories[a].keywords,undefined);
  const retry=manager.retry(j.id);await manager.jobs.get(retry.id).promise;assert.equal(calls,3);assert.equal(manager.jobs.get(retry.id).total,1);
  const partial=manager.plans.get(failed.planId);manager.apply(partial.id,[a]);assert.deepEqual(db.data.memories[a].keywords,['海边']);
  manager.model=async(_ctx,_agent,_input,signal)=>{await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));return {keywords:['不会保存']};};
  const c=manager.start({sessionId:'s1',task:'expand',ids:[b]});manager.cancel(c.id);await manager.jobs.get(c.id).promise;assert.equal(manager.jobs.get(c.id).status,'cancelled');assert.equal(db.data.memories[b].keywords,undefined);
});
test('date/key/stable/refine tasks remain reviewable and retain identity and provenance',async t=>{
  const {manager,db,add}=fixture(t,async(_ctx,_a,input)=>({keys:{attribute:'喜欢的地点'},stable:{stable:true},refine:{text:'喜欢海边',keywords:['大海'],kind:'preference',importance:0.7}}[input.task]));
  const id=add('2026-10-20 我喜欢海边');const before=structuredClone(db.data.memories[id]);
  for(const task of ['dates','keys','stable','refine']){const j=manager.start({sessionId:'s1',task,ids:[id]});await manager.jobs.get(j.id).promise;const p=manager.plans.get(manager.jobs.get(j.id).planId);manager.apply(p.id,[id]);}
  const after=db.data.memories[id];assert.deepEqual(after.evidenceIds,before.evidenceIds);assert.deepEqual(after.subjects,['alice']);assert.equal(after.status,'reported');assert.equal(after.stable,true);assert.equal(after.attribute,'喜欢的地点');assert.ok(after.occurredAt);
});
test('daily backups retain 14 dates and previous state; quota is optional and managed imports do not consume it',t=>{
  const {memory,db,root,add}=fixture(t);add();const backups=path.join(root,'daily-backups');
  for(let i=1;i<=20;i++)fs.writeFileSync(path.join(backups,`2020-01-${String(i).padStart(2,'0')}.json`),'{}');
  db.transaction(d=>{d.policy=validatePolicy({dailyQuota:1});});assert.equal(fs.readdirSync(backups).length,14);assert.ok(fs.existsSync(db.file+'.bak'));
  memory.ingest('s1',[{id:'e1',actorId:'alice',text:'test'}]);const args={subjects:['alice'],evidenceIds:['e1'],kind:'event',status:'reported'};
  memory.remember('s1',{...args,text:'自主记忆一'});assert.throws(()=>memory.remember('s1',{...args,text:'自主记忆二'}),/上限/);
});
test('session archive generation filters injected content and requires an explicitly listed session',async t=>{
  const {manager,agent,ctx,root}=fixture(t,async()=>({text:'用户说喜欢海边；助手表示知道了。'}));
  agent.session.snapshotEvents=()=>[{type:'user/message',data:{source:{kind:'runtime-context'},content:[{type:'text',text:'隐藏注入'}]}},{type:'user/message',time:123,data:{source:{kind:'user'},content:[{type:'text',text:'喜欢海边'}]}},{type:'assistant/message',data:{content:[{type:'reasoning',text:'不应读取'},{type:'text',text:'知道了'}]}}];
  const text=await historyText(ctx,root,'s1');assert.match(text,/喜欢海边/);assert.doesNotMatch(text,/隐藏注入|不应读取/);await assert.rejects(historyText(ctx,root,'missing'));
  const j=manager.start({sessionId:'s1',task:'generate',text});await manager.jobs.get(j.id).promise;const p=manager.plans.get(manager.jobs.get(j.id).planId);assert.match(p.document,/用户说/);assert.equal(p.changes.length,0);
});
