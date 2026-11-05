import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
assert.equal(manifest.start_url,'./exam-setup.html');
for(const page of ['index.html','exam-setup.html']) assert.match(fs.readFileSync(page,'utf8'),/rel="icon"[^>]+icons\/icon-192\.png/);
for(const icon of [...manifest.icons,{src:'./icons/icon-180.png'}]) {const b=fs.readFileSync(icon.src);assert.equal(b.readUInt32BE(0),0x89504e47);const size=Number(icon.src.match(/icon-(\d+)/)[1]);assert.equal(b.readUInt32BE(16),size);assert.equal(b.readUInt32BE(20),size)}
const handlers={}, data=new Map(), deleted=[];
const cache={async addAll(urls){for(const url of urls)data.set(url,new Response('offline'))},async put(url,response){data.set(typeof url==='string'?url:url.url,response)},async match(url){return data.get(url)?.clone()}};
const caches={async open(){return cache},async keys(){return ['unrelated','english-prep-shell-old','english-prep-shell-v6']},async delete(key){deleted.push(key)}};
let fail=false;
const self={registration:{scope:'https://example.test/sub/'},location:{origin:'https://example.test'},clients:{async claim(){}},async skipWaiting(){},addEventListener(type,fn){handlers[type]=fn}};
const ctx={self,caches,URL,Response,Request,fetch:async()=>{if(fail)throw Error('offline');return new Response('online')}};
vm.runInNewContext(fs.readFileSync('sw.js','utf8'),ctx);
async function lifecycle(name){let promise;handlers[name]({waitUntil(p){promise=p}});await promise}
await lifecycle('install');await lifecycle('activate');assert.deepEqual(deleted,['english-prep-shell-old']);assert.ok(!data.has('https://example.test/sub/dictionary/chunks/a.js'));
function dispatch(req){let pending;handlers.fetch({request:req,respondWith(v){pending=v}});return pending}
assert.equal(dispatch(new Request('https://example.test/sub/api/sync')),undefined);
assert.equal(dispatch(new Request('https://other.test/sub/exam-setup.html')),undefined);
assert.equal(dispatch(new Request('https://example.test/sub/exam-setup.html',{headers:{authorization:'Bearer secret'}})),undefined);
let response=await dispatch(new Request('https://example.test/sub/exam-setup.html'));assert.equal(await response.text(),'online');
response=await dispatch(new Request('https://example.test/sub/voices/us/assess.wav'));assert.equal(await response.text(),'online');assert.ok(await cache.match('https://example.test/sub/voices/us/assess.wav'));
response=await dispatch(new Request('https://example.test/sub/dictionary/chunks/a.js'));assert.equal(await response.text(),'online');assert.ok(await cache.match('https://example.test/sub/dictionary/chunks/a.js'));
fail=true;response=await dispatch(new Request('https://example.test/sub/exam-setup.html'));assert.equal(await response.text(),'online');
response=await dispatch(new Request('https://example.test/sub/voices/us/assess.wav'));assert.equal(await response.text(),'online');
console.log('PASS: install manifest, icons, cache fallback and private/API exclusions.');
