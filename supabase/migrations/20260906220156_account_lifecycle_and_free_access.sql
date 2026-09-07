-- Additive lifecycle/free-access rollout. Apply only after isolated verification.
-- External resources are reconciled by a leased server worker; Auth is last.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.profiles add column account_status text not null default 'active'
  check (account_status in ('active', 'deleting'));
alter table public.student_course_access
  add column grant_source text not null default 'invite' check (grant_source in ('invite', 'free')),
  add column revoked_at timestamptz;
alter table public.organization_students drop constraint organization_students_joined_via_check;
alter table public.organization_students add constraint organization_students_joined_via_check
  check (joined_via in ('self_register', 'invite', 'purchase', 'free'));

alter table public.organizations
  add column seller_legal_name text check (char_length(seller_legal_name) <= 160),
  add column seller_tax_id text check (char_length(seller_tax_id) <= 80),
  add column seller_address text check (char_length(seller_address) <= 500),
  add column seller_contact_email text check (char_length(seller_contact_email) <= 254),
  add column seller_country text check (char_length(seller_country) <= 100);

create table public.account_deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null unique, -- historical subject, deliberately not an Auth FK
  actor_user_id uuid,
  administrative boolean not null,
  reason text check (char_length(reason) <= 500),
  school_ids uuid[] not null default '{}',
  tracking_hash text not null check (tracking_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending' check (status in ('pending','processing','retry','completed')),
  stage text not null default 'sessions' check (stage in ('sessions','checkouts','storage','personal_data','auth','completed')),
  attempts integer not null default 0,
  lease_token uuid,
  lease_until timestamptz,
  next_attempt_at timestamptz not null default now(),
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  audit_expires_at timestamptz not null default now() + interval '1 year',
  tombstone_expires_at timestamptz not null default now() + interval '6 years'
);
create index account_deletion_jobs_pending_idx on public.account_deletion_jobs(next_attempt_at)
  where status <> 'completed';
alter table public.account_deletion_jobs enable row level security;
revoke all on public.account_deletion_jobs from public, anon, authenticated;
grant select, insert, update, delete on public.account_deletion_jobs to service_role;

create table private.account_action_limits (
  actor_id uuid not null,
  action text not null,
  window_start timestamptz not null,
  attempts integer not null,
  primary key(actor_id, action)
);
alter table private.account_action_limits enable row level security;

create or replace function private.account_active(subject uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = subject and p.account_status = 'active')
    and not exists (select 1 from public.account_deletion_jobs j where j.target_user_id = subject);
$$;

-- Checking auth.sessions also closes the otherwise valid old-JWT window.
create or replace function public.current_account_is_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.account_active(auth.uid()) and exists (
    select 1 from auth.sessions s
    where s.user_id = auth.uid() and s.id::text = auth.jwt()->>'session_id'
      and (s.not_after is null or s.not_after > now())
  );
$$;
revoke all on function public.current_account_is_active() from public, anon;
grant execute on function public.current_account_is_active() to authenticated, service_role;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_account_is_active() and exists (
    select 1 from public.profiles where id = auth.uid() and is_super_admin
  );
