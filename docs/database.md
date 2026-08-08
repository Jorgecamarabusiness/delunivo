# Base de datos (Supabase)

El esquema vive únicamente en el dashboard de Supabase (cloud) — no hay Prisma, carpeta `supabase/migrations/` ni SQL local en el repo. Este archivo es la única documentación versionada del esquema: **actualízalo a mano cada vez que se ejecute SQL contra Supabase** (alta/baja de tabla o columna).

Convención: columnas en `snake_case` en la base de datos; las server actions las consumen tal cual (no hay capa de mapeo a camelCase). Los tipos de `src/types/index.ts` no siempre coinciden con las columnas reales — ver nota en `purchases`.

## Tablas confirmadas contra el código

### profiles
| columna | notas |
|---|---|
| id | uuid, = auth.users.id |
| email | |
| name | |
| is_admin | **deprecada desde el 2026-08-07** — ya no la usa ningún server action ni policy nueva. Se mantiene viva de momento solo como red de seguridad de la migración a multi-tenant; se borrará en una limpieza final cuando se confirme que nada la referencia. No usar en código nuevo. |
| is_super_admin | añadida el 2026-08-07 — gate de plataforma (el dueño de Aularia), reemplaza a `is_admin`. Ser "admin" de una organización concreta ya NO se guarda aquí, ver `organization_admins`. |
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
| slug | subdominio (`{slug}.aularia.app`), unique, solo `[a-z0-9-]`. Reservados a nivel de aplicación (no en BD): `www`, `app`, `admin`, `api` |
| tagline_template | plantilla de copy tipo "Aprende {tema} junto a cientos de usuarios con {admin}" ({admin} se sustituye por el nombre del `owner_id`, o por `name` si no tiene). Usada desde la Fase 4 en el hero de `src/app/page.tsx`. **Hoy es `null` para las dos organizaciones existentes** (nadie la ha rellenado todavía) — con `null` se usa un genérico ("Aprende junto a cientos de usuarios con {admin}"). No hay UI para editarla todavía, solo SQL/dashboard. |
| logo_url | nullable |
| primary_color | nullable |
| owner_id | uuid, FK -> auth.users.id — quien creó la organización |
| created_at | |

RLS: lectura pública (`anon`+`authenticated`, `using (true)`) porque es branding de una web pública; solo `is_org_admin(id)` puede actualizar. Sin policy de insert/delete — la creación de una organización (más adelante, Fase 6) siempre pasa por service role en una server action, nunca por RLS directa.

### organization_billing
Añadida el 2026-08-07. Suscripción de PLATAFORMA (los 20€/mes que el cliente le paga a Aularia) — separada de `organizations` para que el estado de facturación no sea público.

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

Se puebla desde tres sitios: el registro en el subdominio del cliente (Fase 7, todavía no implementado), y los dos flujos de compra — `src/app/api/webhooks/stripe/route.ts` y `redeemWhopLicenseAction` (`src/app/cursos/[id]/actions.ts`) — que hacen upsert-si-no-existe (nunca reactivan una fila `removed`) justo después de insertar en `purchases`. **Importante**: si algún día se añade un tercer flujo que inserte en `purchases`, tiene que replicar este mismo paso — si no, el comprador se queda bloqueado por la policy `lessons_buyer_read` pese a haber pagado (ver Seguridad).

### invitations
Añadida el 2026-08-07. Invitaciones de alumnos y de co-admins (todavía sin flujo de aceptación implementado, ver Fase 3 del plan).

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
| columna | notas |
|---|---|
| id | |
| user_id | confirmado |
| lesson_id | confirmado |
| watched_seconds | inferido |
| completed | inferido |
| last_watched_at | inferido |

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

## Seguridad

RLS **sí está activo** en todas las tablas. Desde el 2026-08-07 el modelo es multi-tenant: ningún admin de la organización X puede leer/escribir datos de la organización Y. Estado por tabla:

| tabla | sin sesión (anon) | con sesión (authenticated) |
|---|---|---|
| `courses` | solo `status = 'published'` (policy `courses_public_read_published`) | `status = 'published'` de cualquier organización, o todas las filas (incl. borradores) de las organizaciones donde es admin |
| `sections` / `lessons` | nada | igual que `courses` para gestión de contenido; para VER una lección además hace falta `purchases` + seguir `active` en `organization_students` de esa organización (ver más abajo) |
| `purchases` | nada | solo su propia fila; los admins ven las de su(s) propia(s) organización(es), nunca las de otra |
| `profiles` | nada | solo su propia fila; los admins además ven los profiles de sus propios alumnos/co-admins (no los de otras organizaciones) |
| `video_views` | nada | solo sus propias filas; los admins ven las de lecciones de cursos de su(s) propia(s) organización(es) |
| `organizations` | branding público (`name`, `slug`, `logo_url`, etc., lectura abierta) | igual + puede editar si es admin de esa organización |
| `organization_billing` / `organization_integrations` | nada | solo admin/owner de esa organización (integrations: solo el owner) |
| `organization_admins` / `organization_students` / `invitations` | nada | solo admins de esa organización (alumno: además puede leer su propia fila en `organization_students`) |

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

