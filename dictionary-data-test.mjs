import assert from 'node:assert/strict';
const {lookupOffline}=await import('./dictionary/lookup.js');
for(const w of ['assess','shift','passive','well-being','facilitate']){let r=await lookupOffline(w);assert.ok(r&&/[\u3400-\u9fff]/.test(r.meaning),w)}
for(const w of ['studies','assessed','shifted']){let r=await lookupOffline(w);assert.ok(r&&/[\u3400-\u9fff]/.test(r.meaning),w)}
console.log('PASS: bundled bilingual dictionary and inflected words.');
