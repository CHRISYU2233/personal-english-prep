import {mergeSnapshots} from './merge.js';
const PREFIX='english-prep-sync-v1:';
const allowed=k=>k==='english-prep-import-v1'||k==='english-prep-exam-v1'||k.startsWith('english-prep-import-v1:')||k.startsWith('english-prep-training-v1:');
export function capture(storage){const out={};for(let i=0;i<storage.length;i++){const k=storage.key(i);if(!allowed(k))continue;const raw=storage.getItem(k);if(k==='english-prep-exam-v1')out[k]=raw;else {try{out[k]=JSON.parse(raw)}catch{throw Error('本机学习记录格式有误，请先导出备份。')}}}return out}
function apply(storage,state){for(const [k,v] of Object.entries(state)){if(!allowed(k)||(k==='english-prep-exam-v1'?!['cet4','cet6','ielts','toefl','det','other'].includes(v):!v||typeof v!=='object'||Array.isArray(v)))throw Error('云端记录格式无效，本机数据未更改。')}const old=capture(storage);const keys=new Set([...Object.keys(old),...Object.keys(state)]);try{for(const k of keys){if(!allowed(k))throw Error('云端记录包含无效字段。');if(!Object.hasOwn(state,k))storage.removeItem(k);else storage.setItem(k,k==='english-prep-exam-v1'?state[k]:JSON.stringify(state[k]))}}catch(e){for(const k of keys){if(Object.hasOwn(old,k))storage.setItem(k,k==='english-prep-exam-v1'?old[k]:JSON.stringify(old[k]));else storage.removeItem(k)}throw e}}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function createSync({storage, request, changed=()=>{}, status=()=>{}}){
 let busy=false, conflict=null, generation=0;
 const meta=()=>{try{return JSON.parse(storage.getItem(PREFIX+'base')||'null')}catch{return null}};
 const save=(revision,state)=>storage.setItem(PREFIX+'base',JSON.stringify({revision,state}));
 async function sync(){if(busy)return;const token=storage.getItem(PREFIX+'token');if(!token)return;const run=generation;busy=true;try{
   status('正在同步…');
   for(let attempt=0;attempt<3;attempt++){
    const local=capture(storage),base=meta(),remote=await request('GET',token);if(run!==generation)return;
    if(!remote || !(remote.revision===null||typeof remote.revision==='string') || !(remote.state===null || (remote.state && typeof remote.state==='object'&&!Array.isArray(remote.state))))throw Error('同步服务返回了无效记录。');
    const result=mergeSnapshots(base?.state||{},local,remote.state||{});
    if(!same(local,capture(storage)))continue;
    if(result.conflicts.length){conflict={...result,local,remote};status(`有 ${result.conflicts.length} 处冲突，请选择如何处理。`);changed({conflict});return}
    if(!same(result.value,remote.state||{})||remote.revision===null){try{await request('PUT',token,{revision:remote.revision,state:result.value})}catch(e){if(e.status===409)continue;throw e}continue}
    if(run!==generation)return;if(!same(local,result.value)){apply(storage,result.value);changed({updated:true})}
    save(remote.revision,result.value);conflict=null;status('已同步');return;
   }
   status('记录正在变化，稍后自动重试。');
  }catch(e){status(e.message||'暂时无法同步，本机记录仍在。')}finally{busy=false}}
 async function resolve(side){if(!conflict)return;const c=conflict;if(!same(c.local,capture(storage))){conflict=null;await sync();return}const merged=structuredClone(c.value);for(const item of c.conflicts){let target=merged;for(const part of item.path.slice(0,-1))target=target[part];const key=item.path.at(-1),value=item[side];if(value===undefined)delete target[key];else target[key]=value}apply(storage,merged);save(c.remote.revision,c.remote.state||{});conflict=null;changed({updated:true});await sync()}
 return {sync,resolve,disconnect(){generation++;storage.removeItem(PREFIX+'token');storage.removeItem(PREFIX+'base');conflict=null;status('同步已关闭，本机记录保留。')}}
}
export async function httpRequest(method,token,body){const r=await fetch('/api/sync',{method,headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});if(!r.ok){const e=Error(r.status===401?'同步密钥无效。':`同步暂不可用（${r.status}），本机记录仍在。`);e.status=r.status;throw e}return r.json()}
export function installSyncUI({storage=localStorage,container,refresh}){
 const box=document.createElement('details');const summary=document.createElement('summary');summary.textContent='设备同步（自托管）';box.append(summary);
 const intro=document.createElement('p');intro.textContent='需要先部署同步服务。在两台设备输入同一同步密钥；密钥保存在本机，不包含在学习备份中。';
 const label=document.createElement('label');label.textContent='同步密钥';const input=document.createElement('input');input.type='password';input.autocomplete='off';label.append(input);
 const enable=document.createElement('button');enable.textContent='启用同步';const disable=document.createElement('button');disable.textContent='关闭同步';disable.className='secondary';const status=document.createElement('p');status.setAttribute('role','status');
 const conflicts=document.createElement('div'),detail=document.createElement('pre');detail.style.whiteSpace='pre-wrap';const chooseLocal=document.createElement('button'),chooseRemote=document.createElement('button');chooseLocal.textContent='冲突处保留本机';chooseRemote.textContent='冲突处使用云端';conflicts.hidden=true;conflicts.append(detail,chooseLocal,chooseRemote);
 const client=createSync({storage,request:httpRequest,status:msg=>status.textContent=msg,changed:change=>{if(change.conflict){conflicts.hidden=false;detail.textContent=change.conflict.conflicts.map(c=>`${c.path.join(' / ')}\n本机：${JSON.stringify(c.local)}\n云端：${JSON.stringify(c.remote)}`).join('\n\n')}else if(change.updated){conflicts.hidden=true;refresh?.()}}});
 enable.onclick=()=>{if(location.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(location.hostname)){status.textContent='请使用 HTTPS 页面启用同步。';return}const token=input.value.trim();if(!/^[A-Za-z0-9_-]{43,}$/.test(token)){status.textContent='请输入部署服务时配置的同步密钥。';return}storage.setItem(PREFIX+'token',token);storage.removeItem(PREFIX+'base');input.value='';client.sync()};disable.onclick=()=>{client.disconnect();conflicts.hidden=true};chooseLocal.onclick=()=>client.resolve('local');chooseRemote.onclick=()=>client.resolve('remote');
 box.append(intro,label,enable,disable,status,conflicts);container.append(box);
 if(storage.getItem(PREFIX+'token')){status.textContent='同步已启用';client.sync()};window.addEventListener('online',()=>client.sync());document.addEventListener('visibilitychange',()=>{if(!document.hidden)client.sync()});setInterval(()=>{if(!document.hidden)client.sync()},15000);
}

