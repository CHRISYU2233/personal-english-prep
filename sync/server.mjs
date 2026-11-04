// Single-workspace sync backend. Bind to loopback; expose only via HTTPS reverse proxy.
import http from 'node:http';
import {timingSafeEqual, randomBytes} from 'node:crypto';
import {readFile, writeFile, rename, mkdir, unlink} from 'node:fs/promises';
import {dirname} from 'node:path';

const LIMIT = 2 * 1024 * 1024;
function safe(value, depth=0) {
  if (depth > 40) return false;
  if (!value || typeof value !== 'object') return true;
  return Object.entries(value).every(([k,v])=>!['__proto__','constructor','prototype'].includes(k) && safe(v, depth+1));
}
function equal(a,b) {
  const x=Buffer.from(a), y=Buffer.from(b);
  return x.length===y.length && timingSafeEqual(x,y);
}
function reply(res,status,body) {
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(JSON.stringify(body));
}
async function bodyOf(req) {
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>LIMIT)throw Error('too_large');chunks.push(chunk)}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw Error('invalid_json')}
}
export function createSyncServer({token, file, allowedOrigin}) {
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43,}$/.test(token)) throw Error('A random capability token of at least 32 bytes is required.');
  let origin;try{origin=new URL(allowedOrigin)}catch{throw Error('A valid HTTPS public origin is required.')}
  if(!file || origin.protocol!=='https:' || origin.origin!==allowedOrigin) throw Error('A storage file and HTTPS public origin are required.');
  let queue=Promise.resolve();
  const serial = fn => { const result=queue.then(fn);queue=result.catch(()=>{});return result; };
  async function read() {
    try {
      const value=JSON.parse(await readFile(file,'utf8'));
      if(!value || !/^[a-f0-9]{32}$/.test(value.revision) || !value.state || typeof value.state!=='object'||Array.isArray(value.state)||!safe(value.state)) throw Error('invalid_state');
      return value;
    } catch(e) {if(e.code==='ENOENT')return {revision:null,state:null};throw e}
  }
  async function store(snapshot) {
    await mkdir(dirname(file),{recursive:true});
    const temp=file+'.'+randomBytes(12).toString('hex')+'.tmp';
    try {await writeFile(temp,JSON.stringify(snapshot),{encoding:'utf8',mode:0o600,flag:'wx'});await rename(temp,file)}
    finally {await unlink(temp).catch(()=>{})}
  }
  return http.createServer(async(req,res)=>{
    if(req.url!=='/api/sync')return reply(res,404,{error:'not_found'});
    if(req.headers.origin && req.headers.origin!==allowedOrigin)return reply(res,403,{error:'origin_not_allowed'});
    const auth=req.headers.authorization||'';
    if(!auth.startsWith('Bearer ')||!equal(auth.slice(7),token))return reply(res,401,{error:'unauthorized'});
    if(req.method==='GET'){
      try{const snapshot=await serial(read);return reply(res,200,snapshot)}catch{return reply(res,503,{error:'storage_unavailable'})}
    }
    if(req.method!=='PUT')return reply(res,405,{error:'method_not_allowed'});
    if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))return reply(res,415,{error:'json_required'});
    let input;try{input=await bodyOf(req)}catch(e){return reply(res,e.message==='too_large'?413:400,{error:e.message})}
    if(!input || typeof input!=='object'||Array.isArray(input)||!(input.revision===null||typeof input.revision==='string'&&/^[a-f0-9]{32}$/.test(input.revision))||!input.state||typeof input.state!=='object'||Array.isArray(input.state)||!safe(input.state))return reply(res,400,{error:'invalid_state'});
    try {
      const result=await serial(async()=>{const current=await read();if(input.revision!==current.revision)return {conflict:true,current};const next={revision:randomBytes(16).toString('hex'),state:input.state};await store(next);return {conflict:false,next}});
      return result.conflict?reply(res,409,{error:'conflict',...result.current}):reply(res,200,result.next);
    }catch{return reply(res,503,{error:'storage_unavailable'})}
  });
}
