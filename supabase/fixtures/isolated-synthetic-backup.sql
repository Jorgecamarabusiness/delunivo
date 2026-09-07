-- Synthetic restore fixture for CI only. It contains no production identifiers
-- or personal data and is loaded after `supabase db reset --local`.
insert into public.admin_emails (email, label, is_active)
values ('backup-restore@synthetic.invalid', 'isolated CI restore fixture', true)
on conflict (lower(email)) do update
set label = excluded.label,
    is_active = excluded.is_active;
