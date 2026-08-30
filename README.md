# Lernixa

Plataforma de cursos online preparada para llevar a producción la escuela de Iván Fernández (Sata). El objetivo inmediato es que Sata pueda crear cursos, subir vídeos reales, gestionar alumnos y ofrecer acceso privado de forma fiable. La posible evolución posterior a SaaS se mantiene abierta, pero no dirige el alcance actual.

> La producción todavía conserva parte del nombre anterior, Aularia. El cambio a Lernixa se prepara y valida primero en una rama; no se debe asumir completado hasta migrar Vercel, Supabase, Resend, Stripe y los textos externos.

## Estado actual

Ya existen:

- autenticación, verificación de correo y recuperación de contraseña;
- organizaciones, administradores y alumnos con RLS;
- creación y edición de cursos, módulos, lecciones y bloques de contenido;
- invitaciones, expulsión/reactivación y progreso del alumno;
- branding por organización;
- pagos con Stripe y validación de Whop;
- emails transaccionales con Resend;
- CI con lint, unit tests, build y Playwright;
- despliegue en Vercel y base de datos Supabase.

El flujo heredado de vídeo **no es apto para producción**: envía el archivo completo a una función de Vercel y lo guarda en Supabase Storage. Se mantiene únicamente como compatibilidad temporal. El siguiente vertical slice sustituye ese flujo por Direct Upload de Mux, webhooks y reproducción firmada.

## Stack

- Next.js 16 App Router
- React 19 y TypeScript
- Tailwind CSS 4
- Supabase PostgreSQL, Auth y RLS
- Vercel
- Mux Video
- Resend
- Stripe y Whop
- Playwright y Node test runner

## Requisitos

- Node.js 24.x
- npm
- un proyecto Supabase aislado para Sata;
- un proyecto Vercel aislado;
- un entorno Mux con Video API, webhook y signing key;
- una cuenta Resend;
- Stripe/Whop solo cuando el flujo correspondiente vaya a probarse.

## Instalación local

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Abrir `http://localhost:3000`. No usar secretos de producción para desarrollo local salvo una prueba controlada y explícita.

## Comandos

```bash
npm run dev        # desarrollo
npm run lint       # ESLint
npm run test:unit  # tests unitarios
npm run test:e2e   # Playwright
npm run test       # unit + e2e
npm run build      # build de producción y typecheck de Next
```

## Arquitectura

### Rutas

- `/`: landing de la plataforma mientras no se cierre el modo Sata-only.
- `/o/<slug>`: portal público de una organización.
- `/admin`: panel del administrador autenticado.
- `/api/webhooks/*`: entradas servidor-a-servidor verificadas por firma.

La organización pública se resuelve por la ruta. El panel administrativo no confía en la ruta, sino en la membership del usuario.

### Datos y permisos

Supabase conserva usuarios, organizaciones, cursos, secciones, lecciones, compras, progreso e invitaciones. RLS es una capa obligatoria, no un sustituto de las comprobaciones de autorización en servidor.

A partir de la preparación de producción, la fuente versionada del esquema debe ser `supabase/migrations/`. `docs/database.md` describe el modelo, pero no sustituye las migraciones ni debe ser la única fuente de verdad.

### Vídeo

Flujo objetivo:

1. un administrador autorizado solicita una Direct Upload URL;
2. el servidor crea un registro pendiente y una subida Mux con `passthrough` trazable;
3. el navegador sube directamente a Mux con progreso, reintentos y pausa/reanudación;
4. el webhook firmado actualiza upload, asset y playback ID;
5. Supabase conserva estado y metadatos, nunca el vídeo largo;
6. el alumno autorizado recibe un token de reproducción Mux generado en servidor;
7. Mux Player reproduce streaming adaptativo con playback `signed`.

El criterio inicial de aceptación es subir un vídeo real 1080p de 45–60 minutos, procesarlo, asociarlo a una lección y reproducirlo como alumno autorizado.

## Variables de entorno

La lista y comentarios están en `.env.example`. Nunca subir `.env.local`, claves privadas ni secretos al repositorio. En Vercel, separar Preview y Production; en GitHub Actions, usar Secrets.

## Migraciones

Para un cambio de esquema:

```bash
supabase migration new <nombre-descriptivo>
# editar el SQL generado
supabase db reset
supabase db advisors
supabase migration list --local
```

No aplicar una migración productiva desde una rama sin revisar el SQL, probar una base limpia, comprobar datos existentes y documentar rollback.

## Despliegue

- las ramas generan Preview Deployments en Vercel;
- `main` es la rama de producción;
- no fusionar hasta tener CI verde y QA de Preview;
- Supabase Free y Vercel Hobby sirven durante desarrollo, pero deben pasar a Pro antes de usar datos y tráfico reales de Sata;
- cada cliente/producto tendrá proyectos y secretos aislados.

## Documentación

- `AGENTS.md`: reglas estables para agentes y desarrolladores.
- `docs/database.md`: descripción histórica del esquema actual.
- `docs/production-readiness.md`: diagnóstico, prioridades, fases y bloqueos para producción.
- `e2e/`: regresiones críticas de autenticación, permisos, tenant, pagos y progreso.
