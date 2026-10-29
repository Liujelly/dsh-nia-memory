import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Database } from '../lib/store.js';
import { Memory } from '../lib/core.js';
import { createAgentExtensions } from '../lib/activity-context.js';
import { apply } from '../lib/index.js';

const now = new Date('2026-10-29T04:00:00Z').getTime(), day = 86400000;
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nia-activity-context-'));
  const db = new Database(dir), memory = new Memory(db);
  t.after(() => { db.close(); assert.equal(path.dirname(dir), os.tmpdir()); fs.rmSync(dir, { recursive: true }); });
  for (const [sessionId, chatId, preview, personaId] of [
    ['owner-session', 'qq:100:private:200', false, 'nia'],
    ['group-session', 'qq:100:group:300', false, 'nia'],
    ['activity-session', 'local:activity', false, 'nia'],
    ['preview-session', 'qq:100:group:400', true, 'nia'],
    ['other-persona', 'local:activity', false, 'other']
  ]) memory.bind({ sessionId, chatId, preview, personaId, actorIds: ['qq:100:200', 'qq:100:201'], ownerActorId: 'qq:100:200', transport: 'activity' });
  memory.people('nia', [{ id: 'qq:100:200', name: '主人' }, { id: 'qq:100:201', name: '群友' }]);
  memory.people('other', [{ id: 'qq:100:200', name: '其他人格主人' }]);
  let next = 0;
  function add({ session = 'owner-session', text, kind = 'event', status = 'reported', importance = .5,
    emotion = 0, days = 0, visibility = 'internal', subject = 'qq:100:200' }) {
    const eid = 'event-' + next++;
    memory.ingest(session, [{ id: eid, text, actorId: subject, occurredAt: now - days * day }]);
    const result = memory.remember(session, { text, subjects: [subject], evidenceIds: [eid], kind, status, importance, emotion, visibility });
    db.transaction(d => { d.memories[result.id].lastMentionedAt = now - days * day; d.memories[result.id].recordedAt = now - days * day; });
    return { id: result.id, eid };
  }
  return { db, memory, add };
}

test('activity context recalls old significant relationships and unfinished plans beyond recent chatter', t => {
  const f = fixture(t);
  const relation = f.add({ text: '主人一直认真听我谈自己喜欢的游戏', kind: 'relationship', importance: .95, emotion: .9, days: 25 });
  const plan = f.add({ text: '想把之前试玩的解谜游戏继续研究', kind: 'project', status: 'planned', importance: .8, days: 15 });
  for (let i = 0; i < 24; i++) f.add({ session: 'group-session', text: '无关群聊 ' + i, importance: .1, subject: 'qq:100:201' });
  const before = f.db.data.revision;
  const context = f.memory.activityContext('activity-session', { limit: 6, now });
  assert.ok(context.memories.some(m => m.id === relation.id));
  assert.ok(context.memories.some(m => m.id === plan.id));
  assert.ok(context.events.some(e => e.actorId === 'qq:100:200'));
  assert.ok(context.events.some(e => e.actorId === 'qq:100:201'));
  assert.ok(context.memories.every(m => m.crossChat && m.chatId));
  assert.equal(f.db.data.revision, before, 'recall must not write or start an LLM');
});

test('activity context observes private, preview, persona and changed source visibility', t => {
  const f = fixture(t);
  const privateItem = f.add({ text: '只在原聊天说的事', visibility: 'private' });
  const revokedSource = f.add({ text: '后来不再允许跨聊天知道', importance: 1 });
  const missingSource = f.add({ text: '已经不存在的来源', importance: 1 });
  const deleted = f.add({ text: '已经删除的记忆', importance: 1 });
  const superseded = f.add({ text: '已经替代的旧说法', importance: 1 });
  const preview = f.add({ session: 'preview-session', text: '预演中的假设经历', importance: 1 });
  const other = f.add({ session: 'other-persona', text: '另一人格的故事', importance: 1 });
  const visible = f.add({ text: '正常可想起的共同经历', importance: .8 });
  f.db.transaction(d => {
    d.events['nia/' + revokedSource.eid].visibility = 'private';
    delete d.events['nia/' + missingSource.eid];
    d.memories[deleted.id].deletedAt = now;
    d.memories[superseded.id].supersededBy = visible.id;
  });
  const result = f.memory.activityContext('activity-session', { limit: 30, now });
  const ids = new Set(result.memories.map(m => m.id));
  for (const denied of [privateItem, revokedSource, missingSource, deleted, superseded, preview, other]) assert.equal(ids.has(denied.id), false);
  assert.ok(ids.has(visible.id));
  assert.ok(!result.events.some(e => [privateItem.eid, revokedSource.eid, preview.eid, other.eid].includes(e.id)));
  const original = f.memory.activityContext('owner-session', { limit: 30, now });
  assert.ok(original.memories.some(m => m.id === privateItem.id));
  assert.ok(original.memories.some(m => m.id === revokedSource.id));
  const previewResult = f.memory.activityContext('preview-session', { limit: 30, now });
  assert.deepEqual(previewResult.memories.map(m => m.id), [preview.id]);
});

