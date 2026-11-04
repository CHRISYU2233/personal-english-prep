import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {createSyncServer} from './server.mjs';

test('auth, safe validation and simultaneous writes do not overwrite each other',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'prep-sync-test-'));
  const token=randomBytes(32).toString('base64url');
  const server=createSyncServer({token,file:join(dir,'state.json'),allowedOrigin:'https://example.test'});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/api/sync`,headers={authorization:'Bearer '+token,'content-type':'application/json'};
  try {
    assert.equal((await fetch(url)).status,401);
    assert.equal((await fetch(url,{headers:{...headers,origin:'https://evil.test'}})).status,403);
    let read=await fetch(url,{headers}).then(r=>r.json());assert.equal(read.revision,null);
    const put=state=>fetch(url,{method:'PUT',headers,body:JSON.stringify({revision:null,state})});
    const replies=await Promise.all([put({words:{a:'done'}}),put({words:{b:'done'}})]);
    assert.deepEqual(replies.map(x=>x.status).sort(),[200,409]);
    const conflict=await replies.find(x=>x.status===409).json();
    const current=await fetch(url,{headers}).then(r=>r.json());assert.equal(conflict.revision,current.revision);
    const update=await fetch(url,{method:'PUT',headers,body:JSON.stringify({revision:current.revision,state:{words:{...current.state.words,c:'done'}}})});assert.equal(update.status,200);
    const dangerous=await fetch(url,{method:'PUT',headers,body:'{"revision":null,"state":{"__proto__":{"x":1}}}'});assert.equal(dangerous.status,400);
    assert.equal((await fetch(url,{headers}).then(r=>r.json())).state.words.c,'done');
  } finally {await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true})}
});
