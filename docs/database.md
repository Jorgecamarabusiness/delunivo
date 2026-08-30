# Base de datos (Supabase)

El estado real del esquema vive en Supabase (cloud) y no hay Prisma. Este archivo es el inventario versionado del esquema confirmado y del SQL historico aplicado manualmente. Desde 2026-08-30, los cambios nuevos tambien deben conservarse como migraciones en `supabase/migrations/` y, cuando sea seguro, como rollback en `supabase/rollbacks/`. La presencia de un archivo no demuestra que se haya aplicado: **actualiza este documento solo despues de verificar el resultado real en Supabase**.

Convención: columnas en `snake_case` en la base de datos; las server actions las consumen tal cual (no hay capa de mapeo a camelCase). Los tipos de `src/types/index.ts` no siempre coinciden con las columnas reales — ver nota en `purchases`.

## Tablas confirmadas contra el código

### profiles
| columna | notas |
|---|---|
| id | uuid, = auth.users.id |
| email | |
| name | |
| is_admin | **deprecada desde el 2026-08-07** — ya no la usa ningún server action ni policy nueva. Se mantiene viva de momento solo como red de seguridad de la migración a multi-tenant; se borrará en una limpieza final cuando se confirme que nada la referencia. No usar en código nuevo. |
| is_super_admin | añadida el 2026-08-07 — gate de plataforma (el dueño de Delunivo), reemplaza a `is_admin`. Ser "admin" de una organización concreta ya NO se guarda aquí, ver `organization_admins`. |
| created_at | |

### courses
| columna | notas |
|---|---|
| id | |
| title | confirmado, **not null**, sin default |
| description | **not null, sin default** — no se usa en ningún sitio de la UI hoy (el campo visible al público es `long_description`), pero cualquier `insert` en `courses` tiene que incluirla igualmente (aunque sea `""`) o falla. Confirmado consultando el esquema real vía `GET /rest/v1/` (swagger de PostgREST) tras un 500 al crear un curso desde `createCourseAction` (Fase 9) que la omitía. |
| long_description | text (no array) — confirmado; el código lo parte por `\n\n` en párrafos. Nullable. |
| price | confirmado, **not null**, sin default |
| learning_points | **jsonb** (no `text[]` como se documentó antes — corregido tras confirmar con el esquema real), array de strings. **not null, sin default** — mismo motivo que `description`, hay que incluir `[]` en cualquier insert. |
| status | 'published' \| 'draft', default 'published' — añadida el 2026-07-23 (no existía; ver migración abajo). Se filtra en `/cursos` y `/cursos/[id]` para ocultar borradores a quien no sea admin de esa organización. |
| thumbnail_url | nullable — inferido |
| organization_id | uuid, FK -> organizations.id, **not null** — añadida el 2026-08-07. Cada curso pertenece a una sola organización/cliente. |
| created_at | confirmado |

### organizations
Añadida el 2026-08-07. Una fila por cliente ("empresa"). Solo branding público — nada sensible vive aquí (ver `organization_billing` y `organization_integrations`).

| columna | notas |
|---|---|
| id | |
| name | nombre visible del cliente |
| slug | segmento público de ruta (`/o/{slug}`), unique, solo `[a-z0-9-]`. Históricamente se diseñó también para `{slug}.delunivo.app`, dominio que nunca se configuró. Reservados a nivel de aplicación (no en BD): `www`, `app`, `admin`, `api` |
| tagline_template | Titular grande de la portada de la empresa. Plantilla tipo "Aprende {tema} junto a cientos de usuarios con {admin}" ({admin} se sustituye por el nombre del `owner_id`, o por `name` si no tiene). Con `null` se usa un genérico. Editable en `/admin/marca`. |
| hero_subtitle | **añadida el 2026-08-11** — frase de apoyo debajo del titular en la portada. Nullable, editable en `/admin/marca`. |
| featured_course_id | **añadida el 2026-08-11** — uuid, FK -> courses.id `on delete set null`. Curso que protagoniza la portada (su `thumbnail_url` es la imagen del hero y su precio el "Desde X €"). Con `null`, `splitForLanding()` usa el curso publicado más antiguo. `updateBrandingAction` valida que el curso sea de esa misma empresa antes de guardarlo. |
| logo_url | nullable |
| primary_color | nullable. Se inyecta como `--accent` en `<html>` desde `src/app/layout.tsx`, junto con un `--accent-foreground` calculado (negro o blanco según la luminancia WCAG del color, ver `src/lib/organizations/brandColor.ts`) para que el texto de los botones siempre se lea. |
| owner_id | uuid, FK -> auth.users.id — quien creó la organización |
| created_at | |

