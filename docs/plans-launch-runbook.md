# Lanzamiento de planes y consumo — 2026-10-01

Este procedimiento prepara un lanzamiento posterior expresamente autorizado.
El encargo actual no publica, migra producción, activa precios LIVE, envía a
clientes ni elimina sus medios. La rama tiene `deploymentEnabled=false`.
Especificación comercial: [prompt aceptado](plans-consumption-spec.md).

## Evidencia y límites

- 127 unitarios, lint, TypeScript y build local aislado.
- 13 E2E Chromium contra doble local: oferta, paneles, exportación/permisos,
  editor y aula; consola y red externa controladas. Capturas 375/768/1440.
  Esto no demuestra RLS ni llamadas reales Mux/Stripe.
- PostgreSQL 17 nativo con todas las migraciones + PostgREST: reservas concurrentes
  de dos escuelas, expiración, metadata falsa, doble importación y avisos únicos.
  Schemas Auth/Storage compatibles en este ensayo; servicios completos en CI.
- Stripe TEST real: checkout hospedado, impuesto inclusivo sintético 7%, descuento
  once, librería recurrente, upgrade exacto medio ciclo, rechazo/recuperación,
  refund previo a concesión, duplicados, firma inválida/Connect separado,
  downgrade y renovación Test Clock/cancelación. Recursos del reloj eliminados.
  [Informe](evidencias/plans-2026-10-01/stripe-test-journey.json).
