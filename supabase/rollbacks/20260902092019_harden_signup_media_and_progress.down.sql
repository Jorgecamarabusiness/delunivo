-- This rollback restores the previous application contract. It intentionally
-- leaves uploaded public-media objects in place to avoid data loss.
drop policy if exists video_views_owner_delete_with_access on public.video_views;
create policy video_views_owner_delete
on public.video_views
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists video_views_owner_insert_with_access on public.video_views;
create policy "Users can insert own views"
on public.video_views
for insert
to public
with check (auth.uid() = user_id);

drop function if exists public.consume_verification_code(text, text, text);
drop function if exists public.issue_verification_code(text, text, text);
drop index if exists public.verification_codes_one_active_idx;

grant select, insert, update, delete, truncate, references, trigger
  on table public.verification_codes to anon, authenticated;

alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated;
alter default privileges for role postgres in schema public
  grant execute on functions to anon, authenticated;

grant execute on function public.handle_new_user()
  to public, anon, authenticated, service_role;
grant execute on function public.is_admin()
  to public, anon, authenticated, service_role;

grant select, insert, update, delete, truncate, references, trigger
  on table public.profiles to anon, authenticated;

create policy "Users can insert own profile"
on public.profiles
for insert
to public
with check (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles
for update
to public
using (auth.uid() = id);

update public.organizations
set logo_url = null
where slug = 'ivanorganico'
  and logo_url = '/ivan-organico-logo.svg';

update public.courses
set status = 'published'
where id = 'e42c32b8-d44b-4311-acb8-e9df2c44065c'
  and title = 'test2'
  and status = 'draft';

-- Keep `public-media`: dropping a bucket with user files would be destructive.
