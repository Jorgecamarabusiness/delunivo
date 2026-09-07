# Cierre de auditoría: registro de ejecución

Encargo vigente: `cierre-despliegue-y-funciones-delunivo.md` del contexto autorizado.
Sustituye la autorización limitada de la auditoría inicial. Se autorizan commits,
push, migraciones compatibles, respaldo privado y despliegue verificado. Nunca
se prueban borrados, cobros o reembolsos con cuentas/datos reales.

## Reconstrucción tras la interrupción

- Rama: `codex/audit-close-20260906`, remoto público `Jorgecamarabusiness/delunivo`.
- Se incorporó `origin/main` en `675705c` conservando identidad índigo, logos,
  enlaces editables de escuelas, páginas legales y endurecimiento de septiembre.
- El stash `codex audit close checkpoint before integrating verified remote
  2026-09-06` se conserva. No hay conflictos; los 78 archivos nuevos de ese
  checkpoint están presentes. Los tests RPC recuperados conviven con los tests
  de estados de verificación de producción.
- Dependencias actuales: Tiptap exacto 3.31.3 (familia deduplicada), Browserslist
  4.28.9; `npm ci --ignore-scripts` y `npm audit` correctos. No restaurar el lock antiguo.
- La baseline y sus 21 migraciones estaban en los commits remotos: el diagnóstico
  anterior de baseline ausente queda sustituido por esta evidencia.

## Lotes y evidencia

