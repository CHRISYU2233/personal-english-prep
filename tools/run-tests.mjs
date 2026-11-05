import {existsSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const rootTests=readdirSync('.').filter(name=>name.endsWith('-test.mjs')).sort();
const syncTests=readdirSync('sync').filter(name=>name.endsWith('-test.mjs')).sort().map(name=>'sync/'+name);
if(process.platform==='win32'&&!process.env.SYNC_TEST_OPENSSL){for(const candidate of ['D:\\Git\\usr\\bin\\openssl.exe','C:\\Program Files\\Git\\usr\\bin\\openssl.exe'])if(existsSync(candidate)){process.env.SYNC_TEST_OPENSSL=candidate;break}}

function run(command,args){
 const result=spawnSync(command,args,{stdio:'inherit',env:process.env});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status||1);
}

for(const test of rootTests)run(process.execPath,[test]);
run(process.execPath,['--test',...syncTests]);
run(process.platform==='win32'?'python':'python3',['-m','py_compile','tools/generate_word_audio.py','tools/convert-koreader.py']);
console.log(`PASS: ${rootTests.length} browser/data scripts, ${syncTests.length} sync files and Python syntax.`);
