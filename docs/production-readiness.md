# Preparación para producción — auditoría y plan

Fecha de auditoría: 2026-08-30  
Rama de trabajo: `codex/production-readiness-audit`

## Recomendación ejecutiva

No rehacer la aplicación. La base funcional es considerable y merece conservarse: autenticación, modelo de cursos, editor, usuarios, progreso, pagos, emails, RLS, Playwright y despliegue ya existen.

El camino más rápido y seguro es:

1. congelar nuevas funciones SaaS genéricas;
2. hacer reproducible el esquema y endurecer permisos;
3. sustituir exclusivamente el flujo de vídeo largo por Mux;
4. configurar una instancia aislada para Sata;
5. probar un curso real y un alumno real;
6. activar pagos y correo real solo cuando el núcleo esté validado;
7. extraer un producto SaaS generalizable después de obtener uso real.

La arquitectura multi-organización puede permanecer porque ya está integrada y proporciona límites útiles. Sin embargo, el alta pública de empresas, la suscripción de plataforma y otras funciones de marketplace no deben dirigir el lanzamiento de Sata ni bloquearlo.

## Estado verificado

### Repositorio

- Repositorio GitHub profesional existente y conectado a Vercel.
- Rama principal: `main`.
- El repositorio es actualmente público.
- Next.js 16.2.10, React 19.2.4, TypeScript, Tailwind 4.
- CI: lint, tests unitarios, build y Playwright.
- El último workflow de `main` terminó correctamente.
- El README era el texto por defecto de `create-next-app`.
- `AGENTS.md` no describía el proyecto ni su definición de terminado.
- No existe una carpeta de migraciones de Supabase; el esquema se aplicó principalmente a mano.

### Aplicación

Implementado y reutilizable:

- registro, login, verificación por código y recuperación de contraseña;
- organizaciones, owners, administradores y roster de alumnos;
- invitaciones, revocación y reactivación;
- cursos, secciones, lecciones, borradores y ordenación;
- bloques de texto enriquecido, embeds y vídeo heredado;
- landing y branding por organización;
- progreso persistente por lección;
- Stripe, Stripe Connect y Whop;
- Resend con modos `live`, `redirect` y `off`;
- panel de cursos, usuarios, estadísticas, marca, facturación y configuración;
- pruebas E2E de acceso, aislamiento, invitaciones, progreso y billing gate.

### Vercel

- Proyecto `aularia`, plan Hobby, conectado al repositorio.
- Último deployment de producción en estado `READY`.
- La raíz y `/o/ivanorganico` responden correctamente.
- No se detectaron errores de runtime en la ventana revisada.
- Node configurado en Vercel como 24.x, pero `package.json` declara `>=22`; debe fijarse a `24.x` para evitar saltos automáticos de major.

### Supabase

- Proyecto independiente `aularia`, región `eu-west-1`, plan Free.
- El proyecto estaba pausado por inactividad y fue restaurado para poder auditarlo; no se modificaron datos ni esquema.
- Datos reales verificados: 2 organizaciones, 4 cursos, 6 secciones, 12 lecciones, 12 perfiles y 3 compras.
- Buckets privados existentes: `lesson-media` y el residual `course-videos`.
- RLS está activado en las tablas de aplicación.

Hallazgos de seguridad:

- `handle_new_user()` es `SECURITY DEFINER` y puede ser ejecutada por `anon` y `authenticated`; debe revocarse su ejecución pública.
- `is_admin()` está deprecada pero sigue expuesta.
- `is_org_admin`, `is_org_owner`, `is_org_student` e `is_super_admin` también admiten ejecución de `anon`; deben concederse solo a los roles que realmente las necesitan.
- La protección de contraseñas filtradas está desactivada.
- Varias policies antiguas están declaradas para `public` cuando deberían limitarse a `authenticated`.
- Algunas policies usan `auth.uid()` por fila en lugar de `(select auth.uid())`.

Hallazgos de integridad/rendimiento:

- faltan índices sobre varias foreign keys usadas en consultas frecuentes;
- hay dos índices únicos equivalentes en `purchases(user_id, course_id)`;
- existen policies permisivas duplicadas que pueden simplificarse;
- `docs/database.md` no coincide completamente con el estado real;
- el bucket `course-videos` continúa existiendo.

No se ha aplicado ninguna corrección SQL a producción durante esta auditoría.

## Qué conservar

