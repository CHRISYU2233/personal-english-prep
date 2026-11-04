import {createSyncServer} from './server.mjs';
import {fileURLToPath} from 'node:url';
import {resolveSyncFile} from './path.js';
const port=Number(process.env.SYNC_PORT||'8787');
if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid port');
const appDirectory=fileURLToPath(new URL('../',import.meta.url));
const file=resolveSyncFile(process.env.SYNC_FILE,appDirectory);
const server=createSyncServer({token:process.env.SYNC_TOKEN,file,allowedOrigin:process.env.SYNC_PUBLIC_ORIGIN});
server.listen(port,'127.0.0.1',()=>console.log(`Sync backend listening on loopback port ${port}.`));
