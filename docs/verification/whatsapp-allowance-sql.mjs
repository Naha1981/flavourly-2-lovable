import {PGlite} from '@electric-sql/pglite';import fs from 'node:fs';
const root=process.cwd();const db=new PGlite();
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;`);
for(const f of fs.readdirSync(root+'/supabase/migrations').sort())await db.exec(fs.readFileSync(root+'/supabase/migrations/'+f,'utf8').replace(/CREATE EXTENSION[^;]*;/gi,''));
const assert=(v,m)=>{if(!v)throw Error(m);console.log('PASS',m)};
await db.exec(`INSERT INTO tenant_profiles(tenant_id,name,plan_tier,plan_status) VALUES('a','A','starter','active'),('b','B','casual','active'),('c','C','premium','active'),('trial','Trial','starter','trialing');`);
const reserve=async(t,k='send')=>(await db.query('SELECT wa_reserve_budget($1,$2) ok',[t,k])).rows[0].ok;
const usage=async t=>(await db.query('SELECT wa_reply_usage($1) u',[t])).rows[0].u;
assert((await usage('a')).monthlyLimit===500,'Starter 500');assert((await usage('b')).monthlyLimit===1000,'Growth 1000');assert((await usage('c')).monthlyLimit===2500,'Pro 2500');
for(let n=0;n<25;n++)assert(await reserve('a'),'pilot reservation '+(n+1));assert(!(await reserve('a')),'26th daily reply blocked');assert(!(await reserve('a','draft')),'AI draft blocked when reply limit full');assert(await reserve('b'),'tenant isolation');
await db.exec(`DELETE FROM wa_budget_uses;`);
// Test fixed month limits without the conservative daily guard masking them.
for(const [t,limit] of [['a',500],['b',1000],['c',2500]]){
 await db.query(`INSERT INTO wa_budget_uses SELECT $1,'send',(date_trunc('month',now() AT TIME ZONE 'Africa/Johannesburg') AT TIME ZONE 'Africa/Johannesburg')+interval '1 minute' FROM generate_series(1,$2)`,[t,limit]);
 assert(!(await reserve(t)),t+' monthly cap blocked');assert((await usage(t)).reason==='monthly_limit',t+' monthly reason');
}
await db.exec(`DELETE FROM wa_budget_uses; INSERT INTO wa_budget_uses SELECT 'trial','send',now()-interval '40 days' FROM generate_series(1,100);`);
assert(!(await reserve('trial')),'trial100 blocks across month rollover');assert((await usage('trial')).reason==='trial_limit','trial reason');
await db.exec(`UPDATE tenant_profiles SET trial_ends_at=now()-interval '1 second' WHERE tenant_id='trial';`);assert(!(await reserve('trial')),'expired trial blocked');
await db.exec(`UPDATE tenant_profiles SET plan_status='past_due' WHERE tenant_id='b';`);assert(!(await reserve('b')),'past due blocked');assert(!(await reserve('missing')),'missing tenant blocked');
await db.exec(`DELETE FROM wa_budget_uses; INSERT INTO wa_budget_uses SELECT 'a','send',now() FROM generate_series(1,24);`);
const race=await Promise.all(Array.from({length:8},()=>reserve('a')));assert(race.filter(Boolean).length===1,'concurrent final-slot attempts only reserve once');
assert((await usage('a')).dailyUsed===25,'atomic usage total');
const privileges=(await db.query(`SELECT has_function_privilege('anon','wa_reply_usage(text)','EXECUTE') a,has_function_privilege('authenticated','wa_reply_usage(text)','EXECUTE') u,has_function_privilege('service_role','wa_reply_usage(text)','EXECUTE') s`)).rows[0];assert(!privileges.a&&!privileges.u&&privileges.s,'usage RPC server only');
await db.close();
