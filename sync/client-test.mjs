import assert from 'node:assert/strict';
import fs from 'node:fs';
const merge='data:text/javascript;base64,'+fs.readFileSync('sync/merge.js').toString('base64');
const src=fs.readFileSync('sync/client.js','utf8').replace("'./merge.js'",JSON.stringify(merge));
const {createSync,capture}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
function storage(){const m=new Map();return {get length(){return m.size},key:i=>[...m.keys()][i],getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}}
let state=null, revision=null;const request=async(method,token,body)=>{assert.equal(token,'x'.repeat(43));if(method==='GET')return {state:structuredClone(state),revision};if(body.revision!==revision){const e=Error('conflict');e.status=409;throw e}state=structuredClone(body.state);revision='r'+(Number(revision?.slice(1)||0)+1);return {state,revision}};
const a=storage(),b=storage();for(const s of [a,b])s.setItem('english-prep-sync-v1:token','x'.repeat(43));a.setItem('english-prep-training-v1:cet6:x',JSON.stringify({words:{one:1},drafts:{}}));let changes;const ca=createSync({storage:a,request}),cb=createSync({storage:b,request,changed:v=>changes=v});await ca.sync();await cb.sync();assert.deepEqual(capture(a),capture(b));
const k='english-prep-training-v1:cet6:x';a.setItem(k,JSON.stringify({words:{one:2},drafts:{}}));b.setItem(k,JSON.stringify({words:{one:3},drafts:{}}));await ca.sync();await cb.sync();assert.ok(changes.conflict);assert.equal(JSON.parse(b.getItem(k)).words.one,3);await cb.resolve('local');assert.equal(JSON.parse(b.getItem(k)).words.one,3);await ca.sync();assert.equal(JSON.parse(a.getItem(k)).words.one,3); // resolved cloud value is applied when local is unchanged
console.log('PASS: device sync, conflict detection and no silent replacement');
// A local edit arriving while GET is pending must not be overwritten.
const c=storage();c.setItem('english-prep-sync-v1:token','x'.repeat(43));c.setItem(k,JSON.stringify({words:{one:11},drafts:{}}));let release;let first=true;const delayed=async(...args)=>{if(first&&args[0]==='GET'){first=false;await new Promise(r=>release=r)}return request(...args)};let event;const cc=createSync({storage:c,request:delayed,changed:v=>event=v});const pending=cc.sync();await Promise.resolve();c.setItem(k,JSON.stringify({words:{one:12},drafts:{}}));release();await pending;assert.equal(JSON.parse(c.getItem(k)).words.one,12);assert.ok(event.conflict);
// Conflict dialog cannot apply a stale choice over a new edit.
c.setItem(k,JSON.stringify({words:{one:13},drafts:{}}));await cc.resolve('remote');assert.equal(JSON.parse(c.getItem(k)).words.one,13);
console.log('PASS: edits during sync and stale conflict resolution are preserved');
// Independent changes on two existing devices merge.
const d=storage();d.setItem('english-prep-sync-v1:token','x'.repeat(43));const cd=createSync({storage:d,request});await cd.sync();let da=JSON.parse(a.getItem(k));da.drafts.writing='essay';a.setItem(k,JSON.stringify(da));let dd=JSON.parse(d.getItem(k));dd.words.two=4;d.setItem(k,JSON.stringify(dd));await ca.sync();await cd.sync();const combined=JSON.parse(d.getItem(k));assert.equal(combined.drafts.writing,'essay');assert.equal(combined.words.two,4);
console.log('PASS: disjoint cross-device edits merge');

// Replacing a key during a pending request must never apply the old workspace.
const switched=storage(),oldToken='o'.repeat(43),newToken='n'.repeat(43);
switched.setItem('english-prep-sync-v1:token',oldToken);let releaseOld,completeNew;
const newFinished=new Promise(resolve=>completeNew=resolve);
const switchRequest=async(method,token,body)=>{
 if(token===oldToken){await new Promise(resolve=>releaseOld=resolve);return {revision:'old',state:{[k]:{drafts:{writing:'old workspace'},words:{}}}}}
 assert.equal(token,newToken);
 if(method==='GET'){completeNew();return {revision:'new',state:{[k]:{drafts:{writing:'new workspace'},words:{}}}};}
 return {revision:'new',state:body.state};
};
const switchClient=createSync({storage:switched,request:switchRequest});const oldRun=switchClient.sync();await Promise.resolve();await switchClient.connect(newToken);releaseOld();await oldRun;await newFinished;await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(JSON.parse(switched.getItem(k)).drafts.writing,'new workspace');assert.equal(switched.getItem('english-prep-sync-v1:token'),newToken);
console.log('PASS: switching workspace during a pending sync does not apply stale data.');
// A conflict cleared by a later sync must be dismissed in the interface.
const transient=storage();transient.setItem('english-prep-sync-v1:token','x'.repeat(43));transient.setItem(k,JSON.stringify({words:{one:901}}));let lastEvent;const ct=createSync({storage:transient,request,changed:v=>lastEvent=v});await ct.sync();assert.ok(lastEvent.conflict);transient.removeItem(k);await ct.sync();assert.equal(lastEvent.conflict,null);
// A hung network request aborts and reports a retryable error rather than blocking forever.
const {httpRequest}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));const savedFetch=globalThis.fetch,savedTimer=globalThis.setTimeout,savedClear=globalThis.clearTimeout;try{globalThis.setTimeout=fn=>{queueMicrotask(fn);return 1};globalThis.clearTimeout=()=>{};globalThis.fetch=(_url,opts)=>new Promise((_resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(Object.assign(Error('aborted'),{name:'AbortError'}))));await assert.rejects(httpRequest('GET','x'.repeat(43)),/同步超时/)}finally{globalThis.fetch=savedFetch;globalThis.setTimeout=savedTimer;globalThis.clearTimeout=savedClear}console.log('PASS: stale conflict cleared and network timeout is retryable.');

const libraryKey='english-prep-training-v1:cet6:materials',libA=storage(),libB=storage();for(const store of [libA,libB])store.setItem('english-prep-sync-v1:token','x'.repeat(43));let libState=null,libRevision=null;const libRequest=async(method,_token,body)=>{if(method==='GET')return {state:structuredClone(libState),revision:libRevision};libState=structuredClone(body.state);libRevision='one';return {state:libState,revision:libRevision}};libA.setItem(libraryKey,JSON.stringify([{id:'abc123',material:{title:'Example'}}]));await createSync({storage:libA,request:libRequest}).sync();await createSync({storage:libB,request:libRequest}).sync();assert.equal(JSON.parse(libB.getItem(libraryKey))[0].material.title,'Example');console.log('PASS: imported material library syncs between devices.');
