# AGENTS.md

## Propósito

Este repositorio contiene una plataforma de cursos online que debe servir primero a Iván Fernández (Sata) en producción. La posible evolución a SaaS no justifica retrasar ni complicar el producto inicial.

## Prioridad de producto

1. Entregar vertical slices completas y utilizables por Sata.
2. Conservar lo existente que sea correcto.
3. Mantener aislamiento de datos, seguridad y capacidad de migración.
4. No construir funcionalidades hipotéticas ni infraestructura compartida entre clientes.

## Stack y arquitectura

- Next.js 16 App Router, React 19, TypeScript y Tailwind CSS.
- Supabase: PostgreSQL, Auth y RLS.
- Vercel: aplicación y funciones de servidor.
- Mux: subida directa, procesamiento y streaming de vídeo largo.
- Resend: correo transaccional.
- Stripe y Whop: cobros e integraciones existentes.

La autorización vive en servidor y en RLS. Las páginas públicas resuelven la organización por `/o/<slug>`; el panel `/admin` resuelve la organización por membership del usuario.

## Estructura relevante

- `src/app`: páginas, route handlers y server actions.
- `src/components`: UI y editor de contenido.
- `src/lib/auth`: autenticación y autorización.
- `src/lib/supabase`: clientes browser/server/admin.
- `src/lib/organizations`: resolución y permisos de organización.
- `src/lib/stripe`, `src/lib/whop`, `src/lib/email`: integraciones externas.
- `e2e`: pruebas Playwright.
- `supabase/migrations`: fuente versionada de cambios de esquema.
- `docs`: arquitectura, operación y contexto verificable.

## Entorno y comandos

Usar Node.js 24.x y `npm`; no mezclar gestores de paquetes.

```bash
npm ci
npm run dev
npm run lint
npm run test:unit
npm run test:e2e
npm run build
```

## Reglas de implementación

- Hacer el cambio mínimo que resuelva correctamente el requisito.
- No introducir dependencias, abstracciones ni refactors no relacionados.
- No confiar en IDs de organización, curso, lección o usuario enviados por el cliente: verificar su relación en servidor.
- Toda mutación administrativa debe pasar por `requireOrgAdmin`, `requireOwnerContext` o una comprobación equivalente.
- `SUPABASE_SERVICE_ROLE_KEY` y cualquier secreto solo pueden usarse en código de servidor.
- Toda tabla expuesta debe tener RLS y políticas revisadas; no usar `user_metadata` para autorización.
- Todo cambio de esquema debe quedar en una migración versionada y tener rollback documentado. No aplicar SQL manual sin reflejarlo en el repositorio.
- Los webhooks deben verificar la firma sobre el cuerpo sin modificar y ser idempotentes.
- Los vídeos largos nunca deben atravesar Vercel ni guardarse como blob principal en Supabase Storage: el navegador sube directamente a Mux mediante Direct Upload.
- El playback privado de Mux debe usar IDs `signed` y tokens generados en servidor después de comprobar acceso.
- Mantener compatibilidad de lectura con vídeos heredados mientras existan; no crear nuevos vídeos largos con el flujo legado.
- No introducir secretos, credenciales, datos personales reales ni archivos de vídeo en Git.

## Pruebas y revisión

Antes de considerar terminado un cambio:

1. Ejecutar lint, unit tests, typecheck/build y pruebas afectadas.
2. Para UI, comprobar normal, loading, vacío, error, responsive y estados deshabilitados.
3. Para auth, pagos, permisos, webhooks o migraciones, añadir pruebas negativas y de aislamiento.
4. Revisar el diff completo y comprobar que no incluye archivos ni cambios ajenos.
5. Documentar verificación, rollback y riesgo residual.

## Operaciones externas

No fusionar a `main`, desplegar a producción, aplicar migraciones productivas, borrar datos, rotar secretos ni cambiar planes/cuentas sin una aprobación explícita cuando la acción sea material o difícil de revertir. Los cambios deben prepararse y validarse primero en una rama y en Preview.

## Definición de terminado

Una tarea está terminada cuando el flujo funciona de extremo a extremo, los permisos fallan de forma segura, las pruebas relevantes pasan, el despliegue de Preview es verificable, la documentación estable queda actualizada y existe una ruta clara de rollback.