## Resolución de organización en el sitio público (Fase 4)

`src/lib/organizations/getCurrentOrganization.ts` (memoizado por request con `cache()` de React) resuelve qué organización se está viendo, para el branding dinámico (`Header`, `Footer`, `src/app/layout.tsx`, hero de `src/app/page.tsx`) y el listado de cursos (`/cursos`):

1. Lee el header `x-org-slug` que inyecta `src/proxy.ts` a partir del subdominio (`cliente1.aularia.app` / `cliente1.localhost:3000` en local) o de la ruta `/o/<slug>` (ver más abajo). Si hay slug, busca la organización por `slug`.
2. **Sin slug (dominio raíz) → `null`, siempre** (desde la Fase 6): ya no hay ningún fallback a "la única organización que exista" ni a una variable de entorno — el dominio raíz tiene su propio significado (landing de registro de empresas, `CreateCompanyForm`) y no debe mostrar el sitio de ningún cliente. `Header`/`Footer` caen a branding genérico "Aularia" cuando `organization` es `null`.
3. **Historia**: hasta la Fase 6 existió aquí un fallback por variable de entorno `DEFAULT_ORG_SLUG` (necesario en cuanto hubo una segunda organización de prueba y el dominio raíz dejó de poder inferirse por "solo hay una"). Se eliminó del todo (`getCurrentOrganization.ts` y `.env.local`) al convertir el dominio raíz en la landing de registro — ver sección "Fase 6" más abajo.

`/cursos` usa la misma resolución para listar `courses` de esa organización (`status='published'`): 0 → mensaje vacío, 1 → redirect directo a `/cursos/{id}`, 2+ → listado. `/admin/cursos` y `/admin/estadisticas` NO usan esta función (son admin, no público) — usan `getCurrentOrgMembership()` en su lugar, ver Seguridad arriba.

**Hallazgo al probar esta fase**: la organización real `ivanorganico` ya tenía **3 cursos publicados** en la base de datos (`Dropshipping Orgánico desde Cero`, `Marketing Digital para Emprendedores`, `Introducción a la Programación Web`, estos dos últimos insertados el 2026-07-22), pero solo el primero era alcanzable desde la web pública porque todo el flujo (home, login, registro) redirigía siempre al `MAIN_COURSE_ID` hardcodeado. Con `/cursos` ahora dinámico, los tres aparecen.

**Crear cursos y editar la marca ya tienen UI** (antes solo por SQL/dashboard, ver Fase 9):
- `/admin/cursos` tiene un formulario "Crear curso" (título + precio) que inserta con `status: 'draft'` y redirige al currículum (`src/app/admin/cursos/actions.ts`, `createCourseAction`). **Ojo**: `courses.description` y `courses.learning_points` son `not null` sin default (ver tabla `courses` arriba) — el insert tiene que mandarlos explícitamente (`""` y `[]`).
- `/admin/marca` (nuevo, enlazado desde `AdminSidebar`) edita `organizations.name`, `tagline_template`, `logo_url` (con subida de imagen real, reutilizando el endpoint `api/admin/media/upload` ya existente) y `primary_color` (`src/app/admin/marca/actions.ts`, `updateBrandingAction`). Cualquier admin de la organización puede editarla (no solo el owner — igual que la policy RLS de `organizations`).
- El sidebar (`AdminSidebar.tsx`) ya no enlaza directo a "el curso más antiguo" — ahora tiene una entrada fija "Cursos" que va al listado en `/admin/cursos` (se quitó la query de un solo curso en `admin/layout.tsx`, ahora dead code).

## Integraciones externas

