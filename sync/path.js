import {isAbsolute,relative,resolve,sep} from 'node:path';
// Store data outside the application directory, which may be served as static files.
export function resolveSyncFile(file,appDirectory){
 if(typeof file!=='string'||!isAbsolute(file))throw Error('SYNC_FILE must be an absolute path outside the application directory.');
 const target=resolve(file),root=resolve(appDirectory),rel=relative(root,target);
 if(!rel||(!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep)))throw Error('SYNC_FILE must be outside the application directory.');
 return target;
}
