// Loaded on first use, so initial page load is not blocked by the dictionary.
let dictionaryPromise;
const defaultLoader = () => import('./data.js');
export function normalizeWord(input) {
  return String(input ?? '').trim().toLowerCase().replace(/[‘’]/g,"'").replace(/[‐‑–—]/g,'-');
}
export async function lookupWord(input, load = defaultLoader) {
  const word = normalizeWord(input);
  if (!/^[a-z]+(?:[-'][a-z]+)*$/.test(word)) return null;
  const data = load === defaultLoader ? await (dictionaryPromise ||= load().catch(error => {dictionaryPromise = undefined; throw error})) : await load();
  const base = data.TAP_WORD_FORMS[word] || word;
  const entry = data.TAP_DICTIONARY[word] || data.TAP_DICTIONARY[base];
  return entry ? (Array.isArray(entry) ? {word:base,meaning:entry[0],phonetic:entry[1],phrase:'',matchedWord:word,baseWord:base} : { ...entry, matchedWord: word, baseWord: base }) : null;
}
export function lookupOffline(input) { return lookupWord(input, defaultLoader); }
