// Three-way merge: disjoint object edits merge, concurrent edits are surfaced.
const absent=Symbol('absent');
const object=v=>v!==absent && v!==null && typeof v==='object' && !Array.isArray(v);
const equals=(a,b)=>a===absent||b===absent?a===b:JSON.stringify(a)===JSON.stringify(b);
export function mergeSnapshots(base,local,remote) {
  const conflicts=[];
  function merge(b,l,r,path) {
    if(equals(l,r))return l;
    if(equals(l,b))return r;
    if(equals(r,b))return l;
    if(object(l)&&object(r)&&(object(b)||b===absent)) {
      const result={}; const keys=new Set([...Object.keys(object(b)?b:{}),...Object.keys(l),...Object.keys(r)]);
      for(const key of keys) {
        if(['__proto__','constructor','prototype'].includes(key))throw Error('Unsafe key');
        const get=(x,k)=>object(x)&&Object.hasOwn(x,k)?x[k]:absent;
        const value=merge(get(b,key),get(l,key),get(r,key),[...path,key]);if(value!==absent)result[key]=value;
      }
      return result;
    }
    conflicts.push({path,base:b===absent?undefined:b,local:l===absent?undefined:l,remote:r===absent?undefined:r});
    return l;
  }
  const value=merge(base,local,remote,[]);
  return {value,conflicts};
}
