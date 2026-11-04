import assert from 'node:assert/strict';
import {mkdtemp,readFile,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawnSync} from 'node:child_process';
import https from 'node:https';import http from 'node:http';import {once} from 'node:events';import {randomBytes} from 'node:crypto';import {createSyncServer} from './server.mjs';
// This checks an HTTPS reverse-proxy shape with a temporary certificate. It is
// not a substitute for testing a real host, certificate chain or mobile device.
const bin=process.env.SYNC_TEST_OPENSSL || 'openssl';const version=spawnSync(bin,['version'],{stdio:'ignore'});if(version.error){console.log('SKIP: openssl unavailable for HTTPS test');process.exit(0)}
const dir=await mkdtemp(join(tmpdir(),'english-prep-tls-')),key=join(dir,'key.pem'),cert=join(dir,'cert.pem'),data=join(dir,'state.json');let backend,proxy;
try{
 const generated=spawnSync(bin,['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1'],{stdio:'ignore'});assert.equal(generated.status,0,'certificate generation failed');
 const token=randomBytes(32).toString('base64url'),publicOrigin='https://127.0.0.1';backend=createSyncServer({token,file:data,allowedOrigin:publicOrigin});backend.listen(0,'127.0.0.1');await once(backend,'listening');
 proxy=https.createServer({key:await readFile(key),cert:await readFile(cert)},(req,res)=>{const upstream=http.request({hostname:'127.0.0.1',port:backend.address().port,path:req.url,method:req.method,headers:req.headers},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res)});upstream.on('error',()=>{res.statusCode=502;res.end()});req.pipe(upstream)});proxy.listen(0,'127.0.0.1');await once(proxy,'listening');
 const call=(method,body,authorization=token)=>new Promise((resolve,reject)=>{const req=https.request({hostname:'127.0.0.1',port:proxy.address().port,path:'/api/sync',method,ca:awaitCert,headers:{authorization:'Bearer '+authorization,origin:publicOrigin,...(body?{'content-type':'application/json'}:{})}},res=>{let text='';res.on('data',x=>text+=x);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(text)}))});req.on('error',reject);if(body)req.write(JSON.stringify(body));req.end()});
 const awaitCert=await readFile(cert);let reply=await call('PUT',{revision:null,state:{'english-prep-training-v1:cet6:test':{drafts:{writing:'practice'}}}});assert.equal(reply.status,200);reply=await call('GET');assert.equal(reply.body.state['english-prep-training-v1:cet6:test'].drafts.writing,'practice');assert.equal((await call('GET',undefined,'bad')).status,401);
 console.log('PASS: authenticated HTTPS reverse proxy and certificate verification.');
}finally{if(proxy?.listening)await new Promise(resolve=>proxy.close(resolve));if(backend?.listening)await new Promise(resolve=>backend.close(resolve));for(const file of [key,cert,data])await unlink(file).catch(()=>{});await rmdir(dir).catch(()=>{})}
