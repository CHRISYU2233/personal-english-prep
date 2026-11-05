import assert from 'node:assert/strict';
import fs from 'node:fs'; const {EXAMS,createStudyPrompt,parseStudyContent}=await import('data:text/javascript;base64,'+fs.readFileSync('exam-profiles.js').toString('base64'));
for (const exam of Object.keys(EXAMS)) assert.ok(createStudyPrompt({exam}).includes(EXAMS[exam]));
assert.throws(() => createStudyPrompt({exam:'unknown'}));
assert.throws(() => createStudyPrompt({exam:'cet6',minutes:0}));
assert.throws(() => parseStudyContent('{bad'));
assert.throws(() => parseStudyContent('{}'));
const material = parseStudyContent('```json\n{"title":"学习","plan":["阅读"],"vocabulary":[{"word":"assess","meaning":"评估"}],"reading":{"passage":"Hello"},"writing":"Write"}\n```');
assert.equal(material.vocabulary[0].word,'assess');
assert.equal(material.reading.passage,'Hello');
console.log('PASS: exam selection, prompt bounds, JSON validation and AI content import.');


const structured=parseStudyContent(JSON.stringify({listening:{lines:[{english:'Hello.',chinese:'你好。',start:0}],questions:[{question:'Choose',options:['A','B'],answer:1,start:2,end:4,explanation:'Because.'}]}}));
assert.equal(structured.listening.questions[0].answer,1);assert.equal(structured.listening.questions[0].end,4);assert.equal(structured.listening.lines[0].chinese,'你好。');
assert.match(createStudyPrompt({exam:'ielts',minutes:60}),/translation 留空/);
const invalid=parseStudyContent(JSON.stringify({title:'x',reading:{questions:[{question:'Broken',options:['Only one'],answer:2}]}}));assert.equal(invalid.reading.questions.length,0);
