import {lookupOffline} from './lookup.js';
export function installDictionary(root){
 const panel=document.createElement('details'),summary=document.createElement('summary');summary.textContent='查单词';panel.className='dictionary-panel';panel.append(summary);
 const form=document.createElement('form'),input=document.createElement('input'),submit=document.createElement('button'),status=document.createElement('p');input.placeholder='输入英文单词';input.setAttribute('aria-label','查询英文单词');submit.textContent='查询';status.setAttribute('role','status');form.append(input,submit);panel.append(form,status);root.prepend(panel);
 let current=0;async function show(word){const id=++current;panel.open=true;input.value=word;status.textContent='正在查找…';try{const result=await lookupOffline(word);if(id!==current)return;status.textContent=result?[result.word||result.baseWord,result.phonetic?'/'+result.phonetic+'/':'',result.meaning,result.phrase].filter(Boolean).join('\n'):'本地词典暂未收录这个词。';status.style.whiteSpace='pre-wrap'}catch{if(id===current)status.textContent='词典加载失败，请稍后重试。'}}
 form.onsubmit=e=>{e.preventDefault();show(input.value)};
 root.addEventListener('dblclick',e=>{if(e.target.closest('input,textarea,select,button,.dictionary-panel'))return;const text=String(window.getSelection()?.toString()||'').trim();if(/^[A-Za-z]+(?:[-'’][A-Za-z]+)*$/.test(text))show(text)});
}