RLS: lectura pública (`anon`+`authenticated`, `using (true)`) porque es branding de una web pública; solo `is_org_admin(id)` puede actualizar. Sin policy de insert/delete — la creación de una organización (más adelante, Fase 6) siempre pasa por service role en una server action, nunca por RLS directa.

### organization_billing
Añadida el 2026-08-07. Suscripción de PLATAFORMA (los 20€/mes que el cliente le paga a Delunivo) — separada de `organizations` para que el estado de facturación no sea público.

| columna | notas |
|---|---|
| organization_id | uuid, PK y FK -> organizations.id (1 fila por organización) |
| platform_stripe_customer_id | nullable |
| platform_subscription_id | nullable |
| platform_subscription_status | 'trialing' \| 'active' \| 'past_due' \| 'canceled', default 'trialing' |

RLS: solo lectura, solo `is_org_admin(organization_id)`. Sin policy de escritura — solo el webhook de Stripe (service role, Fase 6) la actualiza.

### organization_integrations
Añadida el 2026-08-07. Claves de pago propias de cada cliente — la tabla más sensible de todas, separada del resto a propósito.

| columna | notas |
|---|---|
| organization_id | uuid, PK y FK -> organizations.id (1 fila por organización) |
| stripe_account_id | nullable — cuenta Stripe Connect Express del cliente (Fase 5, todavía sin usar) |
| stripe_connect_status | nullable |
| whop_api_key_encrypted | nullable — cifrada en reposo (Fase 5, todavía sin usar) |
| whop_product_id | nullable |

RLS: lectura y escritura solo para `is_org_owner(organization_id)` (ni siquiera un admin no-owner de la misma organización puede verlas).

### organization_admins
Añadida el 2026-08-07. Varios admins por organización (`owner` o `admin`); reemplaza el antiguo `profiles.is_admin` global.

| columna | notas |
|---|---|
| id | |
| organization_id | uuid, FK -> organizations.id |
| user_id | uuid, FK -> auth.users.id |
| role | 'owner' \| 'admin', default 'admin' |
| invited_by | uuid, FK -> auth.users.id, nullable |
| created_at | |

`unique(organization_id, user_id)`. RLS: lectura para `is_org_admin(organization_id)`; solo `is_org_owner(organization_id)` puede insertar/borrar filas (añadir o quitar co-admins).

### organization_students
Añadida el 2026-08-07. Roster de alumnos por organización — incluye a quien se registró pero no ha pagado nada todavía, y guarda auditoría permanente de quién fue expulsado, cuándo y por quién.

| columna | notas |
|---|---|
| id | |
| organization_id | uuid, FK -> organizations.id |
| user_id | uuid, FK -> auth.users.id |
| status | 'active' \| 'removed', default 'active' |
| joined_via | 'self_register' \| 'invite' \| 'purchase' |
| invited_by | uuid, FK -> auth.users.id, nullable |
| removed_at / removed_by / removed_reason | nullable — auditoría de expulsión |
| created_at | |

`unique(organization_id, user_id)`. RLS: cada alumno ve su propia fila; los admins de esa organización ven/insertan/actualizan todo el roster. **Sin policy de DELETE** — a propósito, para que "echar" a alguien sea siempre un `update` a `status='removed'`, nunca un borrado (así queda registro permanente). El acceso a lecciones ya comprueba `status='active'` además de `purchases` — ver Seguridad.

Se puebla desde el registro (`src/app/register/actions.ts`), la aceptación de
invitaciones (`src/app/invitaciones/[token]/actions.ts`) y los flujos de compra
de Stripe y Whop. Los flujos de compra crean la membresía junto a `purchases` y
nunca reactivan automáticamente una fila `removed`.

### invitations
Añadida el 2026-08-07. Invitaciones de alumnos y co-admins con aceptación por
token en `/invitaciones/[token]`.

