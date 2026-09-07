# Matriz de controles de la guía común

Actualizada: 2026-09-07. **Cerrado** es evidencia acotada, no certificación; **parcial** mantiene una limitación concreta. Las migraciones de producción no están aplicadas y este lote no está desplegado.

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
| G19 | Privacidad | Parcial | Ruta pública, enlaces y aviso de identidad incompleta existen; variables legales configuradas, pero falta runtime, tratamientos y revisión jurídica. |
| G20 | Condiciones | Parcial | Rutas, enlace desde compra, ficha de vendedor y confirmación descargable existen; faltan runtime, textos de cada vendedor y revisión contractual. |
| G21 | Datos empresariales | Parcial | Plataforma lee identidad configurable y cada escuela puede publicar datos; no se fuerzan valores y falta comprobar producción. |
| G22 | Cookies/tracking | Pendiente | Inventario estático no prueba red productiva. |
| G23 | Consentimiento | Pendiente | Falta información por finalidad cuando aplique. |
| G24 | Minimización/retención | Parcial | Borrado, conservación mínima y purga operacional están implementados y probados en SQL/runtime; falta calendario, backups y cron en producción. |
| G25 | Leyes aplicables | Parcial documental | Requiere revisión jurídica/fiscal concreta. |
| G26 | Contenido digital | Parcial | Snapshot inmutable y descarga pasan SQL/runtime y CI; falta producción y revisión jurídica del consentimiento o de cualquier excepción al desistimiento. |
| G27 | Responsabilidad legal | Pendiente | Modelo documentado no es calificación jurídica. |
| G28 | Secretos | Parcial | Se eliminaron 8 secretos detectados y no quedan remanentes detectados; falta bundle/runtime productivo y proveedores. |
| G29 | Historial secretos | Parcial | Escaneo y limpieza no dejan remanentes detectados; no cubren valores arbitrarios, servicios externos ni futuros commits. |
| G30 | RLS | Parcial | SQL/RLS y runtime pasan CI; falta aplicar y verificar políticas en producción. |
| G31 | Auth servidor | Parcial | CI y borrado app real pasan; falta cobertura integral. |
| G32 | Tampering | Parcial | Flujos validan servidor; faltan RPC/producción completos. |
| G33 | Supabase | Parcial | SQL/runtime pasan en CI con esquema final restaurado; falta aplicar y comparar producción. |
| G34 | Cookies/passwords | Parcial | OTP/política pasan; falta runtime real. |
| G35 | Cifrado | Parcial | Código revisado; rotación/proveedores no ensayados. |
| G36 | Rate limit | Parcial | OTP limita; faltan cuotas distribuidas. |
| G37 | SQL parametrizado | Cerrado acotado | Superficie revisada sin concatenación; no pentest total. |
| G38 | Validar/escapar | Parcial | Sanitización/allowlist pasan; falta contenido real. |
| G39 | Subidas | Parcial | Lifecycle CI pasa; faltan cuotas, antivirus y Mux real. |
| G40 | Respuestas API | Parcial | Nuevas acciones genéricas; herencia pendiente. |
| G41 | Cabeceras/HTTPS | Parcial | Hardening local; falta respuesta desplegada. |
| G42 | Dependencias | Cerrado acotado | Baseline 21, `npm audit` 0, Tiptap 3.31.3. |
| G43 | Integraciones | Parcial | Sesión Stripe LIVE y endpoints Connect activos; faltan dos eventos Connect de refund/dispute. Backup Mux bloqueado por credencial. |
| G44 | Durabilidad | Parcial | Restore final verificó 54 tablas, 1.446 filas, FK y secuencias externas 0; faltan 27 assets Mux. |
| G45 | Titles/descriptions | Parcial | A16 cubre escuela/curso; falta resto de pantallas. |
| G46 | Fuentes de página | Parcial | Servidor/pruebas locales; falta producción. |
| G47 | Canonical/sitemap/robots | Cerrado local | A16 filtra público y bloquea privado; falta deploy. |
| G48 | 404/enlaces | Cerrado en rutas probadas | Inexistentes 404; borradores sin título ni acceso y noindex incluso en HTTP200 por streaming documentado de Next. |
| G49 | Schema | Pendiente | Sin datos estructurados ni ratings inventados. |
| G50 | LocalBusiness | No aplica | SaaS sin entidad local pública verificada. |
| G51 | Social cards | Parcial | OG por escuela/curso; falta preview productivo. |
| G52 | llms.txt | No aplica | No es requisito actual. |
| G53 | Runtime errors | Parcial | Tras `networkidle`, pases completos no reproducen cierre de stream ni silencian logs; falta runtime productivo. |
| G54 | Sourcemaps | Parcial | Local revisado; política productiva pendiente. |
| G55 | Rendimiento | Pendiente | Sin CWV de campo ni perfiles por rol. |
| G56 | Operación | Parcial | Restore final y limpieza de secretos verificados; faltan deploy, rollback y backup Mux. |
| G57 | Evitar errores | Parcial | Pruebas y revisión; no se promete ausencia de fallos. |

## Evidencia disponible

- `817d4ff`: lint y 111 unitarias pasaron. `33a0687` solo ajusta el selector E2E de filas responsive.
- `0233c75`: build y 8 E2E audit pasaron; los pases posteriores a `networkidle` no reprodujeron el cierre de stream.
- CI general `34104247692` y CI aislada `34104244104`: éxito sobre `33a0687`, incluidos los cinco E2E reales y nueve de auditoría. SQL/runtime también pasó en `d3e837b` (`34102906720`).
- App real: borrado propio y por superadmin pasó. Los selectores de acceso gratuito se corrigieron antes de la CI actual.
- Restore final de esquema `34103612710`, job `101683493178`: 54 tablas, 1.446 filas, FK y secuencias externas 0. Se eliminaron 8 secretos detectados y no quedan remanentes detectados. Quedan 27 assets Mux sin recuperar por falta de credencial de backup.

## Siguiente lote

Completar backup Mux; aplicar las migraciones compatibles, desplegar y comprobar producción con los eventos adicionales de reembolsos/disputas de Connect coordinados con el nuevo handler. Las CI finales ya pasan. La descarga contractual y los textos de vendedor ya pasan SQL/runtime; siguen pendientes de producción y de contenido/revisión de cada vendedor. Connect tiene dos eventos activos; esos dos eventos no son los pendientes.