$$;
create or replace function public.is_org_admin(org_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_account_is_active() and (public.is_super_admin() or exists (
    select 1 from public.organization_admins where organization_id=org_id and user_id=auth.uid()
  ));
$$;
create or replace function public.is_org_owner(org_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_account_is_active() and (public.is_super_admin() or exists (
    select 1 from public.organization_admins where organization_id=org_id and user_id=auth.uid() and role='owner'
  ));
$$;
create or replace function public.is_org_student(org_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_account_is_active() and exists (
    select 1 from public.organization_students where organization_id=org_id and user_id=auth.uid() and status='active'
  );
$$;

-- Restrictive policies are AND-ed with existing tenant policies, not replacements.
do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('create policy active_account_required on public.%I as restrictive for all to authenticated using ((select public.current_account_is_active())) with check ((select public.current_account_is_active()))', t.tablename);
  end loop;
end $$;
create policy active_account_required on storage.objects as restrictive for all to authenticated
  using ((select public.current_account_is_active())) with check ((select public.current_account_is_active()));

-- History remains attached to the original subject, never reassigned by email.
alter table public.purchases
  add column historical_user_id uuid,
  add column access_status text not null default 'active' check (access_status in ('active','refunded','disputed')),
  drop constraint purchases_user_id_fkey,
  add constraint purchases_user_id_fkey foreign key(user_id) references public.profiles(id) on delete set null;
alter table public.stripe_checkout_attempts
  add column historical_user_id uuid,
  alter column user_id drop not null,
  drop constraint stripe_checkout_attempts_user_id_fkey,
  add constraint stripe_checkout_attempts_user_id_fkey foreign key(user_id) references public.profiles(id) on delete set null,
  drop constraint stripe_checkout_attempts_session_shape_check,
  add constraint stripe_checkout_attempts_session_shape_check check (stripe_session_url is null or stripe_session_id is not null);

-- School resources and affiliate contracts outlive an individual uploader.
do $$ declare r record; begin
  for r in select * from (values
    ('video_assets','created_by'), ('organization_referral_codes','created_by'),
    ('organization_referrals','referrer_owner_id'), ('organization_referrals','referred_owner_id'),
    ('support_impersonation_sessions','actor_user_id'), ('support_impersonation_sessions','target_user_id'),
    ('support_impersonation_sessions','ended_by')
  ) as columns_to_detach(tbl,col) loop
    execute format('alter table public.%I alter column %I drop not null',r.tbl,r.col);
    execute format('alter table public.%I drop constraint %I',r.tbl,r.tbl||'_'||r.col||'_fkey');
    execute format('alter table public.%I add constraint %I foreign key (%I) references auth.users(id) on delete set null',r.tbl,r.tbl||'_'||r.col||'_fkey',r.col);
  end loop;
end $$;

create or replace function public.has_course_access(target_course_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_account_is_active() and coalesce((select
    public.is_org_admin(c.organization_id) or (
      c.status='published' and public.is_org_student(c.organization_id) and (
        exists(select 1 from public.purchases p where p.course_id=c.id and p.organization_id=c.organization_id and p.user_id=auth.uid() and p.access_status='active')
        or exists(select 1 from public.student_course_access a where a.course_id=c.id and a.user_id=auth.uid() and a.revoked_at is null)
      )
    ) from public.courses c where c.id=target_course_id),false);
$$;

-- All identity/ownership mutations serialize on the same transaction lock.
-- This applies to service_role and FK cascades as well as authenticated writes.
create or replace function private.protect_account_invariants()
returns trigger language plpgsql security definer set search_path = '' as $$
declare subject uuid; org uuid;
begin
  perform pg_advisory_xact_lock(742109, 1);
  if tg_table_name='profiles' then
    if tg_op='UPDATE' and new.account_status=old.account_status and new.is_super_admin=old.is_super_admin then return new; end if;
    subject:=old.id;
    if old.is_super_admin and old.account_status='active' and
      (tg_op='DELETE' or not new.is_super_admin or new.account_status<>'active') and
      not exists(select 1 from public.profiles p where p.id<>subject and p.is_super_admin and p.account_status='active') then
      raise exception 'last_superadmin_requires_successor';
    end if;
    if tg_op='DELETE' or new.account_status<>'active' then
      if exists(select 1 from public.organizations where owner_id=subject) then raise exception 'school_owner_requires_successor'; end if;
      if exists(select 1 from public.organization_admins a where a.user_id=subject and a.role='owner'
        and not exists(select 1 from public.organization_admins b join public.profiles p on p.id=b.user_id
          where b.organization_id=a.organization_id and b.user_id<>subject and b.role='owner' and p.account_status='active')) then
        raise exception 'last_owner_requires_successor';
      end if;
    end if;
  elsif tg_table_name='organization_admins' then
    if tg_op='INSERT' then
      if not private.account_active(new.user_id) then raise exception 'account_inactive'; end if;
      return new;
    end if;
    if tg_op='UPDATE' and new.user_id=old.user_id and new.organization_id=old.organization_id and new.role=old.role then return new; end if;
    org:=old.organization_id;
    if old.role='owner' and exists(select 1 from public.organizations where id=org) and
      not exists(select 1 from public.organization_admins a join public.profiles p on p.id=a.user_id
        where a.organization_id=org and a.id<>old.id and a.role='owner' and p.account_status='active') then
      raise exception 'last_owner_requires_successor';
    end if;
    if exists(select 1 from public.organizations where id=org and owner_id=old.user_id) then
      raise exception 'canonical_owner_requires_transfer';
    end if;
  elsif tg_table_name='organizations' then
    if new.owner_id<>old.owner_id and (not private.account_active(new.owner_id) or not exists(
      select 1 from public.organization_admins where organization_id=new.id and user_id=new.owner_id and role='owner'
    )) then raise exception 'invalid_owner_successor'; end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger protect_account_invariants before update or delete on public.profiles
  for each row execute function private.protect_account_invariants();
create trigger protect_owner_invariants before insert or update or delete on public.organization_admins
  for each row execute function private.protect_account_invariants();
create trigger protect_organization_owner before update of owner_id on public.organizations
  for each row execute function private.protect_account_invariants();

create or replace function public.grant_free_course_access(p_course_id uuid,p_organization_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); course public.courses%rowtype; roster_status text; existing_access public.student_course_access%rowtype;
begin
  if not public.current_account_is_active() then return 'account_inactive'; end if;
  perform 1 from public.profiles where id=actor and account_status='active' for update;
  if not found or not private.account_active(actor) then return 'account_inactive'; end if;
  select * into course from public.courses where id=p_course_id and organization_id=p_organization_id for update;
  if not found or course.status<>'published' then return 'not_available'; end if;
  select status into roster_status from public.organization_students where user_id=actor and organization_id=p_organization_id for update;
  if roster_status='removed' then return 'removed'; end if;
  select * into existing_access from public.student_course_access where user_id=actor and course_id=p_course_id;
  if existing_access.revoked_at is not null then return 'revoked'; end if;
  if existing_access.user_id is not null or exists(select 1 from public.purchases where user_id=actor and course_id=p_course_id and organization_id=p_organization_id and access_status='active') then return 'already_has_access'; end if;
  if course.price is null or course.price<>0 then return 'price_changed'; end if;
  if not exists(select 1 from public.organization_billing b where b.organization_id=p_organization_id and (
    b.platform_subscription_status in ('active','trialing','past_due') or
    (b.access_mode='complimentary' and (b.access_expires_at is null or b.access_expires_at>now())) or
    (b.access_mode='trial' and b.access_expires_at>now())
  )) then return 'not_available'; end if;
  if exists(select 1 from public.stripe_checkout_attempts where user_id=actor and course_id=p_course_id and status in ('creating','open')) then return 'checkout_pending'; end if;
  insert into public.organization_students(organization_id,user_id,status,joined_via)
    values(p_organization_id,actor,'active','free') on conflict(organization_id,user_id) do nothing;
  insert into public.student_course_access(user_id,course_id,grant_source)
    values(actor,p_course_id,'free') on conflict(user_id,course_id) do nothing;
  return 'granted';
end;
$$;
revoke all on function public.grant_free_course_access(uuid,uuid) from public,anon;
grant execute on function public.grant_free_course_access(uuid,uuid) to authenticated;

-- Service writers and late jobs cannot attach new access to a deleting identity.
create or replace function private.require_active_access_subject()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.profiles where id=new.user_id and account_status='active' for update;
  if not found or not private.account_active(new.user_id) then raise exception 'account_inactive'; end if;
  return new;
end;
$$;
create trigger active_student_subject before insert on public.organization_students
  for each row execute function private.require_active_access_subject();
create trigger active_entitlement_subject before insert or update on public.student_course_access
  for each row execute function private.require_active_access_subject();
create trigger active_checkout_subject before insert on public.stripe_checkout_attempts
  for each row execute function private.require_active_access_subject();

create or replace function public.account_action_allowed(p_actor_id uuid,p_action text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if p_action not in ('reauth','retry') or not private.account_active(p_actor_id) then return false; end if;
  insert into private.account_action_limits(actor_id,action,window_start,attempts) values(p_actor_id,p_action,now(),1)
    on conflict(actor_id,action) do update set
      window_start=case when private.account_action_limits.window_start<now()-interval '15 minutes' then now() else private.account_action_limits.window_start end,
      attempts=case when private.account_action_limits.window_start<now()-interval '15 minutes' then 1 else private.account_action_limits.attempts+1 end
    returning attempts into n;
  return n<=5;
end;
$$;

create or replace function public.begin_account_deletion(
  p_actor_id uuid,p_target_id uuid,p_actor_session_id uuid,p_confirmation_email text,
  p_reason text,p_successors jsonb,p_super_successor uuid,p_tracking_hash text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target public.profiles%rowtype; org record; successor uuid; job_id uuid; actor_super boolean; schools uuid[];
begin
  perform pg_advisory_xact_lock(742109,1);
  select is_super_admin into actor_super from public.profiles where id=p_actor_id and account_status='active';
  if not found or not private.account_active(p_actor_id) or (p_actor_id<>p_target_id and not actor_super) then raise exception 'not_authorized'; end if;
  if not exists(select 1 from auth.sessions where id=p_actor_session_id and user_id=p_actor_id and created_at>now()-interval '5 minutes') then raise exception 'recent_reauthentication_required'; end if;
  if exists(select 1 from public.support_impersonation_sessions where status='active' and expires_at>now() and (actor_user_id=p_actor_id or target_user_id=p_actor_id)) then raise exception 'run_as_not_allowed'; end if;
  select * into target from public.profiles where id=p_target_id for update;
  if not found then raise exception 'account_not_found'; end if;
  if lower(trim(p_confirmation_email))<>lower(target.email) then raise exception 'confirmation_mismatch'; end if;
  if p_actor_id<>p_target_id and (p_reason is null or char_length(trim(p_reason)) not between 5 and 500) then raise exception 'administrative_reason_required'; end if;
  select id into job_id from public.account_deletion_jobs where target_user_id=p_target_id;
  if job_id is not null then return job_id; end if;
  select array_agg(distinct id) into schools from (
    select organization_id as id from public.organization_admins where user_id=p_target_id
    union select id from public.organizations where owner_id=p_target_id
  ) memberships;
  if target.is_super_admin and not exists(select 1 from public.profiles where id<>p_target_id and is_super_admin and account_status='active') then
    if p_super_successor is null or p_super_successor=p_target_id or not private.account_active(p_super_successor) then raise exception 'last_superadmin_requires_successor'; end if;
    update public.profiles set is_super_admin=true where id=p_super_successor;
  end if;
  for org in select distinct o.id from public.organizations o left join public.organization_admins a on a.organization_id=o.id
    where o.owner_id=p_target_id or (a.user_id=p_target_id and a.role='owner') order by o.id loop
    perform 1 from public.organizations where id=org.id for update;
    successor:=nullif(p_successors->>org.id::text,'')::uuid;
    if successor is null then select a.user_id into successor from public.organization_admins a join public.profiles p on p.id=a.user_id
      where a.organization_id=org.id and a.user_id<>p_target_id and a.role='owner' and p.account_status='active' order by a.created_at limit 1; end if;
    if successor is null or successor=p_target_id or not private.account_active(successor) or not exists(
      select 1 from public.organization_admins where organization_id=org.id and user_id=successor
    ) then raise exception 'school_owner_requires_successor'; end if;
    update public.organization_admins set role='owner' where organization_id=org.id and user_id=successor;
    update public.organizations set owner_id=successor where id=org.id and owner_id=p_target_id;
    delete from public.organization_admins where organization_id=org.id and user_id=p_target_id;
  end loop;
  update public.profiles set account_status='deleting' where id=p_target_id;
  insert into public.account_deletion_jobs(target_user_id,actor_user_id,administrative,reason,tracking_hash,school_ids)
    values(p_target_id,p_actor_id,p_actor_id<>p_target_id,case when p_actor_id<>p_target_id then trim(p_reason) else null end,p_tracking_hash,coalesce(schools,'{}'))
    returning id into job_id;
  -- The session rows own refresh-token rows; deletion revokes them atomically.
  delete from auth.sessions where user_id=p_target_id;
  update public.support_impersonation_sessions set status='revoked',ended_at=now(),end_reason='Account deletion',encrypted_actor_session='',ip_address=null,user_agent=null
    where status='active' and (actor_user_id=p_target_id or target_user_id=p_target_id);
  return job_id;
end;
$$;

create or replace function public.claim_account_deletion_job(p_job_id uuid default null)
returns setof public.account_deletion_jobs language plpgsql security definer set search_path = '' as $$
begin
  return query update public.account_deletion_jobs j set status='processing',attempts=j.attempts+1,
    lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',updated_at=now()
    where j.id=(select x.id from public.account_deletion_jobs x where x.status<>'completed'
      and (p_job_id is null or x.id=p_job_id) and x.next_attempt_at<=now()
      and (x.lease_until is null or x.lease_until<now()) order by x.created_at for update skip locked limit 1)
    returning j.*;
end;
$$;

create or replace function public.clean_account_personal_data(p_job_id uuid,p_lease_token uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare j public.account_deletion_jobs%rowtype; target_email text;
begin
  select * into j from public.account_deletion_jobs where id=p_job_id and lease_token=p_lease_token and lease_until>now() and stage='personal_data' for update;
  if not found then raise exception 'invalid_job_lease'; end if;
  if exists(select 1 from public.stripe_checkout_attempts where user_id=j.target_user_id and status in ('creating','open')) then raise exception 'open_checkouts_remain'; end if;
  if exists(select 1 from storage.objects where owner=j.target_user_id or owner_id=j.target_user_id::text) then raise exception 'owned_storage_remains'; end if;
  select email into target_email from public.profiles where id=j.target_user_id;
  update public.purchases set historical_user_id=j.target_user_id,user_id=null where user_id=j.target_user_id;
  update public.stripe_checkout_attempts set historical_user_id=j.target_user_id,user_id=null,stripe_params='{}',stripe_session_url=null,error_message=null where user_id=j.target_user_id;
  delete from public.verification_codes where lower(email)=lower(target_email);
  delete from public.admin_emails where lower(email)=lower(target_email);
  delete from public.invitations where lower(email)=lower(target_email);
  delete from public.video_views where user_id=j.target_user_id;
  delete from public.student_course_access where user_id=j.target_user_id;
  delete from public.organization_students where user_id=j.target_user_id;
  delete from public.organization_admins where user_id=j.target_user_id;
  update public.support_impersonation_sessions set encrypted_actor_session='',ip_address=null,user_agent=null,reason='Account deletion',end_reason='Account deletion'
    where actor_user_id=j.target_user_id or target_user_id=j.target_user_id;
  delete from auth.sessions where user_id=j.target_user_id;
  delete from private.account_action_limits where actor_id=j.target_user_id;
end;
$$;

-- Only confirmed school references are detached. Unmatched personal objects need
-- explicit resolution instead of a blanket cascade or silent indefinite retention.
create or replace function public.detach_account_school_storage(p_job_id uuid,p_lease_token uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare j public.account_deletion_jobs%rowtype; remaining integer;
begin
  select * into j from public.account_deletion_jobs where id=p_job_id and lease_token=p_lease_token and lease_until>now() and stage='storage' for update;
  if not found then raise exception 'invalid_job_lease'; end if;
  update storage.objects o set owner=null,owner_id=null where (o.owner=j.target_user_id or o.owner_id=j.target_user_id::text) and (
    exists(select 1 from public.organizations org where org.id=any(j.school_ids) and org.id::text=split_part(o.name,'/',1))
    or (o.bucket_id='lesson-media' and exists(
      select 1 from public.lessons l join public.courses c on c.id=l.course_id,
        lateral jsonb_array_elements(l.blocks) b
      where c.organization_id=any(j.school_ids) and b->>'type'='video_file'
        and (b->>'video_url'=o.name or
          split_part(regexp_replace(b->>'video_url','^https?://[^/]+/storage/v1/object/(public|sign)/lesson-media/',''),'?',1)=o.name)
    ))
    or exists(select 1 from public.courses c where c.organization_id=any(j.school_ids)
      and split_part(regexp_replace(c.thumbnail_url,'^https?://[^/]+/storage/v1/object/(public|sign)/'||o.bucket_id||'/',''),'?',1)=o.name)
    or exists(select 1 from public.organizations org where org.id=any(j.school_ids)
      and split_part(regexp_replace(org.logo_url,'^https?://[^/]+/storage/v1/object/(public|sign)/'||o.bucket_id||'/',''),'?',1)=o.name)
  );
  select count(*) into remaining from storage.objects where owner=j.target_user_id or owner_id=j.target_user_id::text;
  return remaining;
end;
$$;

-- Every privileged lifecycle RPC is server-only, including metadata cleanup.
revoke all on function public.account_action_allowed(uuid,text) from public,anon,authenticated;
revoke all on function public.begin_account_deletion(uuid,uuid,uuid,text,text,jsonb,uuid,text) from public,anon,authenticated;
revoke all on function public.claim_account_deletion_job(uuid) from public,anon,authenticated;
revoke all on function public.clean_account_personal_data(uuid,uuid) from public,anon,authenticated;
revoke all on function public.detach_account_school_storage(uuid,uuid) from public,anon,authenticated;
grant execute on function public.account_action_allowed(uuid,text) to service_role;
grant execute on function public.begin_account_deletion(uuid,uuid,uuid,text,text,jsonb,uuid,text) to service_role;
grant execute on function public.claim_account_deletion_job(uuid) to service_role;
grant execute on function public.clean_account_personal_data(uuid,uuid) to service_role;
grant execute on function public.detach_account_school_storage(uuid,uuid) to service_role;

-- Definer internals have no direct API surface.
revoke all on all functions in schema private from public,anon,authenticated;

alter table public.purchases
  add column stripe_payment_intent_id text,
  add column stripe_account_id text,
  add column refunded_amount_cents integer not null default 0 check (refunded_amount_cents>=0),
  add column dispute_status text,
  add column dispute_event_at timestamptz,
  add column reconciliation_required boolean not null default false;
create index purchases_payment_intent_idx on public.purchases(stripe_account_id,stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
update public.purchases set historical_user_id=user_id where historical_user_id is null;
update public.stripe_checkout_attempts set historical_user_id=user_id where historical_user_id is null;

create or replace function private.guard_checkout_offer()
returns trigger language plpgsql security definer set search_path='' as $$
declare c public.courses%rowtype;
begin
  if tg_op='INSERT' then new.historical_user_id:=new.user_id; end if;
  if tg_op='UPDATE' and new.status<>'open' then return new; end if;
  if new.checkout_kind<>'course_purchase' then return new; end if;
  perform 1 from public.profiles where id=new.user_id and account_status='active' for update;
  if not found or not private.account_active(new.user_id) then raise exception 'account_inactive'; end if;
  select * into c from public.courses where id=new.course_id and organization_id=new.organization_id for update;
  if not found or c.status<>'published' or c.price is null or c.price<=0 or c.price::text='NaN'
    or round(c.price*100)<>new.expected_amount_total then raise exception 'course_price_changed'; end if;
  if exists(select 1 from public.organization_students where user_id=new.user_id and organization_id=new.organization_id and status='removed') then raise exception 'student_removed'; end if;
  if not exists(select 1 from public.organization_billing b where b.organization_id=new.organization_id and (
    b.platform_subscription_status in ('active','trialing','past_due') or
    (b.access_mode='complimentary' and (b.access_expires_at is null or b.access_expires_at>now())) or
    (b.access_mode='trial' and b.access_expires_at>now())
  )) then raise exception 'school_not_accepting_sales'; end if;
  if exists(select 1 from public.student_course_access where user_id=new.user_id and course_id=new.course_id)
    or exists(select 1 from public.purchases where user_id=new.user_id and course_id=new.course_id) then raise exception 'existing_course_rights'; end if;
  return new;
end;
$$;
create trigger guard_checkout_offer before insert or update of status on public.stripe_checkout_attempts
  for each row execute function private.guard_checkout_offer();

-- One transaction records the receipt and grants access only to the original
-- active identity. Removed/deleting subjects go to manual reconciliation.
create or replace function public.complete_course_checkout(
  p_attempt_id uuid,p_session_id text,p_account_id text,p_amount_cents integer,p_currency text,p_payment_intent_id text
)
returns void language plpgsql security definer set search_path='' as $$
declare a public.stripe_checkout_attempts%rowtype; subject uuid; grant_user uuid; blocked boolean;
begin
  select * into a from public.stripe_checkout_attempts where id=p_attempt_id;
  if not found then raise exception 'checkout_not_found'; end if;
  subject:=coalesce(a.user_id,a.historical_user_id);
  perform 1 from public.profiles where id=subject for update;
  perform 1 from public.courses where id=a.course_id and organization_id=a.organization_id for update;
  if not found then raise exception 'checkout_course_mismatch'; end if;
  select * into a from public.stripe_checkout_attempts where id=p_attempt_id for update;
  if a.checkout_kind<>'course_purchase' or a.stripe_session_id is distinct from p_session_id or a.stripe_account_id is distinct from p_account_id
    or a.expected_amount_total is distinct from p_amount_cents or a.expected_currency is distinct from p_currency then raise exception 'checkout_mismatch'; end if;
  if a.status='completed' then return; end if;
  blocked:=not private.account_active(subject) or exists(select 1 from public.organization_students where user_id=subject and organization_id=a.organization_id and status='removed')
    or exists(select 1 from public.student_course_access where user_id=subject and course_id=a.course_id)
    or exists(select 1 from public.purchases where user_id=subject and course_id=a.course_id and external_reference is distinct from p_session_id);
  grant_user:=case when blocked then null else subject end;
  insert into public.purchases(user_id,historical_user_id,course_id,organization_id,amount_paid,payment_method,external_reference,stripe_account_id,stripe_payment_intent_id,reconciliation_required)
    values(grant_user,subject,a.course_id,a.organization_id,p_amount_cents/100.0,'stripe',p_session_id,p_account_id,p_payment_intent_id,blocked)
    on conflict(payment_method,external_reference) where external_reference is not null do nothing;
  if not blocked then
    insert into public.organization_students(organization_id,user_id,status,joined_via) values(a.organization_id,subject,'active','purchase')
      on conflict(organization_id,user_id) do nothing;
  end if;
  update public.stripe_checkout_attempts set status='completed',stripe_session_url=null,updated_at=now() where id=a.id;
end;
$$;
revoke all on function public.complete_course_checkout(uuid,text,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.complete_course_checkout(uuid,text,text,integer,text,text) to service_role;

create table public.stripe_connect_webhook_events (
  event_id text primary key, account_id text not null, event_type text not null,
  status text not null check(status in ('processing','completed','failed')),
  attempts integer not null default 1,
  lease_until timestamptz,
  received_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  last_error_code text
);
alter table public.stripe_connect_webhook_events enable row level security;
revoke all on public.stripe_connect_webhook_events from public,anon,authenticated;
grant select,insert,update,delete on public.stripe_connect_webhook_events to service_role;

create or replace function public.claim_connect_event(p_id text,p_account text,p_type text)
returns text language plpgsql security definer set search_path='' as $$
declare e public.stripe_connect_webhook_events%rowtype;
begin
  insert into public.stripe_connect_webhook_events(event_id,account_id,event_type,status,lease_until)
    values(p_id,p_account,p_type,'processing',now()+interval '5 minutes') on conflict do nothing;
  if found then return 'claimed'; end if;
  select * into e from public.stripe_connect_webhook_events where event_id=p_id for update;
  if e.account_id<>p_account or e.event_type<>p_type then raise exception 'event_mismatch'; end if;
  if e.status='completed' then return 'completed'; end if;
  if e.status='processing' and e.lease_until>now() then return 'in_progress'; end if;
  update public.stripe_connect_webhook_events set status='processing',attempts=attempts+1,lease_until=now()+interval '5 minutes',updated_at=now() where event_id=p_id;
  return 'claimed';
end;
$$;
revoke all on function public.claim_connect_event(text,text,text) from public,anon,authenticated;
grant execute on function public.claim_connect_event(text,text,text) to service_role;

-- Refund totals are monotonic. Dispute state has its own provider event clock;
-- an open dispute alone does not remove valid access; a lost dispute does.
create or replace function public.apply_course_payment_adjustment(
  p_account text,p_payment_intent text,p_refunded_cents integer,p_dispute_status text,p_event_at timestamptz
)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_payment_intent is null then raise exception 'payment_intent_required'; end if;
  if not exists(select 1 from public.purchases where stripe_account_id=p_account and stripe_payment_intent_id=p_payment_intent) then raise exception 'purchase_not_reconciled'; end if;
  update public.purchases set
    refunded_amount_cents=greatest(refunded_amount_cents,coalesce(p_refunded_cents,0)),
    dispute_status=case when p_dispute_status is not null and (dispute_event_at is null or p_event_at>=dispute_event_at) then p_dispute_status else dispute_status end,
    dispute_event_at=case when p_dispute_status is not null and (dispute_event_at is null or p_event_at>=dispute_event_at) then p_event_at else dispute_event_at end
    where stripe_account_id=p_account and stripe_payment_intent_id=p_payment_intent;
  update public.purchases set access_status=case
    when refunded_amount_cents>=round(amount_paid*100) and amount_paid>0 then 'refunded'
    when dispute_status='lost' then 'disputed' else 'active' end
    where stripe_account_id=p_account and stripe_payment_intent_id=p_payment_intent;
end;
$$;
revoke all on function public.apply_course_payment_adjustment(text,text,integer,text,timestamptz) from public,anon,authenticated;
grant execute on function public.apply_course_payment_adjustment(text,text,integer,text,timestamptz) to service_role;
revoke all on all functions in schema private from public,anon,authenticated;
