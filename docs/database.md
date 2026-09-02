# Base de datos (Supabase)

El estado real del esquema vive en Supabase (cloud) y no hay Prisma. Este archivo es el inventario versionado del esquema confirmado. `20260830000000_initial_platform_baseline.sql` captura, sin datos reales, la base histórica anterior a las migraciones incrementales; una rama vacía puede reconstruir todo el esquema aplicando `supabase/migrations/` en orden. Cuando sea seguro, los cambios también tienen rollback en `supabase/rollbacks/`. La presencia de un archivo no demuestra que se haya aplicado: **actualiza este documento solo después de verificar el resultado real en Supabase**.

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
| slug | segmento público de ruta (`/o/{slug}`), unique, solo `[a-z0-9-]`. Los administradores pueden editarlo desde `/admin/marca`: la interfaz normaliza espacios, acentos y mayúsculas, consulta disponibilidad y permite copiar la URL canónica; el índice unique resuelve de forma atómica dos guardados concurrentes. El enlace anterior deja de funcionar después del cambio. Históricamente se diseñó también para `{slug}.delunivo.app`, dominio que nunca se configuró. Reservados a nivel de aplicación (no en BD): `www`, `app`, `admin`, `api`, `o`. |
| tagline_template | Titular grande de la portada de la empresa. Plantilla tipo "Aprende {tema} junto a cientos de usuarios con {admin}" ({admin} se sustituye por el nombre del `owner_id`, o por `name` si no tiene). Con `null` se usa un genérico. Editable en `/admin/marca`. |
| hero_subtitle | **añadida el 2026-08-11** — frase de apoyo debajo del titular en la portada. Nullable, editable en `/admin/marca`. |
| featured_course_id | **añadida el 2026-08-11** — uuid, FK -> courses.id `on delete set null`. Curso que protagoniza la portada (su `thumbnail_url` es la imagen del hero y su precio el "Desde X €"). Con `null`, `splitForLanding()` usa el curso publicado más antiguo. `updateBrandingAction` valida que el curso sea de esa misma empresa antes de guardarlo. |
| logo_url | nullable |
| primary_color | nullable. Se inyecta como `--accent` en `<html>` desde `src/app/layout.tsx`, junto con un `--accent-foreground` calculado (negro o blanco según la luminancia WCAG del color, ver `src/lib/organizations/brandColor.ts`) para que el texto de los botones siempre se lea. |
| owner_id | uuid, FK -> auth.users.id — quien creó la organización |
| created_at | |

RLS: lectura pública (`anon`+`authenticated`, `using (true)`) porque es branding de una web pública; solo `is_org_admin(id)` puede actualizar. Sin policy de insert/delete — la creación de una organización (más adelante, Fase 6) siempre pasa por service role en una server action, nunca por RLS directa.

### organization_billing
Añadida el 2026-08-07 y ampliada el 2026-08-30. Suscripción de PLATAFORMA que el cliente paga a Delunivo — separada de `organizations` para que el estado de facturación y las condiciones comerciales no sean públicos.

| columna | notas |
|---|---|
| organization_id | uuid, PK y FK -> organizations.id (1 fila por organización) |
| platform_stripe_customer_id | nullable |
| platform_subscription_id | nullable |
| platform_subscription_status | 'trialing' \| 'active' \| 'past_due' \| 'canceled', default 'canceled' |
| platform_billing_last_event_at | fecha del último evento de Stripe aplicado; impide que un checkout, pago o impago retrasado sobrescriba un estado más nuevo. |
| access_mode | `standard` \| `complimentary` \| `trial`. El acceso gratuito no caduca; las pruebas exigen fecha de fin. |
| access_expires_at | nullable; fecha de fin de una prueba gratuita. |
| discount_percent | entero 0–100. |
| discount_duration | `once` (primera factura mensual) \| `forever`. |
| stripe_coupon_id | nullable; cupón de Stripe creado para aplicar la condición comercial. |
| affiliate_discount_cap_percent | tope total del descuento calculado, 50% por defecto; el superadministrador puede elevarlo para una excepción aprobada. |
| affiliate_reward_percent | recompensa por cada referido activo, 10% por defecto. |
| effective_discount_percent | descuento total vigente que se sincroniza como un único cupón de Stripe. |
| referral_welcome_remaining_payments | facturas pagadas que aún reciben el 10% de bienvenida; empieza en 3. |
| manual_discount_remaining_payments | vale 1 mientras un descuento manual `once` no se haya consumido. |
| commercial_note | nullable, máximo 1.000 caracteres; contexto interno del superadministrador. |
| updated_at | última actualización de las condiciones. |

