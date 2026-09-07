# Delunivo

Delunivo es una plataforma SaaS multi-tenant para crear, vender y entregar
cursos online. Cada organización dispone de portal y marca propios, gestión de
alumnos, pagos directos mediante Stripe Connect y vídeo protegido con Mux.

Producción canónica: [https://www.delunivo.com](https://www.delunivo.com).
`https://delunivo.com` redirige a `www`; `delunivo.vercel.app` es únicamente la
URL técnica de compatibilidad.

## Desarrollo local

Requisitos: Node.js 24.x y npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

La aplicación se sirve en `http://localhost:3000`. No guardes secretos reales
en el repositorio. El esquema vive en Supabase; no hay Prisma ni una base local
implícita.

## Verificación

```bash
npm run test:unit
npm run lint
npx tsc --noEmit
npm run build
```

La regresión de auditoría usa Next y Chromium reales con Supabase simulado en
loopback. Durante las pruebas se bloquean las solicitudes externas del navegador
y del `fetch` de servidor. El build permite descargar las fuentes de Next;
las variables de integraciones se sustituyen por valores sintéticos o vacíos.
Este control no es un cortafuegos del sistema operativo:

```bash
npx playwright install chromium
npm run test:e2e:audit
```

Usa `http://localhost:3217` y el mock en el puerto 55473, datos ficticios y claves efímeras. El build de esa
suite contiene configuración local: **no usarlo para desplegar**. No prueba RLS,
Stripe ni Mux reales.

`npm run test:e2e` conserva la suite de integración con base de datos. Exige
Supabase en loopback, contenido sintético previamente comprobado,
`E2E_DATA_POLICY=synthetic-only` y las variables de `.env.e2e.local`. Rechaza
cloud, claves live y credenciales Mux/Resend. El workflow aislado reconstruye el esquema desde las migraciones versionadas;
no utiliza secretos ni datos de producción.

La cobertura y el siguiente lote están en `docs/auditoria-profesional.md`.

```bash
node scripts/seed-e2e-users.mjs
npm run test:e2e
```

Durante E2E, usa `EMAIL_DELIVERY_MODE=off` y `MUX_DELETION_MODE=off` para no
enviar correos ni borrar recursos externos reales.

El repositorio incluye una migración base sin datos reales. Una rama vacía de
Supabase puede reconstruir todo el esquema aplicando `supabase/migrations/` en
orden; no hay que clonar producción.

## Producción

Antes de desplegar:

1. Ejecuta unitarios, lint, TypeScript, build y E2E sobre infraestructura de prueba.
2. Aplica y verifica las migraciones pendientes de `supabase/migrations/`.
3. Configura todas las variables de `.env.example`, incluidos los datos legales.
4. Comprueba webhooks y secretos por entorno en Vercel, Stripe, Mux y Resend.
5. Verifica el flujo completo en Preview antes de promoverlo a producción.

El despliegue no se hace automáticamente desde este documento ni desde una
auditoría local.

## Documentación

- [Estado del proyecto](docs/project-status.md)
- [Esquema y seguridad de Supabase](docs/database.md)
- [Guía funcional](docs/guia-para-explicar.md)