- **Stripe** (checkout de pago único) — `src/lib/stripe/client.ts`. El precio se calcula en el momento desde `courses.price` (no hay Price ID fijo en el dashboard de Stripe). La confirmación de compra llega por webhook (`src/app/api/webhooks/stripe/route.ts`, evento `checkout.session.completed`), nunca solo por el redirect del navegador — el webhook usa el cliente admin de Supabase (`src/lib/supabase/admin.ts`, service role key) porque no hay sesión de usuario en una llamada servidor-a-servidor.
- **Whop** (verificación de compras hechas fuera de la web) — `src/lib/whop/client.ts`. El alumno pega su license key de Whop; se valida contra `GET /memberships/{license_key_o_id}` de la API de Whop (acepta la license key directamente como id). Si el membership está activo y corresponde al `WHOP_PRODUCT_ID` configurado, se crea la fila en `purchases`. No hay webhook de Whop, es validación bajo demanda.
- Variables de entorno necesarias (en `.env.local`, y replicarlas en el proveedor de hosting al desplegar): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `WHOP_API_KEY`, `WHOP_PRODUCT_ID`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`. Ninguna de estas (excepto `NEXT_PUBLIC_SITE_URL`) debe usarse fuera de código de servidor.
- El acceso a `/cursos/[id]/aprender` requiere sesión iniciada y una fila en `purchases` para ese `user_id`+`course_id` (o ser admin de la organización de ese curso) — si no, redirige a `/cursos/[id]`.
- **Fase 5 (Stripe Connect + Whop por organización) — código completo, bloqueada por 2 pasos externos**: ver la sección siguiente para el detalle. Resumen:
  - `src/lib/crypto/encryption.ts` (nuevo): AES-256-GCM con `ENCRYPTION_KEY` (env var, 32 bytes en base64) para cifrar `organization_integrations.whop_api_key_encrypted`.
  - `src/lib/organizations/integrations.ts` (nuevo): `getConnectedStripeAccountId()`/`getWhopCredentials()`, leen con el cliente admin (el comprador no es el owner, RLS le bloquearía la lectura directa).
  - `createStripeCheckoutAction` (`src/app/cursos/[id]/actions.ts`) pasa `{stripeAccount: id}` si la organización ya conectó Stripe; si no, cobra en la cuenta principal exactamente como antes (fallback permanente, no solo de transición — así una organización nueva sin conectar no rompe nada).
  - `redeemWhopLicenseAction` ya no lee `WHOP_API_KEY`/`WHOP_PRODUCT_ID` globales — resuelve las credenciales de la organización del curso vía `getWhopCredentials()`; si no las tiene configuradas, error claro ("Este curso no tiene Whop configurado todavía.").
  - Nuevo webhook `src/app/api/webhooks/stripe-connect/route.ts` (secret propio `STRIPE_CONNECT_WEBHOOK_SECRET`): `checkout.session.completed` de cuentas conectadas (comparte lógica con el webhook principal vía `src/lib/stripe/handleCheckoutCompleted.ts`) + `account.updated` (actualiza `stripe_connect_status`).
  - `/admin/configuracion` (nuevo, solo visible/editable por el **owner**, no por cualquier admin): botón "Conectar con Stripe" (Account Link de onboarding) + formulario para pegar la API key/product ID de Whop (nunca se vuelve a mostrar en claro).
  - **Migrado**: la clave de Whop que antes era global (`WHOP_API_KEY`/`WHOP_PRODUCT_ID`) se cifró y se copió a la fila de `organization_integrations` de `ivanorganico` (`scripts/migrate-whop-key-to-org.mjs`, ejecutado) — así la redención de licencias real no se rompe con el cambio. **`WHOP_API_KEY`/`WHOP_PRODUCT_ID` en `.env.local` NO se deben borrar**: `src/app/api/webhooks/whop/route.ts` (el email de aviso de la license key) sigue siendo de un solo tenant y sigue leyéndolas — ver nota en ese archivo.
  - `src/app/api/webhooks/whop/route.ts` (el webhook que envía el email con la license key) se queda deliberadamente sin multi-tenant: el payload de Whop no indica a qué organización pertenece la membership, y resolverlo bien requeriría rediseñar ese webhook (endpoint por organización o mapear producto→organización antes de llamar a la API de Whop) — no bloquea la compra real, solo ese email de cortesía. Pendiente, ver Fase 9.

## Despliegue y dominio

**Decisión del usuario (2026-08-07): sin dominio propio, se queda en `*.vercel.app`.** El proyecto de Vercel se renombró de `ivan-organico` a `aularia` (`https://aularia.vercel.app`, ya confirmado funcionando) y el de Supabase también a "aularia" (cosmético, no cambia `NEXT_PUBLIC_SUPABASE_URL`). Ya hechos por el usuario: env vars de producción (`NEXT_PUBLIC_SITE_URL`, `DEFAULT_ORG_SLUG`) + redeploy, URL del webhook de Stripe actualizada, Redirect URLs de Supabase actualizados, webhook de Whop revisado.