| columna | notas |
|---|---|
| id | |
| organization_id | uuid, FK -> organizations.id |
| email | |
| invite_type | 'student' \| 'admin' |
| token_hash | el token en claro nunca se guarda, solo su hash |
| status | 'pending' \| 'accepted' \| 'revoked' \| 'expired', default 'pending' |
| invited_by / revoked_by | uuid, FK -> auth.users.id, nullable |
| expires_at | |
| created_at | |

Índice único parcial: como mucho una invitación `pending` por `(organization_id, email, invite_type)`. RLS: solo admins de esa organización (`is_org_admin`). Sin policy de lectura pública ni de DELETE — la aceptación se valida con service role en una server action (Fase 3), no vía RLS.

**Implementado el 2026-08-07 (Fase 3)**: `src/app/admin/usuarios/actions.ts` (invitar/echar/reactivar/quitar admin/revocar invitación), `src/app/invitaciones/[token]/` (aceptación — crea cuenta con `admin.auth.admin.createUser()` si el correo no tenía una, o vincula la sesión actual si ya la tenía). El token en claro solo va en la URL del email (`src/lib/invitations/token.ts` + `src/lib/resend/sendInvitationEmail.ts`); en `invitations.token_hash` solo se guarda su SHA-256. Invitar co-admins está restringido a `role='owner'` a nivel de aplicación (la policy RLS de `invitations` permite insertar a cualquier `is_org_admin`, no distingue `invite_type` — el filtro más estricto vive en `inviteAdminAction`, no en SQL).

### admin_emails
Añadida el 2026-08-11. Lista de correos de prueba de la PLATAFORMA (no de ninguna empresa). Mientras el envío real está desactivado, todo email de la aplicación se redirige a las filas `is_active = true` en vez de ir a su destinatario real — ver "Emails" más abajo.

| columna | notas |
|---|---|
| id | |
| email | índice único sobre `lower(email)` (los correos no distinguen mayúsculas) |
| label | nullable — para qué es ese correo |
| is_active | boolean, default true |
| created_at | |

RLS: `admin_emails_super_admin_all` (`for all`, `is_super_admin()`) — solo para la pantalla de gestión `/admin/emails`. El envío de emails la lee con la service role key, porque quien manda un correo casi nunca es el super admin (suele ser un alumno registrándose).

### verification_codes
Añadida el 2026-08-11. Códigos temporales de 6 dígitos que sustituyen a los emails de confirmación y de recuperación de contraseña de Supabase Auth (su límite de envío se agotaba constantemente en pruebas).

| columna | notas |
|---|---|
| id | |
| email | |
| code_hash | SHA-256 del código; **el código en claro solo viaja en el email**, igual que `invitations.token_hash` |
| purpose | 'signup' \| 'password_reset' |
| expires_at | 30 minutos (`CODE_TTL_MINUTES` en `src/lib/auth/verificationCodes.ts`) |
| created_at | también es el reloj del límite de emisión, ver abajo |
| consumed_at | nullable — un código solo sirve una vez; pedir uno nuevo consume los anteriores del mismo (email, purpose) |
| attempts | máximo 5 intentos fallidos antes de invalidarlo |
| created_at | |

RLS activo y **sin ninguna policy, a propósito**: con RLS activo y cero policies nadie puede leerla ni escribirla salvo la service role key. Un código de verificación no debe ser legible por ningún cliente, ni siquiera por su propio destinatario — solo se comprueba en servidor. La comparación es en tiempo constante (`crypto.timingSafeEqual`).

**Límite de emisión** (`checkIssueRateLimit`, 2026-08-11): máximo 3 códigos por correo y 60 en total cada 15 minutos, contando filas por `created_at` — sin tabla nueva. Cada código emitido es un email enviado, así que sin este tope cualquiera podía quemar la cuota de Resend pulsando "enviar otro código" o bombardear el buzón de una persona real metiendo su correo en `/forgot-password`. El tope de 5 intentos protege un código ya emitido, no su emisión: son dos cosas distintas.

### sections
| columna | notas |
|---|---|
| id | |
| course_id | FK → courses.id, confirmado |
| title | confirmado |
| order_index | confirmado (ojo: no `order`) |
| status | 'published' \| 'draft', default 'published' — añadida el 2026-07-23. Si el capítulo está en borrador, sus lecciones se ocultan al alumno aunque estén publicadas individualmente. |