RLS: solo lectura, solo `is_org_admin(organization_id)`. Sin policy de escritura directa — los webhooks y las acciones del centro de control validan permisos y escriben con service role.

### platform_settings

Añadida el 2026-08-30. Singleton con la configuración comercial pública de Delunivo.

| columna | notas |
|---|---|
| id | boolean PK, siempre `true`; garantiza una sola fila. |
| monthly_price_cents | precio mensual para nuevas suscripciones, default `3000` (30 €). |
| updated_at | última modificación. |
| updated_by | nullable, FK a `auth.users`; superadministrador que hizo el cambio. |

RLS: lectura pública limitada a `id` y `monthly_price_cents` para mostrar el mismo precio en landing, alta y facturación; la auditoría no se expone. Solo `is_super_admin()` puede actualizar las columnas concedidas; no hay insert ni delete desde clientes.

Desde `20260830214830_enforce_platform_access_and_billing_integrity.sql`,
`has_org_platform_access(org_id)` centraliza el permiso comercial: permite
suscripciones `active`, `trialing` y `past_due`, invitaciones gratuitas vigentes
y pruebas no vencidas; el superadministrador siempre puede intervenir. Las
policies de escritura de empresa, cursos, temario, alumnos, administradores e
integraciones usan ese permiso. Una empresa suspendida no puede saltarse el
bloqueo de la interfaz mediante la Data API, mientras los alumnos conservan la
lectura de cursos ya comprados o asignados.

Facturación no depende de la membresía “actual”: `/admin/facturacion` permite
elegir explícitamente una de las empresas que posee el usuario y las server
actions vuelven a validar ese `organization_id` con `is_org_owner()`. Esto
permite reactivar una empresa cancelada aunque el mismo usuario administre
otras empresas activas.

### organization_referral_codes / organization_referrals

Añadidas y verificadas en Supabase el 2026-08-31. El código es opaco, único y
solo se resuelve en servidor. Cada empresa tiene como máximo un enlace activo;
cada empresa y cada propietario referidos solo pueden atribuirse una vez. La
base rechaza autorreferencias, códigos ajenos, atribuciones posteriores al
inicio de la facturación y altas con más de 15 minutos.

La atribución empieza `pending`. Solo una factura de importe pagado mayor que
cero la convierte en `active`; un impago o la cancelación la deja `inactive`.
El invitado recibe 10% durante sus tres primeras facturas pagadas. El referente
recibe por defecto 10% por cada referido activo. El descuento efectivo suma el
manual aplicable, la bienvenida y las recompensas, y se limita al tope de la
empresa (50% normal). Una excepción comercial se expresa elevando ese tope, no
saltándose el cálculo.

Ambas tablas tienen RLS activa sin policies y sin privilegios para `anon` ni
`authenticated`; solo `service_role` puede leer o mutar. Las RPC de atribución,
recálculo y aplicación de eventos también son exclusivas de servidor.

### stripe_platform_webhook_events

Registro privado e idempotente de eventos de la suscripción de plataforma.
Conserva estado, intentos, error y si el efecto de dominio ya fue aplicado. Un
evento simultáneo queda `in_progress` para que Stripe reintente; uno completado
se reconoce como duplicado. Las fechas de facturación impiden que un evento
antiguo reactive un referido después de una baja más reciente.

### support_impersonation_sessions