**Bug encontrado y corregido al confirmar esta decisión**: `resolveOrgSlug()` en `src/proxy.ts` parseaba `aularia.vercel.app` igual que `cliente1.aularia.app` (3 etiquetas) y trataba `"aularia"` como si fuera el slug de un cliente inexistente — habría roto el sitio entero. Arreglado: cualquier hostname `*.vercel.app` se trata como dominio raíz (sin slug), igual que `localhost`.

### Enrutamiento por RUTA en vez de subdominio: `/o/<slug>`

`*.vercel.app` no admite wildcards de subdominio propios, así que el enrutamiento de tenant de la Fase 1 (`cliente1.aularia.app`) no es alcanzable en producción sin dominio propio. El usuario decidió (2026-08-07) resolverlo con **rutas** en vez de comprar un dominio, e implementación **completa** (no solo el mecanismo base): cualquier URL con el prefijo `/o/<slug>` (ej. `aularia.vercel.app/o/cliente1`) enruta a esa organización, y toda la navegación interna se queda dentro de ese prefijo.

- **`src/proxy.ts`**: `ORG_PATH_PREFIX` (regex `^/o/([a-z0-9-]+)(/.*)?$`) detecta el prefijo, mete `x-org-slug`/`x-org-path-prefix` como headers de request, y hace `NextResponse.rewrite()` a la misma ruta sin el prefijo (`/o/cliente1/cursos` → internamente `/cursos`, pero el navegador sigue viendo `/o/cliente1/cursos`). El enrutamiento por subdominio (Fase 1, para cuando algún día haya dominio propio) se mantiene intacto como alternativa — ambos mecanismos conviven, se prueba primero la ruta y si no hay match se cae al subdominio (o a `null`/dominio raíz si tampoco hay subdominio).
- **`src/lib/supabase/middleware.ts`**: `updateSession()` ahora acepta una función `buildResponse` opcional (por defecto `NextResponse.next({request})`) para poder combinar el `rewrite` con la renovación de cookies de sesión de Supabase sin perder ninguno de los dos.
- **`src/lib/organizations/orgPath.ts`** (nuevo): `getOrgPathPrefix()` (lee `x-org-path-prefix`, memoizado con `cache()`) y `orgPath(path)` (le antepone el prefijo). Server Components y Server Actions lo llaman directamente (`headers()` está disponible ahí); los pocos Client Components con enlaces internos (`LoginForm`, `AprenderView`) lo reciben como prop `basePath` desde su página.
- **Todo enlace/redirect interno de las páginas públicas pasa por `orgPath()`**: Header, Footer (branding, sin cambios ahí), home, `/cursos` (listado y detalle), `/login`, `/register`, `/forgot-password`, `/reset-password`, `signOutAction`, y las URLs `success_url`/`cancel_url`/`emailRedirectTo`/`redirectTo` que se construyen en servidor (Stripe Checkout, confirmación de registro, recuperación de contraseña) — así Stripe/Supabase redirigen de vuelta al mismo `/o/<slug>/...` en el que se inició el flujo. `/admin/*` se deja **sin prefijo a propósito**: qué organización administra un usuario se resuelve por su membership (`getCurrentOrgMembership`), no por la URL — un admin que navega desde `/o/cliente1/` sigue yendo a `/admin` (global) al hacer clic en el logo, no a `/o/cliente1/admin`.
- **`/invitaciones/[token]` se deja sin prefijo a propósito**: la organización de la invitación se resuelve por el token en la base de datos, no por la URL, así que no le hace falta.
- Verificado en navegador con Playwright contra `/o/cliente-prueba`: login → queda en `/o/cliente-prueba/cursos` (no en el `/cursos` por defecto) → cerrar sesión → vuelve a `/o/cliente-prueba/login`. El link del logo, logueado como admin, sigue yendo a `/admin` (sin prefijo) correctamente. Sin regresión en el dominio raíz (`ivanorganico` vía `DEFAULT_ORG_SLUG`, sin prefijo, tal cual antes).

## Fase 5 — estado de los bloqueos externos

Probando `/admin/configuracion` aparecieron problemas que no son bugs del código, sino pasos que solo puede resolver el usuario en sus propios dashboards:

