// Load one first-letter shard at a time so mobile devices do not parse the
// entire dictionary for a single lookup.
const shards=new Map();
const shardFor=word=>/^[a-z]/.test(word)?word[0]:'_';
const defaultLoader = shard => import(`./chunks/${shard}.js`);
async function loadShard(shard,loader){
  if(loader!==defaultLoader)return loader(shard);
  if(!shards.has(shard))shards.set(shard,loader(shard).catch(error=>{shards.delete(shard);throw error}));
  return shards.get(shard);
}
export function normalizeWord(input) {
  return String(input ?? '').trim().toLowerCase().replace(/[‘’]/g,"'").replace(/[‐‑–—]/g,'-');
}
export async function lookupWord(input, load = defaultLoader) {
  const word = normalizeWord(input);
  if (!/^[a-z]+(?:[-'][a-z]+)*$/.test(word)) return null;
  const data = await loadShard(shardFor(word),load),dictionary=data.DICTIONARY||data.TAP_DICTIONARY||{},forms=data.WORD_FORMS||data.TAP_WORD_FORMS||{};
  const base = forms[word] || word;
  let entry = dictionary[word] || dictionary[base];
  if(!entry&&shardFor(base)!==shardFor(word)){const target=await loadShard(shardFor(base),load),targetDictionary=target.DICTIONARY||target.TAP_DICTIONARY||{};entry=targetDictionary[base]}
  return entry ? (Array.isArray(entry) ? {word:base,meaning:entry[0],phonetic:entry[1],phrase:'',matchedWord:word,baseWord:base} : { ...entry, matchedWord: word, baseWord: base }) : null;
}
export function lookupOffline(input) { return lookupWord(input, defaultLoader); }
