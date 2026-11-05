// Cache only the public application shell, never user data, API traffic or credentials.
const CACHE = 'english-prep-shell-v6';
const FILES = ['index.html','exam-setup.html','manifest.webmanifest','pwa-register.js','exam-profiles.js','material-library.js','training.js','pronunciation.js','listening-audio.js','exercise.js','ai-client.js','daily-plan.js','targeted-training.js','dictionary/lookup.js','dictionary/meta.js','dictionary/ui.js','dictionary/LICENSE.txt','dictionary/ATTRIBUTION.txt','sync/client.js','sync/merge.js','icons/icon-180.png','icons/icon-192.png','icons/icon-512.png'];
const canonical = file => new URL(file,self.registration.scope).href;
const allowed = new Set(FILES.map(canonical));
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  await cache.addAll(FILES.map(canonical));
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith('english-prep-shell-') && key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const request=event.request, url=new URL(request.url);
  if(request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('authorization') || request.headers.has('range')) return;
  const base=url.origin+url.pathname;
  const root=new URL('./',self.registration.scope).href;
  const target=base===root?canonical('index.html'):base;
  const dictionaryRoot=canonical('dictionary/chunks/'),optionalDictionary=base.startsWith(dictionaryRoot)&&/^[a-z_]\.js$/i.test(base.slice(dictionaryRoot.length));
  const voiceRoot=canonical('voices/');let voicePath='';try{if(base.startsWith(voiceRoot))voicePath=decodeURIComponent(base.slice(voiceRoot.length))}catch{}
  const optionalVoice=voicePath==='manifest.json'||/^(?:us|uk)\/[a-z]+(?:[-'][a-z]+)*\.wav$/i.test(voicePath);
  if(!allowed.has(target)&&!optionalDictionary&&!optionalVoice) return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try {
      const response=await fetch(request);
      // Never persist personalized query responses or responses marked private.
      if(response.ok && !url.search && !/private|no-store/i.test(response.headers.get('cache-control')||'')) await cache.put(target,response.clone());
      return response;
    } catch {
      const saved=await cache.match(target);
      if(saved) return saved;
      return new Response('离线时无法加载页面，请联网后重试。',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8','Cache-Control':'no-store'}});
    }
  })());
});
