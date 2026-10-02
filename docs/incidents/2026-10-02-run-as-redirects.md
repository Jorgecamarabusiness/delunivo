# Incidente de acceso: Run as caducado — 2026-10-02

## Diagnóstico confirmado

Chrome mostró `ERR_TOO_MANY_REDIRECTS` en la salida de soporte. Vercel registró
131 respuestas 3xx en `/api/support/run-as/exit` y 75 en `/login` en la ventana
consultada. HTTP anónimo: www raíz/login 200; dominio sin www 308 a www y 200.
Producción leída: `dpl_3EcBRjSvcNJ5Ba9bdpA8czJfzAaC`, commit `25130eb`.

Una consulta de sólo lectura, limitada a la sesión afectada, confirmó audit
`active`, fecha caducada, Auth vinculada y credencial original ya purgada.
No se conservan aquí identificadores privados, proof, tokens ni credenciales.
`purge_expired_operational_data` elimina `encrypted_actor_session` después de
caducar: la restauración falla, pero la route anterior redirigía a login sin
cerrar la identidad temporal. El proxy devolvía esa identidad a la misma salida.

## Corrección

La salida verifica el proof existente antes de cambiar identidad. Si la
restauración devuelve false o falla, intenta revocar únicamente la sesión local,
caduca explícitamente los cookies Auth del proyecto (incluidos chunks/auxiliares)
y el marcador de soporte, y devuelve al login. Se conservan cookies ajenos.
Un fallo verificando el proof termina en 503, sin redirecciones repetidas.

La salida manual y automática comparten un orden seguro: descifrar, revocar
target, cerrar auditoría, restaurar actor. Los errores de revocación se comprueban.
Si falla revocar una sesión manual activa, la auditoría continúa active y el
guarda de acciones sensibles mantiene el bloqueo. Ningún efecto externo de
cleanup queda después de cambiar al actor.

## Evidencia y límites

- Antes: el E2E local con credencial purgada reprodujo exactamente
  `net::ERR_TOO_MANY_REDIRECTS`. Las tres regresiones del helper fallaron contra
  el código original: revocación ignorada y restauración anterior al cierre.
- Después: siete E2E enfocados pasan contra Next y transporte Supabase local:
  credencial purgada, Auth 503/chunks, cuenta inactiva, restauración válida,
  fallo de auditoría, fallo de revocación y proof forjado sin cierre de sesión normal.
- Tres pruebas Node usan el helper y guarda reales con transporte/cookies
  sintéticos: fallo de revocación manual activa, fallo posterior de auditoría,
  y orden correcto. No constituyen una prueba de Auth/RLS real.
- Revisión independiente read-only de calidad: hallazgos de orden integrados;
  sin bloqueos materiales en la revisión posterior.
- Rama de planes con el parche integrado: lint, 130 unitarios, TypeScript,
  build aislado y los 20 E2E Chromium de la suite completa pasan en el estado
  final. Se observaron mensajes RSC de stream cerrado al navegar concurrentemente;
  ningún error de consola de navegador ni tráfico externo permitido en los tests.

## Publicación pendiente

Parche sobre `origin/main`, separado de `codex/plans-consumption-20261001`.
No necesita migraciones ni cambios de precios, DNS o secretos. Antes de publicar:
autorizar el despliegue del parche, comprobar el commit final y luego recargar
la pestaña afectada para verificar login accesible y ausencia del bucle en destino.

Los nuevos planes conservan los pendientes de
[`plans-launch-runbook.md`](https://github.com/Jorgecamarabusiness/delunivo/blob/codex/plans-consumption-20261001/docs/plans-launch-runbook.md): acceso Stripe LIVE y
tratamiento fiscal por jurisdicción, API Mux vigente, migraciones, configuración
LIVE y activación gradual autorizadas. No se han activado con este incidente.
