import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { Readable } from 'node:stream';
import { apply } from '../lib/index.js';
test('host supplies service, registers scoped tools, admits real observations, restores local binding and enforces settings origin', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nia-memory-host-')), previous = process.env.DSH_HOME; process.env.DSH_HOME = dir;
  const effects = [], routes = new Map(), tools = new Map(), contexts = new Map(), listeners = new Map(), sections = new Map();
  const register = map => x => { map.set(x.name, x); return () => map.delete(x.name); };
  const events = [
    { type: 'user/message', seq: 1, data: { id: 'm1', source: { kind: 'user' }, content: [{ type: 'text', text: '试试看你的新项目' }] } },
    { type: 'tool/call', seq: 2, data: { callId: 'c1', name: 'read_file', arguments: {} } },
    { type: 'tool/result', seq: 3, data: { message: { source: { callId: 'c1' }, content: [{ type: 'text', text: '真实工具回执' }] } } }
  ];
  const a = { session: { id: 'local-test', snapshotEvents: () => events }, ctx: { tools: { register: register(tools) }, systemPrompt: { context: register(contexts), section: register(sections) }, on: (n, f) => { listeners.set(n, f); return () => listeners.delete(n); } } };
  const assessments = [], ctx = { agents: { list: () => [a], get: id => id === a.session.id ? a : undefined },
    provide(n, v) { this[n] = v; }, get(n) { return this[n]; }, effect: f => { const off = f(); effects.push(off); return off; },
    niaMood: { attach: () => {}, assess: async (_m, _a, _sid, ids) => { assessments.push(ids); } },
    webServer: { register: r => { routes.set(r.path, r.handler); return () => routes.delete(r.path); } } };
  t.after(() => { for (const off of effects.reverse()) off?.(); if (previous === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = previous;
    assert.equal(path.dirname(dir), os.tmpdir()); assert.ok(path.basename(dir).startsWith('nia-memory-host-')); fs.rmSync(dir, { recursive: true }); });
  apply(ctx);
  const req = async (name, method, body, origin) => {
    const r = Readable.from(body === undefined ? [] : [JSON.stringify(body)]); r.method = method; r.headers = { host: 'localhost:1234', origin, 'x-nia-memory': '1', 'content-type': 'application/json' };
    const res = { setHeader() {}, end(s) { this.body = JSON.parse(s); } }; await routes.get('/dsh-nia-memory/' + name)(r, res); return res;
  };
  assert.equal((await req('bind', 'POST', { sessionId: a.session.id })).statusCode, 200);
  assert.match(contexts.get('nia-memory:context').text(), /试试看你的新项目/);
  const observed = await tools.get('nia_observations').execute({ callIds: ['c1'] }); assert.equal(observed.evidence[0].text, '真实工具回执');
  const result = await tools.get('nia_remember').execute({ text: '读到项目资料', subjects: ['self'], evidenceIds: [observed.evidence[0].id], kind: 'project', status: 'observed', visibility: 'private' }); assert.ok(result.saved);
  await assert.rejects(tools.get('nia_observations').execute({ callIds: ['invented'] }));
  listeners.get('agent/turn-stopping')(); assert.equal(assessments.length, 1);
  assert.equal((await req('config', 'POST', { enabled: false }, 'https://different.example')).statusCode, 400);
  assert.equal((await req('bind', 'POST', { sessionId: a.session.id, preview: false })).statusCode, 400);
  assert.equal((await req('export', 'GET')).body.data.memories[result.id].text, '读到项目资料');
  assert.equal((await req('config', 'POST', { enabled: false })).statusCode, 200);
  await assert.rejects(tools.get('nia_recall').execute({ query: '项目' }), /暂停/);
});
test('memory settings render records, bindings and scoped controls without HTML interpolation', async () => {
  const data = { enabled: true, sessions: [{ id: 'sid' }], bindings: [{sessionId:'sid',actorIds:[]}], people:[], memories: [{ id: 'm1', text: '<script>unsafe</script>', subjects: ['self'] }], moods: {}, events: [], actions: [] };
  let component, index = 0; const states = [data, 'memories', '', 'active', '', 'local:owner', true, false, '', ''];
  const React = { createElement: (type, props, ...children) => ({ type, props, children }), useState: initial => [states[index++] ?? initial, () => {}], useEffect: () => {} };
  const sandbox = { window: { __ModuleLoader__: { load: entry => entry.factory(n => { assert.equal(n, 'react'); return React; }).apply({ slots: {
    inject: (_n, f) => f(), register: (_s, f) => { component = f().type; }
  } }) } } };
  vm.runInNewContext(fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8'), sandbox);
  const tree = component(); const serialized = JSON.stringify(tree); assert.match(serialized, /管理与备份/); assert.match(serialized, /仅限原聊天/); assert.match(serialized, /<script>unsafe/); assert.doesNotMatch(serialized, /dangerouslySetInnerHTML/);
});