### lessons
| columna | notas |
|---|---|
| id | |
| section_id | FK → sections.id, confirmado |
| course_id | FK → courses.id, confirmado |
| title | confirmado |
| duration | inferido |
| order_index | confirmado |
| is_preview | inferido |
| status | 'published' \| 'draft', default 'published' — añadida el 2026-07-23. Se filtra en `/cursos/[id]/aprender` junto con `sections.status`. |
| blocks | jsonb, confirmado — array de bloques `{type: "video"\|"video_file"\|"text", ...}`. `"video"` se muestra en el admin como **"Embed media"** (enlace externo tipo YouTube/Vimeo); `"video_file"` es un vídeo subido directamente por el admin a Supabase Storage (bucket `lesson-media`) — añadido el 2026-07-23. Ambos usan el campo `video_url`. El contenido de los bloques `"text"` es HTML (editor de texto enriquecido), se sanea con `isomorphic-dompurify` antes de renderizarlo al alumno. |

### purchases
| columna | notas |
|---|---|
| id | |
| user_id | confirmado |
| course_id | confirmado |
| amount_paid | confirmado — se lee/escribe tal cual desde las queries, sin tipo TS dedicado (no hay `Purchase` en `src/types/index.ts`; se quitó por no usarse en ningún sitio). |
| purchased_at | confirmado |
| payment_method | 'stripe' \| 'whop', default 'stripe' — añadida el 2026-07-23. |
| external_reference | nullable, texto libre — añadida el 2026-07-23. Id de la Checkout Session de Stripe, o la license key/membership id de Whop. Único junto con `payment_method` (evita reutilizar un mismo código/sesión). Hay además un unique en `(user_id, course_id)` para que no se dupliquen compras. |
| organization_id | uuid, FK -> organizations.id, **not null** — añadida el 2026-08-07, denormalizada desde `courses.organization_id` en el momento de insertar (evita un join extra en cada policy RLS y congela la atribución si algún día un curso cambia de organización). |

### video_views
**Una fila = esa lección está completada por ese alumno.** No hay estado intermedio ni segundos vistos.

| columna | notas |
|---|---|
| id | |
| user_id | FK -> profiles.id |
| lesson_id | FK -> lessons.id |
| viewed_at | timestamptz, default now() |

> **Corrección del 2026-08-11**: esta tabla estaba documentada con `watched_seconds`, `completed` y `last_watched_at` marcadas como "inferido" — **ninguna de las tres existe**. Confirmado contra el esquema real vía `GET /rest/v1/` (swagger de PostgREST). Es justo el caso que avisa el gotcha de "comprueba las columnas reales antes de escribir un insert".

`unique(user_id, lesson_id)` (índice `video_views_user_lesson_key`, añadido el 2026-08-11): antes no existía y cada marcado creaba una fila nueva, por eso `/admin/estadisticas` tenía que deduplicar a mano con un `Set` de `user_id:lesson_id`.

RLS: cada alumno ve, inserta y borra **solo sus propias filas** (`user_id = auth.uid()`); los admins ven las de lecciones de cursos de su(s) organización(es). La policy de DELETE (`video_views_owner_delete`) se añadió el 2026-08-11 — antes solo había de INSERT, así que desmarcar una lección no daba error pero tampoco borraba nada: la interfaz se quedaba desmarcada y la base de datos no.

**Escrituras**: `setLessonCompletedAction` (`src/app/cursos/[id]/aprender/actions.ts`), con el cliente de sesión (no el admin) porque la RLS ya garantiza que nadie toca el progreso de otro. Hasta el 2026-08-11 **nadie escribía en esta tabla**: el progreso del aula vivía solo en un `useState` y se perdía al cerrar la pestaña, mientras `/admin/estadisticas` mostraba datos congelados de filas antiguas.

## Historial de migraciones aplicadas manualmente

