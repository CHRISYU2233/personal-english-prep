// Audio blobs stay on this device, outside text backups and cloud sync.
const DB='english-prep-audio-v1', STORE='recordings';
function open(factory=globalThis.indexedDB){return new Promise((resolve,reject)=>{if(!factory){reject(Error('浏览器不支持本机音频保存。'));return}const request=factory.open(DB,1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE)};request.onerror=()=>reject(request.error||Error('音频库无法打开。'));request.onsuccess=()=>resolve(request.result)})}
async function operation(mode,key,blob,factory,remove=false){const db=await open(factory);try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE),request=mode==='readonly'?store.get(key):remove?store.delete(key):store.put(blob,key);let value;request.onsuccess=()=>{value=request.result};request.onerror=()=>reject(request.error||Error('音频操作失败。'));tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(tx.error||Error('音频操作失败。'));tx.onerror=()=>reject(tx.error||Error('音频操作失败。'))})}finally{db.close()}}
export function recordingKey(exam,audioId,scope){return audioId?String(exam)+':'+String(audioId):String(scope||exam)}
export function getRecording(key,factory){return operation('readonly',key,undefined,factory)}
export function saveRecording(key,blob,factory){return operation('readwrite',key,blob,factory)}
export function deleteRecording(key,factory){return operation('readwrite',key,undefined,factory,true)}
