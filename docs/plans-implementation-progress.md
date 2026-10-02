# Planes y consumo ? progreso

Actualizaci?n: 2026-10-02. Encargo le?do entero antes de editar.
Rama: codex/plans-consumption-20261001. [Especificaci?n aceptada](plans-consumption-spec.md).

## Implementado y publicado

Cat?logo versionado, contratos legacy en observe, cuotas y reservas at?micas,
importador Mux con cobertura/correcciones, checkout/cambios/ampliaciones,
recuperaci?n, playback limitado, avisos/outbox, paneles, A medida,
conservaci?n y exportaci?n. [Anexo](plans-implementation.md).

Jorge autoriz? producci?n. PR4 corrigi? el bucle Run as y su sesi?n real volvi?
al login y despu?s a la portada. PR5 public? planes: main55408ae, Vercel
`dpl_FvavXXKp1pLgPiXQZjMMS2xCoUVm` READY, www.delunivo.com.
Planes, worker, importaci?n, avisos y borrado siguen apagados.

Backup cifrado fuera del repo: 64 tablas/1.758 filas, captura12:07UTC;
SHA25620568de6d94ef5c8480df9a4e6989d24c0beb8f93515f47febfe94b527b97620.
Descifrado y JSON comprobados en memoria; sin nueva copia de bytes multimedia
ni restauraci?n completa de este snapshot. Migraciones aplicadas at?micamente
12:11UTC, 29?33 recibos incluyendo20261002121113. Ocho contratos anteriores
?ntegros en observe sin oferta/retenci?n nueva;27 assets/ledger, cero ciclos/jobs.
Las23 tablas nuevas tienen RLS y grants service-only; sin nuevos WARN de advisors.

## Verificado

- 136 unitarios, lint, TypeScript y build aislado pasan.
- 23 E2E Chromium aislados: permisos, servicios desconocidos, Run as, paneles,
  aula y exportaci?n; consola y red controladas;375/768/1440 sin overflow.
- CI general37006543260 pas? sobre46ad0d9:136 unitarios y22 E2E anteriores.
- CI Supabase37006489165 pas?:128 pgTAP/11 archivos, concurrencia real,
  Auth/Storage/OTP/lifecycle y6 E2E de aplicaci?n; restauraci?n privada omitida.
- Stripe TEST real:7 grupos comerciales pasan, tarifa inclusiva sint?tica7%,
  checkout hospedado, descuento, librer?a, upgrades, rechazo/recuperaci?n,
  refund, firmas/duplicados/Connect y Test Clock. Recursos de relojes eliminados.
- Avisos con SQL real y transporte Resend interceptado pasan:70/90,
  unicidad/retry; sin entregas reales. Revisiones UI/calidad cerradas.

## Trabajo actual y pendientes

Se a?ade /admin/plataforma/servicios: consumidor privado del mismo diagn?stico
can?nico que la API. Chrome bloque? la navegaci?n a la URL API t?cnica.
Auth superadmin fuera de Run as, s?lo lecturas/proyecciones sin secretos.
Revisi?n de seguridad sin bloqueos; revisi?n UI detect? targets36px, corregidos
con44px y regresi?n. Pendiente publicar esta vista y leer providers en destino.

Stripe LIVE autenticado muestra cuenta acct_1TwKtKJD1wCl42uL, pagos/payouts
activos, cat?logo y tarifas fiscales vac?os. Falta comprobar coincidencia con
la cuenta real del servidor. Exportaci?n Vercel sensible redacted no prueba
credenciales inv?lidas; no rotarlas por ese resultado.
Jorge limita el primer lanzamiento a Espa?a. Preguntas pendientes: regiones/IVA
y escuelas del piloto (m?ximo5). No activar cobros con una pol?tica fiscal supuesta.

Mux UI muestra30 assets. Pendiente lectura API/entorno desde producci?n,
conciliaci?n/importaci?n real, configuraci?n de precios/webhooks y piloto.
No probado v?deo real12h/20GiB, entrega Resend ni observaci?n14d/dos ciclos.
No activar avisos/borrado fuera de l?mites del documento.

Siguiente: publicar vista privada tras checks finales, comprobar Stripe/Mux y
resolver pasos independientes del [runbook](plans-launch-runbook.md). No detener
la implementaci?n por el cierre de una fase. No afirmar piloto/cobros activos.
