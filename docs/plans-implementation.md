# Planes y consumo — implementación verificada, 2026-10-01

Las decisiones comerciales canónicas están en [el prompt aceptado](plans-consumption-spec.md).
Este anexo describe su implementación; no modifica precios o contratos anteriores.
Estado final y recuperación en [progreso](plans-implementation-progress.md) y
[procedimiento de lanzamiento](plans-launch-runbook.md).

## Fuentes de verdad y tiempo

`src/lib/billing/catalog.ts` publica oferta versión2026-10-01 y snapshots aceptados.
Stripe determina cobro/periodo real; las membresías actuales determinan permisos.
Los saldos importados se reconstruyen en Postgres y nunca se toman del navegador.
Importes en céntimos; detalle de coste en micro-unidades; duración precisa en segundos.
Los incrementos proporcionales redondean hacia abajo a segundos enteros.

Ciclos UTC `[inicio,fin)`. La hora oficial de Mux se asigna por el inicio del bucket,
sin inventar precisión intrahoraria. `rights_start_at` evita cargar uso previo al
pago inicial. Los aumentos usan quote congelada y efectividad tras pago, conservando
consumo. Bolsa: primera verificación del servidor y exactamente2160h; los plazos
de prueba/conservación/exceso son336/720/168h, sin desfase DST del servidor.

## Recorridos y evidencia

| Requisito | Implementación y comprobación |
|---|---|
| Oferta y A medida | Portada/condiciones/catálogo canónico; solicitud auditada sin contrato automático. UI375/768/1440 y acción real con Supabase aislado. |
| Fiscal del piloto | Domicilio canónico Stripe, vínculo exclusivo, consentimiento/política versionada y guard compartido de creación/recovery/worker; ES Península/Baleares, IVA21 inclusivo inicial/recurrente. TEST real con tarjeta FR y rechazo de código postal35001; listas vacías cierran ventas. |
| Compra y ampliación | Checkout Stripe TEST hospedado real, precio inclusivo, descuento once sólo base, biblioteca recurrente y bolsa única. |
| Cambios | Quote exacta Stripe, upgrade medio ciclo añade150.000s y15.000s de gracia, no reset; downgrade y cantidad biblioteca a cero en renovación Test Clock. |
| Recuperación | Firma/Connect/duplicados, checkout completado sin grant, rechazo→pago→conciliación, expiración explícita del checkout, refund previo al grant atómico. |
| Cuotas y aislamiento | SQL real/RLS, reservas concurrentes en dos escuelas, duración falsa, expiración, compras/importación bajo bloqueo de escuela. |
| Uso y costes | Ledger persistente incluso asset borrado, reemplazo/corrección por hora, paginación completa, lease renovada y escritura con fencing; cobertura/errores explícitos, datos sin atribución separados. |
| Playback | Sesión persistida por usuario/escuela/asset, duración+900s; agotamiento impide nueva sesión pero conserva la anterior sin extender vencimiento. Revocación de roster bloquea la comprobación siguiente. |
| Avisos | Umbrales70/90 únicos por escuela/recurso/ciclo; worker real, destinatarios sintéticos y SDK Resend con transporte capturado. Fallo permanece sin enviar y retry usa misma clave. |
| Conservación | Fin efectivo/30d/version aceptada, recuperación cancela trabajo, SQL synthetic prueba idempotencia/retención de facturas, Storage processing mantiene barrera de restore mientras el proveedor es incierto. |
| Salida | Owner propio fuera de Run as, JSON/cursos/lecciones/medios, Storage exclusivo firmado y descargado real, HLS procesado; sin compras/credenciales ni promesa de original Mux. |
| Paneles | Escuela: saldos/cobertura/operaciones y recuperación; plataforma: ingreso real/desconocido, bruto/créditos/pago, referencia, FX explícito y Storage separado. |

Los unitarios y los dobles prueban calendario/correcciones/paginación/errores/UI,
pero no sustituyen llamadas oficiales del importador ni un vídeo real. El E2E de
sesión larga usa una duración sintética y JWT local, no una subida de12 horas.
La captura de Resend verifica contenido, destinatario e idempotencia, no entrega.

## Ejecución reproducible y límites

`npm run test:unit`, `npm run lint`, `npx tsc --noEmit` y
`npm run test:e2e:audit` (incluye build aislado). El harness neutraliza todas las
variables `.env*` y bloquea red externa en la aplicación/navegador.
No ejecutar E2E normales con `.env.local` de producción.

El workflow `Isolated Supabase` crea Postgres17/Auth/REST/Storage temporales,
aplica todas las migraciones y ejecuta pgTAP, concurrencia, OTP, lifecycle y
`playwright.isolated.config.ts`; no contiene pasos de despliegue.
[CI final](https://github.com/Jorgecamarabusiness/delunivo/actions/runs/37019775267):
128 aserciones SQL en11 archivos y seis E2E reales pasan.

En Windows, el harness portable utiliza PostgreSQL17.11 y PostgREST16.4 oficiales
en TEMP/delunivo-capacity-tools, puertos54399/54397/54398 exclusivamente loopback.
`start-portable-capacity-db.mjs` aplica migraciones y verifica REST; mantener la
sesión abierta. `isolated-capacity-concurrency.mjs --portable` crea fixtures nuevas.
`node --import ./scripts/capacity-test-imports.mjs scripts/capacity-stripe-journey.mjs`
exige Stripe TEST y el REST local; nunca cargar LIVE. El script de avisos usa la
misma base y un transporte capturado. `.env*.local` queda ignorado; ningún secreto
se publica. Auth/Storage portables sólo son schemas compatibles: su prueba real
corresponde al workflow completo. Los relojes Stripe sintéticos se eliminan al final.

Estado 02/10: proveedores LIVE verificados desde runtime; catálogo y tarifa manual ES21 inclusiva configurados. Mux real importa ventanas completas (73, ninguna fallida a14:21UTC), con histórico progresivo90d y cero filas proveedor en esas ventanas. Cierre fiscal local:158 unitarios, lint, TS, build y24E2E; Stripe TEST real final siete grupos. PR10 integrado6cab273 y piloto activo Production READY dpl_4CMMZrHfS2W5DscEXAvTxFp4VJJt; formulario real de Iván comprobado, ventas fuera del piloto cerradas, acceso/salida de soporte sin bucles. Evidencia runtime/publica y registro exacto en progreso.

Owner real debe aceptar nueva oferta. Piloto14d/dos ciclos es observación futura. Avisos y borrado reales siguen apagados; no aplicar conservación nueva a legacy. No se ha probado compra LIVE, entrega real ni subida12h/20GiB.
