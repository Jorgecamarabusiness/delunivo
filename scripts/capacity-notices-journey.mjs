// Real local SQL outbox + application worker + Resend SDK; transport is captured.
// No email is sent, including to account owners. Run after portable concurrency.
import fs from 'node:fs';
import {parseEnv} from 'node:util';
import assert from 'node:assert/strict';
const isolated=parseEnv(fs.readFileSync('.env.capacity-isolated.local','utf8'));
if(new URL(isolated.NEXT_PUBLIC_SUPABASE_URL).origin!=='http://127.0.0.1:54398') throw new Error('Verified portable REST required');
Object.assign(process.env,isolated,{STRIPE_SECRET_KEY:'sk_test_synthetic_no_network',PLATFORM_CAPACITY_WORKER_ENABLED:'true',MUX_USAGE_IMPORT_ENABLED:'false',PLATFORM_CAPACITY_NOTICES_ENABLED:'true',EMAIL_DELIVERY_MODE:'live',VERCEL_ENV:'',RESEND_API_KEY:'re_synthetic_transport',RESEND_FROM_EMAIL:'notices@synthetic.invalid',PLATFORM_RETENTION_EXECUTE:''});
const captured=[];
let failNext=false;
const nativeFetch=globalThis.fetch;
globalThis.fetch=async(input,init)=>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
 if(url.hostname==='api.resend.com'){
  assert.equal(url.pathname,'/emails');
  const body=JSON.parse(init.body);
  assert(body.to.every(email=>email.endsWith('@synthetic.invalid')),'Synthetic recipients only');
  const idempotencyKey=new Headers(init.headers).get('idempotency-key');
  assert(idempotencyKey?.startsWith('capacity-notice-'));
  captured.push({to:body.to,subject:body.subject,html:body.html,idempotencyKey});
  if(failNext){failNext=false;return Response.json({message:'Synthetic provider failure',name:'validation_error'},{status:422});}
  return Response.json({id:'94000000-0000-4000-8000-000000000100'});
 }
 if(!['127.0.0.1','localhost'].includes(url.hostname)) throw new Error('Email journey forbids outbound network');
 return nativeFetch(input,init);
};
const {runCapacityMaintenance}=await import('../src/lib/billing/worker.ts');
const {createAdminClient}=await import('../src/lib/supabase/admin.ts');
const db=createAdminClient();
const first=await runCapacityMaintenance();
assert(first.sent>=2);assert.equal(first.failures.length,0);assert.equal(captured.length,first.sent);
assert(captured.some(m=>m.html.includes('70%')) && captured.some(m=>m.html.includes('90%')));
assert.equal((await runCapacityMaintenance()).sent,0);assert.equal(captured.length,first.sent);
const row=(await db.from('platform_resource_notices').select('organization_id').limit(1).single()).data;
assert(row);
const inserted=await db.from('platform_resource_notices').insert({organization_id:row.organization_id,resource:'retention',cycle_key:'synthetic-failure',threshold:'ended',payload:{deleteAfter:'2026-11-01T12:00:00Z'}}).select('id').single();
assert.equal(inserted.error,null);
failNext=true;
const failed=await runCapacityMaintenance();
assert(failed.failures.includes('notice_delivery_failed'));
const afterFailure=(await db.from('platform_resource_notices').select('sent_at,last_error').eq('id',inserted.data.id).single()).data;
assert.equal(afterFailure.sent_at,null);assert(afterFailure.last_error);
const retried=await runCapacityMaintenance();assert.equal(retried.sent,1);
assert.equal(captured.at(-1).idempotencyKey,captured.at(-2).idempotencyKey);
assert(captured.at(-1).html.includes('2026-11-01T12:00:00Z'));
assert.equal((await runCapacityMaintenance()).sent,0);
fs.writeFileSync('docs/evidencias/plans-2026-10-01/notices-synthetic-journey.json',JSON.stringify({checkedAt:new Date().toISOString(),database:'real native PostgreSQL and PostgREST',provider:'Resend SDK with intercepted transport, no delivery',checks:['70/90 recipients synthetic, unique notice per cycle','Duplicate worker does not resend','Provider failure remains unsent and retries with the same idempotency key','Retention date preserved in rendered message'],captured:captured.map(({html,...metadata})=>metadata)},null,2)+'\n');
console.log('Synthetic notice journey passed: real SQL outbox, SDK payload, duplicate suppression and failed-provider recovery. No mail sent.');
