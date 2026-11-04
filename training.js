import {renderQuestions} from './exercise.js';
// Local practice state; no user content or credentials leave the browser.
export const storageKey = 'english-prep-training-v1';
export function scheduleWord(previous, rating, now = Date.now()) {
  if (!['known','uncertain','forgotten','mastered'].includes(rating)) throw new Error('无效的记忆反馈');
  if (rating === 'mastered') return {...previous, mastered:true, due:null, lastAt:now, lastRating:rating};
  const spaced = !previous || now - (previous.lastAt || 0) >= 12 * 3600000;
  const stage = rating === 'known' ? Math.max(0, Math.min(6, (previous?.stage ?? -1) + (spaced ? 1 : 0))) : rating === 'uncertain' ? Math.max(0, (previous?.stage ?? 0) - 1) : 0;
  const intervals = [1,2,4,7,15,30,60];
  const due = rating === 'forgotten' ? now+5*60000 : rating === 'uncertain' ? now+10*60000 : (!spaced && previous?.due > now ? previous.due : now+intervals[stage]*86400000);
  return {stage:Math.max(0,stage), due, mastered:false, lastAt:rating === 'known' && !spaced ? previous.lastAt : now, lastRating:rating};
}
export function isDueWord(progress, now = Date.now()) {
  return !!progress && !progress.mastered && Number.isFinite(progress.due) && progress.due <= now;
}
export function dueVocabulary(catalog, progress, now = Date.now()) {
  return Object.values(catalog).filter(w => w && typeof w.word === 'string' && isDueWord(progress[w.word.toLowerCase()],now)).sort((a,b) => progress[a.word.toLowerCase()].due - progress[b.word.toLowerCase()].due || a.word.localeCompare(b.word));
}
export function matchesSpelling(input, expected) {
  return String(input).trim().toLocaleLowerCase() === String(expected).trim().toLocaleLowerCase();
}
export function renderTraining(root, material, storage = localStorage, scope = 'default', feedback = null) {
  const key=storageKey+':'+scope; let state;
  try {state=JSON.parse(storage.getItem(key)||'{}')} catch {state={}}
  const vocabularyKey=storageKey+':'+scope.split(':')[0]+':vocabulary';
  let sharedWords={};try {sharedWords=JSON.parse(storage.getItem(vocabularyKey)||'{}')} catch {}
  if(!sharedWords || typeof sharedWords!=='object' || Array.isArray(sharedWords)) sharedWords={};
  state.words={...(state.words||{}),...sharedWords}; state.drafts ||= {};
  const catalogKey=storageKey+':'+scope.split(':')[0]+':vocabulary-catalog';
  let catalog={};try {catalog=JSON.parse(storage.getItem(catalogKey)||'{}')} catch {}
  if(!catalog || typeof catalog!=='object' || Array.isArray(catalog)) catalog={};
  for(const word of material.vocabulary || []) if(word && typeof word.word==='string' && word.word.trim()) catalog[word.word.toLowerCase()]={...catalog[word.word.toLowerCase()],...word};
  storage.setItem(catalogKey,JSON.stringify(catalog));
  const persist=()=>storage.setItem(key,JSON.stringify(state));
  const saveWord=(id,progress)=>{let latest={};try{latest=JSON.parse(storage.getItem(vocabularyKey)||'{}')}catch{};if(!latest||typeof latest!=='object'||Array.isArray(latest))latest={};latest[id]=progress;state.words={...state.words,...latest};storage.setItem(vocabularyKey,JSON.stringify(latest));persist()};
  root.replaceChildren();
  const section=(title)=>{const el=document.createElement('section');const heading=document.createElement('h3');heading.textContent=title;el.append(heading);root.append(el);return el};
  if (material.vocabulary.length || Object.keys(catalog).length) {
    const el=section('词汇练习'), controls=document.createElement('div'), all=document.createElement('button'), due=document.createElement('button'), area=document.createElement('div');
    el.classList.add('vocab-practice');controls.className='vocab-tabs';area.className='vocab-card';all.textContent='全部词汇'; due.textContent='到期复习'; controls.append(all,due); el.append(controls,area);
    let index=0, words=material.vocabulary;
    const choose=(review)=>{if(review){try{const latest=JSON.parse(storage.getItem(vocabularyKey)||'{}');state.words={...state.words,...latest}}catch{};words=dueVocabulary(catalog,state.words)}else words=material.vocabulary;index=0;paint()};
    all.onclick=()=>choose(false); due.onclick=()=>choose(true);
    function paint(){
      area.replaceChildren();
      if(index>=words.length){area.textContent=words.length?'本轮词汇已完成。':'目前没有到期词汇。';return}
      const word=words[index], id=word.word.toLowerCase(), progress=document.createElement('small'), title=document.createElement('h4');
      progress.textContent=`${index+1} / ${words.length}`;title.textContent=word.word;area.append(progress,title);
      if('speechSynthesis' in window){const sound=document.createElement('button');sound.className='secondary';sound.textContent='播放发音';sound.onclick=()=>{speechSynthesis.cancel();const voice=new SpeechSynthesisUtterance(word.word);voice.lang='en-US';speechSynthesis.speak(voice)};area.append(sound)}
      const prompt=document.createElement('p');prompt.textContent='先回忆意思，再选择你的记忆程度。';area.append(prompt);
      const answer=document.createElement('div');answer.hidden=true;
      for(const text of [word.meaning,word.example,word.translation].filter(Boolean)){const line=document.createElement('p');line.textContent=text;answer.append(line)}
      const actions=document.createElement('div'),status=document.createElement('p');actions.className='vocab-actions';status.setAttribute('role','status');
      let selected=null; const prior=state.words[id];
      for(const [label,rating] of [['知道','known'],['模糊','uncertain'],['不知道','forgotten'],['我已熟练掌握','mastered']]){
        const button=document.createElement('button');button.textContent=label;button.className=rating==='mastered'?'secondary':'';
        button.onclick=()=>{selected=rating;state.words[id]=scheduleWord(prior,rating);saveWord(id,state.words[id]);answer.hidden=false;status.textContent=`已标记「${label}」。如记错了，可以重新选择。`;next.hidden=false;spelling.hidden=false;};actions.append(button);
      }
      const spelling=document.createElement('div');spelling.hidden=true;const startSpell=document.createElement('button');startSpell.textContent='练习拼写';const fields=document.createElement('div');fields.hidden=true;const spellPrompt=document.createElement('p');spellPrompt.textContent='根据释义拼写：'+word.meaning;const input=document.createElement('input');input.autocomplete='off';input.setAttribute('aria-label','输入单词拼写');const check=document.createElement('button'),showAnswer=document.createElement('button'),spellStatus=document.createElement('p');startSpell.onclick=()=>{title.hidden=true;answer.hidden=true;fields.hidden=false;startSpell.hidden=true;input.focus()};check.textContent='检查拼写';check.onclick=()=>{if(!input.value.trim()){spellStatus.textContent='请输入拼写。';return}const correct=matchesSpelling(input.value,word.word);spellStatus.textContent=correct?'拼写正确。':'再试一次。';if(correct){title.hidden=false;answer.hidden=false}};showAnswer.textContent='显示答案';showAnswer.onclick=()=>{title.hidden=false;answer.hidden=false};fields.append(spellPrompt,input,check,showAnswer,spellStatus);spelling.append(startSpell,fields);
      const next=document.createElement('button');next.textContent='下一个';next.hidden=true;next.onclick=()=>{if(selected){index++;paint()}};
      area.append(actions,answer,status,spelling,next);
    }
    paint();
  }
  const listen=section('听力练习');const hint=document.createElement('p');hint.textContent='选择自己的音频文件，进行听力练习。';const upload=document.createElement('input');upload.type='file';upload.accept='audio/*';upload.setAttribute('aria-label','选择听力音频');const audio=document.createElement('audio');audio.controls=true;audio.hidden=true;let objectUrl;upload.onchange=()=>{if(objectUrl)URL.revokeObjectURL(objectUrl);if(upload.files?.[0]){objectUrl=URL.createObjectURL(upload.files[0]);audio.src=objectUrl;audio.hidden=false}};listen.append(hint,upload,audio);
  renderQuestions(listen, material.listening, state, persist, audio);
  if(material.reading?.questions?.length){const reading=section('阅读选择题');renderQuestions(reading, material.reading, state, persist)}
  if(material.listening?.transcript){const details=document.createElement('details'),summary=document.createElement('summary'),transcript=document.createElement('p');summary.textContent='查看听力原文';transcript.textContent=material.listening.transcript;details.append(summary,transcript);listen.append(details)}
  for(const [label,prompt] of [['听力回答',material.listening?.question],['阅读回答',material.reading?.question],['写作练习',material.writing],['翻译练习',material.translation]]){if(!prompt)continue;const el=section(label),question=document.createElement('p');question.textContent=prompt;el.append(question);const field=document.createElement('textarea');field.setAttribute('aria-label',label);field.value=state.drafts[label]||'';field.addEventListener('input',()=>{state.drafts[label]=field.value;persist()});el.append(field);const note=document.createElement('small');note.textContent='草稿自动保存在当前浏览器。';el.append(note);if(feedback){const button=document.createElement('button'),result=document.createElement('p');button.textContent='请求 AI 反馈';result.setAttribute('role','status');button.onclick=async()=>{if(!field.value.trim()){result.textContent='请先填写作答。';return}button.disabled=true;result.textContent='正在请求反馈…';try{const original=field.value, response=await feedback(label,prompt,original);result.replaceChildren();const summary=document.createElement('p');summary.textContent=response.summary||'反馈已生成。';result.append(summary);const marked=document.createElement('p');let cursor=0;const hits=(response.issues||[]).filter(i=>typeof i.quote==='string'&&i.quote.trim()&&original.includes(i.quote)).map(i=>({quote:i.quote,start:original.indexOf(i.quote)})).sort((a,b)=>a.start-b.start);for(const hit of hits){if(hit.start<cursor)continue;marked.append(document.createTextNode(original.slice(cursor,hit.start)));const mark=document.createElement('mark');mark.textContent=hit.quote;marked.append(mark);cursor=hit.start+hit.quote.length}marked.append(document.createTextNode(original.slice(cursor)));if(hits.length){marked.style.whiteSpace='pre-wrap';result.append(marked)}for(const issue of response.issues||[]){if(typeof issue.quote!=='string'||!issue.quote.trim()||!original.includes(issue.quote)||typeof issue.explanation!=='string'||typeof issue.suggestion!=='string')continue;const card=document.createElement('div'),quote=document.createElement('mark'),detail=document.createElement('p');quote.textContent=issue.quote;detail.textContent=issue.explanation+' → '+issue.suggestion;card.append(quote,detail);result.append(card)}}catch(e){result.textContent=e.message||'反馈未完成，请稍后重试。'}finally{button.disabled=false}};el.append(button,result)}}
}
