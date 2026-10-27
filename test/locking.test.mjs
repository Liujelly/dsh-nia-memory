import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { Database } from '../lib/store.js';

function fixture(t) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nia-lock-test-'));
  t.after(()=>{assert.equal(path.dirname(dir),os.tmpdir());assert.ok(path.basename(dir).startsWith('nia-lock-test-'));fs.rmSync(dir,{recursive:true});});
  return {dir,lock:path.join(dir,'writer.lock')};
}
test('same-process duplicate open cannot replace the writer or release its lock',t=>{
  const {dir,lock}=fixture(t),db=new Database(dir);t.after(()=>db.close());
  const original=fs.readFileSync(lock,'utf8');
  assert.throws(()=>new Database(dir),{code:'EEXIST'});
  assert.equal(fs.readFileSync(lock,'utf8'),original);
  db.transaction(d=>{d.events.kept={text:'retained'};});
  assert.equal(JSON.parse(fs.readFileSync(db.file,'utf8')).events.kept.text,'retained');
});
test('malformed locks, invalid owners and interrupted acquisition guards remain untouched',t=>{
  const {dir,lock}=fixture(t);
  for(const value of ['{broken','{}','{"pid":null}','{"pid":-1}','{"pid":"123"}']) {
    fs.writeFileSync(lock,value);assert.throws(()=>new Database(dir),{code:'EEXIST'});
    assert.equal(fs.readFileSync(lock,'utf8'),value);
  }
  fs.writeFileSync(lock+'.acquiring','interrupted');
  assert.throws(()=>new Database(dir),{code:'EEXIST'});
  assert.equal(fs.readFileSync(lock+'.acquiring','utf8'),'interrupted');
});
test('only ESRCH proves an exited holder; permission and unexpected probe errors preserve the lock',t=>{
  const {dir,lock}=fixture(t),kill=process.kill;
  try {
    for(const code of ['EPERM','EACCES','EINVAL']) {
      const value=JSON.stringify({pid:12345678});fs.writeFileSync(lock,value);
      process.kill=()=>{throw Object.assign(new Error('probe unavailable'),{code});};
      assert.throws(()=>new Database(dir),{code:'EEXIST'});assert.equal(fs.readFileSync(lock,'utf8'),value);
    }
    process.kill=()=>{throw Object.assign(new Error('gone'),{code:'ESRCH'});};
    const db=new Database(dir);db.close();assert.equal(fs.existsSync(lock),false);
  } finally {process.kill=kill;}
});
test('lost ownership blocks writes and close never deletes the replacement lock',t=>{
  const {dir,lock}=fixture(t),db=new Database(dir);
  const replacement=JSON.stringify({pid:process.pid,token:'new-owner'});fs.writeFileSync(lock,replacement);
  assert.throws(()=>db.transaction(d=>{d.enabled=false;}),/锁已失效/);
  db.close();assert.equal(fs.readFileSync(lock,'utf8'),replacement);assert.equal(db.data.enabled,true);
});
test('concurrent processes reclaim a dead holder with exactly one writer',async t=>{
  const {dir,lock}=fixture(t);
  const exited=spawnSync(process.execPath,['-e',''],{windowsHide:true});assert.equal(exited.status,0);
  fs.writeFileSync(lock,JSON.stringify({pid:exited.pid,at:0}));
  const url=new URL('../lib/store.js',import.meta.url).href;
  const source=`import {Database} from ${JSON.stringify(url)};try{const db=new Database(process.argv[1]);console.log('claimed');process.stdin.once('data',()=>{db.close();process.exit(0);});}catch(e){if(e.code!=='EEXIST'){console.error(e);process.exit(2);}console.log('blocked');}`;
  const children=[];
  try {
    const results=await Promise.all([0,1].map(()=>new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,['--input-type=module','-e',source,dir],{windowsHide:true});children.push(child);
      let output='';child.stdout.on('data',chunk=>{output+=chunk;if(output.includes('\n'))resolve(output.trim());});
      child.on('error',reject);child.on('exit',code=>{if(code&&!output)reject(Error('child exit '+code));});
    })));
    assert.deepEqual(results.sort(),['blocked','claimed']);
  } finally {
    await Promise.all(children.map(child=>new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);child.stdin.end('close');})));
  }
});