- App Router y Server Components/Server Actions.
- Supabase Auth y PostgreSQL.
- El modelo de cursos, secciones, lecciones y bloques JSONB.
- Las tablas de organizaciones y memberships.
- Los helpers de autorización existentes, después de endurecer grants y RLS.
- El editor actual y su UX general.
- La suite Playwright, ampliada para Mux.
- Resend como punto único de correo.
- Stripe y Whop como integraciones, sin priorizar Stripe Connect para el primer uso de Sata.

## Qué cambiar

### 1. Vídeo largo

El flujo actual hace `POST multipart/form-data` del archivo completo a `/api/admin/media/upload`, limita el vídeo a 500 MB y después lo copia desde Vercel a Supabase Storage. Esto incumple el requisito de archivos grandes, aumenta memoria y tiempo de función y no proporciona procesamiento ni streaming adaptativo.

Debe sustituirse por:

- Direct Upload URL creada en servidor;
- subida navegador → Mux sin pasar por Vercel;
- componente Mux Uploader con progreso, reintentos, pausa y reanudación;
- `passthrough` estable para correlacionar el upload con la fila local;
- webhook con firma verificada e idempotencia;
- playback policy `signed`;
- token JWT emitido en servidor solo tras comprobar admin o compra + alumno activo;
- Mux Player para HLS adaptativo;
- compatibilidad de lectura con bloques heredados de Supabase mientras se migren.

### 2. Esquema reproducible

Crear `supabase/migrations/` y convertir el estado actual en una baseline verificable. A partir de ahí, todo DDL debe entrar mediante migración. `docs/database.md` queda como explicación, no como mecanismo de despliegue.

### 3. Alcance Sata-only

Para el primer lanzamiento:

- una infraestructura de Sata aislada;
- una organización activa;
- ocultar o desactivar el alta pública de nuevas empresas;
- no cobrar la suscripción de plataforma de 20 €/mes;
- no depender de Stripe Connect para vender el primer curso;
- conservar las tablas multi-organización para no efectuar un refactor destructivo.

### 4. Operación y seguridad

- repositorio privado antes de incorporar configuración operativa o datos reales;
- ramas protegidas y PR obligatoria para `main`;
- secrets separados para Preview y Production;
- logs sin PII ni secretos;
- webhooks idempotentes;
- política de backup, restore testado y rollback;
- Supabase Pro y Vercel Pro antes de abrir a usuarios reales.

## Primer vertical slice de producción

### Resultado

Un administrador de Sata crea o abre una lección, selecciona un vídeo real 1080p de 45–60 minutos, observa la subida y el procesamiento, y un alumno autorizado lo reproduce mediante streaming firmado.

### Modelo propuesto

Crear una tabla `video_assets` con, como mínimo:

- `id` UUID interno;
- `organization_id`, `course_id`, `lesson_id`;
- `block_id` para relacionarlo con el bloque JSONB existente;
- `provider = 'mux'`;
- `status`: `creating`, `waiting_upload`, `uploading`, `processing`, `ready`, `errored`, `deleted`;
- `mux_upload_id` único;
- `mux_asset_id` único y nullable;
- `mux_playback_id` único y nullable;
- `playback_policy = 'signed'`;
- `duration_seconds`, `aspect_ratio`, `max_stored_resolution`, `error_message`;
- `created_by`, timestamps y `deleted_at`.

Los bloques nuevos guardarán una referencia interna al asset, no una Direct Upload URL ni un JWT. Las filas solo serán legibles por admins de la organización; el alumno recibirá datos de playback a través de una ruta protegida.

### Endpoints

- `POST /api/admin/mux/uploads`: autoriza, crea fila, solicita Direct Upload y devuelve URL + ID local.
- `POST /api/webhooks/mux`: verifica `mux-signature`, procesa eventos de forma idempotente y actualiza la fila.
- `GET /api/videos/<id>/playback`: valida acceso al curso y devuelve playback ID + tokens de corta duración.

### Eventos mínimos

- `video.upload.asset_created`;
- `video.asset.ready`;
- eventos de error de upload/asset;
- eliminación, cuando se implemente el borrado desde admin.

### Criterios de aceptación

- archivo real 1080p de 45–60 minutos;
- el archivo no atraviesa una función de Vercel;
- progreso visible y recuperación ante desconexión temporal;
- la lección muestra `Procesando` hasta recibir `video.asset.ready`;
- webhook duplicado no duplica ni corrompe datos;
- alumno sin compra recibe 403 o redirección segura;
- alumno expulsado no obtiene token;
- URL sin token no reproduce;
- token expirado no reproduce;
- token válido reproduce en desktop y móvil;
- refresh obtiene un token nuevo sin regenerar el asset;
- tests unitarios, integración y Playwright en verde.