1. ✅ **Resuelto**: RLS de `organization_integrations` sin policy de INSERT — SQL de arreglo aplicado por el usuario (ver historial de migraciones arriba).
2. ✅ **Resuelto**: "Accounts v1 support" activado en Stripe Dashboard.
3. ⏳ **Nuevo bloqueo, pendiente, no urgente**: al intentar "Conectar con Stripe" (ya con v1 activado), Stripe avisó de que la cuenta del usuario no tiene una cuenta bancaria vinculada. Decisión del usuario (2026-08-07): lo deja para más adelante, no bloquea seguir con el resto de fases. Confirmado por REST que ni `ivanorganico` ni `cliente-prueba` tienen `stripe_account_id` guardado — la conexión no llegó a completarse. **Retomar la verificación de punta a punta de Stripe Connect cuando el usuario vincule una cuenta bancaria en Stripe.**

Mientras tanto, lo que sí está verificado: el cifrado/descifrado de la clave de Whop migrada funciona correctamente, el resto del código compila y pasa lint sin errores, y el fallback de checkout (cobrar en la cuenta principal cuando la organización no está conectada) sigue funcionando exactamente como antes.

## Fase 6 — Suscripción de plataforma (20€/mes) y registro de admin en el index

Completada (2026-08-08). El dominio raíz (`aularia.vercel.app` sin `/o/<slug>`) deja de mostrar el `DEFAULT_ORG_SLUG` (eliminado, ver más abajo) y pasa a ser la landing de registro de nuevas empresas, tal como se decidió al principio del proyecto.

- **`src/app/page.tsx` ahora tiene dos ramas** según si `getCurrentOrganization()` resuelve una organización o no (misma ruta atiende tanto el dominio raíz como `/o/<slug>` tras el rewrite de `src/proxy.ts`, así que no se podía sustituir sin más):
  - Sin organización (dominio raíz) → `CreateCompanyForm` (nuevo): nombre de empresa, nombre del owner, email, contraseña.
  - Con organización (`/o/<slug>` o subdominio real) → el hero de siempre (tagline, CTA a `/cursos` o `/login`), sin cambios.
- **`src/app/actions.ts`** (nuevo, `createCompanyAction`): `signUp()` → crea `organizations` (`owner_id`, slug generado con `src/lib/organizations/slug.ts::slugify()` + desambiguado si ya existe con `resolveUniqueSlug()`) → `organization_billing` (solo `organization_id`, el status parte de `'trialing'` por default de columna) → `organization_admins(role: 'owner')` — las tres inserciones usan el cliente **admin** (service role), igual que documenta el esquema para `organizations`/`organization_billing` (sin policy de insert por RLS a propósito). Si hay sesión inmediata (confirm email desactivado), redirige directo al checkout de suscripción; si no, muestra "revisa tu correo" igual que el registro de alumno normal.
- **`src/lib/stripe/platformSubscription.ts`** (nuevo): `createPlatformSubscriptionCheckoutUrl(organizationId, userId)` — Checkout `mode: "subscription"`, `price_data` inline (20€/mes, sin Price ID fijo en el dashboard, mismo patrón que el checkout de curso), metadata con `organization_id`. Compartido entre el alta de empresa y `/admin/facturacion`.
- **`/admin/facturacion`** (nuevo, solo el owner): muestra el estado de `organization_billing.platform_subscription_status` y un botón "Suscribirse ahora"/"Reactivar suscripción" (si no está `active`) o "Gestionar suscripción" (Stripe Billing Portal, si ya está `active`).
- **Webhook principal (`src/app/api/webhooks/stripe/route.ts`) ampliado** — `src/lib/stripe/handlePlatformBilling.ts` (nuevo):
  - `checkout.session.completed` con `session.mode === "subscription"` → `handlePlatformSubscriptionCheckout()` (guarda `platform_stripe_customer_id`/`platform_subscription_id`, status `active`). Con `mode: "payment"` sigue yendo a `handleCheckoutSessionCompleted()` (compra de curso) como hasta ahora.
  - `invoice.paid` → status `active`. `invoice.payment_failed` → status `past_due`. `customer.subscription.deleted` → status `canceled`. Los tres localizan la organización por `platform_stripe_customer_id`, no por metadata (esos eventos no lo llevan).
  - **Pendiente, acción del usuario**: el webhook de Stripe ya existente solo tenía suscrito `checkout.session.completed` (ver captura de antes) — hay que añadirle `invoice.paid`, `invoice.payment_failed` y `customer.subscription.deleted` en Stripe Dashboard → Webhooks → editar el endpoint, o los otros tres eventos nunca llegarán.
