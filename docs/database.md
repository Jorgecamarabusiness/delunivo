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
| is_admin | gate de acceso admin, chequeado a mano en cada server action |
| created_at | |

### courses
| columna | notas |
|---|---|
| id | |
| title | confirmado |
| description | |
| long_description | text (no array) — confirmado; el código lo parte por `\n\n` en párrafos |
| price | confirmado |
| learning_points | text[] — confirmado (ojo: no `learn_points`) |
| status | 'published' \| 'draft', default 'published' — añadida el 2026-07-23 (no existía; ver migración abajo). Se filtra en `/cursos` y `/cursos/[id]` para ocultar borradores a quien no sea admin. |
| thumbnail_url | nullable — inferido |
| created_at | confirmado |

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

## Seguridad

RLS **sí está activo** en todas las tablas (confirmado el 2026-08-02 consultando cada una con la clave `anon`, con y sin sesión). Estado verificado por tabla:

| tabla | sin sesión (anon) | con sesión (authenticated) |
|---|---|---|
| `courses` | solo `status = 'published'` (policy `courses_public_read_published`) | todas las filas |
| `sections` / `lessons` | nada | `lessons` solo devuelve filas de cursos comprados por ese usuario (o si es admin) — verificado con una cuenta sin compra: 0 filas |
| `purchases` | nada | solo su propia fila, no las de otros alumnos |
| `profiles` | nada | solo su propia fila |

El control de acceso admin además se repite a mano en cada server action (`profiles.is_admin`, ver `requireAdmin()`) — RLS y el chequeo de código son dos capas independientes, no confiar solo en una.

- **`profiles`** se crea sola: trigger `on_auth_user_created` (`after insert on auth.users`) inserta la fila con `name` sacado de `raw_user_meta_data->>'name'` e `is_admin = false`. `registerAction` ya no inserta el perfil a mano (ver `src/app/register/actions.ts`) — así el perfil existe también si el usuario se crea por otra vía (invitación, magic link, panel de Supabase).

## Storage

- **`lesson-media`** (bucket **privado** desde el 2026-08-02, antes público) — creado el 2026-07-23. Contiene:
  - `videos/` — archivos de vídeo subidos directamente por el admin para bloques de tipo `video_file`. **Sin lectura pública**: solo se puede leer generando una URL firmada con el cliente admin (service role), que se salta RLS. Eso lo hace `src/lib/storage/media.ts` (`getSignedVideoUrl`), llamado desde `src/app/cursos/[id]/aprender/page.tsx` **después** de comprobar que el usuario es admin o compró el curso, y desde `src/lib/storage/actions.ts` (`getVideoPreviewUrlAction`) para la previsualización del admin en el editor.
  - `images/` — imágenes insertadas dentro del editor de texto enriquecido (bloques `text`). Sigue con lectura pública (policy `lesson_media_public_read_images`, filtra por `(storage.foldername(name))[1] = 'images'`).
- La subida ya **no** se hace desde el navegador: pasa por el route handler `src/app/api/admin/media/upload/route.ts`, que comprueba `requireAdmin()` y sube con el cliente admin (service role). `src/lib/storage/uploadLessonMedia.ts` (cliente) solo hace `fetch()` a ese endpoint.
- **Ojo con `video_url` en `lessons.blocks`**: para bloques `video_file`, este campo puede contener dos formatos según cuándo se subió el vídeo — una ruta relativa nueva (`videos/uuid.mp4`) o una URL pública antigua de cuando el bucket era público (`.../object/public/lesson-media/videos/uuid.mp4`, de antes del 2026-08-02). `extractStoragePath()` en `src/lib/storage/media.ts` normaliza ambos casos antes de firmar la URL — no hizo falta migrar los datos existentes.

## Integraciones externas

- **Stripe** (checkout de pago único) — `src/lib/stripe/client.ts`. El precio se calcula en el momento desde `courses.price` (no hay Price ID fijo en el dashboard de Stripe). La confirmación de compra llega por webhook (`src/app/api/webhooks/stripe/route.ts`, evento `checkout.session.completed`), nunca solo por el redirect del navegador — el webhook usa el cliente admin de Supabase (`src/lib/supabase/admin.ts`, service role key) porque no hay sesión de usuario en una llamada servidor-a-servidor.
- **Whop** (verificación de compras hechas fuera de la web) — `src/lib/whop/client.ts`. El alumno pega su license key de Whop; se valida contra `GET /memberships/{license_key_o_id}` de la API de Whop (acepta la license key directamente como id). Si el membership está activo y corresponde al `WHOP_PRODUCT_ID` configurado, se crea la fila en `purchases`. No hay webhook de Whop, es validación bajo demanda.
- Variables de entorno necesarias (en `.env.local`, y replicarlas en el proveedor de hosting al desplegar): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `WHOP_API_KEY`, `WHOP_PRODUCT_ID`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`. Ninguna de estas (excepto `NEXT_PUBLIC_SITE_URL`) debe usarse fuera de código de servidor.
- El acceso a `/cursos/[id]/aprender` requiere sesión iniciada y una fila en `purchases` para ese `user_id`+`course_id` (o ser admin) — si no, redirige a `/cursos/[id]`.
