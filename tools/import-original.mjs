import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
// Parse JSON literals only. Never evaluate source files as JavaScript.
export function extractJSON(source,name){
 const marker=`const ${name}=`;const begin=source.indexOf(marker);if(begin<0)throw Error(`缺少 ${name}`);let pos=begin+marker.length;while(/\s/.test(source[pos]))pos++;
 if(source[pos]!=='{'&&source[pos]!=='[')throw Error('数据必须是 JSON 对象或数组');let depth=0,quoted=false,escape=false;
 for(let i=pos;i<source.length;i++){const c=source[i];if(quoted){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quoted=false;continue}if(c==='"'){quoted=true;continue}if(c==='{'||c==='[')depth++;else if(c==='}'||c===']'){depth--;if(depth===0)return JSON.parse(source.slice(pos,i+1))}}
 throw Error('数据不完整');
}
export function convertListening(paperId,bank,audio,translations={},subtitles=[]){
 const paper=bank[paperId],sound=audio[paperId];if(!paper||!sound)throw Error('题目和音频数据不匹配');
 return sound.groups.map((g,groupIndex)=>{
  const trans=translations[paperId]?.groups?.find(t=>t.start===g.start&&t.end===g.end)?.sentences||[];
  const timings=subtitles.filter(t=>t.group===groupIndex+1);
  const lines=trans.map((v,i)=>({english:v.en||'',chinese:v.zh||'',start:timings[i]?.start??null})).filter(x=>x.english);
  const questions=paper.questions.filter(q=>q.number>=g.start&&q.number<=g.end).map(q=>{
   const part=sound.questions[String(q.number)];const answer='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(q.answer||'');
   return {question:part?.text||`Question ${q.number}`,options:q.options||[],answer,explanation:q.analysis||'',segments:part&&Number.isFinite(g.audioStart)&&Number.isFinite(g.audioEnd)?[[g.audioStart,g.audioEnd],[part.start,part.end]]:[]};
  });
  return {title:`${paperId} 听力 ${g.start}–${g.end}`,plan:[],vocabulary:[],listening:{transcript:g.transcript||'',lines,questions},reading:{passage:'',question:''},writing:'',translation:''};
 });
}
async function main(){const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('用法：node tools/import-original.mjs <原站 dist 目录> <输出目录>');
 const read=async(file,name)=>extractJSON(await readFile(join(input,file),'utf8'),name);
 const bank=await read('listening-data.js','LISTENING_BANK'),audio=await read('question-audio-data.js','QUESTION_AUDIO');
 const a=await read('listening-translations-a.js','LISTENING_TRANSLATIONS_A'),b=await read('listening-translations-b.js','LISTENING_TRANSLATIONS_B'),sub=await read('subtitle-data.js','LISTENING_SUBTITLES');
 await mkdir(output,{recursive:true});let count=0;for(const id of Object.keys(bank)){if(!audio[id])continue;const groups=convertListening(id,bank,audio,{...a,...b},sub[id]||[]);for(let i=0;i<groups.length;i++){await writeFile(join(output,`${id}-group-${i+1}.json`),JSON.stringify(groups[i],null,2),'utf8');count++}}
 console.log(`已在指定目录生成 ${count} 组个人练习文件。请仅使用有权使用的材料。`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1});
