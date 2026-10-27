import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Database } from '../lib/store.js';
import { Memory } from '../lib/core.js';
export function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nia-memory-test-')), db = new Database(dir), memory = new Memory(db);
  t.after(() => { db.close(); if (path.dirname(dir) !== os.tmpdir() || !path.basename(dir).startsWith('nia-memory-test-')) throw new Error('cleanup'); fs.rmSync(dir, { recursive: true }); });
  memory.people('nia', [{ id: 'qq:100:200', name: '同名' }, { id: 'qq:100:201', name: '同名' }]);
  for (const [sessionId, chatId, actors] of [['group', 'qq:100:group:300', ['qq:100:200', 'qq:100:201']], ['private', 'qq:100:private:200', ['qq:100:200']]])
    memory.bind({ sessionId, personaId: 'nia', chatId, actorIds: actors, type: sessionId === 'group' ? 'group' : 'private', preview: false, transport: 'qq' });
  memory.ingest('group', [{ id: 'e1', actorId: 'qq:100:201', text: '妮娅你真讨厌', occurredAt: 10 }]);
  return { db, memory, dir };
}
const args = { text: '对同名的冒犯感到不快', subjects: ['qq:100:201'], evidenceIds: ['e1'], kind: 'event', status: 'inferred', importance: 0.8 };

test('changing a display name inherits the existing session, memory, people and mood identity',t=>{
  const {memory,db}=fixture(t),old=memory.binding('group');
  const saved=memory.remember('group',args);memory.commitMood('group',0,{overall:{mood:42},targets:{}});
  const before=structuredClone({events:db.data.events,memories:db.data.memories,people:db.data.people,moods:db.data.moods});
  memory.bind({...old,characterName:'星澄'});
  assert.equal(memory.binding('group').characterName,'星澄');assert.equal(memory.moodKey('group'),'nia:live');
  assert.equal(memory.recall('group','冒犯').some(m=>m.id===saved.id),true);
  assert.deepEqual({events:db.data.events,memories:db.data.memories,people:db.data.people,moods:db.data.moods},before);
  memory.bind(old);assert.equal(memory.binding('group').characterName,'星澄','older callers do not erase display metadata');
  assert.throws(()=>memory.bind({...old,characterName:'invalid\nname'}),/名称/);
});

