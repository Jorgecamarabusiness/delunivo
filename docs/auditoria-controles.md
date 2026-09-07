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
| G19 | Privacidad | Pendiente producción | Borrador sin rutas/textos finales ni tratamientos verificados. |
| G20 | Condiciones | Parcial | Ficha de vendedor local; faltan SQL, publicación y contrato SaaS. |
| G21 | Datos empresariales | Pendiente | No se inventan datos de plataforma ni vendedores. |
| G22 | Cookies/tracking | Pendiente | Inventario estático no prueba red productiva. |
| G23 | Consentimiento | Pendiente | Falta información por finalidad cuando aplique. |
| G24 | Minimización/retención | Parcial | Borrado diseñado; faltan producción, backups y plazos. |
| G25 | Leyes aplicables | Parcial documental | Requiere revisión jurídica/fiscal concreta. |
| G26 | Contenido digital | Pendiente | Descarga inmutable existe en código, pendiente SQL/CI. |
| G27 | Responsabilidad legal | Pendiente | Modelo documentado no es calificación jurídica. |
| G28 | Secretos | Parcial | CI pasa; falta inspección de bundle/runtime productivo. |
| G29 | Historial secretos | Parcial | Escaneo conocido pasa; no cubre todo valor/servicio. |
| G30 | RLS | Parcial | CI SQL/RLS pasa; migraciones no aplicadas. |
| G31 | Auth servidor | Parcial | CI y borrado app real pasan; falta cobertura integral. |
| G32 | Tampering | Parcial | Flujos validan servidor; faltan RPC/producción completos. |
| G33 | Supabase | Parcial | CI revisa migraciones; falta estado productivo. |
| G34 | Cookies/passwords | Parcial | OTP/política pasan; falta runtime real. |
| G35 | Cifrado | Parcial | Código revisado; rotación/proveedores no ensayados. |
| G36 | Rate limit | Parcial | OTP limita; faltan cuotas distribuidas. |
| G37 | SQL parametrizado | Cerrado acotado | Superficie revisada sin concatenación; no pentest total. |
| G38 | Validar/escapar | Parcial | Sanitización/allowlist pasan; falta contenido real. |
| G39 | Subidas | Parcial | Lifecycle CI pasa; faltan cuotas, antivirus y Mux real. |
| G40 | Respuestas API | Parcial | Nuevas acciones genéricas; herencia pendiente. |
| G41 | Cabeceras/HTTPS | Parcial | Hardening local; falta respuesta desplegada. |
| G42 | Dependencias | Cerrado acotado | Baseline 21, `npm audit` 0, Tiptap 3.31.3. |
| G43 | Integraciones | Parcial | Contratos revisados; backup Mux sin credencial. |
| G44 | Durabilidad | Parcial | Restore DB/Storage verificado; faltan 27 assets Mux. |
| G45 | Titles/descriptions | Parcial | A16 cubre escuela/curso; falta resto de pantallas. |
| G46 | Fuentes de página | Parcial | Servidor/pruebas locales; falta producción. |
| G47 | Canonical/sitemap/robots | Cerrado local | A16 filtra público y bloquea privado; falta deploy. |
| G48 | 404/enlaces | Cerrado en rutas probadas | Inexistentes 404; borradores sin título ni acceso y noindex incluso en HTTP200 por streaming documentado de Next. |
| G49 | Schema | Pendiente | Sin datos estructurados ni ratings inventados. |
| G50 | LocalBusiness | No aplica | SaaS sin entidad local pública verificada. |
| G51 | Social cards | Parcial | OG por escuela/curso; falta preview productivo. |
| G52 | llms.txt | No aplica | No es requisito actual. |
| G53 | Runtime errors | Parcial | RSC cerraba el destino al adelantar otra navegación de la prueba. Tras networkidle, pases completos sin reproducción y sin silenciar logs; falta runtime productivo. |
| G54 | Sourcemaps | Parcial | Local revisado; política productiva pendiente. |
| G55 | Rendimiento | Pendiente | Sin CWV de campo ni perfiles por rol. |
| G56 | Operación | Parcial | Restore privado verificado; falta deploy/rollback/Mux. |
| G57 | Evitar errores | Parcial | Pruebas y revisión; no se promete ausencia de fallos. |

## Evidencia disponible

- `817d4ff`: lint y 111 unitarias pasaron.
- `0233c75`: build y 8 E2E audit pasaron; no se considera resuelto el cierre temprano de stream tras `networkidle`.
- CI `34102906720`: todo correcto en `d3e837b`; SQL/RLS/OTP/Auth/Storage/lifecycle, contratos, referencias codificadas y cinco E2E reales con autorización de descarga.
- App real: borrado propio y por superadmin pasó. Dos selectores de acceso gratuito fallaban antes de la corrección de `817d4ff`.
- Restore privado `34099275405`, job `101669740041`: 54 tablas, 1.446 filas, FK y secuencias verificadas; Storage 11 objetos/43 MB con descifrado y SHA-256. Quedan 27 assets Mux sin recuperar por falta de credencial de backup.

## Siguiente lote

Terminar backup Mux y verificar eventos Stripe LIVE antes del rollout. SQL y descarga ya probados en la CI completa. Aplicar migraciones compatibles y desplegar solo con esos controles externos satisfechos.
