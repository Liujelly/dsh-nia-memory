import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function atomic(file, data) {
  const temp = file + '.' + randomUUID() + '.tmp';
  let fd;
  try {
    fd = fs.openSync(temp, 'wx', 0o600); fs.writeFileSync(fd, JSON.stringify(data, null, 2));
    fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined; fs.renameSync(temp, file);
  } finally { if (fd !== undefined) fs.closeSync(fd); if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}

function lockError(message) {
  return Object.assign(new Error('EEXIST: ' + message), { code: 'EEXIST' });
}
function acquireLock(file) {
  // All cooperating openers serialize the short acquire/reclaim operation. A crash
  // inside this operation leaves the guard for manual inspection, never lock stealing.
  const guard = file + '.acquiring';
  const guardFd = fs.openSync(guard, 'wx', 0o600);
  try {
    fs.writeFileSync(guardFd, JSON.stringify({ pid: process.pid, at: Date.now() }));
    if (fs.existsSync(file)) {
      let holder;
      try { holder = JSON.parse(fs.readFileSync(file, 'utf8')); }
      catch { throw lockError('记忆锁无法读取，保留原锁；请确认旧实例已停止后检查'); }
      if (!Number.isSafeInteger(holder?.pid) || holder.pid <= 0)
        throw lockError('记忆锁缺少有效进程信息，保留原锁');
      if (holder.pid === process.pid) throw lockError('当前进程已有记忆写入者，拒绝重复加载');
      let exited = false;
      try { process.kill(holder.pid, 0); }
      catch (error) { if (error.code === 'ESRCH') exited = true; }
      if (!exited) throw lockError(`记忆库由进程 ${holder.pid} 持有，或无法确认其已退出；保留原锁`);
      fs.unlinkSync(file);
    }
    const value = JSON.stringify({ pid: process.pid, at: Date.now(), token: randomUUID() });
    const fd = fs.openSync(file, 'wx', 0o600);
    try { fs.writeFileSync(fd, value); fs.fsyncSync(fd); }
    catch (error) { fs.unlinkSync(file); throw error; }
    finally { fs.closeSync(fd); }
    return value;
  } finally { fs.closeSync(guardFd); fs.unlinkSync(guard); }
}

export class Database {
  constructor(directory) {
    fs.mkdirSync(directory, { recursive: true }); this.file = path.join(directory, 'state.json');
    this.lock = path.join(directory, 'writer.lock'); this.closed = false;
    this.lockValue = acquireLock(this.lock);
    try {
      try { this.data = JSON.parse(fs.readFileSync(this.file, 'utf8')); }
      catch (e) { if (e.code !== 'ENOENT') throw e; this.data = { version: 1, revision: 0, enabled: true, bindings: {}, people: {}, events: {}, memories: {}, moods: {}, actions: {} }; }
      if (this.data.version !== 1 || !Number.isInteger(this.data.revision)) throw new Error('记忆数据版本不支持，拒绝覆盖');
      for (const key of ['bindings', 'people', 'events', 'memories', 'moods', 'actions'])
        if (!this.data[key] || typeof this.data[key] !== 'object' || Array.isArray(this.data[key])) throw new Error('记忆数据结构损坏，拒绝覆盖');
    } catch (e) { this.close(); throw e; }
  }
  ownsLock() {
    try { return fs.readFileSync(this.lock, 'utf8') === this.lockValue; }
    catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  }
  transaction(change) {
    if (this.closed) throw new Error('记忆服务已停止');
    if (!this.ownsLock()) throw new Error('记忆写入锁已失效，拒绝继续写入');
    const next = structuredClone(this.data); const result = change(next);
    if (result?.then) throw new Error('记忆事务必须同步，不能跨模型等待');
    next.revision++;
    if (fs.existsSync(this.file)) {
      fs.copyFileSync(this.file, this.file + '.bak');
      const dir=path.join(path.dirname(this.file),'daily-backups');fs.mkdirSync(dir,{recursive:true});
      const date=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'}),today=path.join(dir,date+'.json');
      if(!fs.existsSync(today))fs.copyFileSync(this.file,today);
      const days=fs.readdirSync(dir).filter(n=>/^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
      for(const name of days.slice(0,-14))fs.unlinkSync(path.join(dir,name));
    }
    atomic(this.file, next); this.data = next;
    return structuredClone(result);
  }
  close() { if (this.closed) return; this.closed = true; if (this.ownsLock()) fs.unlinkSync(this.lock); }
}
