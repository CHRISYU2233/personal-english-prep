import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeSnapshots} from './merge.js';
test('independent changes merge and competing edits are not silently discarded',()=>{
  const base={words:{one:1,two:1},drafts:{text:'old'}};
  const local={words:{one:2,two:1},drafts:{text:'local'}};
  const remote={words:{one:1,two:3},drafts:{text:'remote'}};
  const result=mergeSnapshots(base,local,remote);
  assert.deepEqual(result.value.words,{one:2,two:3});
  assert.equal(result.conflicts.length,1);
  assert.deepEqual(result.conflicts[0].path,['drafts','text']);
  assert.equal(result.conflicts[0].local,'local');assert.equal(result.conflicts[0].remote,'remote');
});
test('deletion and unchanged content do not conflict',()=>{
  const result=mergeSnapshots({a:1,b:2},{b:2},{a:1,b:3});
  assert.deepEqual(result.value,{b:3});assert.equal(result.conflicts.length,0);
});
