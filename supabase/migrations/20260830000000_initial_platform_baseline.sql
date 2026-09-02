-- Reproducible, data-free baseline for fresh Supabase environments.
--
-- Production predates the local migration history. This file captures the
-- schema that existed immediately before 20260830185317, so branches and CI
-- can build the complete database without copying production data.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  is_admin boolean default false,
  created_at timestamptz default now(),
  is_super_admin boolean not null default false
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  tagline_template text,
  logo_url text,
  primary_color text,
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  featured_course_id uuid,
  hero_subtitle text
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  price numeric(10,2) not null,
  thumbnail_url text,
  created_at timestamptz default now(),
  long_description text,
  learning_points jsonb not null default '[]'::jsonb,
  status text not null default 'published'
    check (status in ('published', 'draft')),
  organization_id uuid not null references public.organizations(id)
);

alter table public.organizations
  add constraint organizations_featured_course_id_fkey
  foreign key (featured_course_id) references public.courses(id) on delete set null;

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  title text not null,
  order_index integer not null default 0,
  created_at timestamptz default now(),
  status text not null default 'published'
    check (status in ('published', 'draft'))
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  title text not null,
  order_index integer not null default 0,
  created_at timestamptz default now(),
  section_id uuid,
  blocks jsonb not null default '[]'::jsonb,
  status text not null default 'published'
    check (status in ('published', 'draft')),
  constraint lessons_section_id_fkey
    foreign key (section_id) references public.sections(id) on delete cascade
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id),
  amount_paid numeric(10,2) not null,
  purchased_at timestamptz default now(),
  payment_method text not null default 'stripe'
    check (payment_method in ('stripe', 'whop')),
  external_reference text,
  organization_id uuid not null references public.organizations(id),
  constraint purchases_user_id_course_id_key unique (user_id, course_id)
);

create table public.video_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  viewed_at timestamptz default now()
);

create table public.organization_billing (
  organization_id uuid primary key
    references public.organizations(id) on delete cascade,
  platform_stripe_customer_id text,
  platform_subscription_id text,
  platform_subscription_status text not null default 'trialing'
    check (platform_subscription_status in ('trialing', 'active', 'past_due', 'canceled'))
);

create table public.organization_integrations (
  organization_id uuid primary key
    references public.organizations(id) on delete cascade,
  stripe_account_id text,
  stripe_connect_status text,
  whop_api_key_encrypted text,
  whop_product_id text
);

create table public.organization_admins (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('owner', 'admin')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.organization_students (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'removed')),
  joined_via text not null check (joined_via in ('self_register', 'invite', 'purchase')),
  invited_by uuid references auth.users(id) on delete set null,
  removed_at timestamptz,
  removed_by uuid references auth.users(id) on delete set null,
  removed_reason text,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  invite_type text not null check (invite_type in ('student', 'admin')),
  token_hash text not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid references auth.users(id) on delete set null,
  revoked_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.admin_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.verification_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  purpose text not null check (purpose in ('signup', 'password_reset')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create index courses_organization_id_idx on public.courses (organization_id);
create index organization_admins_user_id_idx on public.organization_admins (user_id);
create index organization_students_user_id_idx on public.organization_students (user_id);
create index purchases_organization_id_idx on public.purchases (organization_id);
create unique index purchases_external_reference_unique
  on public.purchases (payment_method, external_reference)
  where external_reference is not null;
create unique index video_views_user_lesson_key
  on public.video_views (user_id, lesson_id);
create unique index admin_emails_email_lower_key
  on public.admin_emails (lower(email));
create index verification_codes_lookup_idx
  on public.verification_codes (lower(email), purpose, created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, is_admin)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''), false)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_super_admin = true
  );
$$;

