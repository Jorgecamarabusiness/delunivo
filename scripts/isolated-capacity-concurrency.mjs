import fs from 'node:fs';
import {parseEnv} from 'node:util';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {localSupabase,requestJson,assert} from './isolated-supabase.mjs';
const portable=process.argv.includes('--portable');
const isolated=portable ? parseEnv(fs.readFileSync('.env.capacity-isolated.local','utf8')) : null;
const local=portable ? {apiUrl:isolated.NEXT_PUBLIC_SUPABASE_URL,serviceRoleKey:isolated.SUPABASE_SERVICE_ROLE_KEY} : localSupabase();
if(!['127.0.0.1','localhost'].includes(new URL(local.apiUrl).hostname)) throw new Error('Isolated loopback only');
const api=(table,body,method='POST',query='')=>requestJson(`${local.apiUrl}/rest/v1/${table}${query}`,{key:local.serviceRoleKey,method,body,headers:{Prefer:'return=representation'}});
const rpc=(name,body)=>api(`rpc/${name}`,body);
const schools=[];
for(let i=0;i<2;i++) {
  const actor=randomUUID(),org=randomUUID(),course=randomUUID(),lesson=randomUUID(),nonce=`${Date.now()}-${i}`;
  if(portable) execFileSync(path.join(process.env.TEMP,'delunivo-capacity-tools/postgres/pgsql/bin/psql.exe'),['-h','127.0.0.1','-p','54399','-U','postgres','-v','ON_ERROR_STOP=1','-c',`insert into auth.users(id,email,raw_user_meta_data) values('${actor}','capacity-race-${nonce}@synthetic.invalid','{}');`],{stdio:'ignore',windowsHide:true});
  else {
    const auth=await requestJson(`${local.apiUrl}/auth/v1/admin/users`,{key:local.serviceRoleKey,method:'POST',body:{id:actor,email:`capacity-race-${nonce}@synthetic.invalid`,password:`Capacity-synthetic-${nonce}!`,email_confirm:true}});
    assert(auth.response.ok,'Synthetic Auth identity not created');
    assert(auth.data.id===actor,'Unexpected synthetic Auth identity');
  }
  for(const [table,body] of [['organizations',{id:org,name:'Capacity race synthetic',slug:`capacity-race-${nonce}`,owner_id:actor}],['organization_admins',{organization_id:org,user_id:actor,role:'owner'}],['organization_billing',{organization_id:org,access_mode:'standard',platform_subscription_status:'canceled'}],['courses',{id:course,organization_id:org,title:'Race synthetic',description:'Synthetic',price:0,status:'published'}],['lessons',{id:lesson,course_id:course,title:'Race synthetic',order_index:0}]]) {
    const result=await api(table,body);assert(result.response.ok,`Fixture ${table} failed: ${result.data?.message ?? result.response.status}`);
  }
  const trial=await rpc('start_platform_trial',{p_organization_id:org,p_offer:{version:'2026-10-01',planKey:'trial'}});assert(trial.response.ok && trial.data===true,'Synthetic trial did not start');
  schools.push({actor,org,course,lesson});
}
const school=schools[0];
const reserve=()=>api('video_assets',{id:randomUUID(),organization_id:school.org,course_id:school.course,lesson_id:school.lesson,block_id:randomUUID(),created_by:school.actor,reserved_duration_seconds:5000,mux_environment:'synthetic',status:'waiting_for_upload'});
const races=await Promise.all([reserve(),reserve()]);
assert(races.filter(r=>r.response.ok).length===1,'Two concurrent uploads spent the same capacity');
assert(races.find(r=>!r.response.ok).data.message==='library_capacity_exceeded','Wrong reservation failure');
const asset=races.find(r=>r.response.ok).data[0];
const b=schools[1];
const other=await api('video_assets',{id:randomUUID(),organization_id:b.org,course_id:b.course,lesson_id:b.lesson,block_id:randomUUID(),created_by:b.actor,reserved_duration_seconds:5000,mux_environment:'synthetic',status:'waiting_for_upload'});
assert(other.response.ok,'School A spent school B capacity');
const expired=await api('video_assets',{reservation_expires_at:new Date(Date.now()-1000).toISOString()},'PATCH',`?id=eq.${asset.id}`);assert(expired.response.ok,'Reservation expiry failed');
const renewed=await reserve();assert(renewed.response.ok,'Expired orphan reservation did not release capacity');
const real=await api('video_assets',{mux_asset_id:`synthetic-${asset.id}`,duration_seconds:7500,status:'ready'},'PATCH',`?id=eq.${asset.id}`);
assert(real.response.ok && real.data[0].status==='errored','Manipulated duration was published');
const start=new Date(Math.floor((Date.now()-20*3600000)/3600000)*3600000).toISOString();
await api('platform_capacity_cycles',{starts_at:new Date(Date.now()-24*3600000).toISOString()},'PATCH',`?organization_id=eq.${school.org}`);
const payload={p_environment:'synthetic',p_start:start,p_rows:[{asset_id:`synthetic-${asset.id}`,delivered_seconds:18001}]};
const imports=await Promise.all([rpc('replace_mux_usage_hour',payload),rpc('replace_mux_usage_hour',payload)]);
assert(imports.every(r=>r.response.ok),'Concurrent importer failed');
const cycles=await api('platform_capacity_cycles',undefined,'GET',`?organization_id=eq.${school.org}`);
assert(Number(cycles.data[0].base_used_seconds)===18000 && Number(cycles.data[0].excess_seconds)===1,'Concurrent import duplicated balances or grace');
const blocked=await rpc('admit_platform_playback',{p_organization_id:school.org,p_user_id:school.actor,p_video_asset_id:asset.id,p_lifetime:900});
assert(blocked.response.ok && blocked.data.reason==='delivery_paused','Reliable exhausted balance still admits');
const rpcs=await Promise.all([rpc('enqueue_platform_resource_notices',{p_organization_id:school.org}),rpc('enqueue_platform_resource_notices',{p_organization_id:school.org})]);assert(rpcs.every(r=>r.response.ok),'Concurrent notice creation failed');
const notices=await api('platform_resource_notices',undefined,'GET',`?organization_id=eq.${school.org}&resource=eq.delivery`);assert(notices.data.length===2,'Concurrent notices duplicate thresholds');
if(!portable) {
  const denied=await requestJson(`${local.apiUrl}/rest/v1/platform_delivery_packs?organization_id=eq.${school.org}`,{key:local.anonKey});assert(!denied.response.ok,'Anonymous Data API exposed a private ledger');
}
console.log('Actual Postgres concurrency passed: two tenants, atomic reservations, expiry, authoritative duration, duplicate imports, exhausted admission, idempotent notices.');