Auditoría privada de “Run as”. Guarda actor, objetivo, motivo, caducidad máxima
de 15 minutos, IP, agente de usuario, estado final y el ID real de la sesión de
Supabase Auth creada para el objetivo. La sesión original del superadministrador
se cifra en la aplicación con AES-256-GCM; en la base solo se guarda el marcador
como SHA-256. No se permite actuar como otro superadministrador ni abrir dos
sesiones activas para el mismo actor.

RLS está activa sin policies y todos los privilegios de navegador están
revocados. Las RPC de apertura, enlace a `auth.sessions` y cierre solo se
conceden a `service_role`. El permiso de borrado existe únicamente para
mantenimiento/E2E y ninguna ruta de producto lo expone.

### organization_integrations
Añadida el 2026-08-07. Claves de pago propias de cada cliente — la tabla más sensible de todas, separada del resto a propósito.

| columna | notas |
|---|---|
| organization_id | uuid, PK y FK -> organizations.id (1 fila por organización) |
| stripe_account_id | nullable — cuenta Stripe Connect Express de la organización; los cobros de sus cursos deben crearse en esta cuenta conectada |
| stripe_connect_status | nullable — `pending` \| `connected`; se actualiza al volver del onboarding y mediante el webhook Connect `account.updated` |
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
invitaciones (`src/app/invitaciones/[token]/actions.ts`) y los flujos de compra.
Los flujos de compra crean la membresía junto a `purchases` y nunca reactivan
automáticamente una fila `removed`.

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
| note | nota interna opcional del admin, máximo 1000 caracteres; no aparece en el email ni en la página pública de aceptación |
| expires_at | |
| created_at | |

Índice único parcial case-insensitive: como mucho una invitación `pending` por
persona y organización, independientemente de si es de alumno o admin. RLS:
solo admins de esa organización pueden leer. `authenticated` no tiene INSERT,
UPDATE ni DELETE directos; crear y revocar pasa por RPC con validación de rol.
La aceptación se completa de forma atómica con service role.

**Implementado el 2026-08-07 y ampliado el 2026-08-30**:
`src/app/admin/usuarios/actions.ts` gestiona invitaciones, alumnos y admins;
`src/app/invitaciones/[token]/` acepta el enlace. El token en claro solo va en
la URL del email y la base guarda su SHA-256. La RPC
`create_invitation_with_courses` impide desde SQL que un no-owner invite admins
y valida que todos los cursos pertenezcan a la organización.
`revoke_invitation` solo permite revocar invitaciones pendientes de la propia
organización y reserva las de admin al owner.

### invitation_courses
Cursos incluidos en una invitación de alumno. Clave primaria compuesta
`(invitation_id, course_id)`. Una invitación de admin no contiene cursos. RLS:
solo admins de la organización de la invitación pueden leer filas; la creación
ocurre dentro de la RPC validada.

### student_course_access
Accesos concedidos fuera del checkout, normalmente al aceptar una invitación.
La clave primaria `(user_id, course_id)` garantiza un único acceso por alumno y
curso; conserva `invitation_id`, `granted_by` y `created_at` como auditoría. El
alumno ve sus filas y los admins solo las de cursos de su organización. No se
mezcla con `purchases`, por lo que la lista de cursos distingue comprado de
invitado.

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

RLS activo y **sin ninguna policy, a propósito**. Desde la migración
`20260902092019_harden_signup_media_and_progress.sql`, `anon` y
`authenticated` tampoco tienen grants sobre la tabla: solo `service_role`
puede usarla. Un código de verificación no debe ser legible por ningún cliente,
ni siquiera por su propio destinatario.

