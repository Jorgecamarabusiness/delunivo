# Delunivo

Delunivo es la aplicación para crear, vender y compartir conocimiento mediante
cursos online. El producto mantiene portales de organización con marca propia,
gestión de alumnos, pagos y vídeo protegido.

## Desarrollo local

Requisitos: Node.js 22 o superior y npm.

```bash
npm ci
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`. La configuración se
lee de `.env.local`; `.env.example` contiene únicamente los nombres esperados.

## Verificación

```bash
npm run test:unit
npm run lint
npx tsc --noEmit
npm run build
```

Los tests E2E requieren las cuentas y servicios de prueba documentados en
`e2e/helpers.ts` y se ejecutan con `npm run test:e2e`.

## Despliegue

El proyecto técnico de Vercel y su equipo usan el nombre Delunivo. La URL
pública actual es `https://delunivo.vercel.app`; todavía no hay un dominio
propio configurado.
