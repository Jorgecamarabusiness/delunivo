# Auditoría profesional de Delunivo

Fecha de corte: 2026-09-06. Estado: **lote local implementado; lanzamiento pendiente**.
Este documento permite continuar sin repetir el descubrimiento. No acredita una
auditoría dinámica completa ni cumplimiento legal ni preparación para producción.

## Alcance y fuentes

Se leyeron el encargo `prompt-delunivo.md`, AGENTS.md, README, estado, esquema,
vertical Mux y la guía común `Jorge-Conocimiento/Guias/Desarrollo-profesional.md`.
Sus **57 controles** tienen evaluación individual en [la matriz](auditoria-controles.md),
incluidos motivos de no aplicación y limitaciones. Se aplicaron las skills de UI,
servicios externos, Supabase, schema y documentación de Next instalada; de
`addyosmani/agent-skills`: contexto, revisión/calidad, frontend, seguridad,
fuentes y pruebas con navegador. SkillUI no se utilizó.

Rama inicial `main`, remoto `Jorgecamarabusiness/delunivo`, worktree inicialmente
limpio. No se hicieron commits, push, deploy, cambios de DNS, cobros, emails,
migraciones remotas, borrados de datos ni contratación de servicios. Los procesos
preexistentes en puertos 3100/54329 no se detuvieron. Los cambios quedan locales.

Stack detectado: Next 16.3.3, React 19.2.4, Node 24.18.0, npm 11.16.0.
La URL de producto documentada es `https://www.delunivo.com`; README corregido.
No se volvió a comprobar dominio/deploy remoto: se preserva su evidencia de agosto.

El [inventario](auditoria-inventario.md) enumera 35 archivos de páginas/handlers,
46 acciones en `src/app` y dos auxiliares, 25 tablas, 33 funciones (incluidos triggers),
buckets, cron y terceros. Las variantes `/o/<slug>` reutilizan esas pantallas.
Catálogo cloud consultado **solo lectura** en el proyecto correcto
`jgxqdzmmeveksseflyst`; no se descargaron filas personales ni objetos de Storage.

## Hallazgos priorizados y decisiones

P0 significa incidente/explotación crítica confirmada; **no se ha confirmado ninguno**.
Eso no demuestra ausencia de fallos. P1 requiere resolución antes de ampliar el
lanzamiento; P2 es mejora material; P3 es deuda de menor impacto.

