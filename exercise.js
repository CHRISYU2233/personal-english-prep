// Imported materials remain on the learner's device. Audio is chosen locally.
export function previousSentenceTime(lines, currentTime) {
  const times = [...new Set(lines.map(line => line.start).filter(t => Number.isFinite(t) && t >= 0))].sort((a,b) => a-b);
  if (!times.length) return null;
  let current = -1;
  for (let i=0;i<times.length;i++) if (times[i] <= currentTime + 0.05) current=i;
  return times[Math.max(0,current-1)];
}
export function renderQuestions(parent, data, state, persist, audio = null, onMistake = null) {
  if (!data) return;
  state.answers ||= {};
  const scope = audio ? 'listening' : 'reading';
  let activeStop = null;
  const clearClip = () => { if(activeStop && audio) audio.removeEventListener('timeupdate',activeStop); activeStop=null; };
  if (audio) {
    const lines = Array.isArray(data.lines) ? data.lines : [];
    if (lines.length) {
      const controls=document.createElement('div'), previous=document.createElement('button'), mode=document.createElement('select'), subtitle=document.createElement('div'), notice=document.createElement('p');
      notice.setAttribute('role','status'); previous.textContent='回到上一句'; previous.className='secondary';
      previous.onclick=()=>{
        const time=previousSentenceTime(lines,audio.currentTime);
        if(time===null){notice.textContent='字幕未设置时间，请先为每句填写起始时间。';return}
        if(!audio.src){notice.textContent='请先选择音频文件。';return}
        clearClip();audio.currentTime=time;notice.textContent='';audio.play().catch(()=>{notice.textContent='音频播放失败，请重新选择文件。'});
      };
      mode.setAttribute('aria-label','字幕');
      for(const [value,label] of [['off','关闭字幕'],['en','英文字幕'],['both','中英字幕']]){const option=document.createElement('option');option.value=value;option.textContent=label;mode.append(option)}
      const highlight=()=>{const at=audio.currentTime;let active=-1;for(let i=0;i<lines.length;i++){if(Number.isFinite(lines[i].start)&&lines[i].start<=at&&(active<0||lines[i].start>lines[active].start))active=i}for(const [i,row] of Array.from(subtitle.children).entries()){if(i===active)row.setAttribute('aria-current','true');else row.removeAttribute('aria-current');row.style.fontWeight=i===active?'700':''}};
      function paint(){subtitle.replaceChildren();if(mode.value==='off')return;for(const line of lines){const row=document.createElement('p');row.textContent=line.english+(mode.value==='both'&&line.chinese?'\n'+line.chinese:'');row.style.whiteSpace='pre-wrap';subtitle.append(row)}highlight()}
      mode.onchange=paint;audio.addEventListener('timeupdate',highlight);controls.append(previous,mode,notice,subtitle);parent.append(controls);
    }
    const speed=document.createElement('select');speed.setAttribute('aria-label','播放速度');for(const n of [0.5,0.75,1,1.25,1.5]){const option=document.createElement('option');option.value=n;option.textContent=n+'×';option.selected=n===1;speed.append(option)}speed.onchange=()=>audio.playbackRate=Number(speed.value);parent.append(speed);
  }
  (data.questions || []).forEach((q,index)=>{
    const card=document.createElement('article'), heading=document.createElement('h4'), message=document.createElement('p');heading.textContent=`${index+1}. ${q.question}`;card.append(heading);
    if(audio){const play=document.createElement('button');play.className='secondary';play.textContent='播放本题';play.onclick=()=>{
      if(!audio.src){message.textContent='请先选择音频文件。';return}
      const segments=q.segments?.length?q.segments:[[q.start,q.end]];
      if(segments.some(([start,end])=>!Number.isFinite(start)||!Number.isFinite(end)||end<=start)){message.textContent='这道题尚未设置有效的起止时间，请按录音填写后重新导入。';return}
      if(Number.isFinite(audio.duration)&&segments.some(([,end])=>end>audio.duration+0.1)){message.textContent='本题结束时间超过录音长度，请检查时间。';return}
      clearClip();let segment=0;audio.currentTime=segments[0][0];message.textContent='';
      activeStop=()=>{if(audio.currentTime>=segments[segment][1]){segment++;if(segment<segments.length)audio.currentTime=segments[segment][0];else{audio.pause();clearClip()}}};
      audio.addEventListener('timeupdate',activeStop);audio.play().catch(()=>{clearClip();message.textContent='音频播放失败，请重新选择文件。'});
    };card.append(play)}
    const group=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='选择答案';group.append(legend);const key=scope+':'+index;
    q.options.forEach((option,i)=>{const label=document.createElement('label'),radio=document.createElement('input');radio.type='radio';radio.name=key;radio.value=i;radio.checked=state.answers[key]===i;radio.onchange=()=>{state.answers[key]=i;persist()};label.append(radio,document.createTextNode(' '+option));group.append(label)});card.append(group);
    const check=document.createElement('button');check.textContent='查看答案与讲解';message.setAttribute('role','status');check.onclick=()=>{const selected=state.answers[key];if(selected===undefined){message.textContent='请先选择答案。';return}if(q.answer<0||q.answer>=q.options.length){message.textContent='这道题没有有效的参考答案。';return}if(selected!==q.answer&&onMistake)onMistake({type:scope,source:String(index),question:q.question,answer:q.options[selected],expected:q.options[q.answer],explanation:q.explanation});message.textContent=(selected===q.answer?'回答正确。':'再看看这道题。')+' 正确答案：'+q.options[q.answer]+(q.explanation?'\n'+q.explanation:'');message.style.whiteSpace='pre-wrap'};card.append(check,message);parent.append(card);
  });
}
