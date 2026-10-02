# Planes y consumo — progreso

Actualización: 2026-10-02, 13:10 UTC. Encargo leído entero antes de editar.
Rama: codex/plans-consumption-20261001. [Especificación](plans-consumption-spec.md).

## Implementado y publicado

Catálogo versionado, legacy observe, cuotas/reservas atómicas, importador Mux,
checkout/cambios/ampliaciones/recuperación, playback limitado, avisos/outbox,
paneles, A medida, conservación y exportación. [Anexo](plans-implementation.md).

Autorización expresa de producción. PR4 corrigió el bucle Run as; sesión real
recuperada a login y portada. PR5 publicó planes; PR6 vista privada de servicios.
Main a7991d4, Vercel dpl_8pqgsd5ZWQ3fUrnKgj3kH3qkGPuz READY.
www y login 200; apex 308 único; consola real sin errores.
Planes, avisos y borrado siguen apagados. Worker/importador true y entorno
Mux 3cnmn5 guardados/verificados en Vercel, aplicarán al siguiente despliegue.

Backup cifrado fuera del repo: 64 tablas/1.758 filas, captura 12:07 UTC;
SHA256 20568de6d94ef5c8480df9a4e6989d24c0beb8f93515f47febfe94b527b97620.
Descifrado y JSON comprobados en memoria; sin copia nueva de bytes multimedia
ni restore completo de este snapshot. Migraciones aplicadas atómicamente
12:11 UTC, 29→33 recibos incluyendo 20261002121113. Ocho contratos anteriores
íntegros en observe, sin aceptación/retención nueva; 27 assets/ledger, cero ciclos/jobs.
Las 23 tablas nuevas tienen RLS y grants service-only; sin nuevos WARN de advisors.

## Verificado

- 146 unitarios, lint, TypeScript, build y 23 E2E aislados pasan. Tres E2E finales
  de servicios enfocados pasan: permisos, unknown, acción deshabilitada,
  375/768/1440, consola y red. Espera del redirect evita cancelar su stream.
- CI PR6 general 37008387979 y Supabase 37008361193 verdes: 128 pgTAP/11 archivos,
  concurrencia real, Auth/Storage/OTP/lifecycle y seis E2E de aplicación.
  Restauración privada omitida; no afirmar restore de este snapshot.
- Stripe TEST real, siete grupos previos, con tarifa inclusiva sintética 7%,
  checkout hospedado, descuentos, librería, upgrades, rechazo/recuperación,
  refund, firmas/duplicados/Connect y Test Clock. Recursos de relojes eliminados.
- Avisos SQL real/Resend con transporte interceptado pasan: 70/90 y unicidad/retry;
  sin entrega real. Revisiones UI/calidad cerradas tras corregir hallazgos.
- Producción desde panel privado 12:48 UTC: Stripe LIVE acct_1TwKtKJD1wCl42uL,
  coincide con dashboard, cobros/payouts habilitados; catálogo/fiscal vacíos.
  Mux token válido, tkrqi3/3cnmn5, nombre Production, tipo development.
  Exportación local redacted de Vercel no prueba credenciales inválidas.

## Trabajo actual y pendientes

Nueva acción superadmin fuera de Run as prepara sólo cinco productos/precios
LIVE fijos, inclusivos, versionados, deterministas/idempotentes, con recuperación
parcial; no clientes, cargos, contratos ni registros fiscales. Stripe UI no
ofrece tax_behavior sin entrar a Stripe Tax; Workbench LIVE es read-only.
Validación canónica por key/lookup/LIVE/EUR/importe/intervalo evita false ready.
16 regresiones enfocadas pasan. SubmitButton muestra pending/aria-busy.
Ningún producto LIVE creado todavía; publicar acción y ejecutarla.

Ampliar eventos del webhook principal, verificar medición real/atribución/
cobertura, configurar cinco PriceIDs en Vercel. Jorge limita lanzamiento a España;
regiones/IVA y lista de máximo cinco escuelas siguen pendientes. Autorización
para operar reiterada; no equivale a una respuesta de IVA ni lista de escuelas.
No activar ventas sin fiscal/piloto; no activar avisos/borrado fuera de límites.
No probado vídeo real 12 h/20 GiB, entrega Resend ni observación 14 d/dos ciclos.

Continuar por [runbook](plans-launch-runbook.md). No detenerse por cierre de fase.
