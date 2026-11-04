import {createSyncServer} from './server.mjs';
import {resolve} from 'node:path';
const port=Number(process.env.SYNC_PORT||'8787');
if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid port');
const server=createSyncServer({token:process.env.SYNC_TOKEN,file:resolve(process.env.SYNC_FILE||'./private-data/sync-state.json'),allowedOrigin:process.env.SYNC_PUBLIC_ORIGIN});
server.listen(port,'127.0.0.1',()=>console.log(`Sync backend listening on loopback port ${port}.`));