| Lote | Commit / evidencia | Estado real |
|---|---|---|
| Supabase aislado | `c2fd6ce`; [CI 34063424037](https://github.com/Jorgecamarabusiness/delunivo/actions/runs/34063424037) | Pasan reconstrucción PG17, restore sintético, RLS, Mux ready, OTP concurrente, Auth refresh y Storage A/B. No equivale a restaurar el backup privado real. |
| Lifecycle/free SQL | `4305ca3`; [CI 34095395235](https://github.com/Jorgecamarabusiness/delunivo/actions/runs/34095395235) | Pasan RPC/grants, gratuidad, JWT antiguo, cleanup y Auth delete sintético. No aplicada a producción. |
| Backend/UI integrado | `4cb2cb1`, `0233c75`, `817d4ff` | CI real completa borrado propio y por superadmin sintéticos; gratuidad también concede y entra al aula. Los fallos restantes de esas ejecuciones eran selectores y el HTTP 200 de notFound en streaming; se comprueban denegación, noindex y ausencia de título privado. |
| SQL operativo | `1c81693` y correcciones posteriores | Invitaciones ≤7 días, cuenta/expulsión/revocación, retención ejecutable y reservas de vídeo anteriores al SDK. Preparado y enviado a CI; todavía no aplicado. |
| Comprobaciones locales | `0233c75`: build/TypeScript, lint, 105 unitarios y ocho E2E de auditoría; `be37b3b`: lint y 114 unitarios | El cierre de stream dejó de reproducirse al esperar networkidle tras el login antes de la siguiente navegación del test. El código local de React RSC confirma que se emite al cerrar el destino. No se filtran logs ni excepciones. No acredita ausencia de cualquier fallo productivo. |
| Recuperación y vídeo | `817d4ff` | Cuatro unitarios verifican lease perdido, fallo/reintento de proveedor, Auth inexistente y orden Auth-last; lease renovable y peticiones privilegiadas con timeout. SQL de reservas sin ID, cola de rechazados y límites pasa en CI 34101067555. |
| Confirmación y ficha legal | `be37b3b` | Condiciones por escuela opcionales, copia de oferta inmutable y justificante descargable por titular. No se fabrican condiciones anteriores ni se afirma que el justificante incompleto satisface todos los requisitos contractuales. SQL y nuevo E2E registro/verificación enviados a CI. |
| Revisión de secretos | Escáner local: 42 commits, 1021 blobs y 413 archivos de trabajo | Cero patrones conocidos. No inspecciona secretos ignorados ni demuestra ausencia absoluta. |
| Cierre técnico aislado | `d3e837b`; [CI 34102906720](https://github.com/Jorgecamarabusiness/delunivo/actions/runs/34102906720) | **Todo correcto**: reconstrucción/migraciones, SQL/RLS, OTP concurrente, Auth, Storage, lifecycle y cinco E2E reales (gratis, expulsión/borrador, registro/verificación/retorno, autodelete, superadmin delete), incluida autorización del justificante. |
| Última UI | Cambio de tabla de cuentas sobre `d3e837b` | Build/TypeScript y nueve E2E de auditoría correctos, sin errores inesperados de navegador ni cierre de stream. Capturas 375/768/1440; correo/rol/CTA de cuentas visibles en móvil. |

La producción se volvió a consultar: Vercel `dpl_44yFMF2oHrYZYLQr7Q7BiKUosrfi`,
READY, Node24. El ledger real sigue en 21 migraciones, última
`20260902124822`. Ninguna migración nueva ni despliegue de este encargo se ha
ejecutado aún. `vercel.json` desactiva autodeploy solo para la rama de auditoría.

## Backups y operaciones externas de este lote

- Snapshot de BD real capturado el 2026-09-07 a las 07:33 UTC con cifrado
  OpenPGP dentro de Postgres; 56 tablas/1588 filas. No se imprimieron registros.
  Copia privada fuera del repositorio, protegida por ACL local.
- Storage: 11 archivos, 43.360.601 bytes respaldados cifrados. Descifrado y
  SHA-256 de cada objeto verificados. Esto prueba recuperación de bytes local,
  no su reimportación conjunta en Storage/Auth.
- Restore privado de BD **correcto**: [ejecución 34099275405](https://github.com/Jorgecamarabusiness/delunivo/actions/runs/34099275405),
  job `101669740041`. Se importaron 54 tablas/1446 filas con FK comprobadas y
  secuencias avanzadas. Las dos tablas de ledger de Auth/Storage se reconstruyen
  desde la versión del proveedor; el snapshot original conserva sus registros.
  Se corrigió el rol del contenedor (`supabase_admin`), sin cambiar producción.
  Los ocho secretos temporales de GitHub se retiraron y se verificó que quedan cero.
  El otro job de esa ejecución falló por una fixture SQL independiente; eso no
  invalida ni convierte el restore privado en un restore sintético.
- Mux: inventario de BD de 27 assets / 5241,829 segundos. El panel autenticado
  confirma crédito mensual de 20 USD, uso actual 0,01 USD y excedente 0.
  Las credenciales descargadas de Vercel son marcadores `[SENSITIVE]`, y el
  panel no habilita descarga de estos assets privados. Se solicitó únicamente
  confirmar una credencial temporal de vídeo para terminar el backup.
- `LEGAL_*` de **Production** actualizadas/verificadas contra los datos ya
  facilitados en el chat, sin copiarlos al repositorio. Todavía requieren el
  siguiente despliegue para que el runtime use la nueva configuración.
- Stripe: la credencial local utilizable es **TEST**, con un endpoint histórico.
  No se modificó. La pestaña de Stripe se abre en login; no hay sesión para
  verificar/ajustar los eventos LIVE de reembolsos y disputas. La configuración
  LIVE histórica figura documentada, pero no se da por revalidada en este lote.
- Recuperación de Git: 27 copias SQL históricas coinciden con el SQL activo al
  excluir formato/comentarios. Archivadas fuera de Git en ZIP privado, verificadas
  por SHA-256 individual antes de retirar los directorios duplicados. Stash intacto.
  Los tres informes originales se conservan íntegros en `docs/historico/`.

## Decisiones de implementación en revisión

- Identidad global: self o superadmin; no permiso global para profesores. El
  actor se obtiene de Auth y confirma su contraseña en cliente no persistente.
  La sesión temporal se revoca en servidor con `scope: local`.
- Postgres comprueba perfil activo y existencia de `auth.sessions` para el JWT.
  Las policies restrictivas se añaden a las de tenant; necesitan pruebas positivas
  y negativas con Auth real antes de aplicarse.
- La sucesión conserva escuelas, suscripción SaaS, Connect y medios. Los archivos
  sin asociación estructurada comprobable quedan en revisión y bloquean Auth delete.
- Una compra tardía de una identidad inactiva conserva recibo con UUID histórico,
  sin crear roster ni atribuir derechos a un nuevo registro con el mismo correo.
- Un reembolso íntegro o disputa perdida elimina solo la fuente de acceso pagada.
  Reembolso parcial y disputa abierta conservan acceso; invitación/gratuidad son
  fuentes independientes. No se emiten reembolsos automáticos.
- Gratis significa precio actual exactamente cero. Bloqueo de fila y unicidad
  impiden duplicados; se concilian checkouts antes de conceder. No se crean ventas
  ficticias, no se reactiva `removed` ni un grant revocado.
- El titular confirmó identidad/contacto publicables y modelo SaaS/escuelas en
  el chat. Se usarán variables `LEGAL_*`; este informe no copia esos datos.
  Cada escuela rellena su identidad vendedora; no se inventan datos de Sata.

## Revisión independiente

`closure_quality` identificó carreras de checkout, cobro a expulsados, consumidores
de compras sin estado, retorno de login con sesión y coincidencias débiles de
Storage. Se están integrando. Retiró expresamente el hallazgo sobre signOut local
tras contrastar el SDK. No presentar este primer pase como revisión final.

## Siguiente acción exacta

1. Resolver la pregunta pendiente de credencial temporal Mux; respaldar los 27
   assets de Production de forma privada y verificar recuperación de los bytes.
   No crear otra credencial mientras esa confirmación específica siga pendiente.
2. Recuperar sesión de Stripe LIVE para comprobar el endpoint Connect y añadir
   únicamente los eventos usados por el handler si faltan. No usar la clave TEST.
3. Confirmar CI del último commit de integración/documentación; `d3e837b` ya pasó
   todo el conjunto aislado. Mantener los controles editoriales/fiscales por escuela
   como limitaciones explícitas, y no anunciar 12 h/20 GiB como prueba real realizada.
4. Revalidar inventario/backup antes del rollout, aplicar las siete migraciones
   compatibles en orden, hacer deploy limpio con Production y verificar la URL
   pública, permisos, playback y logs sin borrados/cobros de prueba reales.

El rollout está detenido por cobertura de backup Mux y acceso de configuración
Stripe LIVE. No por falta de autorización para migrar/desplegar. Producción sigue
sin cambios de código ni esquema de este encargo. La configuración legal sí se
actualizó, como se detalla arriba. No se considera cerrada toda la auditoría ni
verificado producción mientras queden estos pasos y los controles de la matriz.

No reutilizar el build de auditoría (loopback/mocks) para desplegar.
