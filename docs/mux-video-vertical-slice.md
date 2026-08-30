# Mux: primer vertical slice de vídeo privado

Este cambio añade vídeo Mux sin cambiar la marca ni generalizar el producto.
El archivo nunca se envía a una ruta de Next/Vercel: el servidor sólo crea una
Direct Upload URL de corta duración y el navegador carga los chunks directamente
a Mux mediante Mux Uploader.

## Flujo

1. Un admin abre el editor de una lección y selecciona un vídeo.
2. `POST /api/admin/mux/uploads` valida sesión, organización, curso y lección.
3. El servidor crea en Mux un Direct Upload con playback `signed`, 1080p máximo y
   24 horas de validez. Sólo la URL efímera vuelve al navegador.
4. Mux Uploader divide el fichero en chunks, reintenta, pausa y reanuda dentro de
   la pestaña actual. El progreso y los errores aparecen en el formulario.
5. `POST /api/webhooks/mux` verifica la firma sobre el body original. Cada event ID
   se reclama una sola vez y los fallos pueden reintentarse.
6. Las transiciones usan `created_at` de Mux: un evento antiguo puede completar
   IDs que falten, pero no puede hacer retroceder el estado de un evento más nuevo.
7. Guardar los bloques de la lección marca el asset como vigente en la misma
   transacción. Una sustitución sin guardar no corta el vídeo anterior.
8. `GET /api/video/<videoAssetId>/playback` vuelve a comprobar sesión, compra,
   roster, publicación y asociación del bloque antes de emitir un JWT de 4 horas.

Los bloques `video_file` con `video_url` siguen usando las URLs firmadas de
Supabase existentes. Los bloques nuevos guardan `mux_video_asset_id`.

## Variables

Todas son server-only y deben configurarse por separado en Development, Preview
y Production:

- `MUX_TOKEN_ID`: token ID con permiso Mux Video de escritura.
- `MUX_TOKEN_SECRET`: secreto del token anterior.
- `MUX_WEBHOOK_SECRET`: signing secret del webhook o del listener local.
- `MUX_SIGNING_KEY`: ID de la signing key usada por signed playback.
- `MUX_PRIVATE_KEY`: private key correspondiente.

También son obligatorias las variables Supabase existentes y
`NEXT_PUBLIC_SITE_URL`. No se debe exponer ninguna variable Mux con prefijo
`NEXT_PUBLIC_`.

## Migración y rollback

- Migración: `supabase/migrations/20260830185317_mux_video_vertical_slice.sql`.
- Rollback manual: `supabase/rollbacks/20260830185317_mux_video_vertical_slice.down.sql`.

La migración crea `video_assets`, `mux_webhook_events`, índices, RLS cerrada y RPC
server-only. El rollback elimina esos datos; sólo debe ejecutarse después de
retirar las referencias `mux_video_asset_id` de las lecciones.

Este repositorio todavía no contiene una baseline completa del esquema anterior,
por lo que la migración no puede aplicarse a un Supabase vacío. Se aplicó al
proyecto de producción existente el 2026-08-30 y quedó registrada con la versión
`20260830185317`. Se verificó que `anon` y `authenticated` no tienen privilegios
sobre las dos tablas y que sólo `service_role` puede ejecutar sus RPC.

## Prueba local exacta

1. Crear o elegir un proyecto Supabase de pruebas con el esquema actual. Nunca usar
   el proyecto de producción para E2E.
2. Aplicar allí únicamente la migración, revisada, mediante el flujo aprobado por
   el equipo (`supabase db push` o SQL Editor). Confirmar que aparecen las dos tablas
   y que `anon`/`authenticated` no pueden leerlas.
3. Crear un environment de desarrollo en Mux, un access token de Video y una
   signing key.
4. Copiar `.env.example` a `.env.local` y rellenar las variables con credenciales
   del proyecto de pruebas.
5. Ejecutar `npm ci` y `npm run dev`.
6. En otra terminal ejecutar:

   `npx @mux/cli webhooks listen --forward-to http://localhost:3000/api/webhooks/mux`

7. Copiar el signing secret que muestra el CLI a `MUX_WEBHOOK_SECRET` y reiniciar
   el servidor local.
8. Iniciar sesión como admin, abrir una lección, añadir “Vídeo” y seleccionar un
   MP4 1080p. Verificar en DevTools que las peticiones con bytes van al dominio de
   upload de Mux, nunca a `/api/admin/mux/uploads` ni a Vercel.
9. Pausar/reanudar, interrumpir la red temporalmente y confirmar que continúa en la
   misma pestaña. Esperar a `Vídeo listo` y guardar el bloque.
10. Entrar como alumno activo con compra y reproducir. Repetir como anónimo, alumno
    sin compra y alumno desactivado; deben recibir 401/403.
11. Repetir un evento con
    `npx @mux/cli webhooks events replay <event-id> --forward-to http://localhost:3000/api/webhooks/mux`
    y comprobar una sola transición y un solo registro por `event_id`.

## Pruebas incluidas y alcance

- Unitarias: validación de origen/archivo/bloques y normalización de eventos.
- Integración simulada: claim, duplicado, procesamiento concurrente y reintento de
  webhook mediante un repositorio falso.
- No se incluye una prueba real con vídeo largo: requiere Mux, la migración en un
  Supabase de pruebas y un archivo comparable.

La reanudación proporcionada por Mux Uploader cubre chunks, pausas y cortes de red
mientras la pestaña sigue abierta. Cerrar o recargar la pestaña obliga a volver a
seleccionar el archivo; persistir una carga entre sesiones queda fuera de este
vertical slice.
