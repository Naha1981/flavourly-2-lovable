import {readFile,writeFile} from 'node:fs/promises';
const dir=new URL('../../dist/_worker.js/',import.meta.url);
await writeFile(new URL('index.js',dir),`import app from './nitro-entry.js';
import process from 'node:process';
export default {async fetch(request,env,ctx){for(const k of ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_PUBLISHABLE_KEY','REQUIRE_AUTH','PUBLIC_APP_URL'])if(env[k])process.env[k]=env[k];return app.fetch(request,env,ctx);}};
`);
const cfg=JSON.parse(await readFile(new URL('wrangler.json',dir),'utf8'));
cfg.vars={SUPABASE_URL:'https://sllsevzvlarcmdyxaibm.supabase.co',PUBLIC_APP_URL:'https://flavourly.nahalabs.co.za',REQUIRE_AUTH:'true'};
await writeFile(new URL('wrangler.json',dir),JSON.stringify(cfg,null,2));