| ID | Prioridad | Hallazgo, evidencia e impacto | Estado / decisión |
|---|---|---|---|
| A01 | P1 | `.env.local` apunta al único Supabase real; el E2E anterior cargaba ese archivo y helpers creaban/borraban fixtures allí. Nombre de entorno no prueba aislamiento. | Corregido local: guardia exige loopback, `synthetic-only`, ninguna clave live de Stripe/Mux/Resend; seed/helper/config la ejecutan antes de escribir. CI usa nueva suite con mock local. |
| A02 | P1 | Códigos de verificación usaban select/update separados: intentos e invalidación podían perderse en concurrencia. RPC atómicas ya existen en cloud con grants exclusivos. | Wrapper migrado a issue/consume RPC, sin fallback inseguro, formato estricto y fallo cerrado. Concurrencia Postgres real pendiente; fake RPC solo valida contrato/comportamiento de aplicación. |
| A03 | P1 | Guardar Mux permitía adjuntar assets processing/errored. Comprobar ready en una action deja carrera con webhook antes de RPC. Definición cloud confirmada usa solo blacklist de estados. | UI/action endurecidas. Migración local `20260906213000` exige ready, duración y playback ID en UPDATE atómico; revisada, no aplicada ni ejecutada en BD. Bloquea rollout hasta prueba aislada. |
| A04 | P1 | JWT fijo de cuatro horas corta sesiones largas; metadatos de duración no se validaban al listo. | Duración inclusiva 43200, token duración+900, chequeos/reanudación/expiración. Unitarios con tiempo controlado; bearer capturado válido hasta exp. No revocación individual instantánea. |
| A05 | P1 | 20 GiB es tamaño declarado por cliente; una Direct Upload URL no lleva cap autoritativo de bytes. Rate limit por bloque puede eludirse variando IDs. | Conservado límite UX y 1080p; no garantía de costes. Cuotas por actor/tenant, conciliación de uso, pista de vídeo y abuso pendientes antes de anunciar 12 h reales. |
| A06 | P1 | Ledger real de 21 migraciones: tres de septiembre ausentes del repo; baseline histórica incompleta. Bucket público no documentado. | Inventario/catalogación sin DDL remoto. Recuperar SQL original y comparar grants/triggers antes de construir BD aislada. |
| A07 | P1 | `stripe-connect/route.ts` tramita checkout completo y account.updated, no reembolsos; purchase concede acceso duradero. account.updated no protege contra desorden temporal. | Pendiente modelo explícito de refund parcial/total/disputa e idempotencia. No revocar compras ni cambiar condiciones sin decisión de producto y migración probada. |
| A08 | P1 | Último owner puede borrar su membership mediante política directa; única cuenta superadmin carece de defensa ante borrado privilegiado. Recuperación reportada no demuestra historial íntegro. | No se borró/restauró nada. Preparar protección SQL concurrente, revisión de cascadas y ensayo de recuperación con fixtures. Conteos reales: un superadmin, cero empresas sin owner. |
| A09 | P1 | `npm audit`: 28 moderate de familia Tiptap, 1 high Browserslist. | Intentos de actualización acotada encontraron conflictos peer; se restauró lock original y ejecutó npm ci. Pendiente actualización coordinada, sin force ni cambios de stack. |
| A10 | P1 | No hay rutas legales completas ni confirmación duradera del inicio inmediato de contenido digital; identidad/roles/retención no cerrados. | Borrador interno preparado con fuentes oficiales. No se inventan datos fiscales ni se cambian derechos/condiciones; falta revisión y publicación autorizada. |
| A11 | P1/P2 | Contraste de texto blanco sobre verde insuficiente y umbral dinámico simplista; claims ficticios de cientos de alumnos y copia imposible. | Contraste calculado contra foreground real, fallback negro; copy por defecto corregido. Contenido guardado por escuelas preservado, pendiente revisión editorial. |
| A12 | P2 | Header x-org recibido podía influir en tenant fuera de ruta. Cabeceras defensivas y exclusión SEO privadas incompletas. | Se descartan headers entrantes y se derivan de `/o/<slug>`; CSP parcial frame/object/base, nosniff/referrer, API no-store y noindex privado. CSP completa/robots/canonical/sitemap pendientes. |
| A13 | P2 | Ficha ausente mostraba soft-404; estados de vídeo no anunciados; fila móvil truncaba título a un carácter. | notFound y pantalla compartida; role alert/status; menú del bloque pasa debajo en móvil. UI revisada en tres anchos. Otras rutas soft-404 y streaming 200+noindex pendientes. |
| A14 | P1/P2 | Aula móvil mantiene índice oculto tabulable; edición sin protección de borrador; RichTextEditor sin nombre/foco/alt; iframe admite terceros arbitrarios. | Pendiente lote UX/accesibilidad y allowlist/consentimiento según proveedor. No se declara accesibilidad global por las capturas del lote. |
| A15 | P2 | RPC de invitaciones permite caducidad arbitraria aunque UI limita a siete días; algunas acciones exponen error.message de BD. | Pendiente fijar invariantes en SQL y mensajes públicos genéricos con diagnóstico privado. |
| A16 | P2/P3 | SEO de entidades/OG/sitemap, tablas accesibles de gráficos, estados placeholder y medición por rol incompletos. | Backlog explícito, no rediseño general ni datos estructurados/ratings inventados. |
| A17 | P2 | Next registra `destination stream closed early` al navegar rápidamente entre rutas del editor en la suite; dos apariciones en el pase final. | Los 7 casos pasan y no hay excepción del navegador, pero el runtime no está limpio. Aislar cancelación de RSC/prefetch frente a error de app antes de declarar ese control cerrado. |

