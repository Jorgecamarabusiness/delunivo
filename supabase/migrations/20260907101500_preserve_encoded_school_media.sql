create or replace function private.storage_reference_matches(reference text,bucket text,object_name text)
returns boolean language plpgsql immutable set search_path='' as $$
declare path text; bytes bytea:=''::bytea; i integer:=1; c text;
begin
  if reference is null then return false; end if;
  if reference=object_name then return true; end if;
  if reference !~ '^https?://[^/]+/storage/v1/object/(public|sign)/' then return false; end if;
  path:=regexp_replace(reference,'^https?://[^/]+/storage/v1/object/(public|sign)/','');
  if split_part(path,'/',1)<>bucket then return false; end if;
  path:=split_part(substr(path,length(bucket)+2),'?',1);
  while i<=length(path) loop
    c:=substr(path,i,1);
    if c='%' then
      if substr(path,i+1,2) !~ '^[0-9A-Fa-f]{2}$' then return false; end if;
      bytes:=bytes||decode(substr(path,i+1,2),'hex'); i:=i+3;
    else bytes:=bytes||convert_to(c,'UTF8'); i:=i+1;
    end if;
  end loop;
  return convert_from(bytes,'UTF8')=object_name;
exception when character_not_in_repertoire or untranslatable_character then return false;
end;
$$;
revoke all on function private.storage_reference_matches(text,text,text) from public,anon,authenticated;

create or replace function public.detach_account_school_storage(p_job_id uuid,p_lease_token uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare j public.account_deletion_jobs%rowtype; remaining integer;
begin
  select * into j from public.account_deletion_jobs where id=p_job_id and lease_token=p_lease_token
    and lease_until>now() and stage='storage' for update;
  if not found then raise exception 'invalid_job_lease'; end if;
  update storage.objects o set owner=null,owner_id=null
    where (o.owner=j.target_user_id or o.owner_id=j.target_user_id::text) and (
      exists(select 1 from public.organizations org where org.id=any(j.school_ids) and org.id::text=split_part(o.name,'/',1))
      or exists(select 1 from public.lessons l join public.courses c on c.id=l.course_id,
        lateral jsonb_array_elements(l.blocks) b where c.organization_id=any(j.school_ids) and (
          (b->>'type'='video_file' and private.storage_reference_matches(b->>'video_url',o.bucket_id,o.name))
          or (b->>'type'='text' and exists(select 1 from regexp_matches(b->>'content',$re$<img[[:space:]]+(?:[^>]*[[:space:]])?src[[:space:]]*=[[:space:]]*["']([^"']+)["']$re$,'gi') ref
            where private.storage_reference_matches(ref[1],o.bucket_id,o.name)))
        ))
      or exists(select 1 from public.courses c where c.organization_id=any(j.school_ids)
        and private.storage_reference_matches(c.thumbnail_url,o.bucket_id,o.name))
      or exists(select 1 from public.organizations org where org.id=any(j.school_ids)
        and private.storage_reference_matches(org.logo_url,o.bucket_id,o.name))
    );
  select count(*) into remaining from storage.objects where owner=j.target_user_id or owner_id=j.target_user_id::text;
  return remaining;
end;
$$;
revoke all on function public.detach_account_school_storage(uuid,uuid) from public,anon,authenticated;
grant execute on function public.detach_account_school_storage(uuid,uuid) to service_role;