- **Bloqueo del panel de admin por impago** (`src/components/layout/AdminBillingGate.tsx`, nuevo, usado desde `admin/layout.tsx`): un único punto de control en vez de tocar cada acción de escritura una por una.
  - `platform_subscription_status === 'canceled'` → toda página bajo `/admin` (excepto `/admin/facturacion`, para poder reactivar) muestra una pantalla de "Cuenta suspendida" en vez de su contenido normal.
  - `'past_due'` → banner de aviso, pero **no bloquea** (grace period antes de la suspensión total).
  - `'trialing'`/`'active'`/super_admin sin organización → sin gate, funciona normal.
  - Los alumnos con curso comprado **nunca pierden acceso** por esto — `AdminBillingGate` solo envuelve `/admin`, no `/cursos/[id]/aprender`.
  - Verificado con Playwright contra `cliente-prueba`: `active` → "Gestionar suscripción"; `past_due` simulado → banner sin bloquear; `canceled` simulado → "Cuenta suspendida" en `/admin` pero `/admin/facturacion` sigue accesible con "Reactivar suscripción"; restaurado a `active` al terminar.
- **`DEFAULT_ORG_SLUG` eliminado** (de `getCurrentOrganization.ts` y de `.env.local`): ya no hace falta — el dominio raíz tiene un significado propio ahora (landing de registro), no debe mostrar ningún cliente. **Pendiente, acción del usuario**: quitar `DEFAULT_ORG_SLUG` de las variables de entorno de producción en Vercel (ya no se lee, dejarla no rompe nada pero está obsoleta).
- Verificado además: la creación de organización (usuario + org + billing + admin) probada de punta a punta con un script (limpiado después); el checkout de suscripción de Stripe probado de forma aislada (devuelve una URL de `checkout.stripe.com` válida en modo `subscription`). El flujo completo a través del formulario real de `/` no se pudo probar end-to-end porque el proyecto de Supabase alcanzó el límite de envío de emails de auth tras tantas pruebas de registro en esta sesión ("email rate limit exceeded") — es un límite externo de Supabase, no un bug; el manejo de errores lo mostró correctamente en pantalla.

## Fase 7 — Cerrar registro de alumno en el dominio raíz, alta en el roster al registrarse en `/o/<slug>`

Completada (2026-08-08). Antes de esta fase, `/register` mostraba el mismo formulario de alumno en cualquier dominio (incluida la raíz, donde ya no tiene sentido desde la Fase 6 — ahí "registrarse" es crear una empresa, no ser alumno de nadie), y además **nunca insertaba nada en `organization_students`** al registrarse por libre: un alumno que se registraba directamente (sin invitación ni compra) quedaba con cuenta válida pero sin ninguna fila de roster, así que no aparecía en `/admin/usuarios` de ninguna organización.

- **`src/app/register/page.tsx`**: si `getCurrentOrganization()` no resuelve organización (dominio raíz), `redirect("/")` — ahí ya está `CreateCompanyForm` (Fase 6), que es el equivalente real de "crear cuenta" en ese dominio.
- **`src/app/register/actions.ts`** (`registerAction`):
  - Mismo guard por si acaso (`redirect("/")` si no hay organización) — defensa en profundidad, la action no debe fiarse solo de que la página ya filtró.
  - Tras `signUp()`, si hay `data.user` (existe aunque falte confirmar el email), upsert-si-no-existe en `organization_students` (`status: 'active'`, `joined_via: 'self_register'`) usando el cliente **admin** — la policy de `organization_students` solo permite insertar a los admins de esa organización, no al propio alumno nuevo. Mismo patrón que el resto de flujos: si ya existe una fila (incluida `'removed'`), no se toca.
- El `Header` no necesitó ningún cambio: nunca mostró un enlace de "regístrate" aparte del de "iniciar sesión" (que sigue siendo válido en cualquier dominio, tanto para alumnos como para owners que vuelven a `/login` desde la raíz).
- Verificado: `curl` a `/register` en dominio raíz devuelve 307 a `/`; `/o/cliente-prueba/register` carga con normalidad (200); un slug de organización inexistente en `/o/<slug>/register` también cae a `/` (mismo guard, `getCurrentOrganization` devuelve `null`). La inserción en `organization_students` se verificó aparte con un script contra la base real (usuario creado con `admin.auth.admin.createUser`, mismo bloque de código que usa la action: primera pasada inserta la fila `active`/`self_register`, segunda pasada la encuentra y no duplica). El envío real del formulario en navegador mostró correctamente el error "email rate limit exceeded" (mismo límite externo de Supabase agotado durante la Fase 6, no un bug) en vez del mensaje de éxito — no bloquea dar la fase por completa, ya que la lógica de negocio quedó verificada por otra vía.

## Fase 8 — Rebranding final "Aularia"

