-- =============================================================================
-- Aularia — 2026-08-11
-- 1) admin_emails       : lista de correos "de pruebas" a los que se redirige
--                         TODO email cuando el envío real está desactivado.
-- 2) verification_codes : códigos temporales de 30 min (registro y recuperación
--                         de contraseña), para dejar de depender del email de
--                         Supabase Auth y su límite de envío.
-- 3) organizations      : curso destacado + subtítulo del hero de la landing
--                         de cada empresa.
-- Todo es idempotente: se puede ejecutar dos veces sin romper nada.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1) admin_emails
--    El "option set" de correos de prueba. Con envío real desactivado
--    (EMAIL_DELIVERY_MODE != 'live'), cualquier email de la app se manda a las
--    filas is_active = true en vez de al destinatario original.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.admin_emails (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  label      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- Unicidad sin distinguir mayúsculas (los correos no son case-sensitive).
create unique index if not exists admin_emails_email_lower_key
  on public.admin_emails (lower(email));

alter table public.admin_emails enable row level security;

-- Solo el dueño de la plataforma gestiona esta lista. El envío de emails la
-- lee con la service role key (se salta RLS), así que estas policies existen
-- únicamente para la pantalla de gestión.
drop policy if exists admin_emails_super_admin_all on public.admin_emails;
create policy admin_emails_super_admin_all
  on public.admin_emails
  for all
  to authenticated
  using (is_super_admin())
  with check (is_super_admin());

-- Semilla. Hoy Resend NO tiene dominio verificado, así que el único correo al
-- que puede entregar de verdad es jorgecamarabusiness@gmail.com — el resto se
-- deja inactivo para no provocar errores 403 de Resend.
insert into public.admin_emails (email, label, is_active) values
  ('jorgecamarabusiness@gmail.com', 'Jorge — cuenta principal de pruebas', true),
  ('jorge@getaybee.com',            'Jorge — trabajo (activar cuando Resend tenga dominio verificado)', false)
on conflict do nothing;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2) verification_codes
--    Códigos de 6 dígitos con caducidad. Nunca se guarda el código en claro,
--    solo su SHA-256 (mismo criterio que invitations.token_hash).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.verification_codes (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  code_hash   text not null,
  purpose     text not null check (purpose in ('signup', 'password_reset')),
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  attempts    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists verification_codes_lookup_idx
  on public.verification_codes (lower(email), purpose, created_at desc);

alter table public.verification_codes enable row level security;

-- SIN NINGUNA POLICY, a propósito: con RLS activo y cero policies, nadie puede
-- leerla ni escribirla salvo la service role key (que se salta RLS). Un código
-- de verificación no debe ser legible por ningún cliente, ni siquiera por su
-- propio destinatario — solo se comprueba en servidor.


-- ─────────────────────────────────────────────────────────────────────────────
-- 3) organizations — hero de la landing de cada empresa
--    La IMAGEN y el CTA del hero salen del curso destacado
--    (courses.thumbnail_url, columna que ya existía y no se usaba).
--    El TÍTULO sigue siendo tagline_template (ya editable en /admin/marca);
--    esto añade solo el subtítulo que va debajo.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.organizations
  add column if not exists featured_course_id uuid
    references public.courses(id) on delete set null,
  add column if not exists hero_subtitle text;
