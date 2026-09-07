# Auditoría profesional de Delunivo

Actualizada: 2026-09-07. Consolida evidencia local, CI y restauración privada. No acredita cumplimiento legal, seguridad global ni producción lista: migraciones y despliegue siguen pendientes.

El diagnóstico original se conserva íntegro en [el informe histórico](historico/auditoria-profesional-20260906.md),
junto con la matriz y el borrador legal de esa fecha. Sus pendientes no sustituyen
los resultados posteriores de este registro.

## Seguimiento A01–A17

| ID | Resultado actual y límite |
|---|---|
| A01 | Guards de entorno y red; Supabase real aislado en Linux CI, sin Docker local ni cuentas reales de prueba. |
| A02 | OTP por RPC y concurrencia real pasan en CI. |
| A03 | Guardado Mux ready/duración/playback atómico probado en PG17. No aplicado a producción. |
| A04 | Duración hasta 43200 y token +900 s con tiempo simulado; nueva emisión denegada tras borrado. El bearer emitido mantiene su ventana residual. |
| A05 | Cuotas serializadas y reserva anterior al SDK probadas; pista/duración firmadas y cola de rechazados. El cap de bytes de Direct Upload no es autoritativo: capacidad real de 12 h/20 GiB y coste siguen sin certificar. |
| A06 | 21 migraciones recuperadas, reconstrucción y restore real privados verificados. Copias históricas equivalentes archivadas privadamente, stash intacto. |
| A07 | Ajustes SQL de reembolso/disputa, eventos tardíos y no resurrección probados; suscripción de eventos LIVE por verificar en Stripe (sesión ausente, clave local solo TEST). |
| A08 | Sucesión, último owner/superadmin y sesiones antiguas probados; worker recuperable con Auth al final. E2E propio/global completados con Auth real. |
| A09 | Tiptap 3.31.3/Browserslist 4.28.9; audit limpio, lock actual conservado. |
| A10 | Páginas legales, identidad de plataforma configurada, ficha y términos por escuela, oferta inmutable y descarga. Datos/condiciones reales de escuelas y revisión fiscal internacional siguen externos. |
| A11 | Contraste dinámico y claims predeterminados corregidos. Material editorial de escuelas conservado y sin certificar. |
| A12 | Identidad por URL, headers entrantes descartados, cabeceras defensivas y noindex privado; canonical/robots/sitemap públicos. |
| A13 | 404 real en rutas inexistentes; notFound con streaming puede ser 200+noindex según documentación local de Next. E2E exige denegación y ausencia de datos privados. |
| A14 | Foco/trap/Escape, borradores, alt/nombre, objetivos 44 px y embeds con allowlist/clic; revisión de 375/768/1440. No equivale a auditoría con lector de pantalla de todas las rutas. |
| A15 | Invitaciones SQL ≤7 días, identidad vinculada y errores públicos genéricos. |
| A16 | Metadata/OG de entidades, sitemap/robots, navegación útil del panel; sin ratings/Schema inventados. CWV de campo y gráficos por rol siguen sin medición completa. |
| A17 | El emisor de React RSC se activa al cerrarse el destino; esperar networkidle entre navegaciones del test elimina la reproducción. Tres pases completos posteriores sin esos logs, sin filtros ni silenciamiento. Runtime productivo pendiente del rollout. |

Estado más reciente: `d3e837b`, 114 unitarios/lint; build/TypeScript y nueve E2E
de auditoría. CI `34102906720` **completa correctamente** SQL, Auth, Storage,
concurrencia y los cinco E2E reales: registro/verificación, gratuidad, expulsión,
borradores, justificantes y los dos borrados. Usa la columna real `purchased_at`.

## Estado verificable

- `817d4ff`: lint y 111 pruebas unitarias pasaron.
- `0233c75`: build y 8 E2E audit pasaron. El cierre de stream posterior a `networkidle` no se da por cerrado.
- CI `34100503218`: SQL/RLS, OTP/Auth, Storage y lifecycle pasó.
- La CI completa vigente es `34102906720`, correcta sobre `d3e837b`; las ejecuciones anteriores sirvieron para corregir selectores, semántica de streaming y columna del recibo.
- Baseline de 21 migraciones recuperada de upstream. `npm audit` informa 0; Tiptap está en 3.31.3.

## Lotes aplicados localmente

A14 corrigió foco del índice móvil, diálogo de descarte, nombre/alt del editor, borradores e iframes permitidos con clic previo. A16 añadió URL centralizada, canonical/OG de escuelas y cursos publicados, sitemap público filtrado y robots para rutas privadas.

El borrado conserva datos mínimos de pagos o reclamaciones y las pruebas no eliminan personas, alumnos o escuelas reales. El acceso gratuito conserva checkout para precios no gratuitos. La ficha por escuela permite identificar al vendedor y publicar textos opcionales de acceso o cambios/reembolsos; no crea términos predeterminados ni limita derechos.

## Recuperación y límites

Restore privado `34099275405` (job `101669740041`): 54 tablas y 1.446 filas, FK y secuencias verificados. Storage: 11 objetos, 43 MB, descifrado y SHA-256 verificados. Siguen sin recuperar 27 assets Mux por falta de credencial de backup; no se presenta como restauración completa de medios.

Las variables legales de producción se comprobaron configuradas, pero falta verificar su comportamiento en runtime. El contrato descargable inmutable y los textos de vendedor pasan SQL/CI; aún no están migrados/desplegados. La revisión de acciones sustituyó errores técnicos públicos por mensajes acotados.

## Siguiente paso operativo

Completar backup Mux y acceder a Stripe LIVE para verificar eventos; después aplicar migraciones compatibles, desplegar y comprobar producción. Las operaciones destructivas de borrado siguen limitadas a aislado. El borrador legal y la matriz conservan las limitaciones externas/editoriales sin atribuir conformidad global.

La matriz completa y sus límites están en [auditoria-controles.md](auditoria-controles.md). No registrar aquí datos identificativos de titulares ni vendedores.