**Emisión y consumo atómicos** (2026-09-02): las RPC privadas
`issue_verification_code` y `consume_verification_code`, ejecutables solo por
`service_role`, serializan la emisión con un advisory lock y bloquean la fila
al consumirla. Así, solicitudes concurrentes no pueden saltarse los topes ni
usar el mismo código dos veces. El índice parcial único
`verification_codes_one_active_idx` garantiza un solo código activo por
`lower(email), purpose`. Se mantienen los límites de 3 códigos por correo y 60
en total cada 15 minutos, además de 5 intentos fallidos por código.

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
| blocks | jsonb, confirmado — array de bloques `{type: "video"\|"video_file"\|"text", ...}`. `"video"` se muestra en el admin como **"Embed media"** (enlace externo tipo YouTube/Vimeo) y usa `video_url`. Para las subidas nuevas, `"video_file"` guarda `mux_video_asset_id`, que referencia `video_assets`; el archivo se procesa y reproduce de forma privada mediante Mux. Los bloques antiguos pueden conservar `video_url` con una ruta de Supabase Storage por compatibilidad. El contenido de los bloques `"text"` es HTML (editor de texto enriquecido), se sanea con `isomorphic-dompurify` antes de renderizarlo al alumno. |

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

### stripe_checkout_attempts

Añadida y verificada en producción el 2026-08-31. Registro privado y
server-only que coordina la creación idempotente de Checkout para impedir dos
sesiones cobrables por la misma compra o suscripción.

| columna | notas |
|---|---|
| id | uuid, PK; también forma la clave idempotente enviada a Stripe |
| checkout_kind | `course_purchase` \| `platform_subscription` |
| organization_id / user_id | FK obligatorias con `ON DELETE RESTRICT` |
| course_id | FK nullable; obligatoria para compra de curso y nula para suscripción de plataforma |
| stripe_account_id | cuenta Connect obligatoria para cursos; nula para suscripción de plataforma |
| stripe_session_id / stripe_session_url | nullable hasta crear la sesión; el ID es único y ambos campos aparecen juntos |
| stripe_params | jsonb, parámetros inmutables usados al reintentar la misma petición idempotente |
| expected_amount_total / expected_currency | validación económica del webhook; el importe es obligatorio para cursos |
| status | `creating` \| `open` \| `completed` \| `expired` \| `failed` |
| expires_at / error_message | estado operativo y último error, nullable |
| created_at / updated_at | timestamptz |

Índices únicos parciales permiten como máximo un intento `creating`/`open` por
alumno+curso y uno por organización para la suscripción de plataforma. RLS está
activa sin policies; `anon` y `authenticated` no tienen privilegios y solo
`service_role` puede leer o mutar la tabla. El rollback versionado es
destructivo y no debe ejecutarse con el código de Checkout desplegado.

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

RLS: cada alumno ve, inserta y borra **solo sus propias filas** (`user_id = (select auth.uid())`); los admins ven las de lecciones de cursos de su(s) organización(es). Las policies de escritura exigen además acceso vigente al curso. La policy de DELETE original se añadió el 2026-08-11 — antes solo había de INSERT, así que desmarcar una lección no daba error pero tampoco borraba nada: la interfaz se quedaba desmarcada y la base de datos no.

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
- **2026-08-30** — invitaciones únicas y acceso por curso: `invitations.note`,
  `invitation_courses`, `student_course_access`, las RPC atómicas
  `create_invitation_with_courses` y `complete_invitation_acceptance`, y
  `has_course_access` como control común de compra/invitación. La policy de
  lectura de lecciones usa este último control. Migraciones versionadas
  `20260830203510_course_scoped_invitations.sql`,
  `20260830203655_invite_access_fk_indexes.sql` y
  `20260830205248_secure_invitation_and_lesson_access.sql`, aplicadas y
  verificadas contra el proyecto Delunivo. La última cierra escrituras directas
  de invitaciones y evita que alumnos lean cursos o lecciones en borrador.
