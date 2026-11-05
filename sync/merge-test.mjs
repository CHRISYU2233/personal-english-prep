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
test('different material IDs merge instead of replacing the whole library',()=>{
  const base=[{id:'base',material:{title:'Base'}}];
  const local=[...base,{id:'local',material:{title:'Local'}}];
  const remote=[...base,{id:'remote',material:{title:'Remote'}}];
  const result=mergeSnapshots({materials:base},{materials:local},{materials:remote});
  assert.deepEqual(result.value.materials.map(x=>x.id),['base','local','remote']);
  assert.equal(result.conflicts.length,0);
});
test('edits to the same material still surface a precise conflict',()=>{
  const base={materials:[{id:'same',material:{title:'Base'}}]},local={materials:[{id:'same',material:{title:'Local'}}]},remote={materials:[{id:'same',material:{title:'Remote'}}]};
  const result=mergeSnapshots(base,local,remote);
  assert.equal(result.conflicts.length,1);
  assert.deepEqual(result.conflicts[0].path,['materials','$id=same','material','title']);
});

test('concurrent word progress keeps mastered or most recent assessment',()=>{
 const key='english-prep-training-v1:cet6:vocabulary',base={[key]:{assess:{stage:1,lastAt:100,mastered:false}}};
 let result=mergeSnapshots(base,{[key]:{assess:{stage:2,lastAt:200,mastered:false}}},{[key]:{assess:{stage:1,lastAt:300,mastered:false}}});
 assert.equal(result.conflicts.length,0);assert.equal(result.value[key].assess.lastAt,300);
 result=mergeSnapshots(base,{[key]:{assess:{stage:2,lastAt:200,mastered:false}}},{[key]:{assess:{stage:1,lastAt:150,mastered:true}}});
 assert.equal(result.conflicts.length,0);assert.equal(result.value[key].assess.mastered,true);
});

test('same material imported on two devices does not conflict on local timestamp',()=>{
 const key='english-prep-training-v1:cet6:materials',base={[key]:[]},material={title:'Same'};
 const result=mergeSnapshots(base,{[key]:[{id:'same',addedAt:200,material}]},{[key]:[{id:'same',addedAt:100,material}]});
 assert.equal(result.conflicts.length,0);assert.equal(result.value[key][0].addedAt,100);
});