Aspectos conservados por evidencia: compra **por curso**, no suscripción del alumno;
Connect de la escuela, importe/cuenta calculados en servidor, firma e idempotencia
de webhooks, RESTRICT de historial de compras, cola persistente de borrado Mux;
suspensión comercial no elimina acceso adquirido de alumnos. Afiliados y Run as
usan estado/auditoría propios; revisión estática no certifica su ciclo real completo.

Los advisors devolvieron 9 INFO por tablas intencionalmente server-only sin policies
y 7 WARN por funciones definer ejecutables desde Auth. No se califican automáticamente
como vulnerabilidades: importa la autorización del cuerpo y grants de cada firma.

## Progreso por lotes

| Lote | Trabajo | Estado |
|---|---|---|
| 0 | Contexto, inventario, revisión read-only de datos, guía completa, secretos/dependencias y entorno | Cerrado como descubrimiento; límites anotados, no aprobación dinámica global. |
| 1 | Aislamiento de pruebas/CI, códigos atómicos, seguridad de cabeceras | Implementado local; regresión final registrada debajo. |
| 2 | Duración/playback/processing, publicación ready y corrección móvil localizada | Código local y pruebas; parte SQL preparada con rollback, pendiente BD aislada. |
| 3 | Copy honesto/contraste/404, documentos legales e inventario operativo | Implementación local reversible; textos legales internos, no publicados. |
| 4 siguiente | Dependencias y baseline SQL aislada con pruebas de invariantes | Preparado en plan exacto; sin empezar desde cero. |

Revisión independiente: `quality_reviewer` auditó seguridad/datos/pagos y diff final;
`ui_reviewer` revisó diff/capturas 375/768/1440. Se integraron sus hallazgos de campo
inexistente en student_course_access, alertas de vídeo, fila móvil, carrera de RPC
y límites de la garantía de aislamiento/bytes. El maestro ejecutó servidores/pruebas.

## Matriz de cobertura real

**C** código/catálogo, **U** unitaria, **E** navegador/HTTP con fixtures, **P** pendiente.
Una E prueba las ramas de Next con un Supabase simulado; no prueba RLS real.

| Flujo / actor | Evidencia | Límites pendientes |
|---|---|---|
| Anónimo: landing, login, ruta inexistente | E con Chromium, captura 375/768/1440, HTTP 404 | Registro/recovery completo, validaciones y entrega real de email P |
| Anónimo: playback privado | E HTTP 401 | Catálogo público/privado completo, enlaces/media sin sesión P |
| Owner B frente a lesson/asset A | E playback 403 y upload 403; C helpers | CRUD directo de tablas/RPC/media/actions en Postgres real P |
| Alumno A comprador | E playback check 200 sin JWT, C acceso por curso | Compra Stripe test, aula completa/progreso/seek/descarga P |
| Alumna A invitada sin compra | E aula y autorización enfocadas en suite | Token caducado/revocado, aceptación y concurrencia real P |
| Owner A editor | E apertura/editor/subida local processing→ready, guardar deshabilitado→habilitado | Guardado real/RPC, cancelación, salir con borrador, red cortada y huérfanos P |
| Owner multiempresa / perfil multiescuela | C scopes y selección de membership | E2E completo con A/B e historial P |
| Superadmin | C política/operaciones, fixture sintética disponible | Dashboard, último privilegiado, tampering y lectura UI A/B P; disponer de fixture no es ejecutar prueba |
| Suspensión comercial | C helper/RLS y separación de derechos adquiridos | E2E owner bloqueado/alumno comprador permitido P |
| Stripe / Connect | C y U contratos/idempotencia/lógica existente | Eventos firmados test real, cancelación/refund parcial-total/disputas y cuenta retrasada P |
| Afiliados | C/U estado/descuento/suscripción exacta | Ciclo facturado, factura antigua y concurrencia en DB P |
| Run as | C/U cifrado/firma/auditoría/15min/bloqueo financiero | Entrada/salida/restauración/revocación/expiración con dos sesiones reales aisladas P |
| HTML/iframes/archivos | C/U sanitización y formatos; MP4 real de 52 s local | Contenido real, allowlist/consentimiento, antivirus/bytes/pista de vídeo P |
| Mux webhook/playback largo | U bordes/eventos/retry/tiempo; E HTTP y archivo local | Mux real 12 h, metadatos firmados reales, red/seek/resume/revocación bearer P |
| Storage/backups/borrado | C catálogo/cola/cascadas, conteos sin PII | Políticas de objetos, restore aislado y recuperación de historial P |
| SEO/legal/privacidad | C y fuentes oficiales; E red local solo landing/uploader | Red/cookies por proveedor en entorno real autorizado, textos completos y fiscalidad P |

