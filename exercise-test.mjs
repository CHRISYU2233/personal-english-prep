import assert from 'node:assert/strict';
import fs from 'node:fs';
const {renderQuestions,previousSentenceTime}=await import('data:text/javascript;base64,'+fs.readFileSync('exercise.js').toString('base64'));
assert.equal(previousSentenceTime([{start:0},{start:5},{start:10}],7),0);
assert.equal(previousSentenceTime([{start:10},{start:0},{start:5}],10),5);
assert.equal(previousSentenceTime([{start:null}],4),null);
class El {
 constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.style={};this.events={};this.value='';this.currentTime=0;this.duration=20;this.paused=false;this.src='audio';}
 append(...v){this.children.push(...v)} replaceChildren(){this.children=[]} setAttribute(k,v){this.attributes[k]=v} removeAttribute(k){delete this.attributes[k]}
 addEventListener(k,f){(this.events[k]??=new Set()).add(f)} removeEventListener(k,f){this.events[k]?.delete(f)} emit(k){for(const f of [...(this.events[k]||[])])f()}
 play(){this.paused=false;return Promise.resolve()} pause(){this.paused=true} click(){this.onclick?.()}
}
globalThis.document={createElement:tag=>new El(tag),createTextNode:text=>({textContent:text})};
const root=new El('main'),audio=new El('audio'),state={};let saves=0;
const q=(start,end)=>({question:'Question',options:['A','B'],answer:0,explanation:'Reason',start,end});
renderQuestions(root,{lines:[{english:'First',chinese:'第一句',start:0},{english:'Second',chinese:'第二句',start:5}],questions:[q(0,3),q(5,9),q(null,null)]},state,()=>saves++,audio);
const cards=root.children.filter(x=>x.tag==='article');cards[0].children[1].click();assert.equal(audio.currentTime,0);cards[1].children[1].click();assert.equal(audio.currentTime,5);audio.currentTime=6;audio.emit('timeupdate');assert.equal(audio.paused,false,'old clip must not stop the next clip');audio.currentTime=9;audio.emit('timeupdate');assert.equal(audio.paused,true);
cards[2].children[1].click();assert.match(cards[2].children.at(-1).textContent,/起止时间/);
const controls=root.children[0],mode=controls.children[1];mode.value='both';mode.onchange();assert.equal(controls.children[3].children[0].textContent,'First\n第一句');
audio.currentTime=6;controls.children[0].click();assert.equal(audio.currentTime,0);
const radio=cards[0].children[2].children[1].children[0];radio.onchange();assert.equal(saves,1);cards[0].children[3].click();assert.match(cards[0].children.at(-1).textContent,/回答正确/);
console.log('PASS: clip switching, timestamps, previous sentence, subtitles and answer feedback.');
