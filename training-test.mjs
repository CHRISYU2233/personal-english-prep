import assert from 'node:assert/strict';
import fs from 'node:fs';
const dependency=fs.readFileSync('exercise.js').toString('base64');const code=Buffer.from(fs.readFileSync('training.js','utf8').replace("'./exercise.js'", "'data:text/javascript;base64,"+dependency+"'").replace("'./targeted-training.js'","'data:text/javascript;base64,"+fs.readFileSync('targeted-training.js').toString('base64')+"'"));const {scheduleWord,isDueWord,matchesSpelling,planDailyNew}=await import('data:text/javascript;base64,'+code.toString('base64'));
const t=1700000000000;let a=scheduleWord(null,'known',t);assert.equal(a.due,t+86400000);a=scheduleWord(a,'known',t+86400000);assert.equal(a.stage,1);a=scheduleWord(a,'forgotten',t+2*86400000);assert.equal(a.stage,0);assert.throws(()=>scheduleWord(null,'invalid'));console.log('PASS: vocabulary self-assessment and scheduling.');

const forgotten=scheduleWord(null,'forgotten',t);assert.equal(forgotten.due,t+300000);assert.equal(isDueWord(forgotten,t+300000),true);const mastered=scheduleWord(forgotten,'mastered',t);assert.equal(isDueWord(mastered,t+365*86400000),false);assert.equal(scheduleWord(mastered,'forgotten',t+1000).mastered,false);assert.equal(matchesSpelling('  Self-aware ','self-aware'),true);assert.equal(matchesSpelling('self aware','self-aware'),false);const quick=scheduleWord(a,'known',t+2*86400000+1000);assert.equal(quick.stage,a.stage);assert.equal(quick.lastAt,a.lastAt);

const reversed=scheduleWord(scheduleWord(null,'mastered',t),'known',t+1000);assert.ok(Number.isFinite(reversed.due));assert.equal(reversed.mastered,false);

const catalog=Object.fromEntries(Array.from({length:30},(_,i)=>['word'+i,{word:'word'+i}]));
let todayPlan=planDailyNew(catalog,{},null,'2026-11-05');assert.equal(todayPlan.ids.length,20);
const attempts=Object.fromEntries(todayPlan.ids.slice(0,5).map(id=>[id,{due:t}]));
assert.deepEqual(planDailyNew(catalog,attempts,todayPlan,'2026-11-05').ids,todayPlan.ids);
let tomorrow=planDailyNew(catalog,attempts,todayPlan,'2026-11-06');assert.equal(tomorrow.ids.length,20);assert.deepEqual(tomorrow.ids.slice(0,15),todayPlan.ids.slice(5));
const small=planDailyNew({a:{word:'a'}},{},null,'2026-11-05');assert.deepEqual(planDailyNew({a:{word:'a'},b:{word:'b'}},{},small,'2026-11-05').ids,['a','b']);
