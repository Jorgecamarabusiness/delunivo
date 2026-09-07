# Matriz de controles de la guía común

Actualizada: 2026-09-07 tras el rollout. **Cerrado** es evidencia acotada, no certificación; **parcial** mantiene una limitación concreta. El esquema, el código y la configuración coordinada están desplegados y comprobados en Production.

| ID | Control | Estado | Evidencia y siguiente control |
|---|---|---|---|
| G01 | Contraste | Parcial | Tokens y contraste de marca en código; falta barrido visual por marcas/estados. |
| G02 | Alt text | Cerrado local | A14 añadió nombre y alt al insertar; falta revisar contenido real. |
| G03 | Accesibilidad | Parcial | A14 corrige foco del índice; faltan lector de pantalla, zoom y todas las rutas. |
| G04 | Teclado en formularios | Parcial | Borrador/descarte en editor; falta recorrido E2E completo. |
| G05 | Botones claros | Parcial | Componentes recientes son explícitos; falta inventario por rol. |
| G06 | Estados y móvil | Parcial | Nueve E2E y capturas 375/768/1440 de borrado, ficha legal, panel, cuentas y subida; faltan todas las combinaciones de estados/roles. |
| G07 | Vídeo accesible | Pendiente | Faltan subtítulos, transcripción y evaluación docente. |
| G08 | Métricas no ficticias | Parcial | Sin defaults engañosos; revisar contenido de vendedores. |
| G09 | Claims verificables | Parcial | Copy endurecido; quedan emails y contenido comercial. |
| G10 | Hero/copy | Parcial | Portada explica producto; falta validación editorial. |
| G11 | Gradientes/pills | Cerrado por decisión | Se conservan tokens e identidad existente. |
| G12 | Iconos emoji | Parcial | SVG existente; falta inventario de targets. |
| G13 | Rayas largas | No requiere cambio | Sin riesgo técnico que justifique refactor editorial. |
| G14 | Movimiento/scroll | Cerrado local | prefers-reduced-motion reduce transiciones/animaciones y evita scroll animado; comprobado en navegador. |
| G15 | Recursos inventados | Parcial | No se añadieron; procedencia del contenido existente pendiente. |
| G16 | Copyright/embeds | Parcial | Allowlist YouTube/Vimeo con clic; licencias reales pendientes. |
| G17 | Defaults | Parcial | Branding recuperado; quedan placeholders/contenido de escuelas. |
| G18 | Calidad percibida | Parcial | Revisión UI aplicada; sin prueba con usuarios reales. |
| G19 | Privacidad | Parcial | Ruta, enlaces, identidad configurada y borrado se comprobaron en Production; queda revisión jurídica y del inventario completo de tratamientos. |
| G20 | Condiciones | Parcial | Ruta, compra, ficha vendedora y justificante están desplegados; cada vendedor debe completar y revisar sus condiciones. |
| G21 | Datos empresariales | Parcial | Identidad de plataforma comprobada en runtime y ficha configurable por escuela; no se inventan los datos aún no publicados por Sata. |
| G22 | Cookies/tracking | Parcial | La política y las cargas con clic están desplegadas; falta inventario periódico de red y proveedores. |
| G23 | Consentimiento | Pendiente | Falta información por finalidad cuando aplique. |
| G24 | Minimización/retención | Parcial | Borrado, conservación mínima, purga, backup y recuperación están desplegados/probados; falta observar la ejecución calendarizada real. |
| G25 | Leyes aplicables | Parcial documental | Requiere revisión jurídica/fiscal concreta. |
| G26 | Contenido digital | Parcial | Snapshot inmutable y descarga están desplegados y pasan SQL/runtime; queda revisión jurídica del consentimiento y desistimiento. |
| G27 | Responsabilidad legal | Pendiente | Modelo documentado no es calificación jurídica. |
| G28 | Secretos | Parcial | Escaneo limpio, ocho secretos temporales retirados, token Mux revocado y runtime sin secretos públicos detectados; no prueba valores arbitrarios. |
| G29 | Historial secretos | Parcial | Escaneo y limpieza no dejan remanentes detectados; no cubren valores arbitrarios, servicios externos ni futuros commits. |
| G30 | RLS | Cerrado acotado | SQL/RLS/Auth/PostgREST pasan en aislado; migraciones aplicadas y sesión existente revalidada. Advisor conserva RPC autenticadas intencionadas. |
| G31 | Auth servidor | Parcial | CI y borrado app real pasan; falta cobertura integral. |
| G32 | Tampering | Cerrado acotado | Servidor, RPC, carreras y estados obsoletos se probaron en aislado; no equivale a pentest total. |
| G33 | Supabase | Cerrado acotado | Esquema restaurado, siete migraciones atómicas aplicadas, ledger alineado y agregados productivos comparados. |
| G34 | Cookies/passwords | Parcial | OTP/concurrencia/política pasan y la sesión productiva sobrevivió al rollout; no se forzó un cambio de contraseña real. |
| G35 | Cifrado | Parcial | Código revisado; rotación/proveedores no ensayados. |
| G36 | Rate limit | Parcial | OTP limita; faltan cuotas distribuidas. |
| G37 | SQL parametrizado | Cerrado acotado | Superficie revisada sin concatenación; no pentest total. |
| G38 | Validar/escapar | Parcial | Sanitización/allowlist pasan; falta contenido real. |
| G39 | Subidas | Parcial | Lifecycle, reservas, cuotas y Mux real se comprobaron; faltan antivirus y una subida real del máximo de 12 horas. |
| G40 | Respuestas API | Parcial | Nuevas acciones genéricas; herencia pendiente. |
| G41 | Cabeceras/HTTPS | Cerrado acotado | HTTPS, HSTS, CSP, nosniff y denegación de framing comprobados en las rutas desplegadas. |
| G42 | Dependencias | Cerrado acotado | Baseline 21, `npm audit` 0, Tiptap 3.31.3. |
| G43 | Integraciones | Cerrado acotado | Stripe LIVE conserva endpoints activos y Connect escucha 11 eventos; Mux respaldado y token temporal revocado. No se generaron eventos reales para probar. |
| G44 | Durabilidad | Cerrado acotado | Restore verificó 54 tablas/1.446 filas, FK, secuencias y migraciones; Storage 11 objetos y Mux 30 assets se recuperaron/verificaron en aislado. |
| G45 | Titles/descriptions | Parcial | A16 cubre escuela/curso; falta resto de pantallas. |
| G46 | Fuentes de página | Cerrado acotado | Render servidor y contenido público comprobados en Production para portada, cursos y legales. |
| G47 | Canonical/sitemap/robots | Cerrado acotado | Sitemap y robots responden 200 en Production; canónicos y noindex se cubren en pruebas enfocadas. |
| G48 | 404/enlaces | Cerrado en rutas probadas | Inexistentes 404; borradores sin título ni acceso y noindex incluso en HTTP200 por streaming documentado de Next. |
| G49 | Schema | Pendiente | Sin datos estructurados ni ratings inventados. |
| G50 | LocalBusiness | No aplica | SaaS sin entidad local pública verificada. |
| G51 | Social cards | Parcial | OG por escuela/curso; falta preview productivo. |
| G52 | llms.txt | No aplica | No es requisito actual. |
| G53 | Runtime errors | Cerrado acotado | Vercel no registró errores de runtime en las dos horas del rollout y las rutas ejercitadas respondieron como se esperaba. |
| G54 | Sourcemaps | Parcial | Local revisado; política productiva pendiente. |
| G55 | Rendimiento | Pendiente | Sin CWV de campo ni perfiles por rol. |
| G56 | Operación | Cerrado acotado | Backup/restore, migración atómica, merge, deploy, alias, Stripe y observación de runtime verificados. El rollback no se ejecutó contra producción. |
| G57 | Evitar errores | Parcial | Pruebas y revisión; no se promete ausencia de fallos. |

