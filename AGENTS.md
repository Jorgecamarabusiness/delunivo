<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Delunivo

Delunivo es una plataforma SaaS multi-tenant para crear, vender y consumir cursos. La primera organizacion real es Ivan Organico, pero cada organizacion debe permanecer aislada en datos, permisos, marca, cursos, alumnos y cobros.

## Acuerdo de trabajo con Jorge

- Si la tarea es codigo y el alcance esta claro, implementala directamente y verifica el resultado.
- Si requiere un dashboard, una cuenta, un secreto, un pago, DNS, produccion o cualquier paso externo, guia a Jorge con un solo paso concreto cada vez: indica donde entrar, que cambiar, que deberia ver y espera su confirmacion antes de depender de ese cambio.
- No afirmes que una accion manual o externa esta completada sin evidencia.
- Pide aclaracion solo cuando la respuesta cambie materialmente el producto, pueda causar perdida de datos o requiera nueva autorizacion.
- Al terminar, responde de forma concisa: resultado general, verificaciones ejecutadas y siguiente paso o recomendacion. No pegues logs completos salvo que expliquen un fallo.

## Principios de ingenieria

- YAGNI: construye solo lo necesario para el problema actual. No prepares extensibilidad hipotetica.
- Reutiliza primero `src/components/ui`, `src/components/layout` y los helpers existentes en `src/lib`.
- Extrae una primitiva cuando represente un patron real repetido; no abstraigas una pantalla unica por anticipado.
- Mantiene una sola fuente de verdad: identidad de plataforma en `src/lib/brand.ts`, tokens globales en `src/app/globals.css` y esquema documentado en `docs/database.md` junto con las migraciones versionadas que existan.
- Prefiere Server Components. Usa Client Components solo cuando haya estado, efectos o interaccion del navegador.
- Preserva los cambios no relacionados del worktree.
- Puedes crear commits y hacer pull o push cuando ayude a completar una tarea ya verificada. Revisa antes rama, remoto y worktree; no reescribas historia compartida ni uses force push. Un deploy sigue requiriendo peticion explicita.

## Seguridad multi-tenant

- Toda lectura o mutacion privada debe demostrar la organizacion y el rol del usuario.
- Usa los helpers actuales de membership y autorizacion; no recuperes el antiguo patron global `profiles.is_admin`.
- Filtra por `organization_id` incluso cuando RLS permita lecturas publicas necesarias para el catalogo.
- Las claves privilegiadas y secretos solo pueden usarse en servidor. Nunca los expongas mediante variables `NEXT_PUBLIC_*`.
- Antes de cambiar Supabase o un servicio externo, usa la skill de proyecto correspondiente.

## UI, reutilizacion y responsive

- Usa la skill `delunivo-ui-system` para cambios visibles o de componentes.
- Respeta los tokens CSS y el color de marca dinamico por organizacion.
- Disena mobile-first y verifica, como minimo, movil estrecho, tablet y escritorio.
- No introduzcas un rediseño general durante una tarea localizada.

## Orquestacion

- El hilo principal es el agente maestro: define alcance, integra cambios y entrega el resultado.
- Para tareas pequenas usa un solo agente.
- Delega exploracion solo si el flujo es grande o desconocido.
- Tras crear una pantalla, cambiar layout o navegacion, o hacer un cambio visual amplio, delega una revision a `ui_reviewer`. No es necesario para copy o ajustes visuales triviales.
- Tras migraciones, RLS, autenticacion, aislamiento multi-tenant, pagos, webhooks o integraciones externas, delega una revision a `quality_reviewer`.
- Los revisores son read-only: el agente maestro ejecuta servidor y pruebas y les facilita diff, rutas, capturas o resultados necesarios. Evita varios agentes escribiendo a la vez; si delegas implementacion, usa un unico escritor o conjuntos de archivos totalmente separados.
- El agente maestro valida los hallazgos antes de aplicarlos o comunicarlos.

## Verificacion

- Ejecuta la prueba mas pequena que detecte el fallo mientras implementas.
- Antes de cada entrega final que incluya cambios, vuelve a ejecutar las comprobaciones relevantes sobre el estado final. No declares listo un cambio con tests anteriores a la ultima modificacion.
- Para cambios amplios: unitarios, lint, TypeScript y build.
- Para UI: renderiza y revisa visualmente las rutas afectadas en movil y escritorio, incluida la consola.
- Para auth, tenancy, pagos o integraciones: anade o ejecuta E2E enfocados sin disparar operaciones externas reales.
- Si una comprobacion no puede ejecutarse, explica por que y cual es la siguiente mejor evidencia.

## Referencias

- Estado y decisiones vigentes: `docs/project-status.md`.
- Esquema y RLS: `docs/database.md` y `supabase/migrations/` cuando exista una migracion relacionada.
- Actualiza `docs/project-status.md` cuando cambien de forma duradera producto, arquitectura, integraciones, prioridades, decisiones o riesgos; no lo edites por ajustes pasajeros.