create or replace function public.is_org_admin(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1 from public.organization_admins
    where organization_id = org_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_org_owner(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1 from public.organization_admins
    where organization_id = org_id and user_id = auth.uid() and role = 'owner'
  );
$$;

create or replace function public.is_org_student(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_students
    where organization_id = org_id and user_id = auth.uid() and status = 'active'
  );
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.courses enable row level security;
alter table public.sections enable row level security;
alter table public.lessons enable row level security;
alter table public.purchases enable row level security;
alter table public.video_views enable row level security;
alter table public.organization_billing enable row level security;
alter table public.organization_integrations enable row level security;
alter table public.organization_admins enable row level security;
alter table public.organization_students enable row level security;
alter table public.invitations enable row level security;
alter table public.admin_emails enable row level security;
alter table public.verification_codes enable row level security;

create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Admins can view all profiles" on public.profiles
  for select using (
    public.is_super_admin()
    or exists (
      select 1 from public.organization_students os
      where os.user_id = profiles.id and public.is_org_admin(os.organization_id)
    )
    or exists (
      select 1 from public.organization_admins oa
      where oa.user_id = profiles.id and public.is_org_admin(oa.organization_id)
    )
  );
create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy organizations_public_read on public.organizations
  for select to anon, authenticated using (true);
create policy organizations_admin_update on public.organizations
  for update to authenticated using (public.is_org_admin(id))
  with check (public.is_org_admin(id));

create policy courses_public_read_published on public.courses
  for select to anon using (status = 'published');
create policy courses_authenticated_read on public.courses
  for select to authenticated
  using (status = 'published' or public.is_org_admin(organization_id));
create policy courses_admin_manage on public.courses
  for all to authenticated using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy sections_authenticated_read on public.sections
  for select to authenticated using (
    status = 'published' or public.is_org_admin((
      select course.organization_id from public.courses course
      where course.id = sections.course_id
    ))
  );
create policy sections_admin_manage on public.sections
  for all to authenticated using (public.is_org_admin((
    select course.organization_id from public.courses course
    where course.id = sections.course_id
  ))) with check (public.is_org_admin((
    select course.organization_id from public.courses course
    where course.id = sections.course_id
  )));

create policy lessons_buyer_read on public.lessons
  for select to authenticated using (
    status = 'published' and exists (
      select 1 from public.purchases purchase
      where purchase.course_id = lessons.course_id
        and purchase.user_id = auth.uid()
    )
  );
create policy lessons_admin_manage on public.lessons
  for all to authenticated using (public.is_org_admin((
    select course.organization_id from public.courses course
    where course.id = lessons.course_id
  ))) with check (public.is_org_admin((
    select course.organization_id from public.courses course
    where course.id = lessons.course_id
  )));

create policy "Users can view their own purchases" on public.purchases
  for select to authenticated using (user_id = auth.uid());
create policy purchases_org_admin_read on public.purchases
  for select to authenticated using (public.is_org_admin(organization_id));

create policy "Users can view own views" on public.video_views
  for select using (auth.uid() = user_id);
create policy "Admins can view all views" on public.video_views
  for select using (exists (
    select 1 from public.lessons lesson
    join public.courses course on course.id = lesson.course_id
    where lesson.id = video_views.lesson_id
      and public.is_org_admin(course.organization_id)
  ));
create policy "Users can insert own views" on public.video_views
  for insert to authenticated with check (user_id = auth.uid());
create policy video_views_owner_delete on public.video_views
  for delete to authenticated using (user_id = auth.uid());

create policy organization_billing_admin_read on public.organization_billing
  for select to authenticated using (public.is_org_admin(organization_id));
create policy organization_integrations_owner_read on public.organization_integrations
  for select using (public.is_org_owner(organization_id) or public.is_super_admin());
create policy organization_integrations_owner_insert on public.organization_integrations
  for insert to authenticated with check (
    public.is_org_owner(organization_id) or public.is_super_admin()
  );
create policy organization_integrations_owner_update on public.organization_integrations
  for update to authenticated using (
    public.is_org_owner(organization_id) or public.is_super_admin()
  ) with check (
    public.is_org_owner(organization_id) or public.is_super_admin()
  );

create policy organization_admins_read on public.organization_admins
  for select to authenticated using (public.is_org_admin(organization_id));
create policy organization_admins_owner_insert on public.organization_admins
  for insert to authenticated with check (public.is_org_owner(organization_id));
create policy organization_admins_owner_delete on public.organization_admins
  for delete to authenticated using (public.is_org_owner(organization_id));

create policy organization_students_read on public.organization_students
  for select to authenticated
  using (public.is_org_admin(organization_id) or user_id = auth.uid());
create policy organization_students_admin_insert on public.organization_students
  for insert to authenticated with check (public.is_org_admin(organization_id));
create policy organization_students_admin_update on public.organization_students
  for update to authenticated using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy invitations_admin_read on public.invitations
  for select to authenticated using (public.is_org_admin(organization_id));
create policy invitations_admin_insert on public.invitations
  for insert to authenticated with check (public.is_org_admin(organization_id));
create policy invitations_admin_update on public.invitations
  for update to authenticated using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy admin_emails_super_admin_all on public.admin_emails
  for all to authenticated using (public.is_super_admin())
  with check (public.is_super_admin());

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;

insert into storage.buckets (id, name, public)
values
  ('course-videos', 'course-videos', false),
  ('lesson-media', 'lesson-media', false)
on conflict (id) do update set public = excluded.public;

create policy lesson_media_public_read_images on storage.objects
  for select using (
    bucket_id = 'lesson-media'
    and (storage.foldername(name))[1] = 'images'
  );
create policy "Admins can upload lesson media" on storage.objects
  for insert with check (bucket_id = 'lesson-media' and public.is_super_admin());
create policy "Admins can update lesson media" on storage.objects
  for update using (bucket_id = 'lesson-media' and public.is_super_admin());
create policy "Admins can delete lesson media" on storage.objects
  for delete using (bucket_id = 'lesson-media' and public.is_super_admin());