test('queries find older relevant events; output is bounded and detached from stored records', t => {
  const f = fixture(t);
  const codex = f.add({ text: '之前提到过 Codex 的桌面应用', days: 90, importance: .1 });
  for (let i = 0; i < 20; i++) f.add({ text: '最近的一段很长的内容'.repeat(100) + i, importance: .5 });
  const result = f.memory.activityContext('activity-session', { queries: ['Codex'], limit: 12, now });
  assert.ok(result.events.some(e => e.id === codex.eid));
  assert.ok(result.memories.some(m => m.id === codex.id));
  for (const rows of [result.events, result.memories]) {
    assert.ok(rows.length <= 12);
    assert.ok(rows.reduce((sum, row) => sum + row.text.length, 0) <= 6000);
    assert.ok(rows.every(row => row.text.length <= 800));
  }
  result.memories[0].subjects.push('untrusted');
  result.memories[0].text = 'changed';
  assert.ok(!f.db.data.memories[result.memories[0].id].subjects.includes('untrusted'));
  assert.notEqual(f.db.data.memories[result.memories[0].id].text, 'changed');
  assert.throws(() => f.memory.activityContext('activity-session', { limit: 100 }), /范围/);
  assert.throws(() => f.memory.activityContext('activity-session', { queries: [5] }), /检索词/);
  f.db.transaction(d => { d.enabled = false; });
  assert.throws(() => f.memory.activityContext('activity-session'), /暂停/);
});

function fakeAgent() {
  const effects = [];
  return { ctx: { effect(fn) { effects.push(fn()); } }, dispose() { for (const off of effects.reverse()) off?.(); } };
}

test('agent extensions mount once, support late registration and use supplied sync', () => {
  const extensions = createAgentExtensions(), agent = fakeAgent(); let synced = 0, mounted = 0, cleaned = 0;
  const binding = { sessionId: 's', personaId: 'nia', chatId: 'c', preview: false };
  extensions.track(agent, binding, () => synced++);
  const off = extensions.register((received, b, { sync }) => { assert.equal(received, agent); assert.equal(b.chatId, 'c'); b.chatId = 'tamper'; mounted++; sync(); return () => cleaned++; });
  extensions.track(agent, binding, () => {});
  assert.equal(mounted, 1); assert.equal(synced, 1); assert.equal(binding.chatId, 'c');
  off(); off(); assert.equal(cleaned, 1);
  const again = extensions.register((_a, b) => { assert.equal(b.chatId, 'c'); mounted++; return () => cleaned++; });
  agent.dispose(); assert.equal(cleaned, 2);
  again(); extensions.close(); assert.equal(cleaned, 2);
});

test('early extensions clean on agent or service disposal; failed late mount rolls back', () => {
  const extensions = createAgentExtensions(), first = fakeAgent(), second = fakeAgent(); let cleaned = 0;
  extensions.register(() => () => cleaned++);
  const b = { sessionId: 's', personaId: 'nia', chatId: 'c', preview: false };
  extensions.track(first, b); extensions.track(second, { ...b, sessionId: 's2' });
  let rolledBack = 0;
  assert.throws(() => extensions.register(agent => { if (agent === second) throw Error('cannot mount'); return () => rolledBack++; }), /cannot mount/);
  assert.equal(rolledBack, 1);
  first.dispose(); assert.equal(cleaned, 1);
  extensions.close(); assert.equal(cleaned, 2);
  second.dispose(); extensions.close(); assert.equal(cleaned, 2);
  assert.throws(() => extensions.register(() => {}), /停止/);
});

test('memory host exposes extension registration and syncs bound local conversation evidence before extension tools', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nia-activity-extension-host-'));
  const previous = process.env.DSH_HOME; process.env.DSH_HOME = dir;
  const effects = [], agentEffects = [], toolMap = new Map();
  const entries = [{ type: 'user/message', seq: 1, time: now, data: { id: 'u1', source: { kind: 'user' }, content: [{ type: 'text', text: '我最近经常找 Codex 聊天' }] } }];
  const agent = { session: { id: 'extension-test', snapshotEvents: () => entries }, ctx: {
    tools: { register: tool => { toolMap.set(tool.name, tool); return () => toolMap.delete(tool.name); } },
    systemPrompt: { section: () => () => {}, context: () => () => {} },
    effect: fn => { const off = fn(); agentEffects.push(off); return off; }
  } };
  const ctx = { agents: { list: () => [agent] }, provide(name, value) { this[name] = value; }, get(name) { return this[name]; },
    effect: fn => { const off = fn(); effects.push(off); return off; }, webServer: { register: () => () => {} } };
  t.after(() => {
    for (const off of effects.reverse()) off?.();
    for (const off of agentEffects.reverse()) off?.();
    if (previous === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = previous;
    assert.equal(path.dirname(dir), os.tmpdir()); fs.rmSync(dir, { recursive: true });
  });
  apply(ctx);
  const memory = ctx.niaMemory;
  const binding = { sessionId: 'extension-test', personaId: 'nia', chatId: 'local:extension', actorIds: ['local:owner'], ownerActorId: 'local:owner', transport: 'local', preview: false };
  memory.attach(agent, binding);
  let mounted = 0, cleaned = 0;
  const off = memory.registerAgentExtension((a, b, { sync }) => {
    mounted++;
    return a.ctx.tools.register({ name: 'extension-probe', execute: () => { sync(); return memory.recent(b.sessionId); } });
  });
  memory.registerAgentExtension(() => () => cleaned++);
  assert.equal(mounted, 1);
  memory.attach(agent, binding); assert.equal(mounted, 1);
  const events = toolMap.get('extension-probe').execute();
  assert.equal(events.length, 1); assert.match(events[0].text, /Codex/);
  off(); assert.equal(toolMap.has('extension-probe'), false);
  for (const cleanup of agentEffects.splice(0)) cleanup?.();
  assert.equal(cleaned, 1);
});
