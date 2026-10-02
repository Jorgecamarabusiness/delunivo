# Lanzamiento de planes y consumo — 2026-10-02

Jorge autorizó integración y publicación. Alcance fiscal aceptado: solo Península y Baleares, IVA 21 % incluido; piloto solo Iván Orgánico (Grow Organic). [Especificación](plans-consumption-spec.md), [estado reanudable](plans-implementation-progress.md).

## Evidencia y estado

158 unitarios, lint, TypeScript, build y 24 E2E Chromium aislados pasan tras el último código fiscal; UI 375/768/1440 y consola comprobados. Los dobles no prueban proveedores ni RLS. Stripe TEST real final utiliza tarifa ES 21 % inclusiva y tarjeta con domicilio FR: factura/domicilio canónico permanecen ES. Checkout/descuento once, biblioteca, cambios/rechazo/recovery/refund/duplicados, Test Clock y cancelación pasan; recursos sintéticos eliminados. [Informe](evidencias/plans-2026-10-01/stripe-test-journey.json).

Última CI publicada PR9: [general](https://github.com/Jorgecamarabusiness/delunivo/actions/runs/37016026356) y [Supabase](https://github.com/Jorgecamarabusiness/delunivo/actions/runs/37016004456) verdes. Supabase temporal completo verifica 128 pgTAP/RLS, concurrencia, Auth/REST/Storage/OTP/lifecycle y consumidores reales. El ensayo Windows solo ofrece PostgreSQL/PostgREST y schemas compatibles; no sustituye servicios Auth/Storage reales. Código fiscal requiere CI nueva antes de integrarse. Revisores independientes read-only calidad/UI cerrados sin hallazgos materiales.

Backup cifrado 12:07 UTC: 64 tablas/1.758 filas, hash/descifrado verificados. Tres migraciones atómicas a12:11 UTC, 33 recibos; ocho legacy observe intactos, 23 tablas nuevas RLS/service-only. No hubo restore completo del snapshot ni nuevo backup de bytes multimedia.

Stripe LIVE acct_1TwKtKJD1wCl42uL coincide entre runtime y dashboard. Cinco precios versionados exactos y tarifa manual txr_1UM6nLJD1wCl42uLPf3zp9dl VAT/ES/21 %/inclusive/active. Webhook principal nueve eventos; Connect separado intacto. Ningún cobro LIVE ni activación de servicio Stripe Tax de pago.

Mux tkrqi3/3cnmn5, nombre Production/tipo development. Worker/import encendidos; 73 ventanas completas y cero fallidas a14:21 UTC, con cero filas del proveedor en esas ventanas. No son datos sintéticos ni prueba de tráfico real. Hora fallida reimportada; cursor histórico restaurado por CAS a06/07 15:00. Historia 90 días progresiva; últimos12h excluidos por retraso del proveedor. 27 ledger conocidos, tres assets sin atribución separados. No adivinar dueño ni imputar créditos globales como margen.

Avisos probados con transporte Resend capturado, sin entrega. Subida12h/20GiB no probada. Observación14d/dos ciclos futura.

## Activación y comprobación

1. Integrar fiscal tras CI general y Supabase verdes, verificar Production READY del SHA exacto.
2. Configurar exclusivamente organización 7125f160-3c4b-4225-a6b9-f6756c317930 y su owner verificado; email privado en variable Secret, no en repositorio. Ambas listas obligatorias y máximo cinco; vacías, ausentes o excesivas cierran ventas. No ampliar piloto silenciosamente.
3. Verificar desde runtime cinco precios LIVE, tarifa ES21 inclusiva activa, aprobación versión2026-10-01 y listas. Encender PLATFORM_PLANS_ENABLED y desplegar el SHA fiscal verificado; confirmar nueva configuración efectiva.
4. Comprobar www/login, condiciones y pantallas privadas reales sin aceptar por Iván ni iniciar Checkout LIVE. Run as permite observar y exportación exige owner real; acciones financieras bloqueadas en soporte. Iván acepta nueva oferta, declara domicilio y escoge plan desde su sesión propia. Legacy no migra solo.
5. Mantener avisos y borrado apagados. Para activarlos después, verificar destinatario/condiciones/fecha/exportación y ejecutar solo el paso expresamente autorizado; nunca probar con contenido de cliente.

## Configuración

| Grupo | Estado |
|---|---|
| Piloto | PLATFORM_PLANS_ENABLED=false hasta fiscal READY; listas exactas de escuela y owner preparadas |
| Oferta LIVE | STRIPE_PRICE_INICIO_20261001, STRIPE_PRICE_CRECE_20261001, STRIPE_PRICE_ACADEMIA_20261001, STRIPE_PRICE_LIBRARY_20261001, STRIPE_PRICE_DELIVERY_PACK_20261001 configurados |
| Fiscal | PLATFORM_TAX_RATE_ID tarifa manual verificada; PLATFORM_TAX_LIVE_APPROVED=2026-10-01 |
| Medición | PLATFORM_CAPACITY_WORKER_ENABLED=true, MUX_USAGE_IMPORT_ENABLED=true, MUX_ENVIRONMENT_ID=3cnmn5 |
| Avisos | PLATFORM_CAPACITY_NOTICES_ENABLED=false; conservar EMAIL_DELIVERY_MODE existente para acceso |
| Conservación | PLATFORM_RETENTION_EXECUTE sin activar, MUX_DELETION_MODE=off |
| Secretos existentes | Stripe principal/Connect, Supabase, Mux, Resend y CRON_SECRET solo servidor; no revelar ni publicar |

Cron capacity minuto10/hora; Mux cleanup03:00UTC sigue sin borrar. No trasladar TEST a LIVE. scripts/prepare-capacity-stripe-test.mjs y capacity-stripe-journey.mjs son solo TEST.

## Recuperación y límites

Checkout persiste parámetros/idempotencia antes de Stripe. Recuperación sin respuesta vuelve a la misma clave dentro23h; después exige reconciliación del original. Guard fiscal también protege URLs reutilizadas y worker. Sesión abierta insegura se expira; pago completo se concilia para conservar derechos/evidencia. Cerrar no elimina capacidad pagada. El worker de borrado de identidad nunca crea Checkout para encontrar uno desconocido.

Quote exacta congelada y fingerprint incluyendo impuestos requieren nuevo cálculo si cambian. Pending payment no activa derechos. Consumo/gracia no se resetean. Primer ciclo empieza al confirmar pago; renovación sigue Stripe. Bolsa vence2160h tras primer éxito/captura; trial336h, retención720h y exceso168h, UTC exacto.

Customer fiscal se vincula exclusivamente a escuela, guarda domicilio solo en Stripe y tiene versión de política aceptada. País ES/código postal provincial01–50 excepto35/38; Baleares07 permitido, Ceuta/Melilla excluidas. No se admite exención ni reverse charge durante este piloto. Checkout no reescribe domicilio con la tarjeta; tarifa recurrente por defecto se comprueba antes de compra/ampliación. Ampliar jurisdicción/tratamiento requiere nueva decisión y pruebas.

Mux pagina hasta vacío explícito cuando count no viene; errores parciales/duplicados/ventanas incorrectas quedan desconocidos. Reservas vencidas liberan estimación pero assets reales conservan coste/ledger. Tokens previamente emitidos siguen hasta vencimiento; permisos revisados cada5min. No garantizar corte económico instantáneo.

Conservación empieza en fin efectivo del contrato nuevo aceptado. Restaurar antes del borrado cancela job; Storage reclamado mantiene barrier hasta confirmación. Respuesta incierta permanece processing/retry, sin liberar claims manualmente ni borrar ledgers. Rollback: apagar ventas/avisos/cleanup y mantener conciliación compatible de pagos; no borrar tablas ni reescribir contratos.

Owner propio fuera de Run as exporta manifiesto y enlaces. Storage exclusivo1h; Mux HLS procesado duración+900s, sin promesa del original ni MP4 extra. Descargar consume entrega. Sin compras privadas/credenciales.

## Observación posterior

Registrar durante14d cobertura y retraso, saldos confirmados/estimados, reservas, operaciones pendientes, impuestos/refunds, avisos si se activan y costes atribuidos/desconocidos. Observar dos ciclos completos para validar economía; crédito global no sustituye coste bruto. La muestra histórica Mux0,35USD/105min no representa uso real de clientes. Mantener FX/fuente/fecha y costes Storage separados. No declarar realizada esta observación antes de tiempo.