test('recent events expose real cross-chat activity without requiring a long-term summary',t=>{
  const {memory,db}=fixture(t);
  memory.bind({...memory.binding('private'),ownerActorId:'qq:100:200'});
  memory.bind({...memory.binding('group'),ownerActorId:'qq:100:200'});
  memory.ingest('private',[{id:'latest',actorId:'qq:100:200',text:'我说 xxx，你说银夹子',occurredAt:20}]);
  assert.equal(memory.context('group').people.find(p=>p.id==='qq:100:200').isConfiguredUser,true);
  assert.equal(memory.recent('group',{chatId:'qq:100:private:200',query:'xxx'})[0].text,'我说 xxx，你说银夹子');
  assert.equal(memory.recent('private',{chatId:'qq:100:group:300'})[0].id,'e1');
  const snapshot=JSON.stringify(db.data);memory.recent('group',{});assert.equal(JSON.stringify(db.data),snapshot);
  memory.remember('private',{text:'保密约定',subjects:['qq:100:200'],evidenceIds:['latest'],kind:'plan',status:'planned',visibility:'private'});
  assert.equal(memory.recent('group',{query:'xxx'}).length,0);
  assert.equal(memory.recent('private',{query:'xxx'}).length,1);
  memory.bind({sessionId:'preview',personaId:'nia',chatId:'preview-chat',actorIds:['qq:100:200'],preview:true});
  memory.ingest('preview',[{id:'preview-only',actorId:'qq:100:200',text:'only preview',occurredAt:30}]);
  assert.equal(memory.recent('private',{query:'only preview'}).length,0);
  assert.equal(memory.recent('preview',{}).length,1);
});
test('cross-chat recall keeps stable person identity and provenance; no user claims become observations', t => {
  const { memory } = fixture(t); memory.remember('group', args);
  const r = memory.recall('private', '冒犯'); assert.equal(r.length, 1); assert.deepEqual(r[0].subjects, ['qq:100:201']); assert.equal(r[0].crossChat, true); assert.equal(r[0].occurredAt, 10);
  assert.equal(memory.recall('private', '冒犯', 'qq:100:200').length, 0);
  assert.throws(() => memory.remember('group', { ...args, status: 'completed' }), /自述/);
  assert.throws(() => memory.ingest('group', [{ id: 'e1', actorId: 'qq:100:201', text: '另一件事' }]), /冲突/);
});
test('private scope constrains recall, event transfer and derivative summaries; dedup cannot widen it', t => {
  const { memory } = fixture(t); const a = memory.remember('group', args);
  memory.remember('group', { ...args, text: '另一份冒犯摘要' }); memory.edit(a.id, 'private');
  assert.equal(memory.recall('private', '冒犯').length, 0); assert.throws(() => memory.events('private', ['e1']), /原聊天/);
  assert.throws(() => memory.remember('group', args), /扩大/);
  assert.equal(memory.remember('group', { ...args, visibility: 'private' }).saved, true);
});
test('writing private memory immediately restricts its source and existing summaries', t => {
  const { memory } = fixture(t); memory.remember('group', args);
  memory.remember('group', { ...args, text: '明确不外传的冒犯', visibility: 'private' });
  assert.throws(() => memory.events('private', ['e1']), /原聊天/); assert.equal(memory.recall('private', '冒犯').length, 0);
});
test('soft deletion, correction and reinforcement preserve source records', t => {
  const { memory, db } = fixture(t); const a = memory.remember('group', { ...args, kind: 'relationship', attribute: 'relation' });
  assert.equal(memory.remember('group', { ...args, kind: 'relationship', attribute: 'relation' }).reinforced, true);
  memory.edit(a.id, 'delete'); assert.equal(memory.recall('private', '冒犯').length, 0); memory.edit(a.id, 'restore');
  memory.remember('group', { ...args, kind: 'relationship', attribute: 'relation', text: '已澄清冒犯误会', replaces: a.id });
  assert.ok(db.data.memories[a.id].supersededBy); assert.ok(db.data.events['nia/e1']);
  assert.throws(() => memory.remember('group', { ...args, text: 'wrong', attribute: 'other', replaces: a.id }), /同一属性/);
});
test('preview is excluded from live recalls, evidence and automatic context', t => {
  const { memory } = fixture(t); memory.bind({ ...memory.binding('group'), sessionId: 'preview', preview: true });
  memory.ingest('preview', [{ id: 'preview1', actorId: 'qq:100:201', text: '预演发现企鹅' }]);
  memory.remember('preview', { ...args, text: '预演企鹅', evidenceIds: ['preview1'] });
  assert.equal(memory.recall('private', '企鹅').length, 0); assert.throws(() => memory.events('private', ['preview1']), /预演/);
  assert.equal(memory.context('group').memories.some(m => m.preview), false);
});
test('observed self failures can be remembered; preview sends cannot prove execution', t => {
  const { memory, db } = fixture(t);
  memory.observation('group', { id: 'tool1', name: 'shell', text: 'exit code 1', failed: true, occurredAt: 11 });
  memory.remember('group', { ...args, subjects: ['self'], text: '试运行失败', status: 'failed', evidenceIds: ['tool1'], visibility: 'private' });
  assert.throws(() => memory.remember('group', { ...args, status: 'completed', evidenceIds: ['tool1'], visibility: 'private' }), /失败回执/);
  memory.outbound('group', { id: 'o1', text: 'hi', action: 'send', status: 'preview', preview: true });
  assert.equal(db.data.events['nia/o1'], undefined);
  memory.outbound('group', { id: 'o2', text: 'hi', action: 'send', status: 'confirmed', preview: false });
  const at = db.data.events['nia/o2'].occurredAt; memory.outbound('group', { id: 'o2', text: 'hi', action: 'send', status: 'confirmed', preview: false }); assert.equal(db.data.events['nia/o2'].occurredAt, at);
});
test('CAS and writer lock prevent overwrites; failed transaction rolls back; restart preserves memory', t => {
  const { memory, db, dir } = fixture(t); const a = memory.remember('group', args);
  assert.throws(() => new Database(dir), /EEXIST/);
  memory.commitMood('group', 0, { overall: {} }); assert.throws(() => memory.commitMood('private', 0, {}), /版本/);
  const rev = db.data.revision; assert.throws(() => db.transaction(d => { d.enabled = false; throw new Error('fault'); })); assert.equal(db.data.revision, rev); assert.equal(db.data.enabled, true);
  const originalFile = db.file; db.file = path.join(dir, 'missing', 'state.json'); assert.throws(() => db.transaction(d => { d.enabled = false; })); assert.equal(db.data.enabled, true); db.file = originalFile;
  db.close(); const next = new Database(dir); assert.equal(next.data.memories[a.id].text, args.text); next.close();
  fs.writeFileSync(db.file, '{broken'); assert.throws(() => new Database(dir)); assert.equal(fs.readFileSync(db.file, 'utf8'), '{broken');
});