- **2026-07-23** — `courses.status` (text, default 'published', check in ('published','draft')). Necesario para poder ocultar el curso mientras está en preparación.
- **2026-07-23** — `sections.status` y `lessons.status` (text, default 'published', check in ('published','draft')). Permite marcar capítulos y lecciones como borrador; un capítulo en borrador oculta también sus lecciones al alumno.
- **2026-07-23** — bucket de Storage `lesson-media` (público) + políticas RLS (lectura pública, escritura/borrado solo admins). Usado para subir vídeos (`video_file`) e imágenes insertadas en el editor de texto enriquecido. Ver sección Storage abajo.
- **2026-07-23** — `purchases.payment_method` + `purchases.external_reference`, unique en `(payment_method, external_reference)` y unique en `(user_id, course_id)`. Necesario para el flujo de pago con Stripe/Whop — ver sección Integraciones externas.
- **2026-08-02** — bucket `lesson-media` pasado a **privado** (`storage.buckets.public = false`); la policy de lectura pública total se sustituyó por `lesson_media_public_read_images` (solo lee `images/*`, los `videos/*` ya no tienen ninguna policy de lectura). Trigger `on_auth_user_created` en `auth.users` que crea la fila en `profiles` automáticamente (función `public.handle_new_user()`, `security definer`). Ver sección Storage y Seguridad abajo.
- **2026-08-02** — policy `courses_public_read_published` (RLS, `for select to anon using (status = 'published')`). Sin ella, un visitante sin sesión no podía leer ninguna fila de `courses` y `/`, `/cursos`, `/cursos/[id]` mostraban "Curso no encontrado" a cualquiera no logueado — lo encontró el test de Playwright `e2e/access-control.spec.ts`. Confirmado con la clave anónima y sin sesión que ahora sí devuelve las filas con `status = 'published'`.
- **2026-08-07** — Fundación multi-tenant: tablas `organizations`, `organization_billing`, `organization_integrations`, `organization_admins`, `organization_students`, `invitations` (ver arriba); `courses.organization_id` y `purchases.organization_id` (not null, con backfill); `profiles.is_super_admin` (con backfill desde `is_admin`); funciones `security definer` `is_super_admin()`, `is_org_admin(org_id)`, `is_org_owner(org_id)`, `is_org_student(org_id)`. Se creó la organización `ivanorganico` a partir del admin global existente y se le atribuyeron el curso y las compras ya existentes. Se hizo también un backfill de `organization_students` para TODOS los profiles existentes (en el modelo single-tenant anterior, registrarse implicaba ser alumno de esa única organización) — sin este paso, la nueva policy de `profiles` habría dejado `/admin/usuarios` prácticamente vacío.
- **2026-08-07** — Reescritura completa de RLS para que ningún admin de una organización pueda ver/editar datos de otra: `courses`, `sections`, `lessons`, `purchases`, `profiles`, `video_views` (las que dependían de `is_admin()`/`profiles.is_admin` pasan a depender de `is_org_admin(organization_id)` o de un join hasta la organización correspondiente). Ver detalle en Seguridad, abajo.
- **2026-08-07** — Bug de seguridad corregido (no relacionado con multi-tenant): policy `"Lesson media is publicly readable"` en `storage.objects` daba lectura pública a TODO el bucket `lesson-media`, incluidos los vídeos — nunca se había borrado al añadir `lesson_media_public_read_images` el 2026-08-02 pese a que esa migración decía haberla "sustituido". Borrada.
- **2026-08-07** — Limpieza: policy `"Admins can upload videos"` (bucket `course-videos`) borrada — resto de una integración anterior ya no usada, confirmado con el usuario. Las 3 policies restantes de `storage.objects` sobre `lesson-media` (`Admins can delete/update/upload lesson media`) pasaron de `profiles.is_admin` a `is_super_admin()` — ver nota en Storage sobre por qué no quedaron aisladas por organización todavía. Duplicado de `purchases` ("Users can view own purchases" a rol `public`, redundante con "Users can view their own purchases" a `authenticated`) eliminado.
- **2026-08-07 (Fase 4, sin cambios de esquema)** — Bug de aislamiento cross-tenant corregido en código (no en RLS, que ya estaba bien): `/admin/cursos` y `/admin/estadisticas` consultaban `courses`/`sections`/`lessons`/`video_views` sin filtrar por `organization_id`. Como la policy de `courses` permite leer cualquier fila `status='published'` de **cualquier** organización (no solo la propia — es la misma policy que necesita el sitio público), cualquier admin veía en su propio panel los cursos publicados (títulos y precio) de TODOS los demás clientes de la plataforma, mezclados con los suyos. `purchases`/`video_views` no llegaban a filtrarse mal (esas sí están bien aisladas por RLS), pero el ruido de cursos ajenos en el listado/estadísticas era real. Arreglado añadiendo `.eq("organization_id", ...)` (resuelto vía `getCurrentOrgMembership`) en ambas páginas.

