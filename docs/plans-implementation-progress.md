# Planes y consumo — progreso

Actualización: 2026-10-01, 17:12 UTC. Encargo completo leído antes de editar.
Rama `codex/plans-consumption-20261001`, origen Jorgecamarabusiness/delunivo.
Especificación aceptada: [prompt maestro](plans-consumption-spec.md).
Despliegue automático de rama deshabilitado; producción sin modificar.

## Implementación integrada

Catálogo versionado, tres migraciones compatibles, contratos anteriores en
observe, cuotas/reservas atómicas, importador Mux paginado con cobertura,
correcciones/tombstones, Stripe checkout/cambios/ampliaciones/recuperación,
sesiones acotadas, avisos/outbox, paneles, A medida, conservación y exportación.
Borrado/envíos/importación reales apagados por defecto.
[Esquema](database.md), [anexo técnico](plans-implementation.md),
[lanzamiento](plans-launch-runbook.md).

## Evidencia comprobada

- 127 unitarios; lint sin avisos, TypeScript y build aislado pasan.
- 13 E2E auditoría finales pasan (23,7 s): UI y permisos con doble local,
  consola/red controladas, 375/768/1440. Capturas en evidencias/plans-2026-10-01.
- PostgreSQL17/PostgREST nativo: todas las migraciones desde cero aplicadas;
  REST verificado. Concurrencia real de dos escuelas/reservas/expiración,
  duración manipulada, doble importación, pausa y avisos únicos pasa.
  Auth/Storage nativos son schemas compatibles, no servicios reales.
- Stripe TEST real: siete grupos integrados pasan, checkout hospedado, tarifa
  sintética inclusiva 7%, descuento once, biblioteca recurrente, upgrade
  exacto medio ciclo sin reset, rechazo/recuperación, refund previo al grant,
  firma/duplicados/Connect, downgrade/renovación Test Clock y cancelación.
  Recursos de cada reloj eliminados. Informe stripe-test-journey.json.
- Avisos: worker y outbox SQL real, SDK Resend con transporte capturado,
  destinatarios synthetic.invalid, 70/90, no duplicación y retry de fallo con
  misma clave pasan. No hubo entrega real. Informe notices-synthetic-journey.json.
- [CI final 36896822192](https://github.com/Jorgecamarabusiness/delunivo/actions/runs/36896822192)
  sobre aed0cfb: tres migraciones, 128 pgTAP (11 archivos), concurrencia,
  Auth/Storage/OTP/lifecycle y seis E2E de aplicación pasan (54 s).
  Nuevo consumidor: sesión12h+900s, cuota/recuperación sin nueva compra,
  revocación periódica y exportación Storage descargada real. Sin API Mux externa.
  Los fallos anteriores de fixtures (membership, tipo MIME, reserva) corregidos.
- Revisores read-only UI/calidad: cierre confirmado sin bloqueos materiales.
  Capturas pricing/conditions/custom éxito/error revisadas sin overflow.

## Defectos detectados y defendidos

SQL inicial detectó duración legacy cero y numeric→integer; TEST Stripe detectó
restricción schedule from_subscription+metadata. Revisores detectaron trial
pending, cuotas nuevas, checkout sin grant, renovación ilimitada de sesiones,
retención sin job, Storage/restore concurrente y lease de importador.
Corregidos y probados. Snapshot Mux no degrada ready ni borra duración conocida;
errored perdido se concilia y sólo desvinculado entra en cleanup.
La prueba real de caducidad detectó 90 días +1h por DST Madrid; todos los plazos
nuevos son horas exactas UTC (336/720/2160/168), con SQL SET timezone Madrid.
UI conserva exportación y oculta nuevas compras/cambios durante pago pendiente.

## Bloqueos de lanzamiento comprobados

Mux UI confirma30 assets; la exportaci?n local contiene secretos ocultos por
Vercel. Su401 no representa una prueba de credenciales de producci?n. Stripe
LIVE tiene sesi?n y muestra pagos/payouts activos desde02/10. Pendientes lectura
desde servidor, coincidencia de cuenta, fiscal por jurisdicciones y piloto
expl?cito. No subida real12h/20GiB, observaci?n14d/dos ciclos ni entrega Resend.

## Siguiente paso

Implementación integrada y verificada dentro del alcance aislado. El lanzamiento
requiere autorización explícita, accesos/fiscal y comprobaciones del runbook.
No publicar ni aplicar producción por el push. Procesos portables propios
detenidos y puertos54397/54398/54399 sin listeners. Datos sintéticos permanecen
en TEMP, sin servicio global.


## Lanzamiento autorizado ? 2026-10-02

- Jorge autoriz? los pasos de producci?n. Hotfix PR4/main97af585 desplegado READY
  en dpl_EwQjnR6saJvX9L7d8yUG7pYwAgfd; pesta?a real recuperada a login y luego
  portada con sesi?n propia. Sin errores de consola/runtime en ventana consultada.
- Backup DB cifrado OpenPGP fuera del repo:64 tablas/1.758 filas, captura12:07UTC;
  SHA25620568de6d94ef5c8480df9a4e6989d24c0beb8f93515f47febfe94b527b97620,
  descifrado/JSON comprobados en memoria. Incluye registros Auth/Storage y metadata
  de schema; no nuevos bytes de medios ni restore completo de este snapshot.
- Tres migraciones aplicadas at?micamente12:11UTC, baseline29?33 incluyendo
  recibo API20261002121113. Pre/post verifican datos billing anteriores ?ntegros,
  ocho legacy observe sin oferta/retenci?n;27 videos/ledger, cero ciclos/jobs.
  RLS y grants cerrados para clientes; avisos advisors INFO service-only previstos
  y los mismos nueve WARN de funciones autorizadas anteriores.
- Vercel Production: planes/worker/importador/avisosfalse, Mux deletionoff,
  aplicaci?n al pr?ximo deploy. Correos de acceso existentes conservados.
- origin/main integrado. Nueva lectura de proveedores desde runtime privado
  s?lo superadmin fuera de Run as, proyecciones sin secretos; seis regresiones
  unitarias y dos E2E directos. Revisi?n read-only sin bloqueos tras correcciones.
- Final local:136 unitarios, lint, TypeScript, build y22 E2E pasan. Pendiente
  push/CI/merge/despliegue del c?digo de planes apagado, lectura real Stripe/Mux,
  precios/fiscal y lista expl?cita de piloto antes de activaci?n.
