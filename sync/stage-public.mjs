// Copy only explicitly selected public static files, never the repository itself.
import {lstat,mkdir,readdir,copyFile,readFile} from 'node:fs/promises';
import {dirname,isAbsolute,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const dictionaryChunks=[...'abcdefghijklmnopqrstuvwxyz_'].map(letter=>`dictionary/chunks/${letter}.js`);
export const assets=['index.html','exam-setup.html','manifest.webmanifest','pwa-register.js','sw.js','exam-profiles.js','material-library.js','training.js','pronunciation.js','listening-audio.js','exercise.js','ai-client.js','daily-plan.js','targeted-training.js','dictionary/lookup.js','dictionary/meta.js','dictionary/ui.js','dictionary/LICENSE.txt','dictionary/ATTRIBUTION.txt','sync/client.js','sync/merge.js','icons/icon-180.png','icons/icon-192.png','icons/icon-512.png',...dictionaryChunks];

export async function copyOptionalVoices(source,target){
 const manifestPath=join(source,'voices','manifest.json');let raw;
 try{const info=await lstat(manifestPath);if(!info.isFile()||info.isSymbolicLink())throw Error('Voice manifest must be a regular file.');raw=await readFile(manifestPath,'utf8')}catch(e){if(e.code==='ENOENT')return 0;throw e}
 let manifest;try{manifest=JSON.parse(raw)}catch{throw Error('Voice manifest is not valid JSON.')}
 const files=[];
 for(const accent of ['us','uk'])for(const [word,file] of Object.entries(manifest?.[accent]||{})){
  if(!/^[a-z]+(?:[-'][a-z]+)*$/i.test(word)||file!==`voices/${accent}/${word.toLowerCase()}.wav`)throw Error('Voice manifest contains an unsafe path.');
  files.push(file);
 }
 await mkdir(join(target,'voices'),{recursive:true});await copyFile(manifestPath,join(target,'voices','manifest.json'),1);
 for(const file of files){const src=join(source,...file.split('/')),info=await lstat(src);if(!info.isFile()||info.isSymbolicLink())throw Error(`Voice asset is not a regular file: ${file}`);const dest=join(target,...file.split('/'));await mkdir(dirname(dest),{recursive:true});await copyFile(src,dest,1)}
 return files.length+1;
}

export async function stage(source,target){
 if(!isAbsolute(target))throw Error('Target must be an absolute path.');
 const root=resolve(source),out=resolve(target),rel=relative(root,out);
 if(!rel||(!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep)))throw Error('Target must be outside the source directory.');
 try{const info=await lstat(out);if(!info.isDirectory()||info.isSymbolicLink())throw Error('Target must be a normal empty directory.');if((await readdir(out)).length)throw Error('Target directory is not empty.')}catch(e){if(e.code!=='ENOENT')throw e;await mkdir(out,{recursive:true})}
 for(const item of assets){const src=join(root,...item.split('/'));const info=await lstat(src);if(!info.isFile()||info.isSymbolicLink())throw Error(`Not a regular file: ${item}`);const dest=join(out,...item.split('/'));await mkdir(dirname(dest),{recursive:true});await copyFile(src,dest,1)}
 return assets.length+await copyOptionalVoices(root,out);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const src=fileURLToPath(new URL('../',import.meta.url));stage(src,process.argv[2]||'').then(n=>console.log(`Prepared ${n} static assets.`)).catch(e=>{console.error(e.message);process.exitCode=1})}