- **2026-08-30** — control comercial de plataforma: `platform_settings`, precio
  inicial de 30 €/mes y condiciones por empresa en `organization_billing`
  (`access_mode`, prueba, descuento, cupón y nota). Las empresas que figuraban
  activas sin una suscripción real de Stripe quedaron identificadas como acceso
  gratuito. Migraciones `20260830210751_platform_commercial_controls.sql` y
  `20260830210858_backfill_manual_billing_grants.sql`, aplicadas en Delunivo.
  `20260830212709_restrict_platform_settings_privileges.sql` limita los grants
  a lectura y actualización controlada del precio, y elimina un índice de
  caducidad que ninguna consulta utiliza. La migración
  `20260830214141_limit_platform_settings_public_columns.sql` oculta además las
  columnas de auditoría a clientes públicos.
- **2026-08-31** — borrado seguro de cursos: `purchases.course_id` cambia de
  `ON DELETE CASCADE` a `ON DELETE RESTRICT`, por lo que ni una carrera ni una
  llamada directa pueden borrar el historial de compras. La FK compuesta
  `lessons(section_id, course_id)` impide asociar una lección a un capítulo de
  otro curso u organización. `mux_deletion_jobs`, su trigger sobre
  `video_assets` y la RPC privada `claim_mux_deletion_jobs` forman una cola
  persistente para limpiar Mux al borrar cursos, capítulos o lecciones.
- **2026-08-30** — integridad de acceso y facturación: la migración
  `20260830214830_enforce_platform_access_and_billing_integrity.sql` lleva el
  bloqueo comercial a RLS y RPC, restringe las columnas internas de
  `organization_billing` y añade unicidad parcial para los IDs de cliente y
  suscripción de Stripe. La migración
  `20260830215237_harden_organization_billing_privileges.sql` retira además
  todos los privilegios de escritura históricos de `authenticated` y hace que
  el helper comercial se ejecute sin privilegios elevados.
- **2026-08-31** — `stripe_checkout_attempts`: coordinación idempotente y
  privada de Checkout para cursos y suscripciones. Migración
  `20260831141239_lock_stripe_checkout_attempts.sql` aplicada manualmente y
  verificada con RLS activa, cero policies públicas, permisos exclusivos de
  `service_role`, siete índices y FKs `RESTRICT`.
- **2026-08-31** — afiliados y soporte auditado: migraciones
  `20260831164326_secure_affiliate_program.sql`,
  `20260831164334_audited_support_impersonation.sql`,
  `20260831170054_bind_support_auth_session.sql` y
  `20260831171052_grant_private_service_cleanup.sql`, aplicadas y verificadas
  en el proyecto Delunivo. Las cuatro tablas privadas tienen RLS sin policies,
  cero grants para `anon`/`authenticated` y RPC exclusivas de `service_role`.
- **2026-08-31** — orden temporal de facturación de plataforma: la migración
  `20260831174551_order_platform_billing_events.sql` añade el reloj del último
  evento y dos RPC privadas que aplican tanto el checkout inicial como los
  cambios de estado solo si no existe un evento posterior. Evita que webhooks
  retrasados de la misma suscripción degraden un pago ya recuperado. Stripe
  fecha estos eventos con precisión de segundos; un empate exacto conserva el
  orden de entrega como desempate residual.
- **2026-09-02** — endurecimiento de alta, medios y progreso: la migración
  `20260902092019_harden_signup_media_and_progress.sql` retira a los clientes
  cualquier escritura directa sobre `profiles`, cierra las RPC heredadas,
  hace atómicas la emisión y el consumo de códigos, limita la inserción y el
  borrado de progreso a lecciones con acceso vigente y crea el bucket
  `public-media`. También sustituye el logo roto de Ivan por un asset local y
  pasa el curso de prueba `test2` a borrador tras confirmar que no tenía
  ventas. Aplicada y verificada en Delunivo; su versión y la de
  `20260831141239` están registradas en el historial remoto.
- **2026-09-02** — reproducibilidad y rendimiento: se añadió
  `20260830000000_initial_platform_baseline.sql`, se marcó como aplicada en el
  historial de producción porque representa el esquema histórico ya existente,
  y una rama vacía aplicó correctamente la cadena completa. Las migraciones
  `20260902124433_remove_redundant_purchase_unique.sql` y
  `20260902124822_optimize_rls_and_foreign_keys.sql` eliminan una restricción
  duplicada, cierran cuatro helpers a `anon`, consolidan policies equivalentes,
  evitan reevaluar `auth.uid()` por fila y añaden los índices de FK que faltaban.
  Tras E2E 53/53, ambas se aplicaron y verificaron en producción.