## Verificación y evidencias

Comandos reproducibles desde el repo, sin introducir credenciales reales:

```text
npm ci --ignore-scripts
npm run test:unit
npm run lint
npx tsc --noEmit
npm run test:e2e:audit
node scripts/audit-git-secrets.mjs
git diff --check
```

`test:e2e:audit` ejecuta build de Next y runner Playwright con cuentas sintéticas.
El mock vive en 55473 y la app en 3217; usar origen canónico `http://localhost:3217`.
Next 16 normaliza 127.0.0.1 a localhost en Proxy: mezclar ambos produjo un segundo
salto HTTP en rewrite y perdió los headers de tenant al sanearlos. Se diagnosticó
con logs locales y se unifica el origen del harness y `next start -H localhost`;
no se reabre la confianza en
headers que puede enviar un visitante. Verificar esta restricción al cambiar harness.

Pase final sobre el código entregado, 2026-09-06:

| Comprobación | Resultado y límite |
|---|---|
| `test:unit` | 83/83, 16 suites, sin skips. |
| `lint` | Correcto, exit 0. |
| `tsc --noEmit` | Correcto, exit 0. |
| Build de `test:e2e:audit` | Correcto; 30 páginas estáticas generadas y rutas dinámicas del inventario. Artefacto configurado para local, no desplegar. |
| Runner `playwright.audit.config.ts` | 7/7 en Chromium, 9,9 s; HTTP 401/403/200/404, identidad, alumno invitado, editor y subida local. |
| Consola de la suite | Sin errores inesperados ni pageerror. Solo 409 exacto de processing simulado admitido para su URL y test, con estado loading comprobado; no filtro global de errores. |
| Runtime Next | Dos logs `destination stream closed early`; A17 sigue pendiente aunque las aserciones de UI/HTTP pasan. |
| E2E heredado `playwright test --list` | Rechazado antes de arrancar: falta URL Supabase local. Resultado esperado de la guardia, no regresión integrada aprobada. |
| Git secrets | 27 commits, 688 blobs y 311 archivos del worktree; ninguna coincidencia de patrones conocidos. |
| `git diff --check` | Correcto. |
| Artefactos `.next/static` | 0 source maps públicos; 38 chunks JS, 2.934.829 bytes sin comprimir en total, no todos se descargan en cada ruta. |
| SQL preparado | Revisión estática por quality_reviewer; sin ejecución en Postgres. Bloqueo de rollout explícito. |

Evidencia visual versionada en [evidencias/2026-09-06](evidencias/2026-09-06/README.md).
Se utilizó además **Playwright CLI oficial 0.1.19** para navegación, snapshot,
screenshot, consola y peticiones de landing. Medición única local (sin throttling):
TTFB 123 ms, DOMContentLoaded 178,3 ms, load 221,6 ms; viewport 375 y scrollWidth 375.
Recursos y duración en `cli-metrics.txt`. No son CWV de campo ni mediciones de Mux/BD
reales. Consola de landing: 0 errores/0 avisos; peticiones observadas solo loopback.
HTTP adicional de CLI confirma CSP/nosniff, noindex de perfil y playback anónimo
401 con `private, no-store`. El perfil devuelve documento 200 por streaming;
no se presenta como redirección HTTP 3xx comprobada.

Incidencias de comprobación: el 404 intencional inicialmente se trató como error
de consola en el harness, corregido a comprobación HTTP. Hubo fallos de aula hasta
diagnosticar la normalización de origen; no se eliminó la comprobación de acceso.
Los logs de Next «destination stream closed early» coinciden con navegación entre
rutas y se reprodujeron en el pase final; siguen pendientes según A17.

