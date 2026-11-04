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

