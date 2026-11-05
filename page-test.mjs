import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const html=readFileSync('exam-setup.html','utf8');
const match=html.match(/<script type="module">([\s\S]*?)<\/script>/);
assert.ok(match,'module script missing');
const parsable=match[1].replace(/^import .*;\s*$/gm,'');
new Function(parsable);
assert.match(html,/demo-mode/);assert.match(html,/删除当前练习/);assert.match(html,/studyDay/);

const readme=readFileSync('README.md','utf8');
for(const image of ['docs/screenshots/desktop-setup.png','docs/screenshots/phone-vocabulary-release.png','docs/screenshots/phone-listening-release.png','docs/screenshots/ipad-writing-release.png']){
 assert.ok(existsSync(image),`missing screenshot: ${image}`);assert.ok(readme.includes(image),`README does not reference ${image}`);
}
console.log('PASS: page script syntax, daily material controls and release screenshots.');