- **2026-08-11** — `admin_emails` y `verification_codes` (ver arriba); `organizations.hero_subtitle` y `organizations.featured_course_id`. SQL en `docs/sql/2026-08-11-emails-y-landings.sql`. Aparte del esquema, esta tanda cambió tres cosas grandes sin tocar la base de datos: los emails dejaron de salir por Supabase Auth y pasan todos por Resend con códigos propios; el enrutamiento por subdominio se eliminó (solo queda `/o/<slug>`); y se cerró una fuga cross-tenant en la ficha pública de curso. Ver las secciones correspondientes abajo.

## Emails y verificación de cuenta

Desde el 2026-08-11, **Supabase Auth no envía ningún email**. Ni el de confirmación de registro ni el de recuperación de contraseña: su límite de envío en el plan gratuito se agotaba constantemente al probar, y sus plantillas no se pueden editar sin configurar SMTP propio.

- **Punto único de envío**: `src/lib/email/send.ts` (`sendEmail`). Nada llama a Resend directamente. Las plantillas concretas están en `src/lib/email/templates.ts` (código de registro, código de recuperación, invitación, license key de Whop) sobre el HTML común de `src/lib/email/layout.ts`.
- **Redirección a correos de prueba**: si `EMAIL_DELIVERY_MODE` no vale exactamente `"live"`, TODO email va a las direcciones activas de `admin_emails` en vez de a su destinatario real, con el destinatario original en el asunto (`[→ pepe@gmail.com] Tu código`) y un aviso al principio del cuerpo. **El valor por defecto es el redirigido a propósito**: la cuenta de Resend no tiene dominio verificado, así que solo puede entregar al correo del titular y devolvería un 403 con cualquier otro destinatario. Se gestiona en `/admin/emails` (solo super admin).
- **Registro**: `createUnverifiedUser` (`src/lib/auth/accounts.ts`) usa `admin.auth.admin.createUser({ email_confirm: false })`, que **no manda ningún email**. Luego se emite un código y se envía por Resend. Hasta verificarlo, Supabase bloquea el login por su cuenta con "Email not confirmed" — no hace falta ninguna columna ni gate propio.
  - **Por qué `createUser` y no `signUp()`**: con la confirmación de correo activada, `signUp()` sobre un email que YA existe devuelve un usuario falso con un uuid inventado (protección anti-enumeración de Supabase). Ese uuid no está en `auth.users`, así que el insert siguiente reventaba con `organizations_owner_id_fkey` al crear una empresa. `createUser` da un error limpio.
- **Verificación** (`/verificar`): al acertar el código se hace `updateUserById({ email_confirm: true })` y se inicia sesión sin volver a pedir la contraseña — `startSessionForVerifiedEmail()` genera un token con `admin.auth.admin.generateLink({ type: 'magiclink' })` (que **no envía email**, para eso existe) y lo canjea con `verifyOtp()` sobre el cliente con cookies. Si eso falla, se cae a `/login?verificado=1`.
- **Login**: si Supabase responde "Email not confirmed", se emite y envía un código nuevo y se redirige a `/verificar` en vez de dejar al usuario en un callejón sin salida.
- **Recuperación de contraseña**: `/forgot-password` emite un código `password_reset` (siempre redirige a `/reset-password`, exista o no la cuenta, para no filtrar qué correos están registrados) y `/reset-password` pide email + código + contraseña nueva. Ya no depende de la sesión en el fragmento `#` de la URL, así que `ResetPasswordForm` dejó de necesitar el cliente de navegador.

## Seguridad

RLS **sí está activo** en todas las tablas. Desde el 2026-08-07 el modelo es multi-tenant: ningún admin de la organización X puede leer/escribir datos de la organización Y. Estado por tabla:

