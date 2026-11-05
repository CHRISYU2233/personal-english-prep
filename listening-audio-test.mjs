import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('listening-audio.js','utf8');
const {recordingKey,getRecording,saveRecording,deleteRecording}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

function fakeIndexedDB(){
  const values=new Map();let closes=0;
  const db={
    objectStoreNames:{contains:()=>true},
    createObjectStore(){},
    close(){closes++},
    transaction(_name,mode){
      const tx={error:null};
      tx.objectStore=()=>({
        get(key){const request={result:undefined};queueMicrotask(()=>{request.result=values.get(key);request.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.())});return request},
        put(blob,key){const request={result:key};queueMicrotask(()=>{if(mode!=='readwrite'){request.error=Error('readonly');request.onerror?.();return}values.set(key,blob);request.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.())});return request},
        delete(key){const request={result:undefined};queueMicrotask(()=>{values.delete(key);request.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.())});return request}
      });
      return tx;
    }
  };
  return {factory:{open(){const request={result:db};queueMicrotask(()=>request.onsuccess?.());return request}},values,get closes(){return closes}};
}

const fake=fakeIndexedDB(),key=recordingKey('cet6','2025-12-1','fallback');
assert.equal(key,'cet6:2025-12-1');
assert.equal(recordingKey('cet6','', 'cet6:paper-a'),'cet6:paper-a');
const blob=new Blob(['audio'],{type:'audio/wav'});
await saveRecording(key,blob,fake.factory);
const loaded=await getRecording(key,fake.factory);
assert.equal(await loaded.text(),'audio');
await deleteRecording(key,fake.factory);
assert.equal(await getRecording(key,fake.factory),undefined);
assert.equal(fake.closes,4);
await assert.rejects(getRecording('x',null),/不支持本机音频保存/);
console.log('PASS: listening recordings round-trip in IndexedDB and unsupported storage fails safely.');