## Emails y verificación de cuenta

Desde el 2026-08-11, **Supabase Auth no envía ningún email**. Ni el de confirmación de registro ni el de recuperación de contraseña: su límite de envío en el plan gratuito se agotaba constantemente al probar, y sus plantillas no se pueden editar sin configurar SMTP propio.

- **Punto único de envío**: `src/lib/email/send.ts` (`sendEmail`). Nada llama a Resend directamente. Las plantillas concretas están en `src/lib/email/templates.ts` sobre el HTML común de `src/lib/email/layout.ts`.
- **Desarrollo y previews**: el modo por defecto redirige todo email a las direcciones activas de `admin_emails`, con el destinatario original en el asunto (`[→ pepe@gmail.com] Tu código`) y un aviso en el cuerpo. La lista vive en `/admin/plataforma#correos` y exige `is_super_admin()`, por lo que ningún cliente puede verla; `/admin/emails` solo redirige allí por compatibilidad.
- **Producción de Vercel**: la entrega pasa automáticamente a `live` cuando
  existe `RESEND_FROM_EMAIL` de un dominio verificado. Hasta entonces conserva
  la redirección segura para no perder correos. `off` permanece como interruptor
  de emergencia.
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
| `organization_referral_codes` / `organization_referrals` / `stripe_platform_webhook_events` | nada | **nada** — tablas server-only; el enlace público se valida mediante un route handler y las mutaciones mediante RPC privadas |
| `support_impersonation_sessions` | nada | **nada** — auditoría y sesión cifrada solo para `service_role`; el navegador conserva únicamente un marcador HttpOnly |
| `sections` / `lessons` | nada | igual que `courses` para gestión; para VER una lección hace falta seguir `active` en `organization_students` y tener compra o acceso invitado al curso, salvo admins de esa organización |
| `purchases` | nada | solo su propia fila; los admins ven las de su(s) propia(s) organización(es), nunca las de otra |
| `profiles` | nada | solo lectura: su propia fila; los admins además ven los profiles de sus propios alumnos/co-admins (no los de otras organizaciones). La creación queda exclusivamente en el trigger de Auth; no existe escritura directa desde navegador. |
| `video_views` | nada | solo sus propias filas; los admins ven las de lecciones de cursos de su(s) propia(s) organización(es) |
| `organizations` | branding público (`name`, `slug`, `logo_url`, etc., lectura abierta) | igual + puede editar si es admin de esa organización |
| `organization_billing` / `organization_integrations` | nada | estado comercial visible al admin mediante columnas limitadas; notas y cupón son internos. Integraciones: solo owner con acceso activo |
| `organization_admins` / `organization_students` / `invitations` / `invitation_courses` | nada | admins de esa organización; invitaciones y cursos asociados son de lectura directa, sus mutaciones pasan por RPC (alumno: además puede leer su propia fila en `organization_students`) |
| `student_course_access` | nada | el alumno ve sus accesos y los admins los de cursos de su organización |

**Fuga cross-tenant corregida el 2026-08-11 (ficha pública de curso)**: `src/app/cursos/[id]/page.tsx` buscaba el curso solo por `id`. Como la policy `courses_public_read_published` deja leer cualquier fila publicada de **cualquier** empresa (lo necesita el sitio público), `/o/empresaA/cursos/<id-de-empresaB>` renderizaba el curso de B con el Header, el logo y el color de A. Arreglado comparando `course.organization_id` con la organización que resuelve la URL: si no coinciden, el curso "no existe" en ese portal. Los tests de la Fase 10 cubrían `/admin/cursos` y `/admin/estadisticas`, pero no la ficha pública.

