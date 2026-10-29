import { tokenize } from './retrieval.js';

const copy = value => structuredClone(value);
const timestamp = row => Number(row.lastMentionedAt ?? row.occurredAt ?? row.recordedAt) || 0;
const visible = (row, binding) => row && row.personaId === binding.personaId && row.preview === binding.preview
  && !row.deletedAt && !row.supersededBy && ['shared', 'internal', 'private'].includes(row.visibility)
  && (row.visibility !== 'private' || row.chatId === binding.chatId);
const unfinished = row => ['plan', 'project'].includes(row.kind)
  && !['completed', 'failed', 'cancelled', 'fictional'].includes(row.status);

// This is a bounded context selection, not a new memory or an execution command.
export function selectActivityContext(data, binding, { queries = [], subjects = [], limit = 12, now = Date.now() } = {}) {
  if (!Array.isArray(queries) || queries.length > 8 || queries.some(q => typeof q !== 'string' || q.length > 600)) throw Error('活动检索词无效');
  if (!Array.isArray(subjects) || subjects.length > 12 || subjects.some(s => typeof s !== 'string' || !/^[a-zA-Z0-9:_-]{1,160}$/.test(s) || ['__proto__', 'constructor', 'prototype'].includes(s))) throw Error('活动人物标识无效');
  if (!Number.isInteger(limit) || limit < 1 || limit > 30 || !Number.isFinite(now) || now < 0) throw Error('活动检索范围无效');
  const people = new Set([...subjects, binding.ownerActorId, ...(binding.actorIds || [])].filter(Boolean));
  const queryTerms = [...tokenize(queries.join(' '))];
  const relevance = row => {
    if (!queryTerms.length) return 0;
    const terms = tokenize(row.text || '');
    return queryTerms.filter(t => terms.has(t)).length / queryTerms.length;
  };
  const age = row => Math.max(0, now - timestamp(row)) / 86400000;
  const events = Object.values(data.events).filter(e => visible(e, binding));
  const memories = Object.values(data.memories).filter(m => visible(m, binding)
    && Array.isArray(m.evidenceIds) && m.evidenceIds.length
    && m.evidenceIds.every(id => visible(data.events[binding.personaId + '/' + id], binding)));
  const eventRows = events.map(row => ({ row, score: relevance(row) * 3 + 1 / (1 + age(row) / 3)
    + (people.has(row.actorId) ? .9 : 0) + (row.actorId === 'self' ? .2 : 0) }));
  const memoryRows = memories.map(row => ({ row, score: relevance(row) * 3
    + Math.max(0, Math.min(1, Number(row.importance) || 0))
    + Math.max(0, Math.min(1, Number(row.emotion) || 0)) * .6 / (1 + age(row) / 14)
    + (unfinished(row) ? .9 : row.kind === 'relationship' ? .7 : row.kind === 'preference' ? .3 : 0)
    + ((row.subjects || []).some(s => people.has(s) || s === 'self') ? .3 : 0)
    + .3 / (1 + age(row) / 30) }));
  const rank = rows => rows.sort((a, b) => b.score - a.score || timestamp(b.row) - timestamp(a.row) || a.row.id.localeCompare(b.row.id));
  rank(eventRows); rank(memoryRows);
  const pick = (rows, seeds, render) => {
    const selected = [], used = new Set(), chats = new Map(); let chars = 0;
    const add = item => {
      if (!item || used.has(item.row.id) || selected.length >= limit) return;
      const value = render(item.row); if (chars + value.text.length > 6000) return;
      selected.push(value); used.add(item.row.id); chars += value.text.length;
      chats.set(item.row.chatId, (chats.get(item.row.chatId) || 0) + 1);
    };
    for (const seed of seeds) add(seed);
    const perChat = Math.max(2, Math.ceil(limit / 2));
    for (const item of rows) if ((chats.get(item.row.chatId) || 0) < perChat) add(item);
    for (const item of rows) add(item);
    return selected;
  };
  const newest = eventRows.slice().sort((a, b) => timestamp(b.row) - timestamp(a.row));
  const eventSeeds = [];
  if (queryTerms.length) eventSeeds.push(eventRows.find(x => relevance(x.row) > 0));
  eventSeeds.push(...newest.slice(0, Math.min(3, Math.max(1, Math.floor(limit / 3)))));
  eventSeeds.push(eventRows.find(x => people.has(x.row.actorId)));
  const memorySeeds = [memoryRows[0]];
  if (limit >= 3) memorySeeds.push(memoryRows.find(x => unfinished(x.row)), memoryRows.find(x => x.row.kind === 'relationship'));
  return {
    events: pick(eventRows, eventSeeds, e => ({ id: e.id, chatId: e.chatId, actorId: e.actorId, type: e.type,
      text: String(e.text || '').slice(0, 800), visibility: e.visibility, occurredAt: e.occurredAt,
      recordedAt: e.recordedAt, crossChat: e.chatId !== binding.chatId })),
    memories: pick(memoryRows, memorySeeds, m => ({ id: m.id, chatId: m.chatId, subjects: (m.subjects || []).slice(0, 12),
      text: String(m.text || '').slice(0, 700), kind: m.kind, status: m.status, importance: m.importance,
      emotion: m.emotion, visibility: m.visibility, evidenceIds: m.evidenceIds.slice(0, 20),
      recordedAt: m.recordedAt, lastMentionedAt: m.lastMentionedAt, crossChat: m.chatId !== binding.chatId }))
  };
}

