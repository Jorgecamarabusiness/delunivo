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

Mux navegador autenticado confirma 30 assets en dos páginas y 5.311 s redondeados,
factura histórica 0,35 USD bruto /0 pagado. API local antigua 401: falta credencial
vigente/entorno API y ensayo real del importador. Stripe LIVE muestra login:
falta sesión y política fiscal por jurisdicciones verificadas; activación impedida,
sin copiar tarifa TEST ni fijar21%. Paso de acceso pedido, sin respuesta aún.
No subida real 12 h/20 GiB ni piloto de14 días/dos ciclos, ni entrega Resend real.

## Siguiente paso

Implementación integrada y verificada dentro del alcance aislado. El lanzamiento
requiere autorización explícita, accesos/fiscal y comprobaciones del runbook.
No publicar ni aplicar producción por el push. Procesos portables propios
detenidos y puertos54397/54398/54399 sin listeners. Datos sintéticos permanecen
en TEMP, sin servicio global.