El control de acceso admin se repite a mano en cada server action, ahora vía `requireOrgAdmin()`/`requireSuperAdmin()`/`requireAnyOrgAdmin()` (`src/lib/auth/requireOrgAdmin.ts`, reemplaza al antiguo `requireAdmin()`) — RLS y el chequeo de código son dos capas independientes, no confiar solo en una. Estos helpers llaman por RPC a las mismas funciones `security definer` que usan las policies (`is_org_admin`, `is_super_admin`, `has_org_platform_access`), para no duplicar la lógica de "quién es admin de qué" ni el estado comercial en dos sitios.

**Alumno expulsado ("echado")**: `organization_students.status = 'removed'`
corta el acceso aunque conserve compras e invitaciones, para mantener el
historial. `has_course_access(course_id)` centraliza compra o concesión invitada
más membresía activa. Para alumnos también exige curso y lección publicados; los
admins conservan acceso a borradores. La policy `lessons_course_access_read` usa
esa función.

- **`profiles`** se crea sola: trigger `on_auth_user_created` (`after insert on auth.users`) inserta la fila con `name` sacado de `raw_user_meta_data->>'name'` e `is_admin = false` (sin tocar desde el 2026-08-07 — `is_super_admin` toma su default de columna, `false`, porque el trigger no la menciona). `registerAction` ya no inserta el perfil a mano (ver `src/app/register/actions.ts`) — así el perfil existe también si el usuario se crea por otra vía (invitación, magic link, panel de Supabase).

## Storage

- **`public-media`** (bucket público, creado el 2026-09-02) — imágenes de marca,
  curso y contenido. Límite de 10 MB; solo PNG, JPEG, WebP y GIF validados por
  firma binaria. Las escrituras pasan por
  `src/app/api/admin/media/upload/route.ts`, que exige el alcance concreto
  (`brand`, `course` o `lesson`), valida `requireOrgAdmin()` y guarda bajo
  `<organization_id>/<scope>/...`. No hay escritura directa desde navegador.
- **`lesson-media`** (bucket **privado** desde el 2026-08-02, antes público) — creado el 2026-07-23. Se conserva para imágenes y vídeos heredados; las subidas nuevas de vídeo usan Mux. Contiene:
  - `videos/` — archivos heredados de bloques `video_file`. **Sin lectura pública**: solo se pueden leer mediante una URL firmada generada en servidor después de comprobar que el usuario administra o compró el curso.
  - `images/` — imágenes heredadas del editor enriquecido. Conservan la policy
    pública histórica para no romper contenido ya publicado, pero las nuevas
    subidas ya no entran aquí.
- Los vídeos nuevos se cargan directamente a Mux mediante una URL de subida creada por `src/app/api/admin/mux/uploads/route.ts`; no atraviesan Vercel ni Supabase Storage.
- **Ojo con `video_url` en `lessons.blocks`**: en bloques `video_file` heredados puede contener una ruta relativa de Storage (`videos/uuid.mp4`) o una URL pública antigua. `extractStoragePath()` normaliza ambos formatos antes de firmar la lectura. Los bloques nuevos usan `mux_video_asset_id` y no necesitan `video_url`.
- Los paths antiguos de `lesson-media` no contienen `organization_id`; se
  mantienen solo por compatibilidad. Para previsualizarlos, el servidor exige
  el `lessonId`, comprueba acceso y verifica que el path esté realmente
  referenciado por esa lección. El aislamiento de las imágenes nuevas sí está
  en el path de `public-media` y en la autorización del route handler.
- **Bug corregido el 2026-08-07**: existía una policy `"Lesson media is publicly readable"` que daba lectura pública a TODO el bucket (incluidos los vídeos), contradiciendo la migración del 2026-08-02 que decía haberla sustituido por `lesson_media_public_read_images` — nunca se borró la vieja. Borrada.
- **Bucket `course-videos` eliminado (policy) el 2026-08-07**: resto de una integración anterior ya no usada (confirmado con el usuario). Si el bucket en sí seguía vacío, también se borró desde el dashboard.

