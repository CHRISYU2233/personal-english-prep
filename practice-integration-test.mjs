import assert from 'node:assert/strict';
import fs from 'node:fs';

// Dependency-free DOM harness for rendering and interaction logic. This does not
// replace real browser, touch, audio, or provider integration testing.
class Element {
  constructor(tag) {this.tagName=tag;this.children=[];this.style={};this.attributes={};this.hidden=false;this.value='';this._text='';this.listeners={};this.classList={add() {},remove() {},toggle() {}};}
  set textContent(value){this._text=String(value);this.children=[]}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join('')}
  append(...items){this.children.push(...items)}
  replaceChildren(...items){this._text='';this.children=items}
  setAttribute(name,value){this.attributes[name]=String(value)}
  addEventListener(name,fn){(this.listeners[name] ||= []).push(fn)}
  removeEventListener(name,fn){this.listeners[name]=(this.listeners[name]||[]).filter(x=>x!==fn)}
  dispatch(name){for(const fn of this.listeners[name]||[])fn({target:this});if(typeof this['on'+name]==='function')return this['on'+name]({target:this})}
  focus(){}
}
globalThis.document={createElement:tag=>new Element(tag),createTextNode:text=>{const node=new Element('#text');node.textContent=text;return node}};
globalThis.window={};
const all=(root,predicate)=>[...(predicate(root)?[root]:[]),...root.children.flatMap(child=>all(child,predicate))];
const byText=(root,tag,text)=>{const result=all(root,el=>el.tagName===tag&&el.textContent===text);assert.equal(result.length,1,`expected one ${tag}: ${text}`);return result[0]};
const exerciseCode=fs.readFileSync(new URL('./exercise.js',import.meta.url),'utf8');
const profileCode=fs.readFileSync(new URL('./exam-profiles.js',import.meta.url),'utf8');
const trainingCode=fs.readFileSync(new URL('./training.js',import.meta.url),'utf8').replace("'./listening-audio.js'",`'data:text/javascript;base64,${fs.readFileSync('listening-audio.js').toString('base64')}'`).replace("'./exercise.js'",`'data:text/javascript;base64,${Buffer.from(exerciseCode).toString('base64')}'`).replace("'./targeted-training.js'",`'data:text/javascript;base64,${fs.readFileSync('targeted-training.js').toString('base64')}'`).replace("'./pronunciation.js'",`'data:text/javascript;base64,${fs.readFileSync('pronunciation.js').toString('base64')}'`);
const {parseStudyContent}=await import('data:text/javascript;base64,'+Buffer.from(profileCode).toString('base64'));
const {renderTraining}=await import('data:text/javascript;base64,'+Buffer.from(trainingCode).toString('base64'));
const material=parseStudyContent(JSON.stringify({title:'Sample',vocabulary:[{word:'assess',meaning:'评估',example:'Assess results.',translation:'评估结果。'}],listening:{transcript:'A student studies daily.',questions:[{question:'What?',options:['Study','Travel'],answer:0,explanation:'The student studies.',start:0,end:4}]},writing:'Describe a habit.'}));
const map=new Map(),storage={getItem:key=>map.get(key)??null,setItem:(key,val)=>map.set(key,String(val))};
const root=new Element('main');let feedbackArgs;
const feedback=async (...args)=>{feedbackArgs=args;return {summary:'反馈',issues:[{quote:'bad',explanation:'语法',suggestion:'good'}]}};
renderTraining(root,material,storage,'cet6:test',feedback);
byText(root,'button','知道').dispatch('click');
assert.match(root.textContent,/评估结果/);
byText(root,'button','我已熟练掌握').dispatch('click');
assert.match(root.textContent,/已标记「我已熟练掌握」/);
const saved=JSON.parse(storage.getItem('english-prep-training-v1:cet6:test'));
assert.equal(saved.words.assess.mastered,true);
byText(root,'button','到期复习').dispatch('click');assert.match(root.textContent,/目前没有到期词汇/);
const radios=all(root,e=>e.tagName==='input'&&e.type==='radio');radios[0].dispatch('change');
byText(root,'button','查看答案与讲解').dispatch('click');assert.match(root.textContent,/回答正确。 正确答案：Study/);
const drafts=all(root,e=>e.tagName==='textarea');assert.equal(drafts.length,1);drafts[0].value='bad';drafts[0].dispatch('input');
await byText(root,'button','请求 AI 反馈').dispatch('click');assert.equal(feedbackArgs[2],'bad');assert.match(root.textContent,/语法 → good/);
const root2=new Element('main');renderTraining(root2,material,storage,'cet6:test',feedback);assert.equal(all(root2,e=>e.tagName==='textarea')[0].value,'bad');assert.equal(all(root2,e=>e.tagName==='input'&&e.type==='radio')[0].checked,true);
const nextMaterial=new Element('main');renderTraining(nextMaterial,material,storage,'cet6:another',feedback);byText(nextMaterial,'button','到期复习').dispatch('click');assert.match(nextMaterial.textContent,/目前没有到期词汇/);
console.log('PASS: imported practice, vocabulary rating correction, saved answers and draft, mocked feedback, re-render restoration.');

