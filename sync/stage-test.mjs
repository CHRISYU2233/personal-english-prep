import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {stage,assets,copyOptionalVoices} from './stage-public.mjs';
const temp=await mkdtemp(join(tmpdir(),'english-prep-stage-'));
try {
 const out=join(temp,'public');
 assert.equal(await stage(resolve('.'),out),assets.length);
 assert.equal(await readFile(join(out,'index.html'),'utf8'),await readFile('index.html','utf8'));
 for(const item of assets.filter(x=>x.endsWith('.js')||x.endsWith('.html'))){
  const source=await readFile(join(out,...item.split('/')),'utf8');
  for(const match of source.matchAll(/(?:from\s*|import\s*)['"](\.\.?\/[^'"]+)['"]/g)){
   const dependency=resolve(join(out,...item.split('/').slice(0,-1)),match[1]);
   assert.ok(dependency.startsWith(out),`unsafe import in ${item}`);
   await readFile(dependency,'utf8');
  }
 }
 const dirs=await readdir(out);
 assert.ok(!dirs.includes('.git')); assert.ok(!dirs.includes('private-data')); assert.ok(!dirs.includes('.env.local'));
 await assert.rejects(stage(resolve('.'),out),/not empty/);
 await assert.rejects(stage(resolve('.'),'relative-output'),/absolute/);
 await assert.rejects(stage(resolve('.'),resolve('nested-output')),/outside/);
 const voiceSource=join(temp,'voice-source'),voiceTarget=join(temp,'voice-target');
 await mkdir(join(voiceSource,'voices','us'),{recursive:true});await mkdir(voiceTarget,{recursive:true});
 await writeFile(join(voiceSource,'voices','manifest.json'),JSON.stringify({us:{assess:'voices/us/assess.wav'}}));await writeFile(join(voiceSource,'voices','us','assess.wav'),'audio');
 assert.equal(await copyOptionalVoices(voiceSource,voiceTarget),2);assert.equal(await readFile(join(voiceTarget,'voices','us','assess.wav'),'utf8'),'audio');
 await writeFile(join(voiceSource,'voices','manifest.json'),JSON.stringify({us:{assess:'../secret.wav'}}));await assert.rejects(copyOptionalVoices(voiceSource,join(temp,'unsafe-target')),/unsafe/);
 await writeFile(join(temp,'keep.txt'),'untouched');
 console.log('PASS: static deploy staging copies only public assets and refuses unsafe targets.');
} finally {
 if(temp.startsWith(join(tmpdir(),'english-prep-stage-')))await rm(temp,{recursive:true,force:true});
}