| tabla | sin sesión (anon) | con sesión (authenticated) |
|---|---|---|
| `courses` | solo `status = 'published'` (policy `courses_public_read_published`) | `status = 'published'` de cualquier organización, o todas las filas (incl. borradores) de las organizaciones donde es admin |
| `admin_emails` | nada | solo `is_super_admin()` |
| `verification_codes` | nada | **nada** — RLS activo sin ninguna policy: solo la service role key |
| `sections` / `lessons` | nada | igual que `courses` para gestión de contenido; para VER una lección además hace falta `purchases` + seguir `active` en `organization_students` de esa organización (ver más abajo) |
| `purchases` | nada | solo su propia fila; los admins ven las de su(s) propia(s) organización(es), nunca las de otra |
| `profiles` | nada | solo su propia fila; los admins además ven los profiles de sus propios alumnos/co-admins (no los de otras organizaciones) |
| `video_views` | nada | solo sus propias filas; los admins ven las de lecciones de cursos de su(s) propia(s) organización(es) |
| `organizations` | branding público (`name`, `slug`, `logo_url`, etc., lectura abierta) | igual + puede editar si es admin de esa organización |
| `organization_billing` / `organization_integrations` | nada | solo admin/owner de esa organización (integrations: solo el owner) |
| `organization_admins` / `organization_students` / `invitations` | nada | solo admins de esa organización (alumno: además puede leer su propia fila en `organization_students`) |

**Fuga cross-tenant corregida el 2026-08-11 (ficha pública de curso)**: `src/app/cursos/[id]/page.tsx` buscaba el curso solo por `id`. Como la policy `courses_public_read_published` deja leer cualquier fila publicada de **cualquier** empresa (lo necesita el sitio público), `/o/empresaA/cursos/<id-de-empresaB>` renderizaba el curso de B con el Header, el logo y el color de A. Arreglado comparando `course.organization_id` con la organización que resuelve la URL: si no coinciden, el curso "no existe" en ese portal. Los tests de la Fase 10 cubrían `/admin/cursos` y `/admin/estadisticas`, pero no la ficha pública.

El control de acceso admin se repite a mano en cada server action, ahora vía `requireOrgAdmin()`/`requireSuperAdmin()`/`requireAnyOrgAdmin()` (`src/lib/auth/requireOrgAdmin.ts`, reemplaza al antiguo `requireAdmin()`) — RLS y el chequeo de código son dos capas independientes, no confiar solo en una. Estos helpers llaman por RPC a las mismas funciones `security definer` que usan las policies (`is_org_admin`, `is_super_admin`), para no duplicar la lógica de "quién es admin de qué" en dos sitios.

**Alumno expulsado ("echado")**: `organization_students.status = 'removed'` corta el acceso a las lecciones aunque la fila de `purchases` siga existiendo — es intencional, para conservar el historial de pago. La policy `lessons_buyer_read` exige `is_org_student(purchases.organization_id)` (que comprueba `status = 'active'`) además de la propia compra. El flujo de admin para invitar/expulsar alumnos todavía no tiene UI (ver Fase 3 del plan).

- **`profiles`** se crea sola: trigger `on_auth_user_created` (`after insert on auth.users`) inserta la fila con `name` sacado de `raw_user_meta_data->>'name'` e `is_admin = false` (sin tocar desde el 2026-08-07 — `is_super_admin` toma su default de columna, `false`, porque el trigger no la menciona). `registerAction` ya no inserta el perfil a mano (ver `src/app/register/actions.ts`) — así el perfil existe también si el usuario se crea por otra vía (invitación, magic link, panel de Supabase).

## Storage

- **`lesson-media`** (bucket **privado** desde el 2026-08-02, antes público) — creado el 2026-07-23. Contiene:
  - `videos/` — archivos de vídeo subidos directamente por el admin para bloques de tipo `video_file`. **Sin lectura pública**: solo se puede leer generando una URL firmada con el cliente admin (service role), que se salta RLS. Eso lo hace `src/lib/storage/media.ts` (`getSignedVideoUrl`), llamado desde `src/app/cursos/[id]/aprender/page.tsx` **después** de comprobar que el usuario es admin o compró el curso, y desde `src/lib/storage/actions.ts` (`getVideoPreviewUrlAction`) para la previsualización del admin en el editor.
  - `images/` — imágenes insertadas dentro del editor de texto enriquecido (bloques `text`). Sigue con lectura pública (policy `lesson_media_public_read_images`, filtra por `(storage.foldername(name))[1] = 'images'`).
