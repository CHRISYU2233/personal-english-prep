const prefix='english-prep-training-v1:';
const key=exam=>prefix+exam+':materials';
export function listMaterials(storage,exam){try{const rows=JSON.parse(storage.getItem(key(exam))||'[]');return Array.isArray(rows)?rows.filter(x=>x&&typeof x.id==='string'&&x.material&&typeof x.material==='object'):[]}catch{return []}}
export function saveMaterial(storage,exam,id,material){const rows=listMaterials(storage,exam);const i=rows.findIndex(x=>x.id===id),entry={id,material};if(i<0)rows.push(entry);else rows[i]=entry;storage.setItem(key(exam),JSON.stringify(rows));return rows}