// Review draws from earlier materials of the same exam, but not another exam.
const queueMap=new Map(), queueStore={getItem:k=>queueMap.get(k)??null,setItem:(k,v)=>queueMap.set(k,String(v))};
const oldRoot=new Element('main');renderTraining(oldRoot,material,queueStore,'cet6:old',feedback);
byText(oldRoot,'button','不知道').dispatch('click');
const vocabKey='english-prep-training-v1:cet6:vocabulary';const progress=JSON.parse(queueStore.getItem(vocabKey));progress.assess.due=Date.now()-1;queueStore.setItem(vocabKey,JSON.stringify(progress));
const replacement=parseStudyContent(JSON.stringify({title:'New',vocabulary:[{word:'adapt',meaning:'适应'}]}));
const freshRoot=new Element('main');renderTraining(freshRoot,replacement,queueStore,'cet6:new',feedback);
byText(freshRoot,'button','到期复习').dispatch('click');assert.match(freshRoot.textContent,/assess/);assert.doesNotMatch(freshRoot.textContent,/adapt/);
byText(freshRoot,'button','我已熟练掌握').dispatch('click');
const again=new Element('main');renderTraining(again,replacement,queueStore,'cet6:new',feedback);byText(again,'button','到期复习').dispatch('click');assert.match(again.textContent,/目前没有到期词汇/);
const otherExam=new Element('main');renderTraining(otherExam,replacement,queueStore,'ielts:new',feedback);byText(otherExam,'button','到期复习').dispatch('click');assert.match(otherExam.textContent,/目前没有到期词汇/);
console.log('PASS: cross-material due queue and exam isolation.');

// Today's error collector receives wrong choices, uncertain words, and validated writing quotes.
const errorsMap=new Map(), errorsStore={getItem:k=>errorsMap.get(k)??null,setItem:(k,v)=>errorsMap.set(k,String(v))};
const errorsRoot=new Element('main');renderTraining(errorsRoot,material,errorsStore,'cet6:errors',feedback);
byText(errorsRoot,'button','模糊').dispatch('click');
const errorRadios=all(errorsRoot,e=>e.tagName==='input'&&e.type==='radio');errorRadios[1].dispatch('change');byText(errorsRoot,'button','查看答案与讲解').dispatch('click');
const errorDraft=all(errorsRoot,e=>e.tagName==='textarea')[0];errorDraft.value='bad';errorDraft.dispatch('input');await byText(errorsRoot,'button','请求 AI 反馈').dispatch('click');
const errorDays=JSON.parse(errorsStore.getItem('english-prep-training-v1:cet6:mistakes'));const errors=Object.values(errorDays).flat();assert.deepEqual(errors.map(x=>x.type).sort(),['listening','写作练习','词汇'].sort());assert.ok(errors.some(x=>x.answer==='bad'&&x.expected==='good'));
console.log('PASS: mistakes captured from vocabulary, listening, and writing feedback.');

// An unknown word must reappear within the session until recalled.
const retryMap=new Map(), retryStore={getItem:k=>retryMap.get(k)??null,setItem:(k,v)=>retryMap.set(k,String(v))};
const retryRoot=new Element('main');renderTraining(retryRoot,material,retryStore,'cet6:retry',feedback);
byText(retryRoot,'button','不知道').dispatch('click');byText(retryRoot,'button','下一个').dispatch('click');assert.match(retryRoot.textContent,/assess/);
byText(retryRoot,'button','知道').dispatch('click');byText(retryRoot,'button','下一个').dispatch('click');assert.match(retryRoot.textContent,/本轮词汇已完成/);
// A wrong spelling must not leave a word classified as successfully recalled.
const spellingStoreMap=new Map(), spellingStore={getItem:k=>spellingStoreMap.get(k)??null,setItem:(k,v)=>spellingStoreMap.set(k,String(v))};
const spellingRoot=new Element('main');renderTraining(spellingRoot,material,spellingStore,'cet6:spell',feedback);
byText(spellingRoot,'button','知道').dispatch('click');byText(spellingRoot,'button','练习拼写').dispatch('click');
const spellInput=all(spellingRoot,e=>e.attributes['aria-label']==='输入单词拼写')[0];spellInput.value='asess';byText(spellingRoot,'button','检查拼写').dispatch('click');
assert.equal(JSON.parse(spellingStore.getItem('english-prep-training-v1:cet6:vocabulary')).assess.lastRating,'forgotten');
byText(spellingRoot,'button','下一个').dispatch('click');assert.match(spellingRoot.textContent,/assess/);
console.log('PASS: session retry and spelling mistakes return to practice.');
