import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {once} from 'node:events';
import {createSyncServer} from './server.mjs';
import {createSync,capture} from './client.js';

function memoryStorage(){const m=new Map();return {get length(){return m.size},key:i=>[...m.keys()][i],getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}}
const testDir=await mkdtemp(join(tmpdir(),'english-prep-e2e-'));
const token=randomBytes(32).toString('base64url'), key='english-prep-training-v1:cet6:test';
let server;
async function start(){server=createSyncServer({token,file:join(testDir,'state.json'),allowedOrigin:'https://test.example'});server.listen(0,'127.0.0.1');await once(server,'listening');return `http://127.0.0.1:${server.address().port}/api/sync`}
async function close(){await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))}
try {
 let url=await start();
 const request=async(method,secret,body)=>{const r=await fetch(url,{method,headers:{authorization:'Bearer '+secret,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});if(!r.ok){const e=Error('HTTP '+r.status);e.status=r.status;throw e}return r.json()};
 const a=memoryStorage(),b=memoryStorage();for(const s of [a,b])s.setItem('english-prep-sync-v1:token',token);
 a.setItem(key,JSON.stringify({words:{first:{stage:1}},drafts:{writing:'first draft'}}));
 let event;const ca=createSync({storage:a,request}),cb=createSync({storage:b,request,changed:value=>event=value});
 await ca.sync();await cb.sync();assert.deepEqual(capture(a),capture(b),'fresh device must pull from real HTTP server');
 const first=JSON.parse(a.getItem(key));first.words.second={stage:2};a.setItem(key,JSON.stringify(first));
 const second=JSON.parse(b.getItem(key));second.drafts.translation='translated';b.setItem(key,JSON.stringify(second));
 await ca.sync();await cb.sync();await ca.sync();assert.deepEqual(capture(a),capture(b),'disjoint changes must merge');
 const libraryKey='english-prep-training-v1:cet6:materials';
 a.setItem(libraryKey,JSON.stringify([{id:'froma',material:{title:'From A'}}]));
 b.setItem(libraryKey,JSON.stringify([{id:'fromb',material:{title:'From B'}}]));
 await ca.sync();await cb.sync();await ca.sync();
 assert.deepEqual(JSON.parse(a.getItem(libraryKey)).map(x=>x.id).sort(),['froma','fromb'],'concurrent material imports must both survive');
 assert.deepEqual(capture(a),capture(b),'material libraries must converge');
 const left=JSON.parse(a.getItem(key));left.drafts.writing='left';a.setItem(key,JSON.stringify(left));
 const right=JSON.parse(b.getItem(key));right.drafts.writing='right';b.setItem(key,JSON.stringify(right));
 await ca.sync();await cb.sync();assert.ok(event.conflict,'concurrent edits must surface a conflict');assert.equal(JSON.parse(b.getItem(key)).drafts.writing,'right');
 await cb.resolve('local');await ca.sync();assert.equal(JSON.parse(a.getItem(key)).drafts.writing,'right');
 await close();url=await start();const persisted=await request('GET',token);assert.equal(persisted.state[key].drafts.writing,'right','data must survive restart');
 const unauthorized=await fetch(url,{headers:{authorization:'Bearer wrong'}});assert.equal(unauthorized.status,401);
 const untrusted=await fetch(url,{headers:{authorization:'Bearer '+token,origin:'https://other.example'}});assert.equal(untrusted.status,403);
 console.log('PASS: real HTTP sync across isolated clients, disjoint merge, conflict resolution, restart persistence and access checks.');
} finally {if(server?.listening)await close();await rm(testDir,{recursive:true,force:true})}