- La subida ya **no** se hace desde el navegador: pasa por el route handler `src/app/api/admin/media/upload/route.ts`, que comprueba `requireAnyOrgAdmin()` (desde el 2026-08-07; antes `requireAdmin()`) y sube con el cliente admin (service role). `src/lib/storage/uploadLessonMedia.ts` (cliente) solo hace `fetch()` a ese endpoint.
- **Ojo con `video_url` en `lessons.blocks`**: para bloques `video_file`, este campo puede contener dos formatos según cuándo se subió el vídeo — una ruta relativa nueva (`videos/uuid.mp4`) o una URL pública antigua de cuando el bucket era público (`.../object/public/lesson-media/videos/uuid.mp4`, de antes del 2026-08-02). `extractStoragePath()` en `src/lib/storage/media.ts` normaliza ambos casos antes de firmar la URL — no hizo falta migrar los datos existentes.
- **Sin aislamiento por organización todavía**: el path de los archivos (`videos/uuid.ext`, `images/uuid.ext`) no lleva `organization_id`, así que ni la RLS de `storage.objects` ni el route handler de subida saben de qué cliente es cada archivo en el momento de subirlo (la subida ocurre antes de asociarse a ninguna lección). Las policies de `storage.objects` sobre `lesson-media` (`Admins can delete/update/upload lesson media`) se cambiaron el 2026-08-07 de `profiles.is_admin` a `is_super_admin()` — funcionalmente equivalente a como estaba antes (un único admin global), no un aislamiento real por cliente. El aislamiento efectivo hoy depende de que la asociación archivo→lección (`updateLessonBlocksAction`) sí compruebe `requireOrgAdmin({lessonId})` correctamente. Si se quiere que Storage aísle también por organización, habría que meter `organization_id` en el path al subir — pendiente, ver Fase 9 del plan.
- **Bug corregido el 2026-08-07**: existía una policy `"Lesson media is publicly readable"` que daba lectura pública a TODO el bucket (incluidos los vídeos), contradiciendo la migración del 2026-08-02 que decía haberla sustituido por `lesson_media_public_read_images` — nunca se borró la vieja. Borrada.
- **Bucket `course-videos` eliminado (policy) el 2026-08-07**: resto de una integración anterior ya no usada (confirmado con el usuario). Si el bucket en sí seguía vacío, también se borró desde el dashboard.

## Resolución de organización en el sitio público

`src/proxy.ts` resuelve el tenant exclusivamente desde la ruta `/o/<slug>`.
El proxy elimina el prefijo para el rewrite interno e inyecta los headers
`x-org-slug` y `x-org-path-prefix`. No inspecciona `Host` ni admite
subdominios.

`getCurrentOrganization()` busca la organización por `x-org-slug`. Sin slug
devuelve `null`: la raíz muestra Delunivo y nunca infiere una organización.
Las rutas públicas conservan el prefijo mediante `orgPath()`; `/admin` resuelve
la organización por membership y `/invitaciones/[token]` por el propio token.

`/cursos` filtra siempre por `organization_id` y `status='published'`: con
cero cursos muestra el estado vacío, con uno redirige a su ficha y con varios
muestra el catálogo. Las lecturas privadas del panel usan
`getCurrentOrgMembership()`, no el tenant de la URL.

## Integraciones externas

- **Stripe:** el checkout de cursos usa la cuenta conectada de la organización
  cuando existe y la cuenta principal como fallback. La suscripción de plataforma
  se procesa en la cuenta principal. Los webhooks validan su firma y escriben con
  el cliente admin en servidor.
- **Whop:** las credenciales de cada organización se guardan cifradas con
  AES-256-GCM y se resuelven en servidor. El webhook heredado de licencias sigue
  usando las variables globales documentadas en `.env.example`; no se generaliza
  hasta que exista una necesidad real.
- **Resend:** `src/lib/email/send.ts` es el único punto de envío. El modo
  `redirect` es el valor seguro por defecto, `off` se usa en pruebas y `live`
  requiere un dominio verificado.
- **Mux:** las subidas y reproducciones pasan por rutas de servidor, webhooks
  firmados y playback firmado. Los secretos nunca usan el prefijo
  `NEXT_PUBLIC_`. La migración de producción `20260830185317` crea
  `video_assets`, `mux_webhook_events` y RPC exclusivas de `service_role`; las
  tablas tienen RLS activa y no conceden acceso a `anon` ni `authenticated`.

## Despliegue y dominio

La URL técnica de la plataforma es `https://delunivo.vercel.app`. Delunivo usa
rutas `/o/<slug>` porque `*.vercel.app` no permite wildcards de tenant. Los
identificadores internos estables de Supabase, buckets, tablas e integraciones
no se renombran: no son identidad visible y cambiarlos pondría datos o enlaces
en riesgo. Un dominio propio puede añadirse cuando esté decidido y registrado.
