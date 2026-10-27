import { tokenize, retrieve, policyDefaults } from './retrieval.js';
import { createHash, randomUUID } from 'node:crypto';
const copy = value => structuredClone(value);
const kinds = new Set(['fact', 'preference', 'event', 'plan', 'project', 'relationship']);
const states = new Set(['reported', 'observed', 'inferred', 'planned', 'attempted', 'completed', 'failed', 'cancelled', 'fictional']);
export function identity(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9:_-]{1,160}$/.test(value) || ['__proto__', 'constructor', 'prototype'].includes(value)) throw new Error('身份标识无效'); return value;
}
const eventKey = (persona, id) => identity(persona) + '/' + identity(id);
export const words=tokenize;
export class Memory {
  constructor(db) { this.db = db; this.apiVersion = 1; this.traces = new Map(); }
  active() { if (this.db.closed || !this.db.data.enabled) throw new Error('记忆服务已暂停或停止'); }
  binding(sessionId) { this.active(); const b = this.db.data.bindings[sessionId]; if (!b || b.paused) throw new Error('此会话尚未绑定或已暂停'); return copy(b); }
  bind(value) {
    this.active();
    const sessionId = identity(value.sessionId), old = this.db.data.bindings[sessionId];
    const characterName = value.characterName ?? old?.characterName ?? '';
    if (typeof characterName !== 'string' || characterName.length > 60 || /[\x00-\x1f]/.test(characterName)) throw new Error('角色显示名称无效');
    const b = { sessionId, personaId: identity(value.personaId), chatId: identity(value.chatId),
      type: value.type === 'group' ? 'group' : 'private', actorIds: [...new Set((value.actorIds || []).map(identity))],
      ownerActorId: value.ownerActorId ? identity(value.ownerActorId) : '', preview: value.preview === true, transport: String(value.transport || 'local'), paused: false };
    if (characterName.trim()) b.characterName = characterName.trim();
    if (old && (old.personaId !== b.personaId || old.chatId !== b.chatId)) throw new Error('已绑定会话不能静默换人格或聊天');
    if (old && old.preview !== b.preview) throw new Error('预演和正式模式需要不同会话，以免历史混用');
    b.paused = old?.paused || false;
    if (JSON.stringify(old) === JSON.stringify(b)) return copy(old);
    return this.db.transaction(d => { d.bindings[b.sessionId] = b; return b; });
  }
  people(personaId, people) {
    this.active(); identity(personaId);
    const updates = people.map(p => {
      const id = identity(p.id), key = personaId + '/' + id, old = this.db.data.people[key];
      return { key, next: { ...old, id, personaId, name: String(p.name ?? old?.name ?? '').slice(0, 120), alias: String(p.alias ?? old?.alias ?? '').slice(0, 60) } };
    }).filter(p => JSON.stringify(this.db.data.people[p.key]) !== JSON.stringify(p.next));
    if (!updates.length) return true;
    return this.db.transaction(d => { for (const p of updates) d.people[p.key] = p.next; return true; });
  }
  contacts(sessionId) { const b = this.binding(sessionId); return copy(Object.values(this.db.data.people).filter(p => p.personaId === b.personaId)); }
  ingest(sessionId, events) {
    const b = this.binding(sessionId);
    return this.db.transaction(d => events.map(e => {
      const id = identity(e.id), key = eventKey(b.personaId, id), actorId = identity(e.actorId);
      if (!b.actorIds.includes(actorId)) throw new Error('事件发言者不在可信聊天参与者中');
      const old = d.events[key];
      if (old) { if (old.chatId !== b.chatId || old.actorId !== actorId || old.text !== String(e.text).slice(0, 16000)) throw new Error('事件 ID 与已保存内容冲突'); return old.id; }
      d.events[key] = { id, personaId: b.personaId, chatId: b.chatId, actorId, type: 'message', text: String(e.text).slice(0, 16000),
        occurredAt: Number.isFinite(e.occurredAt) ? e.occurredAt : null, recordedAt: Date.now(), visibility: 'internal', preview: b.preview,
        replyTo: e.replyTo ? identity(e.replyTo) : null };
      return id;
    }));
  }
  events(sessionId, ids, targetChatId) {
    const b = this.binding(sessionId);
    return ids.map(id => {
      const e = this.db.data.events[eventKey(b.personaId, id)]; if (!e) throw new Error('来源事件不存在');
      if (e.visibility === 'private' && e.chatId !== (targetChatId || b.chatId)) throw new Error('该事件仅限原聊天');
      if (!b.preview && e.preview) throw new Error('预演事件不能作为正式经历传递');
      return copy(e);
    });
  }
  remember(sessionId, args) {
    const b = this.binding(sessionId);
    const text = String(args.text || '').trim(); if (!text || text.length > 1600) throw new Error('记忆正文应为 1–1600 字');
    if (!kinds.has(args.kind) || !states.has(args.status)) throw new Error('记忆类型或状态无效');
    const subjects = [...new Set((args.subjects || []).map(identity))];
    if (!subjects.length || subjects.some(id => id !== 'self' && !this.db.data.people[b.personaId + '/' + id])) throw new Error('须指定已识别人物或 self');
    const evidenceIds = [...new Set((args.evidenceIds || []).map(identity))];
    if (!evidenceIds.length) throw new Error('记忆需要实际来源事件');
    const evidence = this.events(sessionId, evidenceIds);
    const visibility = args.visibility || 'internal';
    if (!['shared', 'internal', 'private'].includes(visibility)) throw new Error('记忆范围无效');
    if (visibility !== 'private' && evidence.some(e => e.visibility === 'private')) throw new Error('不能扩大私密来源的范围');
    if (evidence.some(e => e.visibility === 'private' && e.chatId !== b.chatId)) throw new Error('私密来源只能在原聊天提炼');
    // User claims are not tool execution receipts. Completion requires an observed outbound event.
    if (['observed', 'completed'].includes(args.status) && evidence.every(e => !['tool_result','outbound'].includes(e.type))) throw new Error('聊天自述请记为 reported；不能据此宣称已观察或执行完成');
    if (args.status === 'completed' && evidence.filter(e => ['tool_result','outbound'].includes(e.type)).every(e => e.failed)) throw new Error('失败回执不能证明已完成');
    const attribute = String(args.attribute || '').trim().slice(0, 100);
    const importance = Number(args.importance ?? 0.5); if (!Number.isFinite(importance) || importance < 0 || importance > 1) throw new Error('重要度范围 0–1');
    const emotion=Number(args.emotion??0);if(!Number.isFinite(emotion)||emotion<0||emotion>1)throw Error('记忆情绪强度范围 0–1');
    if (visibility === 'private' && evidence.some(e => e.chatId !== b.chatId)) throw new Error('私密记忆须在来源聊天整理');
    const fingerprint = createHash('sha256').update(JSON.stringify([b.personaId, subjects.slice().sort(), text, args.kind, args.status, b.preview, visibility, visibility === 'private' ? b.chatId : '', attribute])).digest('hex');
    const result = this.db.transaction(d => {
      if (visibility === 'private') {
        for (const id of evidenceIds) d.events[eventKey(b.personaId, id)].visibility = 'private';
        for (const m of Object.values(d.memories)) if (m.personaId === b.personaId && m.evidenceIds.some(id => evidenceIds.includes(id))) m.visibility = 'private';
      }
      const same = Object.values(d.memories).find(m => m.fingerprint === fingerprint && !m.deletedAt && !m.supersededBy);
      if (same) { same.lastMentionedAt = Date.now(); same.evidenceIds = [...new Set([...same.evidenceIds, ...evidenceIds])]; return { id: same.id, reinforced: true }; }
      const quota={...policyDefaults,...d.policy}.dailyQuota;
      const day=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'});
      if(quota&&Object.values(d.memories).filter(m=>m.personaId===b.personaId&&m.preview===b.preview&&!m.managed&&new Date(m.recordedAt).toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'})===day).length>=quota)throw Error('今日自主记忆条数已到设置上限');
      const id = 'mem-' + randomUUID();
      if (args.replaces) {
        const old = d.memories[args.replaces];
        if (!old || old.personaId !== b.personaId || old.preview !== b.preview || old.subjects.slice().sort().join() !== subjects.slice().sort().join() || !attribute || old.attribute !== attribute) throw new Error('纠错只能替代同一人物的同一属性');
        if (old.visibility === 'private' && (visibility !== 'private' || old.chatId !== b.chatId)) throw new Error('不能通过纠错扩大私密范围');
        old.supersededBy = id;
      }
      d.memories[id] = { id, personaId: b.personaId, chatId: b.chatId, subjects, text, kind: args.kind, status: args.status,
        importance, emotion, attribute, visibility, evidenceIds, occurredAt: evidence[0].occurredAt, recordedAt: Date.now(), lastMentionedAt: Date.now(), fingerprint, preview: b.preview, supersededBy: null, deletedAt: null };
      return { id, saved: true };
    });
    if(result.saved&&this.onRemember)this.onRemember(sessionId,result.id);
    return result;
  }
  recall(sessionId, query = '', subject, limit) {
    const b=this.binding(sessionId);if(subject)identity(subject);
    const candidates=Object.values(this.db.data.memories).filter(m=>{
      if(m.personaId!==b.personaId||m.deletedAt||m.supersededBy||m.preview!==b.preview)return false;
      if(m.visibility==='private'&&m.chatId!==b.chatId||subject&&!m.subjects.includes(subject))return false;
      return m.evidenceIds.every(id=>{const e=this.db.data.events[eventKey(b.personaId,id)];return e&&e.preview===b.preview&&(e.visibility!=='private'||e.chatId===b.chatId);});
    });
    const result=retrieve(candidates,b,query,this.db.data.policy,limit);
    this.traces.set(sessionId,{...result.trace,sessionId});if(this.traces.size>100)this.traces.delete(this.traces.keys().next().value);
    return result.selected;
  }
  context(sessionId) {
    const b = this.binding(sessionId);
    const recent = Object.values(this.db.data.events).filter(e => e.personaId === b.personaId && e.chatId === b.chatId && (b.preview || !e.preview) && e.type === 'message').slice(-3);
    return { binding: b, identity: { source: 'host-configuration', configuredUser: b.ownerActorId || null },
      people: this.contacts(sessionId).filter(p => b.actorIds.includes(p.id) || p.id === b.ownerActorId).map(p=>({...p,isConfiguredUser:p.id===b.ownerActorId})),
      memories: this.recall(sessionId, recent.map(e => e.text).join(' ')) };
  }
  recent(sessionId, { chatId, subject, query = '', limit = 12, before } = {}) {
    const b = this.binding(sessionId);
    if (chatId) identity(chatId); if (subject) identity(subject);
    if (before !== undefined && (!Number.isFinite(before) || before < 0)) throw new Error('before 应为有效毫秒时间戳');
    const q = String(query).trim().toLowerCase(), terms=words(q);
    const rows=Object.values(this.db.data.events).filter(e=>{
      if(e.personaId!==b.personaId || e.preview!==b.preview) return false;
      if(e.visibility==='private' && e.chatId!==b.chatId) return false;
      if(chatId && e.chatId!==chatId || subject && e.actorId!==subject) return false;
      if(before!==undefined && (e.occurredAt??e.recordedAt)>=before) return false;
      const text=String(e.text).toLowerCase();
      return !q || text.includes(q) || [...terms].some(t=>text.includes(t));
    }).sort((a,b)=>(b.occurredAt??b.recordedAt)-(a.occurredAt??a.recordedAt));
    const count=Math.max(1,Math.min(30,Math.trunc(Number(limit)||12)));
    let size=0;const result=[];
    for(const e of rows){
      const text=String(e.text).slice(0,1800);if(result.length>=count || size+text.length>12000)break;
      size+=text.length;result.push({id:e.id,chatId:e.chatId,actorId:e.actorId,type:e.type,text,visibility:e.visibility,
        occurredAt:e.occurredAt,recordedAt:e.recordedAt,crossChat:e.chatId!==b.chatId});
    }
    return result.reverse();
  }
  outbound(sessionId, { id, text, status, action, preview }) {
    const b = this.binding(sessionId), key = eventKey(b.personaId, id);
    return this.db.transaction(d => {
      d.actions[key] = { id, personaId: b.personaId, chatId: b.chatId, text, status, action, preview, at: Date.now() };
      if (status === 'confirmed' && !preview && !d.events[key]) d.events[key] = { id, personaId: b.personaId, chatId: b.chatId, actorId: 'self', type: 'outbound', text: String(text).slice(0, 16000), visibility: 'internal', occurredAt: Date.now(), recordedAt: Date.now(), preview: false };
      return true;
    });
  }
  observation(sessionId, { id, name, text, failed, occurredAt }) {
    const b = this.binding(sessionId), key = eventKey(b.personaId, id);
    // Called only by the host adapter after reading actual persisted tool results.
    if (this.db.data.events[key]) return id;
    return this.db.transaction(d => {
      d.events[key] = { id, personaId: b.personaId, chatId: b.chatId, actorId: 'self', type: 'tool_result',
        tool: String(name).slice(0, 120), text: String(text).slice(0, 4000), failed: !!failed,
        occurredAt: Number.isFinite(occurredAt) ? occurredAt : null, recordedAt: Date.now(), visibility: 'private', preview: b.preview };
      return id;
    });
  }
  moodKey(sessionId) { const b = this.binding(sessionId); return b.personaId + (b.preview ? ':preview' : ':live'); }
  mood(sessionId) { return copy(this.db.data.moods[this.moodKey(sessionId)] || null); }
  commitMood(sessionId, expectedVersion, state) {
    const key = this.moodKey(sessionId);
    return this.db.transaction(d => {
      if ((d.moods[key]?.version || 0) !== expectedVersion) throw new Error('情绪版本已改变');
      d.moods[key] = copy(state); d.moods[key].version = expectedVersion + 1; return d.moods[key];
    });
  }
  edit(id, action) {
    this.active();
    return this.db.transaction(d => {
      const m = d.memories[id]; if (!m) throw new Error('记忆不存在');
      if (action === 'delete') m.deletedAt = Date.now();
      else if (action === 'restore') m.deletedAt = null;
      else if (action === 'private') {
        m.visibility = 'private';
        for (const eid of m.evidenceIds) { const e = d.events[eventKey(m.personaId, eid)]; if (e) e.visibility = 'private'; }
        // Also restrict summaries with the same sources; a derived summary must not bypass this edit.
        for (const other of Object.values(d.memories)) if (other.personaId === m.personaId && other.evidenceIds.some(e => m.evidenceIds.includes(e))) other.visibility = 'private';
      } else throw new Error('管理操作无效'); return { ok: true };
    });
  }
}
