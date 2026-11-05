import {recordingKey,getRecording,saveRecording,deleteRecording} from './listening-audio.js';
import {createPronunciation} from './pronunciation.js';
import {renderQuestions} from './exercise.js';
import {recordMistake,removeMistake} from './targeted-training.js';
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
export function dueVocabulary(catalog, progress, now = Date.now(), priority = {}) {
  return Object.values(catalog).filter(w => w && typeof w.word === 'string' && isDueWord(progress[w.word.toLowerCase()],now)).sort((a,b) => Number(Boolean(priority[b.word.toLowerCase()]))-Number(Boolean(priority[a.word.toLowerCase()])) || progress[a.word.toLowerCase()].due - progress[b.word.toLowerCase()].due || a.word.localeCompare(b.word));
}
export function localStudyDate(date = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
}
// Reserve at most 20 distinct new words per local calendar day. Yesterday's
// unstarted reservations move to the front; reviewing never consumes this quota.
export function planDailyNew(catalog, progress, daily, today, limit = 20, priority = {}) {
  const valid = id => Object.hasOwn(catalog, id) && catalog[id] && typeof catalog[id].word === 'string';
  const order = ids => [...new Set(ids)].sort((a,b)=>Number(Boolean(priority[b]))-Number(Boolean(priority[a])));
  const old = Array.isArray(daily?.ids) ? [...new Set(daily.ids.filter(id => typeof id === 'string' && valid(id)))] : [];
  if (daily?.date === today) {const fresh=Object.keys(catalog).filter(id=>valid(id)&&!Object.hasOwn(progress,id));return {date:today,ids:order([...old,...fresh]).slice(0,limit)}}
  const pending = old.filter(id => !Object.hasOwn(progress,id));
  const available = Object.keys(catalog).filter(id => valid(id) && !Object.hasOwn(progress,id));
  return {date:today,ids:order([...pending,...available]).slice(0,limit)};
}
export function matchesSpelling(input, expected) {
  return String(input).trim().toLocaleLowerCase() === String(expected).trim().toLocaleLowerCase();
}
export function renderTraining(root, material, storage = localStorage, scope = 'default', feedback = null, guide = null) {
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
  const dailyKey=storageKey+':'+scope.split(':')[0]+':daily-vocabulary';
  const priorityKey=storageKey+':'+scope.split(':')[0]+':priority-vocabulary';let priority={};try{priority=JSON.parse(storage.getItem(priorityKey)||'{}')}catch{};if(!priority||typeof priority!=='object'||Array.isArray(priority))priority={};
  const getDaily=()=>{let daily={};try{daily=JSON.parse(storage.getItem(dailyKey)||'{}')}catch{};const plan=planDailyNew(catalog,state.words,daily,localStudyDate(),20,priority);storage.setItem(dailyKey,JSON.stringify(plan));return plan.ids.filter(id=>!Object.hasOwn(state.words,id)||['uncertain','forgotten'].includes(state.words[id]?.lastRating)).map(id=>catalog[id]).filter(Boolean)};
  const persist=()=>storage.setItem(key,JSON.stringify(state));
  const saveWord=(id,progress)=>{let latest={};try{latest=JSON.parse(storage.getItem(vocabularyKey)||'{}')}catch{};if(!latest||typeof latest!=='object'||Array.isArray(latest))latest={};latest[id]=progress;state.words={...state.words,...latest};storage.setItem(vocabularyKey,JSON.stringify(latest));persist()};
  // Stop and release media owned by the previous render before replacing it.
  for(const oldAudio of Array.from(root.querySelectorAll?.('audio')||[])){
    try{oldAudio.pause()}catch{}
    const oldUrl=oldAudio.dataset?.objectUrl;
    if(oldUrl)URL.revokeObjectURL(oldUrl);
  }
  root.replaceChildren();
  if(root._audioFileGuard)root.removeEventListener?.('change',root._audioFileGuard,true);root._audioFileGuard=event=>{const input=event.target,file=input?.matches?.('input[type="file"][accept="audio/*"]')?input.files?.[0]:null;if(!file)return;const message=file.size>250*1024*1024?'录音不能超过 250 MB。':file.type&&!file.type.startsWith('audio/')?'请选择音频文件。':'';if(message){event.stopImmediatePropagation();input.value='';input.setCustomValidity(message);input.reportValidity?.();setTimeout(()=>input.setCustomValidity(''),0)}};root.addEventListener?.('change',root._audioFileGuard,true);
  const section=(title)=>{const el=document.createElement('section');const heading=document.createElement('h3');heading.textContent=title;el.append(heading);root.append(el);return el};
  if (material.vocabulary.length || Object.keys(catalog).length) {
    const el=section('词汇练习'), controls=document.createElement('div'), all=document.createElement('button'), due=document.createElement('button'), area=document.createElement('div');
    el.classList.add('vocab-practice');controls.className='vocab-tabs';area.className='vocab-card';all.textContent='今日新词（最多 20 个）'; due.textContent='到期复习'; controls.append(all,due); el.append(controls,area);
    let index=0, words=getDaily(), reviewing=false;
    const choose=(review)=>{reviewing=review;if(review){try{const latest=JSON.parse(storage.getItem(vocabularyKey)||'{}');state.words={...state.words,...latest}}catch{};words=dueVocabulary(catalog,state.words,Date.now(),priority)}else words=getDaily();index=0;paint()};
    all.onclick=()=>choose(false); due.onclick=()=>choose(true);
    function paint(){
      area.replaceChildren();
      if(index>=words.length){area.textContent=words.length?'本轮词汇已完成。':reviewing?'目前没有到期词汇。':'今天没有待学习的新词。';return}
      const word=words[index], id=word.word.toLowerCase(), progress=document.createElement('small'), title=document.createElement('h4');
      progress.textContent=`${index+1} / ${words.length}`;title.textContent=word.word;const star=document.createElement('button');star.className='secondary';star.setAttribute('aria-pressed',priority[id]?'true':'false');const paintStar=()=>star.textContent=priority[id]?'★ 已优先':'☆ 优先学习';paintStar();star.onclick=()=>{if(priority[id])delete priority[id];else{priority[id]=Date.now();const current=state.words[id];if(current&&!current.mastered){state.words[id]={...current,due:Math.min(Number.isFinite(current.due)?current.due:Infinity,Date.now()+86400000)};saveWord(id,state.words[id])}}storage.setItem(priorityKey,JSON.stringify(priority));star.setAttribute('aria-pressed',priority[id]?'true':'false');paintStar()};area.append(progress,title,star);
      const pronunciationActions=document.createElement('div'),pronunciationStatus=document.createElement('small');pronunciationActions.className='pronunciation-actions';pronunciationStatus.setAttribute('role','status');const speaker=createPronunciation({onStatus:message=>pronunciationStatus.textContent=message});for(const [accent,label] of [['uk','英式 ▶'],['us','美式 ▶']]){const sound=document.createElement('button');sound.className='secondary';sound.textContent=label;sound.setAttribute('aria-label',label+'发音');sound.onclick=()=>speaker.play(word.word,accent);pronunciationActions.append(sound)}area.append(pronunciationActions,pronunciationStatus);
      const prompt=document.createElement('p');prompt.textContent='先回忆意思，再选择你的记忆程度。';area.append(prompt);
      const answer=document.createElement('div');answer.hidden=true;
      for(const text of [word.meaning,word.example,word.translation].filter(Boolean)){const line=document.createElement('p');line.textContent=text;answer.append(line)}
      const actions=document.createElement('div'),status=document.createElement('p');actions.className='vocab-actions';status.setAttribute('role','status');
      let selected=null; const prior=state.words[id];
      for(const [label,rating] of [['知道','known'],['模糊','uncertain'],['不知道','forgotten'],['我已熟练掌握','mastered']]){
        const button=document.createElement('button');button.textContent=label;button.className=rating==='mastered'?'secondary':'';
        button.onclick=()=>{if((selected==='uncertain'||selected==='forgotten')&&(rating==='known'||rating==='mastered'))removeMistake(storage,scope.split(':')[0],'词汇','vocab:'+id);selected=rating;state.words[id]=scheduleWord(prior,rating);saveWord(id,state.words[id]);if(rating==='uncertain'||rating==='forgotten')recordMistake(storage,scope.split(':')[0],{type:'词汇',source:'vocab:'+id,question:word.word,answer:rating==='uncertain'?'模糊':'不知道',expected:word.meaning||'',explanation:word.example||''});answer.hidden=false;status.textContent=`已标记「${label}」。如记错了，可以重新选择。`;next.hidden=false;spelling.hidden=false;};actions.append(button);
      }
      const spelling=document.createElement('div');spelling.hidden=true;const startSpell=document.createElement('button');startSpell.textContent='练习拼写';const fields=document.createElement('div');fields.hidden=true;const spellPrompt=document.createElement('p');spellPrompt.textContent='根据释义拼写：'+word.meaning;const input=document.createElement('input');input.autocomplete='off';input.setAttribute('aria-label','输入单词拼写');const check=document.createElement('button'),showAnswer=document.createElement('button'),spellStatus=document.createElement('p');startSpell.onclick=()=>{title.hidden=true;answer.hidden=true;fields.hidden=false;startSpell.hidden=true;input.focus()};check.textContent='检查拼写';check.onclick=()=>{if(!input.value.trim()){spellStatus.textContent='请输入拼写。';return}const correct=matchesSpelling(input.value,word.word);spellStatus.textContent=correct?'拼写正确。':'拼写有误，已安排稍后再次练习。';if(correct){title.hidden=false;answer.hidden=false}else{selected='forgotten';saveWord(id,scheduleWord(state.words[id],'forgotten'));recordMistake(storage,scope.split(':')[0],{type:'拼写',source:'spelling:'+id,question:word.meaning||word.word,answer:input.value,expected:word.word,explanation:'检查拼写及字母顺序。'})}};showAnswer.textContent='显示答案';showAnswer.onclick=()=>{title.hidden=false;answer.hidden=false};fields.append(spellPrompt,input,check,showAnswer,spellStatus);spelling.append(startSpell,fields);
      const next=document.createElement('button');next.textContent='下一个';next.hidden=true;next.onclick=()=>{if(selected){if(selected==='uncertain'||selected==='forgotten')words.push(word);index++;paint()}};
      area.append(actions,answer,status,spelling,next);
    }
    paint();
  }
  const hasListening=!!(material.listening?.questions?.length||material.listening?.lines?.length||material.listening?.transcript||material.listening?.question);let listen=null,audio=null;if(hasListening){listen=section('听力练习');const hint=document.createElement('p');hint.textContent='选择本机录音后会尝试保存在此设备；音频不包含在文本备份或设备同步中。';const upload=document.createElement('input');upload.type='file';upload.accept='audio/*';upload.setAttribute('aria-label','选择听力音频');audio=document.createElement('audio');const audioStatus=document.createElement('p'),removeAudio=document.createElement('button');audioStatus.setAttribute('role','status');audio.controls=true;audio.hidden=true;removeAudio.type='button';removeAudio.className='secondary';removeAudio.textContent='删除本机录音';removeAudio.hidden=true;let objectUrl,selection=0,saveQueue=Promise.resolve();const audioKey=recordingKey(scope.split(':')[0],material.listening?.audioId,scope);const attached=()=>!('isConnected' in listen)||listen.isConnected;const clearAudio=()=>{try{audio.pause()}catch{};if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl='';if(audio.dataset)delete audio.dataset.objectUrl;audio.removeAttribute?.('src');audio.load?.();audio.hidden=true;removeAudio.hidden=true};const setAudio=file=>{if(!attached())return false;clearAudio();objectUrl=URL.createObjectURL(file);if(audio.dataset)audio.dataset.objectUrl=objectUrl;audio.src=objectUrl;audio.hidden=false;removeAudio.hidden=false;return true};upload.onchange=()=>{const file=upload.files?.[0];if(!file)return;const current=++selection;setAudio(file);audioStatus.textContent='正在保存录音…';saveQueue=saveQueue.catch(()=>{}).then(()=>saveRecording(audioKey,file));saveQueue.then(()=>{if(current===selection&&attached())audioStatus.textContent='录音已保存在此设备。';globalThis.navigator?.storage?.persist?.().catch(()=>{})}).catch(()=>{if(current===selection&&attached())audioStatus.textContent='录音可在本次使用，但无法保存到设备；下次请重新选择。'})};removeAudio.onclick=async()=>{const current=++selection;clearAudio();upload.value='';audioStatus.textContent='正在删除录音…';try{saveQueue=saveQueue.catch(()=>{}).then(()=>deleteRecording(audioKey));await saveQueue;if(current===selection&&attached())audioStatus.textContent='本机录音已删除。'}catch{if(current===selection&&attached())audioStatus.textContent='录音删除失败，请稍后重试。'}};listen.append(hint,upload,audio,removeAudio,audioStatus);const initialSelection=selection;getRecording(audioKey).then(file=>{if(file&&selection===initialSelection&&setAudio(file))audioStatus.textContent='已加载此设备保存的录音。'}).catch(()=>{})}
  const noteMistake=entry=>recordMistake(storage,scope.split(':')[0],{...entry,source:scope+':'+entry.type+':'+entry.source});
  if(listen)renderQuestions(listen, material.listening, state, persist, audio, noteMistake);
  if(material.reading?.questions?.length||material.reading?.passage){const reading=section('阅读训练');if(material.reading.passage){const passage=document.createElement('p');passage.className='reading-passage';passage.textContent=material.reading.passage;reading.append(passage)}renderQuestions(reading, material.reading, state, persist, null, noteMistake)}
  if(listen&&material.listening?.transcript){const details=document.createElement('details'),summary=document.createElement('summary'),transcript=document.createElement('p');summary.textContent='查看听力原文';transcript.textContent=material.listening.transcript;details.append(summary,transcript);listen.append(details)}
  for(const [label,prompt] of [['听力回答',material.listening?.question],['阅读回答',material.reading?.question],['写作练习',material.writing],['翻译练习',material.translation]]){if(!prompt)continue;const el=section(label),question=document.createElement('p');question.textContent=prompt;el.append(question);if(label==='写作练习'&&guide){const guideButton=document.createElement('button'),guideStatus=document.createElement('p');guideButton.className='secondary';guideButton.textContent='写作前获取思路';guideStatus.setAttribute('role','status');guideButton.onclick=async()=>{guideButton.disabled=true;guideStatus.textContent='正在整理写作思路…';try{guideStatus.textContent=await guide(prompt)}catch(e){guideStatus.textContent=e.message||'暂时无法获取写作思路。'}finally{guideButton.disabled=false}};el.append(guideButton,guideStatus)}const field=document.createElement('textarea');field.setAttribute('aria-label',label);field.value=state.drafts[label]||'';field.addEventListener('input',()=>{state.drafts[label]=field.value;persist()});el.append(field);const note=document.createElement('small');note.textContent='草稿自动保存在当前浏览器。';el.append(note);if(feedback){const button=document.createElement('button'),result=document.createElement('p');button.textContent='请求 AI 反馈';result.setAttribute('role','status');button.onclick=async()=>{if(!field.value.trim()){result.textContent='请先填写作答。';return}button.disabled=true;result.textContent='正在请求反馈…';try{const original=field.value, response=await feedback(label,prompt,original);result.replaceChildren();const summary=document.createElement('p');summary.textContent=response.summary||'反馈已生成。';result.append(summary);if(Number.isFinite(response.score)&&response.score>=0&&response.score<=15){const score=document.createElement('p');score.textContent='练习估分：'+response.score+' / 15（非官方评分）'+(response.scoreReason?'。'+response.scoreReason:'');result.append(score)}const marked=document.createElement('p');let cursor=0;const hits=(response.issues||[]).filter(i=>typeof i.quote==='string'&&i.quote.trim()&&original.includes(i.quote)).map(i=>({quote:i.quote,start:original.indexOf(i.quote)})).sort((a,b)=>a.start-b.start);for(const hit of hits){if(hit.start<cursor)continue;marked.append(document.createTextNode(original.slice(cursor,hit.start)));const mark=document.createElement('mark');mark.textContent=hit.quote;marked.append(mark);cursor=hit.start+hit.quote.length}marked.append(document.createTextNode(original.slice(cursor)));if(hits.length){marked.style.whiteSpace='pre-wrap';result.append(marked)}for(const [issueIndex,issue] of (response.issues||[]).entries()){if(typeof issue.quote!=='string'||!issue.quote.trim()||!original.includes(issue.quote)||typeof issue.explanation!=='string'||typeof issue.suggestion!=='string')continue;if(label==='写作练习'||label==='翻译练习')recordMistake(storage,scope.split(':')[0],{type:label,source:label+':'+scope+':'+issueIndex,question:prompt,answer:issue.quote,expected:issue.suggestion,explanation:issue.explanation});const card=document.createElement('div'),quote=document.createElement('mark'),detail=document.createElement('p');quote.textContent=issue.quote;detail.textContent=issue.explanation+' → '+issue.suggestion;card.append(quote,detail);result.append(card)}}catch(e){result.textContent=e.message||'反馈未完成，请稍后重试。'}finally{button.disabled=false}};el.append(button,result)}}
}