## Resolución de organización en el sitio público

`src/proxy.ts` resuelve el tenant exclusivamente desde la ruta `/o/<slug>`.
El proxy elimina el prefijo para el rewrite interno e inyecta los headers
`x-org-slug` y `x-org-path-prefix`. No inspecciona `Host` ni admite
subdominios. Antes del streaming hace una consulta pública mínima por slug; si
no existe, reescribe a la página 404 con estado HTTP 404 real. Ante un fallo de
red abre el paso para que la página haga la comprobación autoritativa, evitando
convertir una caída transitoria de Supabase en un falso 404 de cliente.

`getCurrentOrganization()` busca la organización por `x-org-slug`. Sin slug
devuelve `null`: la raíz muestra Delunivo y nunca infiere una organización.
Las rutas públicas conservan el prefijo mediante `orgPath()`; `/admin` resuelve
la organización por membership y `/invitaciones/[token]` por el propio token.

`/cursos` filtra siempre por `organization_id` y `status='published'`: con
cero cursos muestra el estado vacío, con uno redirige a su ficha y con varios
muestra el catálogo. Las lecturas privadas del panel usan
`getCurrentOrgMembership()`, no el tenant de la URL.

## Integraciones externas

- **Stripe:** Stripe Connect está activo y cada organización puede enlazar su
  cuenta Express. Los cobros de cursos deben ejecutarse exclusivamente en la
  cuenta conectada correspondiente; la suscripción de plataforma se procesa en
  la cuenta principal. Sin Connect listo, la venta queda bloqueada y nunca usa
  la cuenta principal como fallback. Los webhooks validan firma, modo, cuenta
  origen, estado de pago, importe, moneda, usuario, curso y organización antes
  de conceder acceso. La migración `20260831141239` añade un registro privado
  de intentos para reutilizar la misma sesión ante concurrencia. La migración y
  el código están aplicados y verificados en producción desde el 2026-08-31.
  Para afiliados se calcula un único descuento efectivo y se envía un único
  cupón, evitando la multiplicación de descuentos de Stripe. Los eventos de la
  plataforma se reclaman de forma idempotente y deben coincidir por cliente y
  por ID exacto de suscripción; una factura o baja retrasada de una suscripción
  anterior se archiva sin alterar la vigente.
- **Whop (desactivado):** no hay configuración, compra ni canje en la UI. El
  endpoint histórico responde `200` sin enviar correos, crear compras ni dar
  acceso, para evitar reintentos del proveedor. Se conserva solo el esquema
  histórico; los accesos nuevos entran por Stripe o invitación del admin.
- **Resend:** `src/lib/email/send.ts` es el único punto de envío. El modo
  `redirect` es el valor seguro fuera de producción, `off` se usa en pruebas y
  la producción de Vercel activa `live` al configurar el dominio verificado.
- **Mux:** las subidas y reproducciones pasan por rutas de servidor, webhooks
  firmados y playback firmado. Los secretos nunca usan el prefijo
  `NEXT_PUBLIC_`. La migración de producción `20260830185317` crea
  `video_assets`, `mux_webhook_events` y RPC exclusivas de `service_role`; las
  tablas tienen RLS activa y no conceden acceso a `anon` ni `authenticated`.
  Los borrados se registran antes de eliminar `video_assets` en
  `mux_deletion_jobs`; la aplicación los procesa de inmediato y un cron diario
  protegido por `CRON_SECRET` reintenta los fallos con espera exponencial.

## Despliegue y dominio

La URL canónica de producción es `https://www.delunivo.com`; el dominio raíz
redirige a `www` y `https://delunivo.vercel.app` se conserva solo como URL
técnica de compatibilidad. Delunivo usa rutas `/o/<slug>`. Los
identificadores internos estables de Supabase, buckets, tablas e integraciones
no se renombran: no son identidad visible y cambiarlos pondría datos o enlaces
en riesgo.
