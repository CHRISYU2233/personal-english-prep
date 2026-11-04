import assert from 'node:assert/strict';
import fs from 'node:fs';
const dependency=fs.readFileSync('exercise.js').toString('base64');const code=Buffer.from(fs.readFileSync('training.js','utf8').replace("'./exercise.js'", "'data:text/javascript;base64,"+dependency+"'"));const {scheduleWord}=await import('data:text/javascript;base64,'+code.toString('base64'));
const t=1700000000000;let a=scheduleWord(null,'known',t);assert.equal(a.due,t+86400000);a=scheduleWord(a,'known',t+86400000);assert.equal(a.stage,1);a=scheduleWord(a,'forgotten',t+2*86400000);assert.equal(a.stage,0);assert.throws(()=>scheduleWord(null,'invalid'));console.log('PASS: vocabulary self-assessment and scheduling.');