## Fases priorizadas

### Fase 0 — baseline y seguridad

- documentación operativa real;
- fijar Node 24.x;
- `.env.example` sin secretos;
- baseline de migraciones;
- migration de grants/RLS e índices prioritarios;
- repo privado y protección de `main`;
- Preview aislado.

### Fase 1 — vídeo Mux end-to-end

- tabla y RLS de `video_assets`;
- creación de Direct Upload;
- Mux Uploader;
- webhook;
- estado de procesamiento;
- signed playback;
- Mux Player;
- prueba real de 45–60 minutos.

### Fase 2 — experiencia real de Sata

- modo Sata-only;
- crear y preparar el primer curso real;
- revisar navegación admin/alumno y responsive;
- importación o carga del contenido real;
- gestión de errores y estados vacíos.

### Fase 3 — identidad, correo y permisos

- cerrar findings de Supabase Advisor;
- dominio verificado en Resend;
- flujos reales de invitación, verificación y reset;
- rate limiting de login, registro, reset e invitaciones;
- auditoría de acciones administrativas críticas.

### Fase 4 — cobro del curso

- decidir Stripe directo de Sata frente a cuenta de plataforma temporal;
- webhook de pago idempotente;
- reembolsos y revocación de acceso;
- pruebas de éxito, cancelación, duplicado y fallo.

### Fase 5 — lanzamiento

- Supabase Pro y Vercel Pro;
- dominio y DNS;
- backups y prueba de restore;
- observabilidad y alertas;
- checklist de seguridad y privacidad;
- smoke test productivo;
- rollback documentado.

### Fase 6 — generalización posterior

Solo después de uso real: alta de nuevos creadores, billing de plataforma, límites por plan, subdominios/dominios personalizados y automatización de provisioning.

## Variables necesarias

### Existentes

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `EMAIL_DELIVERY_MODE`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CONNECT_WEBHOOK_SECRET`
- `WHOP_API_KEY`
- `WHOP_PRODUCT_ID`
- `WHOP_WEBHOOK_SECRET`
- `ENCRYPTION_KEY`

### Nuevas para Mux

- `MUX_TOKEN_ID`
- `MUX_TOKEN_SECRET`
- `MUX_WEBHOOK_SECRET`
- `MUX_SIGNING_KEY_ID`
- `MUX_SIGNING_PRIVATE_KEY`
- `MUX_PLAYBACK_RESTRICTION_ID` opcional

Ninguna clave debe copiarse a un chat ni almacenarse en Git. Deben añadirse directamente como secrets de Vercel y GitHub Actions, con valores distintos por entorno cuando corresponda.

## Acciones manuales necesarias de Jorge

Necesarias para completar el vertical slice Mux, no para preparar el código:

1. crear un Access Token de Mux con permisos mínimos de Video Read/Write;
2. crear una signing key de Mux y guardar una sola vez su private key;
3. añadir los secrets de Mux a Vercel Preview y, más adelante, Production;
4. añadir los secrets necesarios a GitHub Actions sin pegarlos en el repositorio;
5. registrar `/api/webhooks/mux` como endpoint una vez exista el Preview y guardar su signing secret;
6. disponer de un vídeo real 1080p de 45–60 minutos para el ensayo;
7. cambiar el repositorio a privado antes del piloto real;
8. comprar/verificar un dominio antes de activar `EMAIL_DELIVERY_MODE=live`;
9. pasar Supabase y Vercel a Pro justo antes del piloto, no durante la implementación inicial.

## Nombre

Nombre de trabajo recomendado: **Lernixa**.

Comprobación preliminar realizada:

- sin coincidencias exactas relevantes en búsqueda web;
- sin repositorios GitHub con ese nombre;
- disponibilidad aparente de `lernixa.com`, `.app`, `.es`, `.io`, `.dev`, `.net` y `.eu`.

Esto reduce el riesgo, pero no sustituye una búsqueda profesional de marcas. El rebranding debe hacerse en código y Preview antes de renombrar servicios, webhooks o dominios de producción.

## Rollback

- Ningún cambio se fusiona directamente a `main`.
- La reproducción heredada se mantiene hasta verificar Mux con un vídeo real.
- La nueva tabla de vídeo se añade sin eliminar columnas ni bloques existentes.
- Un fallo de Mux permite volver al deployment anterior sin perder los vídeos heredados.
- Las migraciones de seguridad deben separar cambios aditivos de revocaciones y documentar los grants anteriores.
- No borrar `course-videos` ni objetos heredados hasta confirmar que no tienen referencias.
