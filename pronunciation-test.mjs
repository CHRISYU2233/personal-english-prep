import assert from 'node:assert/strict';import fs from 'node:fs';
const {chooseVoice,createPronunciation}=await import('data:text/javascript;base64,'+fs.readFileSync('pronunciation.js').toString('base64'));
const voices=[{lang:'en-US',name:'Basic',localService:true},{lang:'en-US',name:'Natural voice'},{lang:'en-GB',name:'UK'}];assert.equal(chooseVoice(voices,'en-US').name,'Natural voice');assert.equal(chooseVoice(voices,'en-GB').name,'UK');
const calls=[];class U{constructor(t){this.text=t}};const synth={cancel(){},getVoices(){return voices},speak(u){calls.push(u)}};
const player=createPronunciation({synthesis:synth,Utterance:U,fetcher:async()=>({ok:false})});await player.ready;player.play('well-being','uk');assert.equal(calls[0].lang,'en-GB');player.play('assess','us');assert.equal(calls[1].lang,'en-US');console.log('PASS: accent voice selection and browser fallback.');

let played='';class A{constructor(src){played=src}play(){return Promise.resolve()}pause(){}}const local=createPronunciation({AudioClass:A,synthesis:synth,Utterance:U,fetcher:async()=>({ok:true,json:async()=>({uk:{assess:'voices/uk/assess.wav'}})})});await local.ready;local.play('assess','uk');assert.equal(played,'./voices/uk/assess.wav');console.log('PASS: optional local recording chosen.');