## Evidencia disponible

- `817d4ff`: lint y 111 unitarias pasaron. `33a0687` solo ajusta el selector E2E de filas responsive.
- `0233c75`: build y 8 E2E audit pasaron; los pases posteriores a `networkidle` no reprodujeron el cierre de stream.
- CI general `34104247692` y CI aislada `34104244104`: éxito sobre `33a0687`, incluidos los cinco E2E reales y nueve de auditoría. El merge `5f6b268` volvió a pasar CI en `34107540208`.
- App real: borrado propio y por superadmin pasó. Los selectores de acceso gratuito se corrigieron antes de la CI actual.
- Restore final `34105664809`, job `101689975903`: 54 tablas, 1.446 filas, FK/secuencias y siete migraciones atómicas. Se eliminaron ocho secretos temporales. Storage y los 30 assets Mux se recuperaron y verificaron en aislado.
- Production: `dpl_CFQmPMKnSiCdKoaviGoUHZ8mrY4c` está `READY`; portada, gratuitos, pagados, legales, borrado, gestión global y playback se comprobaron sin mutaciones reales. Vercel no mostró errores de runtime posteriores.

## Siguiente lote

Completar los controles editoriales y humanos que no bloquean el rollout: datos y condiciones de cada vendedor, revisión jurídica/fiscal antes de ampliar mercados, subtítulos/transcripciones, lector de pantalla/zoom, CWV de campo, antivirus y observación del primer ciclo real de retención y de eventos Stripe. No se deben provocar cobros, disputas o borrados reales para cerrar esos controles.
