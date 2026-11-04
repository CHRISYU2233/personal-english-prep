// Prefer a locally generated recording; use device voices when no recording exists.
export function chooseVoice(voices, locale) {
 const candidates=(voices||[]).filter(v=>typeof v.lang==='string'&&v.lang.toLowerCase().startsWith(locale.toLowerCase().split('-')[0]));
 const score=v=>{const name=String(v.name||'').toLowerCase();return (v.lang.toLowerCase()===locale.toLowerCase()?100:0)+(/natural|neural|premium|enhanced|siri/.test(name)?20:0)+(v.localService?2:0)};
 return candidates.sort((a,b)=>score(b)-score(a))[0]||null;
}
let defaultManifest;
let activeAudio;
export function createPronunciation({synthesis=globalThis.speechSynthesis, Utterance=globalThis.SpeechSynthesisUtterance, AudioClass=globalThis.Audio, fetcher=globalThis.fetch, onStatus=()=>{}}={}) {
 let manifest={};
 const load=()=>fetcher?fetcher('./voices/manifest.json').then(r=>r.ok?r.json():{}).catch(()=>({})):Promise.resolve({});const ready=(fetcher===globalThis.fetch?(defaultManifest ||= load()):load()).then(x=>{if(x&&typeof x==='object')manifest=x});
 function device(word,accent){
  if(!synthesis||!Utterance){onStatus('此设备暂不支持发音。');return}
  try {synthesis.cancel();const utterance=new Utterance(word), locale=accent==='uk'?'en-GB':'en-US';utterance.lang=locale;const voice=chooseVoice(synthesis.getVoices(),locale);if(voice)utterance.voice=voice;utterance.onerror=()=>onStatus('设备发音失败，请检查静音和音量。');utterance.onstart=()=>onStatus(voice&&voice.lang.toLowerCase()!==locale.toLowerCase()?'该口音不可用，正在使用设备英语语音。':'');synthesis.speak(utterance)}catch{onStatus('设备发音失败，请检查静音和音量。')}
 }
 function play(word,accent='us'){
  const text=String(word||'').trim(),valid=/^[a-z]+(?:[-'][a-z]+)*$/i.test(text);if(!valid){onStatus('这个词暂不能播放。');return}
  if(activeAudio){activeAudio.pause();activeAudio=null}const id=text.toLowerCase(),file=manifest?.[accent]?.[id];
  if(typeof file==='string' && /^voices\/(?:us|uk)\/[a-z]+(?:[-'][a-z]+)*\.wav$/i.test(file) && AudioClass){try{activeAudio=new AudioClass('./'+file);const playback=activeAudio.play();if(playback?.catch)playback.catch(()=>device(text,accent));return}catch{}}
  device(text,accent)
 }
 return {ready,play};
}
