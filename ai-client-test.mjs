import assert from 'node:assert/strict';import fs from 'node:fs';
const {askAI}=await import('data:text/javascript;base64,'+fs.readFileSync('ai-client.js').toString('base64'));
let calls=0;const fetcher=async (url,options)=>{calls++;assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');assert.equal(options.headers.authorization,'Bearer demo');return {ok:true,json:async()=>({choices:[{message:{content:'Hello'}}]})}};
assert.equal(await askAI({key:'demo',model:'example/model',messages:[],fetcher}),'Hello');assert.equal(calls,1);
await assert.rejects(askAI({key:'',model:'m',messages:[],fetcher}));
await assert.rejects(askAI({key:'demo',model:'m',messages:[],fetcher:async()=>({ok:false,status:401})}),/401/);
console.log('PASS: optional AI provider request and failure handling.');

await assert.rejects(askAI({key:'demo',model:'m',messages:[],fetcher:async()=>({ok:false,status:403,json:async()=>({error:{message:'Country or region not supported'}})})}),/地区/);

await assert.rejects(askAI({key:'demo',model:'m',messages:[],endpoint:'http://insecure.example/v1',fetcher}),/HTTPS/);let sent='';await askAI({key:'demo',model:'m',messages:[],endpoint:'https://provider.example/v1/chat/completions',fetcher:async(url)=>{sent=url;return {ok:true,json:async()=>({choices:[{message:{content:'ok'}}]})}}});assert.equal(sent,'https://provider.example/v1/chat/completions');