Completada (2026-08-08). El copy de marketing del dominio principal (`/`, sin organización) ya estaba en "Aularia" desde la Fase 6 ("Crea tu escuela online con Aularia", "Crear mi empresa — 20€/mes") — no hizo falta tocarlo. Lo que quedaba era todo lo mecánico:

- **`package.json`/`package-lock.json`**: campo `"name"` de `"teachable-clone"` a `"aularia"` (cosmético, no cambia ninguna dependencia). El lockfile se editó a mano porque este entorno no tiene acceso a red para correr `npm install`/`npm pkg fix` — si algo no cuadra al reinstalar en otra máquina, basta con un `npm install` normal para que npm lo regenere solo.
- **Favicon**: `src/app/favicon.ico` (el genérico de `create-next-app`, nunca se había tocado) borrado y sustituido por `src/app/icon.tsx` — icono generado en código con `ImageResponse` de `next/og` (convención de esta versión de Next, ver `node_modules/next/dist/docs/.../app-icons.md`): un cuadrado verde (`#16a34a`, el mismo verde que `--accent` en `globals.css`) con una "A" blanca, 32×32 `image/png`. Es un único favicon para todo el sitio (dominio raíz y cualquier `/o/<slug>`) — los subdominios/rutas de cliente siguen teniendo su propio branding (nombre, logo, color) en el `<title>`/`Header`/`Footer` vía `generateMetadata()` (Fase 4), pero no un favicon per-organización (no se pidió, sería una feature bastante más grande: habría que generar el `ImageResponse` a partir de `organization.logoUrl` por ruta).
- **Nombre del remitente en emails transaccionales** (`src/lib/resend/sendInvitationEmail.ts`, `sendLicenseKeyEmail.ts`): el `from` pasó de ser una dirección pelada (`RESEND_FROM_EMAIL`, sin nombre visible en el cliente de correo) a `` `Aularia <${RESEND_FROM_EMAIL}>` `` — el remitente ahora se lee "Aularia" independientemente de qué organización invitó o vendió el curso (el nombre de la organización ya aparece en el asunto/cuerpo del email, que sigue siendo dinámico).
- **Fuera de alcance a propósito**: las plantillas de email de Supabase Auth (confirmación de registro, recuperación de contraseña) siguen siendo las genéricas de Supabase — cambiar su remitente/diseño requiere configurar SMTP propio (Resend) en el dashboard de Supabase, que ya estaba anotado como pendiente en la Fase 9 (no es parte de esta fase, es una integración externa aparte).
- Verificado: `npx tsc --noEmit` sin errores; `npm run dev` levantado y comprobado con `curl` que `/icon` devuelve `200 image/png` de 32×32 y que el `<head>` de `/` incluye `<link rel="icon" href="/icon?..." type="image/png" sizes="32x32">`; el PNG generado se inspeccionó visualmente (cuadrado verde con "A" blanca, legible en miniatura).

## Fase 10 — Suite de tests E2E con Playwright

Completada (2026-08-08). Sustituye los scripts `.mjs` desechables usados durante las fases 1-9 por specs reales en `e2e/`, corridos por `.github/workflows/ci.yml`. 26 tests, 24 en verde localmente y 2 que se saltan por motivos externos legítimos (ver abajo).