export function installTrainingTabs(root, initialLabel = ''){
  root.querySelector?.('.training-tabs')?.remove();
  const panels=Array.from(root.children||[]).filter(node=>node.tagName==='SECTION');
  if(!panels.length)return;
  const tabs=document.createElement('nav');tabs.className='training-tabs';tabs.setAttribute('aria-label','训练模块');tabs.setAttribute('role','tablist');
  const buttons=panels.map((panel,index)=>{const button=document.createElement('button'),heading=panel.querySelector('h3');panel.id=`training-panel-${index}`;button.id=`training-tab-${index}`;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);button.type='button';button.setAttribute('role','tab');button.setAttribute('aria-controls',panel.id);button.textContent=(heading?.textContent||`训练 ${index+1}`).replace('练习','');tabs.append(button);return button});
  const select=index=>{panels.forEach((panel,i)=>{panel.hidden=i!==index;buttons[i].setAttribute('aria-selected',i===index?'true':'false');buttons[i].tabIndex=i===index?0:-1});};
  buttons.forEach((button,index)=>{button.onclick=()=>select(index);button.onkeydown=event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const next=(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;select(next);buttons[next].focus()}});
  root.prepend(tabs);
  const normalized=String(initialLabel).trim().toLocaleLowerCase();
  const initialIndex=Math.max(0,buttons.findIndex(button=>button.textContent.trim().toLocaleLowerCase().includes(normalized)));
  select(normalized?initialIndex:0);
}
