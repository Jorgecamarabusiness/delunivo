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

Los E2E crean y eliminan usuarios, organizaciones, cursos y accesos. Deben usar
un proyecto o rama de Supabase exclusivo para pruebas: **nunca el proyecto de
producción**. El seed se niega a ejecutar contra el project ref real, prepara
el tenant, el curso, las cuentas y un vídeo privado sintético, y escribe el
archivo ignorado `.env.e2e.local` sin pedir que se copien credenciales a mano.

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