- **Bug real encontrado y corregido antes de escribir el test que lo habría detectado igualmente**: `src/app/invitaciones/[token]/actions.ts` redirigía a un alumno recién aceptado a `/` (dominio raíz) tras crear su cuenta — como ese enlace se abre siempre desde el dominio raíz (`sendInvitationEmail.ts` no lleva prefijo a propósito) y desde la Fase 6 la raíz sin prefijo es la landing de registro de empresas, el alumno aterrizaba viendo "Crea tu escuela online con Aularia" en vez de sus cursos. Arreglado: se añadió `redirectPathAfterAccept()`, que resuelve el `slug` de la organización y manda al alumno a `/o/<slug>/cursos` (mismo destino que el autorregistro de la Fase 7); los admins invitados siguen yendo a `/admin` (sin prefijo, correcto, no depende de la URL).
- **`e2e/helpers.ts` reescrito para ser consciente de rutas**: el `login()` de antes asumía que tras iniciar sesión se acababa en una URL con `/cursos/` (con barra final y algo detrás) — esto dejó de cumplirse dos veces sin que nadie lo notara: (1) el dominio raíz ya no resuelve ninguna organización desde la Fase 6, así que `/cursos` sin prefijo muestra "No hay cursos disponibles" en vez de redirigir; (2) `ivanorganico` pasó a tener 3 cursos publicados desde la Fase 4, así que aunque se usara el prefijo correcto (`/o/ivanorganico`), `/cursos` ya no redirige a una ficha concreta, muestra un listado. Los 2 specs preexistentes (`access-control.spec.ts`, `video-protection.spec.ts`) fallaban en los 5 tests que usan `login()` — confirmado corriendo la suite antes de tocar nada. Arreglado: `login(page, email, password, orgPrefix)` ahora acepta el prefijo (por defecto `/o/ivanorganico`) y solo espera quedarse dentro de `${orgPrefix}/cursos`, sin asumir qué hay después.
- **`e2e/fixtures.ts` (nuevo)**: `createTestOrg()`/`destroyTestOrg()` — cada spec nuevo crea su propia organización efímera (owner con `admin.auth.admin.createUser({email_confirm:true})`, fila en `organizations`/`organization_billing`/`organization_admins`) en `beforeAll` y la borra entera (filas dependientes + usuarios auth) en `afterAll`. Deliberado: **no hizo falta ningún Secret nuevo en CI** — solo usa `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, que el job de e2e ya tenía. Evita depender de cuentas fijas compartidas entre specs que corren en paralelo (`fullyParallel: true`).
- **Specs nuevos** (cobertura mínima que pedía el plan):
  - `tenant-routing.spec.ts`: dominio raíz sin branding de ningún cliente, `/o/<slug>` con el branding correcto y aislado del de otra organización, un slug inexistente cae a la landing sin romper, y una **regresión automatizada del bug de `*.vercel.app`** de la Fase 5 (request cruda con `Host: aularia.vercel.app` vía el fixture `request` de Playwright, replicando el `curl -H "Host: ..."` que se usó a mano en su momento).
  - `cross-tenant-isolation.spec.ts`: regresión del bug real de la Fase 4 — un curso `published` de la organización A no aparece en `/admin/cursos` ni `/admin/estadisticas` de la organización B.
  - `course-creation-and-branding.spec.ts`: crear un curso desde `/admin/cursos` y editar `/admin/marca` reflejan el cambio en el portal público.
  - `invitations.spec.ts`: invitar desde la UI crea la fila `pending`; aceptar (con una invitación insertada directamente con un token propio — no se puede interceptar el email real de Resend desde el test) crea la cuenta, entra al roster y redirige correctamente (ver el bug de arriba); echar cambia el estado a "Echado". `StudentActions` dispara `confirm()` y luego `prompt()` — hay que encadenar los `page.once("dialog", ...)`, si se registran los dos de golpe ambos reaccionan al primer diálogo y el segundo se queda sin manejar.
  - `billing-gate.spec.ts`: los 4 estados de `organization_billing.platform_subscription_status` contra `AdminBillingGate` (serial, muta la misma organización efímera en cada paso).
  - `student-self-register.spec.ts`: regresión del fix de la Fase 7 — `/register` en el dominio raíz o en un slug inexistente redirige a la landing; en `/o/<slug>` sí registra y entra en `organization_students`. Tolera el límite de envío de emails de Supabase (`test.skip()` si el error de la action es "email rate limit exceeded" — límite externo real, ya documentado, no un bug).
- **Gotcha encontrado escribiendo estos specs**: `page.getByRole("alert")` sin acotar también matchea el `<div id="__next-route-announcer__" role="alert">` que inyecta el propio Next.js (siempre presente en el DOM, técnicamente "visible" para Playwright aunque esté clip-eado por CSS) — cualquier `Promise.race`/`waitFor` contra "alert" a secas se resuelve casi al instante contra ese elemento vacío en vez de esperar al error real. Hay que acotar el locator (p. ej. `page.locator("form").getByRole("alert")`).
- **Requisito nuevo de CI**: `invitations.spec.ts` ejercita el envío real de email de invitación (`sendInvitationEmail`, Resend) — antes ningún test en `e2e/` llamaba a ese código. El job de e2e en `ci.yml` ya pasaba `RESEND_API_KEY`/`RESEND_FROM_EMAIL` con fallback a `'dummy'`; **para que este test pase en CI hace falta que el Secret `RESEND_API_KEY` del repo sea una clave real de Resend** (con `'dummy'` el envío falla y la invitación no llega a mostrarse como "enviada").
- No cubierto a propósito (fuera del alcance mínimo pedido): Stripe Connect (bloqueado por el paso externo de la cuenta bancaria, ver Fase 5) y el flujo de checkout/webhook de Stripe end-to-end (requeriría simular webhooks firmados, no solo navegar).
