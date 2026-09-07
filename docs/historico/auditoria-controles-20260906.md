# Matriz completa de la guía común

Fecha: 2026-09-06. Fuente leída: `C:/Users/jorge/Documents/Jorge-Conocimiento/Guias/Desarrollo-profesional.md`. Sus **57 controles** se evalúan individualmente. El informe principal conserva resultados, lotes y comandos.

**Parcial** significa que existe evidencia concreta, pero falta cobertura: código, simulación y producción son evidencias distintas. No hay aprobación global de seguridad, accesibilidad ni cumplimiento. Salvo excepciones justificadas, todos aplican al SaaS comercial, su contenido o su proceso de ingeniería.

| ID | Control de la guía | Aplicabilidad / estado | Prioridad | Evidencia y acción pendiente |
|---|---|---|---|---|
| G01 | Contraste | Sí; corregido local, cobertura parcial | P1 | `brandColor.ts` compara ratios; negro puro para gris intermedio; unitarios. Falta barrido de marca/errores/hover en todas rutas. |
| G02 | Alt text | Sí; parcial | P2 | CourseCard usa título; RichTextEditor no pide alt al insertar. Revisar imágenes reales, decorativas y logos. |
| G03 | Accesibilidad | Sí; parcial | P1 | `lang=es`, primitivas; índice móvil del aula sigue tabulable cerrado y editor sin nombre/foco. Falta lector de pantalla y zoom/reflow. |
| G04 | Formularios de teclado | Sí; parcial | P1 | ConfirmDialog controla foco/Escape; AddContentPanel/edición no detectan borradores. Probar navegación completa y descarte. |
| G05 | Botones claros | Sí; parcial | P2 | Button compartido, Mux distingue procesar/guardar/reintentar. Revisar confirmaciones destructivas de todos los roles. |
| G06 | Estados y móvil | Sí; parcial | P1 | Capturas/E2E locales del lote. No equivalen a verificar facturación, plataforma, usuarios y todos estados normal/loading/vacío/error/sin permisos. |
| G07 | Vídeo accesible | Sí; pendiente | P1 | Estados Mux anunciados; controles de tercero. No flujo completo de subtítulos/transcripción ni evaluación del material docente. |
| G08 | No fake reviews/metrics/counters | Sí; corregido local, parcial | P1 | Eliminado “cientos” por defecto en getCurrentOrganization y BrandingForm. Las plantillas guardadas/contenido real no se reescribieron: revisión editorial pendiente. |
| G09 | Unsupported claims | Sí; corregido local, parcial | P1 | DelunivoLanding deja de prometer vídeos imposibles de descargar/compartir. Revisar emails y contenido sanitario/económico real. |
| G10 | Hero/copy | Sí; parcial | P2 | Portada explica crear/vender cursos y siguiente acción. Pendiente activación con Sata y revisión de emails. |
| G11 | Purple gradients/pill buttons | Sí; decisión aplicada | P3 | Se conservan tokens/radios de globals.css y Button: ninguna prohibición por moda ni rediseño general. |
| G12 | Emoji icons | Sí; parcial | P3 | Sistema SVG existente. Pendiente inventario completo de nombres/targets; no prohibición de emojis en contenido del autor. |
| G13 | Em dashes | No requiere cambio | P3 | Decisión editorial sin fallo técnico demostrado; no se refactoriza puntuación masivamente. |
| G14 | Scroll/cursor animations | Sí; pendiente | P2 | Cursores convencionales en globals.css. Falta verificar reduced-motion, animaciones y scroll en toda la aplicación. |
| G15 | No AI images/no AI copy | Sí; decisión aplicada | P3 | Sin imágenes ni avales inventados en este lote; texto revisado. Procedencia del contenido existente pendiente. |
| G16 | Copyright/embeds | Sí; fallo/parcial | P1 | VideoBlock/embedUrl permiten terceros no inventariados. Fixture Sintel atribuida. Licencias de recursos reales y clasificación de embeds pendientes. |
| G17 | Made with AI/defaults | Sí; parcial | P2 | brand.ts, icon.tsx y manifest propios. `admin/page` aún dice “Próximamente”; revisar placeholders restantes. |
| G18 | “Que no parezca vibe coded” | Sí; parcial | P2 | Estados/copy/seguridad mejorados con revisión. No es una certificación visual; faltan usuarios reales. |
| G19 | Privacy policy | Sí; fallo, borrador preparado | P1 | No hay ruta de privacidad. `legal-privacidad-borrador.md` prepara tratamientos/datos faltantes; pendiente validación y publicación autorizada. |
| G20 | Términos/condiciones | Sí; fallo, borrador preparado | P1 | Sin condiciones públicas completas. Se preservan compra por curso, precios, descuentos y derechos; falta definir vendedor/contrato. |
| G21 | Real business details | Sí; pendiente | P1 | No se inventa razón social, NIF, domicilio, DPO ni certificaciones. Faltan datos autorizados de plataforma y escuelas. |
| G22 | Cookie policy/consent/tracking | Sí; pendiente | P1 | Código: auth, referidos, soporte, Mux e iframes; no píxel propio localizado. Red local no acredita cookies productivas. No banner decorativo. |
| G23 | Form consent | Sí; pendiente | P1 | Falta información por finalidad en registro/compra. No añadir aceptación genérica de privacidad ni marketing premarcado. |
| G24 | Only necessary data | Sí; pendiente | P1 | Perfiles/compras/progreso/soporte inventariados. No probados exportación, borrado, retención, backups ni logs reales. |
| G25 | Local laws | Sí; parcial documental | P1 | Fuentes AEPD/BOE/AEAT revisadas. España/UE comercial aplica; obligación concreta de accesibilidad depende de actividad/entidad/excepciones no verificadas. |
| G26 | Contenido digital de pago | Sí; fallo/pendiente | P1 | CTA sin flujo específico de inicio inmediato/confirmación duradera. No se elimina desistimiento ni se impone “sin reembolsos”. |
| G27 | Responsabilidad legal | Sí; borrador preparado | P1 | Documento interno con roles probables, condiciones y carencias; no publicado ni declarado conforme. |
| G28 | Hide API keys/public DB key | Sí; parcial | P1 | Wrappers server-only; claves publishable separadas. Guardias E2E nuevas. No inspeccionado bundle productivo autenticado para certificar ausencia de secretos. |
| G29 | Purge git secrets | Sí; verificado con límite | P1 | `audit-git-secrets.mjs`: 27 commits/688 blobs, cero patrones privilegiados conocidos. Heurística no cubre valores arbitrarios, archivos ignorados ni logs remotos. |
| G30 | RLS/lock record access | Sí; parcial | P1 | Cloud read-only: 25 tablas public con RLS, sin vistas. A/B de Next se prueba con mock; RLS real en base aislada sigue pendiente. |
| G31 | Auth server-side | Sí; corregido local/parcial | P1 | Helpers por rol y playback revalidan servidor. Códigos usan RPC atómica. Faltan E2E de todas acciones y ciclo Run as. |
| G32 | Block field tampering | Sí; parcial | P1 | Checkout calcula importe/cuenta en servidor; bloques/UUID/origen validados. Quedan último owner, caducidad arbitraria RPC y tampering completo. |
| G33 | Supabase especial | Sí; parcial | P1 | Advisors: 9 INFO server-only sin policies y 7 WARN definer. Revisados search_path/EXECUTE; drift de tres migraciones bloquea reproducibilidad. |
| G34 | Cookies/passwords | Sí; parcial | P1 | Supabase mantiene sesión; código de 6 dígitos/hash con RPC. Falta logout/expiración/recovery y atributos de cookies sobre entorno real aislado. |
| G35 | Encrypt sensitive data | Sí; parcial | P2 | impersonationCrypto usa AES-256-GCM para sesión original. Gestión/rotación de claves y cifrado de proveedores no ensayados. |
| G36 | Login rate limit/bots | Sí; parcial/fallo | P1 | Códigos serializados; límite global puede sufrir abuso. Upload limita por bloque, evadible con IDs distintos; faltan cuotas/rate limit distribuidos por actor/tenant. |
| G37 | Parameterized queries | Sí; verificado en superficie revisada | P2 | Cliente Supabase/RPC usa parámetros; no concatenación SQL de input localizada. No equivale a pentest exhaustivo. |
| G38 | Validate/escape | Sí; parcial | P1 | Unitarios sanitizeLessonHtml/bloques/duración/JSON pasan. Allowlist de iframes, contenido real y formatos de media pendientes. |
| G39 | Upload restrictions | Sí; corregido local/parcial | P1 | 20 GiB inclusivos en cliente/metadata, 43200 s en evento firmado. Bytes efectivos recibidos, pista de vídeo, cuotas/abuso y huérfanos pendientes. |
| G40 | Trim API responses | Sí; parcial | P2 | Auth falla con errores genéricos; playback check devuelve sólo authorized. Otras acciones aún devuelven error.message de BD. |
| G41 | Headers/HTTPS | Sí; corregido local/parcial | P2 | nosniff, Referrer-Policy, SAMEORIGIN, CSP parcial frame/object/base y API no-store. CSP completa, Permissions-Policy y HSTS según dominios pendientes. |
| G42 | Dependencias | Sí; fallo pendiente | P1 | npm audit: 28 moderate Tiptap y 1 high Browserslist. Intento acotado tuvo conflictos peer; lock original restaurado con npm ci, sin force. Lote dedicado pendiente. |
| G43 | Integraciones | Sí; parcial/fallo | P1 | Firmas, idempotencia y claims revisados/unitarios. Connect no tramita refunds; account.updated no ordena eventos. Stripe test real y cron pendientes. |
| G44 | Datos duraderos | Sí; fallo/pendiente | P1 | RESTRICT de compras, cola Mux y RPC códigos presentes. Baseline incompleta, último owner y única cuenta superadmin sin protección privilegiada; restauración no ensayada. |
| G45 | Titles/descriptions/headings | Sí; parcial | P2 | Metadata de marca/plataforma. Faltan títulos/descripciones por entidad y jerarquías de todas pantallas. |
| G46 | Proper page sources | Sí; parcial | P2 | Server Components/build y navegador real local. No comprobados todos documentos y metadatos públicos. |
| G47 | Canonical/sitemap/robots | Sí; parcial/fallo | P2 | README alineado a www; X-Robots-Tag privado. Faltan canonical/sitemap público filtrado y robots. |
| G48 | 404/internal links/breadcrumbs | Sí; corregido local/parcial | P2 | notFound en ficha y recuperación compartida. Streaming puede entregar 200+noindex; falta comprobar todas URLs/enlaces y status antes del stream. |
| G49 | Structured data | Sí; pendiente | P3 | No Course/Organization fiel implementado; valorar según contenido público real, sin ratings inventados. |
| G50 | LocalBusiness | No aplica | P3 | SaaS de cursos online; estas páginas no describen una entidad local real. |
| G51 | Social share images | Sí; pendiente | P2 | OG raíz básico; sin imagen específica por escuela/curso. Excluir siempre datos privados. |
| G52 | llms.txt | No aplica al lote | P3 | Sin consumidor de documentación pública que lo requiera; no es requisito de Search ni seguridad. |
| G53 | Console/runtime errors | Sí; parcial | P1 | 7 E2E pasan sin errores inesperados de navegador; runtime Next registra dos cierres tempranos de stream, A17 pendiente. Faltan todos roles/estados. |
| G54 | Sourcemaps | Sí; parcial | P2 | productionBrowserSourceMaps no habilitado; 0 mapas en .next/static del build final. Política de carga privada a observabilidad pendiente. |
| G55 | Bundles/performance | Sí; medición local acotada | P2 | Build/navegador local; sin CWV de campo ni consultas reales por rol. Optimizar sólo tras medir cuellos de botella. |
| G56 | Operación profesional | Sí; parcial/fallo | P1 | CI/cron/documentación existentes. E2E heredada podía escribir producción; guardia añadida. Sin ensayo de backups/restauración/rollback/alertas. |
| G57 | “Make no mistakes” | Sí; decisión aplicada | P3 | Pruebas, revisión independiente, evidencias y límites explícitos. No se promete ausencia de errores ni preparación de producción. |
