import {localSupabase,requestJson,assert} from './isolated-supabase.mjs';
const {apiUrl,serviceRoleKey}=localSupabase();
const org='71000000-0000-4000-8000-000000000001';
const state=process.argv[2];
if(!['exhaust','restore','revoke'].includes(state)) throw new Error('Unknown synthetic capacity state');
if(state==='revoke') {
 const result=await requestJson(`${apiUrl}/rest/v1/organization_students?organization_id=eq.${org}`,{key:serviceRoleKey,method:'PATCH',body:{status:'removed'}});
 assert(result.response.ok,'Synthetic roster revocation failed');
} else {
 const result=await requestJson(`${apiUrl}/rest/v1/platform_capacity_cycles?organization_id=eq.${org}`,{key:serviceRoleKey,method:'PATCH',body:{base_used_seconds:state==='exhaust'?180000:0,grace_used_seconds:state==='exhaust'?18000:0}});
 assert(result.response.ok,'Synthetic quota transition failed');
}
