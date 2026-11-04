// Imported materials remain on the learner's device. Audio is chosen locally.
export function renderQuestions(parent, data, state, persist, audio = null) {
  if (!data?.questions?.length) return;
  state.answers ||= {};
  const scope = audio ? 'listening' : 'reading';
  if (audio) {
    const lines = data.lines || [];
    if (lines.length) {
      const controls = document.createElement('div');
      const previous = document.createElement('button'); previous.textContent = '回到上一句'; previous.className = 'secondary';
      previous.onclick = () => { const times = lines.map(x => x.start).filter(x => x !== null && x < audio.currentTime - 0.25); audio.currentTime = times.length ? times[times.length - 1] : 0; audio.play().catch(() => {}); };
      const mode = document.createElement('select'); mode.setAttribute('aria-label', '字幕');
      for (const [value, label] of [['off','关闭字幕'], ['en','英文字幕'], ['both','中英字幕']]) {const o=document.createElement('option');o.value=value;o.textContent=label;mode.append(o)}
      const subtitle=document.createElement('div');
      function paint(){subtitle.replaceChildren();if(mode.value==='off')return;for(const line of lines){const row=document.createElement('p');row.textContent=line.english+(mode.value==='both'&&line.chinese?'\n'+line.chinese:'');row.style.whiteSpace='pre-wrap';subtitle.append(row)}}
      mode.onchange=paint;controls.append(previous,mode,subtitle);parent.append(controls);
    }
    const speed=document.createElement('select');speed.setAttribute('aria-label','播放速度');for(const n of [0.5,0.75,1,1.25,1.5]){const o=document.createElement('option');o.value=n;o.textContent=n+'×';o.selected=n===1;speed.append(o)}speed.onchange=()=>audio.playbackRate=Number(speed.value);parent.append(speed);
  }
  data.questions.forEach((q,index)=>{
    const card=document.createElement('article'), heading=document.createElement('h4');heading.textContent=`${index+1}. ${q.question}`;card.append(heading);
    if(audio){const play=document.createElement('button');play.className='secondary';play.textContent='播放本题';play.onclick=()=>{if(!audio.src){message.textContent='请先选择音频文件。';return}if(q.start!==null)audio.currentTime=q.start;const stop=()=>{if(q.end!==null&&audio.currentTime>=q.end){audio.pause();audio.removeEventListener('timeupdate',stop)}};audio.addEventListener('timeupdate',stop);audio.addEventListener('pause',()=>audio.removeEventListener('timeupdate',stop),{once:true});audio.play().catch(()=>{message.textContent='音频播放失败，请重新选择文件。'})};card.append(play)}
    const group=document.createElement('fieldset'), legend=document.createElement('legend');legend.textContent='选择答案';group.append(legend);const key=scope+':'+index;
    q.options.forEach((option,i)=>{const label=document.createElement('label'),radio=document.createElement('input');radio.type='radio';radio.name=key;radio.value=i;radio.checked=state.answers[key]===i;radio.onchange=()=>{state.answers[key]=i;persist()};label.append(radio,document.createTextNode(' '+option));group.append(label)});card.append(group);
    const check=document.createElement('button'),message=document.createElement('p');check.textContent='查看答案与讲解';message.setAttribute('role','status');check.onclick=()=>{const selected=state.answers[key];if(selected===undefined){message.textContent='请先选择答案。';return}if(q.answer<0||q.answer>=q.options.length){message.textContent='这道题没有有效的参考答案。';return}message.textContent=(selected===q.answer?'回答正确。':'再看看这道题。')+' 正确答案：'+q.options[q.answer]+(q.explanation?'\n'+q.explanation:'');message.style.whiteSpace='pre-wrap'};card.append(check,message);parent.append(card);
  });
}