El guard bloquea `fetch` de runtime y tráfico del navegador fuera de loopback,
pero no es aislamiento de red del sistema operativo. El build conserva salida para
fuentes de Next y recibe claves vacías/sintéticas aunque Next liste `.env.local`.
El E2E heredado no se ejecutó contra datos reales: la guardia lo debe rechazar.

Secretos: 27 commits y 688 blobs revisados con patrones privilegiados conocidos,
sin coincidencias. Informe redactado, no valores; heurística no cubre secretos
arbitrarios, archivos ignorados ni logs/artefactos de otros servicios. No se rotaron
claves ni se reescribió historia.

Herramientas: Context7 no disponible en el catálogo consultado; se usaron docs
oficiales y Next instalado. Docker, psql, Supabase CLI y ffmpeg no estaban en PATH;
no se instaló un servidor ni se restauró una BD. Strix no se ejecutó: falta entorno
aislado/proveedor/coste autorizado; revisión estática y navegador son alternativas,
no sustitutos de la prueba SQL o de un pentest. No se escanearon proveedores.

## Fuentes externas que fundamentan decisiones

- Mux: [secure playback y expiración](https://www.mux.com/docs/guides/secure-video-playback);
  límite de 12 h en SDK oficial instalado `resources/video/assets.d.ts` (`duration`).
  La UI no anuncia una subida real de 12 h certificada; 24 h es validez de URL.
- [Advisory Tiptap](https://github.com/ueberdosis/tiptap/security/advisories/GHSA-cp6q-959q-f8rh):
  corregido en 3.30.4; el vector descrito depende de atributos personalizados no confiables,
  no se afirma explotación de todos los esquemas estándar de esta app.
- [Advisory Browserslist](https://github.com/browserslist/browserslist/security/advisories/GHSA-c83g-rgw3-j3cx).
- AEPD, BOE, RGPD y AEAT: enlaces y aplicación concreta en
  [borrador legal](legal-privacidad-borrador.md). El 21 % no se toma como regla universal.

## Siguiente lote exacto y criterios de cierre

1. **Dependencias**: actualizar coordinadamente Tiptap y todas sus extensiones a
   una línea compatible corregida, y Browserslist por su dependencia padre. Guardar
   lock, inspeccionar peer graph, ejecutar sanitización/editor, unit/lint/TSC/build y
   suite local. No usar force ni aceptar downgrade que oculte el advisory.
2. **Baseline aislada**: recuperar SQL original de las tres migraciones ausentes
   mediante lectura autorizada; comparar tablas, RLS, grants, funciones y triggers.
   Versionar baseline sin PII y arrancar Postgres/Supabase local con fixtures A/B.
   No aplicar `db push/reset` al proyecto real.
3. **Invariantes**: aplicar allí `20260906213000`, ejecutar dos conexiones que
   compitan guardado/webhook y probar rollback; duration 0/null/NaN/>43200, ready
   sin playback y processing deben rechazar y conservar lección/asset previo;
   43200 exactos debe permitir. Probar RPC OTP 5 intentos concurrentes, única emisión,
   rate limits y grants anon/auth/service_role. Preparar protección del último owner
   y privilegiado con migración separada y pruebas de cascadas/recuperación.
4. **A/B y negocio**: extender E2E heredado contra esa BD: todos los roles, perfil
   multiescuela, invitaciones, suspensión, compra por curso, Run as y manipulación
   directa de IDs/columnas/RPC. Después cerrar modelo de reembolsos Connect y eventos
   atrasados con Stripe test/fakes firmados, sin cobros reales.
5. **UX/legal/operación**: preservar borradores/foco/índice móvil, iframes permitidos
   y privacidad real por red, datos fiscales y textos públicos revisados, canonical/
   sitemap filtrado. Planificar archivo/entorno/presupuesto para Mux largo y recuperación
   de red; no generar una carga facturable para marcar un checklist.

Para un eventual paso externo: preparar diff validado, impacto, orden de despliegue,
rollback y evidencia aislada, y solicitar solo ese paso. Este encargo no lo autoriza.