- Supabase aislado en GitHub: Postgres/Auth/REST/Storage + pgTAP y E2E de aplicación.
  [CI final 36896822192](https://github.com/Jorgecamarabusiness/delunivo/actions/runs/36896822192)
  pasó 128 pgTAP/RLS (11 archivos), concurrencia, Auth/Storage/OTP/lifecycle y
  seis E2E (54 s), incluido consumidor real: sesión12h+900s, cuota, revocación
  y exportación Storage descargada. JWT firmado local; ningún vídeo12h real ni
  API Mux externa. No hubo restauración privada en estos runs.
- Avisos con destinatarios sintéticos: worker/outbox SQL real y SDK Resend con
  transporte capturado, umbrales70/90, supresión de duplicados y fallo/retry con
  misma clave. [Informe](evidencias/plans-2026-10-01/notices-synthetic-journey.json).
  No se ha enviado ningún correo ni probado entrega real del proveedor.
- Revisores independientes UI/calidad read-only: correcciones integradas de
  cuotas/trials, callbacks duplicados, bloqueo de pagos antiguos, token renovable,
  retención sin job, Storage/renovación concurrentes, leases de importación,
  snapshots retrasados y consumo anterior a confirmar pago.
- Mux UI real en lectura: 30 assets, dos páginas, 5.311 s redondeados por dashboard,
  bruto histórico 0,35 USD y pago 0. Esta muestra no representa uso de clientes.
  [Evidencia](evidencias/plans-2026-10-01/provider-browser-read-only.json).
  API antigua local 401: pendiente credencial vigente, entorno API real y ensayo
  de importación atribuido. No se han importado datos ficticios en producción.
- Stripe LIVE requiere sesión. Faltan verificar vendedor/registros fiscales,
  países/jurisdicciones que se aceptarán, tipos/exenciones y correspondencia
  inclusiva con la facturación existente. No usar 7% TEST ni 21% universal.
  No habilitar servicios fiscales de pago. `PLATFORM_TAX_LIVE_APPROVED` queda vacío.
- No se probó una subida real de 12 h/20 GiB. Sí validaciones inclusivas separadas.
  El piloto 14 días y sus dos ciclos todavía no se han ejecutado.

## Orden de publicación autorizado

1. Verificar proyecto Supabase y cuenta Stripe/Mux mediante lecturas, backup y
   estado actual. No asumir que el catálogo de septiembre siga vigente. Confirmar
   la revisión comercial/fiscal por países sin modificar contratos legacy.
2. Aplicar en una transacción/ventana controlada, en orden, las migraciones:
   `20261001132712_platform_plans_and_usage.sql`,
   `20261001151159_provider_cost_reconciliation.sql`,
   `20261001162500_capacity_worker_coordination.sql`.
   Comprobar RLS, grants service-only y que antiguos billing siguen observe,
   offer_version/retention_policy_version null. Las duraciones legacy cero pasan
   a pendientes; no se convierten en cero conocido.
3. Desplegar código con ventas nuevas, importador, envíos y borrado apagados.
   No volver a código que ignore pagos ya aceptados; preservar conciliador.
4. Configurar y verificar cinco precios LIVE nuevos versionados, sin sustituir
   precios/contratos anteriores. Metadatos de producto `offer_version=2026-10-01`
   y `capacity_key=inicio|crece|academia|library|delivery_pack`; EUR inclusivo,
   30/69/149/8 mensuales y 20 una vez. La función valida importes/intervalo/metadata.
   `scripts/prepare-capacity-stripe-test.mjs` es **sólo TEST**; no ejecutarlo como LIVE.
5. Resolver la configuración fiscal antes de permitir LIVE. El adaptador de tarifa
   inclusiva fija sirve para el ensayo TEST; su uso LIVE exige una política válida
   para las jurisdicciones atendidas. Si se requiere más de un tratamiento, ampliar
   el selector fiscal según la decisión verificada y repetir pruebas antes de activar.
   No basta con establecer una variable para afirmar que se ha validado fiscalmente.
6. Verificar endpoint principal firmado y sus tipos: checkout.completed/expired,
   invoice.paid/payment_failed, subscription.updated/deleted/pending_update_applied/
   pending_update_expired y charge.refunded. Connect mantiene endpoint y secreto
   propios. Revisar discrepancias TEST/LIVE y ownership de recursos.
7. Validar Mux Production vía API vigente: basic/1080p/signed, UUID passthrough,
   entorno exacto y activos huérfanos. Reconciliar todos los assets y conservar
   tombstones/coste residual. No adivinar escuela de los tres históricos sin fila.
8. Habilitar sólo medición y conciliación, manteniendo cuotas legacy observe.
   Importar últimas 24 h fiables y rotar historia hasta 90 días. El retraso oficial
   excluye las últimas 12 h; cobertura hueca/error queda explícita. Reimportar
   ventanas para correcciones. No sumar estimaciones en horas ya confirmadas.
9. Activar piloto por lista explícita de hasta cinco escuelas/propietarios;
   requerir aceptación nueva versionada. Alta nueva concede prueba; contrato viejo
   no entra en enforce ni conservación automáticamente. Ensayar cuota/publicación,
   upgrade/downgrade/bolsa/recuperación visibles y exportación owner en destino.
10. Sólo tras autorización separada de mensajes, activar avisos y verificar
    destinatario/redirección antes de real. Sólo tras autorización separada de
    borrado, establecer la versión exacta de `PLATFORM_RETENTION_EXECUTE` y Mux
    deletion. Comprobar derechos/fecha/claim/pagos antes de cada eliminación.

## Variables (sin valores secretos)

| Grupo | Nombres / estado inicial |
|---|---|
| Piloto | `PLATFORM_PLANS_ENABLED=false`, `PLATFORM_PLANS_PILOT_ORGANIZATION_IDS`, `PLATFORM_PLANS_PILOT_OWNER_EMAILS` |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET` |
| Oferta | `STRIPE_PRICE_INICIO_20261001`, `STRIPE_PRICE_CRECE_20261001`, `STRIPE_PRICE_ACADEMIA_20261001`, `STRIPE_PRICE_LIBRARY_20261001`, `STRIPE_PRICE_DELIVERY_PACK_20261001` |
| Fiscal | `PLATFORM_TAX_RATE_ID`, `PLATFORM_TAX_LIVE_APPROVED` vacío hasta verificación |
| Medición | `PLATFORM_CAPACITY_WORKER_ENABLED=false`, `MUX_USAGE_IMPORT_ENABLED=false`, `MUX_ENVIRONMENT_ID`, `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET` |
| Playback | `MUX_SIGNING_KEY`, `MUX_PRIVATE_KEY`, `MUX_WEBHOOK_SECRET` |
| Tareas | `CRON_SECRET`; cron capacity a minuto 10 cada hora, cleanup Mux 03:00 UTC |
| Avisos | `PLATFORM_CAPACITY_NOTICES_ENABLED=false`, `EMAIL_DELIVERY_MODE=off`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| Conservación | `PLATFORM_RETENTION_EXECUTE` vacío, `MUX_DELETION_MODE=off` |
| Infraestructura existente | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |

Listas de piloto vacías permiten operación general una vez encendido el flag;
durante piloto deben ser explícitas. Más de cinco entradas falla cerrado.
No compartir archivos `.env*.local` ni trasladar claves/precios TEST a LIVE.

## Conciliación y fallos

El checkout persiste parámetros/idempotency key antes de crear Stripe. Recuperar
su respuesta perdida con la misma clave dentro de 23 h; después, reconciliar
manualmente el recurso original, sin crear un segundo cobro a ciegas. El panel
permite continuar/cerrar un checkout pendiente y consultar pago; cerrar no anula
una capacidad ya pagada. Los checkouts completados sin concesión se recuperan.

Cambios muestran quote exacta con instante congelado. Un fingerprint cambiado
exige nueva quote. Pending payment no activa capacidad. Invoice ID y provider
state permiten retomar una escritura perdida; nunca resetear consumo/gracia.
El inicio de derechos del primer ciclo es la confirmación de pago; la fecha de
renovación sigue Stripe. La bolsa se activa al primer éxito/captura verificados
por servidor y caduca exactamente 90 días después; reintentos no desplazan fecha.

Mux: reservas vencidas dejan de comprometer capacidad estimativa, pero un asset
real continúa contabilizado aun rechazado/borrado localmente. Recuperar snapshots
ready/errored perdidos sin degradar estados terminales respaldados por webhook. Rechazo
por duración/cuota va a cola persistente; default off impide borrado real. Antes
de permitir cleanup verificar que no está publicado/referenciado y que existe
atribución/coste mínimo. 120% es presupuesto económico, no biblioteca extra.
Plazos nuevos de14/30/90/7 días usan336/720/2160/168 horas exactas UTC; el cambio
de horario no añade ni resta una hora. SQL y Stripe TEST comprobaron ese defecto.

Conservación comienza en fin real, nunca al pulsar cancelar. Trial/cancel final
nuevo conserva 30 días. Restore antes de transacción de borrado cancela job;
un efecto Storage ya reclamado mantiene barrier hasta confirmarlo. Si la respuesta
proveedor es incierta permanece processing y se reintenta incluso tras diez intentos;
no limpiar a mano la barrier sin comprobar el proveedor. No editar ledgers de pago
ni aplicar fuerza para restaurar. Tras confirmación el pago pendiente se concilia.

Exportación: owner aun sin plan, fuera de Run as, obtiene manifiesto JSON y enlaces
de medios disponibles. Storage exclusivo: 1 h. Mux: HLS procesado duración +900 s;
no original garantizado ni extras MP4. La descarga consume entrega/coste Mux. No
incluye compras privadas ni credenciales. Referencias compartidas/externas quedan
marcadas no exportables desde esta escuela.

## Costes y observación del piloto

Panel plataforma importa evidencia JSON por fuente/ventana/entorno, con revisión
auditada. Cada detalle Mux exige asset conocido; lo desconocido queda separado.
Registrar bruto, descuento, crédito de cuenta, impuesto y pago por separado.
La CSV histórica de 30/08–30/09 puede registrarse como coste sin atribución de
cuenta; no inventar costes por escuela. FX requiere tasa/fecha/fuente. Coste de
referencia Basic1080p (0,003 USD/min-mes storage; 0,001 USD/min entrega) es hipótesis
fechada de coste bruto, no pago observado ni beneficio. Fuentes oficiales:
[Mux pricing](https://www.mux.com/docs/pricing/overview),
[Delivery API](https://www.mux.com/docs/api-reference/video/delivery-usage/list-delivery-usage).

Durante al menos 14 días registrar por escuela y UTC: cobertura/errores y retraso,
consumo confirmado/estimado, librería activa/reservada/comprometida, avisos70/90,
gracia/pausas/recuperaciones, operaciones pendientes, cobros/impuestos/refunds,
costes atribuidos/no atribuidos/Storage y excepciones con vencimiento. Observar
dos ciclos comerciales completos para evaluar economía; créditos globales no
ocultan margen bruto. No se han obtenido todavía resultados de ese piloto.

## Recuperación autorizada

Apagar ventas nuevas/envíos/cleanup y mantener conciliación de pagos ya confirmados.
Poner cuotas en observe con el rollback operativo versionado sólo si se autoriza.
Conservar ledgers, fuentes, snapshots y provider IDs. No soltar claims inciertos
ni borrar tablas financieras. Restaurar código compatible y revalidar target,
permisos, estado Stripe actual y cobertura antes de volver a enforce. Los rollbacks
SQL de este lote son deliberadamente no destructivos.
