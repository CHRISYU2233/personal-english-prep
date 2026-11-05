// Three-way merge: disjoint object edits merge, concurrent edits are surfaced.
const absent=Symbol('absent');
const object=v=>v!==absent && v!==null && typeof v==='object' && !Array.isArray(v);
const keyed=v=>Array.isArray(v)&&v.every(x=>object(x)&&typeof x.id==='string')&&new Set(v.map(x=>x.id)).size===v.length;
const equals=(a,b)=>a===absent||b===absent?a===b:JSON.stringify(a)===JSON.stringify(b);
export function mergeSnapshots(base,local,remote) {
  const conflicts=[];
  function merge(b,l,r,path) {
    if(equals(l,r))return l;
    if(equals(l,b))return r;
    if(equals(r,b))return l;
    if(path.at(-1)==='addedAt'&&path.some(part=>String(part).startsWith('$id='))&&Number.isFinite(l)&&Number.isFinite(r))return Math.min(l,r);
    const singleWordProgress=path.at(-2)==='words'||(path.length===2&&String(path[0]||'').endsWith(':vocabulary'));
    if(singleWordProgress&&object(l)&&object(r)){
      const rank=value=>[value.mastered?1:0,Number.isFinite(value.lastAt)?value.lastAt:0,Number.isFinite(value.stage)?value.stage:0];
      const left=rank(l),right=rank(r);for(let i=0;i<left.length;i++){if(left[i]>right[i])return l;if(right[i]>left[i])return r}return l;
    }
    if(keyed(l)&&keyed(r)&&(keyed(b)||b===absent)) {
      const base=new Map((keyed(b)?b:[]).map(x=>[x.id,x])),left=new Map(l.map(x=>[x.id,x])),right=new Map(r.map(x=>[x.id,x]));
      const ids=[...new Set([...l,...r,...(keyed(b)?b:[])].map(x=>x.id))],result=[];
      for(const id of ids){const value=merge(base.has(id)?base.get(id):absent,left.has(id)?left.get(id):absent,right.has(id)?right.get(id):absent,[...path,'$id='+encodeURIComponent(id)]);if(value!==absent)result.push(value)}
      return result;
    }
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