// Extensions are owned by both the registering plugin and the bound agent scope.
export function createAgentExtensions() {
  const agents = new Map(), extensions = new Set(); let closed = false;
  const clean = callbacks => {
    const errors = [];
    for (const off of callbacks) try { off?.(); } catch (error) { errors.push(error); }
    if (errors.length) throw new AggregateError(errors, '记忆扩展清理失败');
  };
  const untrack = agent => {
    const record = agents.get(agent); if (!record) return;
    agents.delete(agent); const callbacks = [...record.cleanups.values()]; record.cleanups.clear(); clean(callbacks.reverse());
  };
  const mount = (extension, agent, record) => {
    if (record.cleanups.has(extension)) return;
    const off = extension(agent, copy(record.binding), { sync: record.sync });
    if (off !== undefined && typeof off !== 'function') throw Error('记忆扩展应返回清理函数');
    record.cleanups.set(extension, off);
  };
  const unregister = extension => {
    if (!extensions.delete(extension)) return;
    const callbacks = [];
    for (const record of agents.values()) { callbacks.push(record.cleanups.get(extension)); record.cleanups.delete(extension); }
    clean(callbacks.reverse());
  };
  return {
    track(agent, binding, sync) {
      if (closed) throw Error('记忆扩展已停止');
      if (agents.has(agent)) return;
      const record = { binding: copy(binding), sync: typeof sync === 'function' ? sync : () => {}, cleanups: new Map() };
      agents.set(agent, record);
      try {
        for (const extension of extensions) mount(extension, agent, record);
        agent.ctx?.effect?.(() => () => untrack(agent));
      } catch (error) { try { untrack(agent); } catch {} throw error; }
    },
    register(extension) {
      if (closed) throw Error('记忆扩展已停止');
      if (typeof extension !== 'function') throw Error('记忆扩展须为函数');
      if (extensions.has(extension)) throw Error('记忆扩展已注册');
      extensions.add(extension);
      try { for (const [agent, record] of agents) mount(extension, agent, record); }
      catch (error) { try { unregister(extension); } catch {} throw error; }
      return () => unregister(extension);
    },
    untrack,
    close() {
      if (closed) return; closed = true;
      const callbacks = [...agents.keys()].map(agent => () => untrack(agent)); extensions.clear(); clean(callbacks);
    }
  };
}
