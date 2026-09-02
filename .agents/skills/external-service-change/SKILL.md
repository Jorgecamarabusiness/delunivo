---
name: external-service-change
description: Integra o modifica servicios externos de Delunivo como Stripe, Resend, Mux, Whop, Vercel o configuracion externa de Supabase. No usar para cambios locales sin dependencia externa.
---

# Servicios externos de Delunivo

Automatiza el flujo completo dentro de la autorización de la tarea. Usa, por
este orden, un conector específico, API/CLI autenticada, Chrome con la sesión
del usuario y el navegador integrado. Si Codex puede operar el dashboard, no
pidas a Jorge que haga clic ni que copie valores manualmente.

1. Inspecciona el wrapper existente en `src/lib/<servicio>/`, rutas de webhook, variables documentadas y pruebas antes de crear una integracion nueva.
2. Centraliza el SDK o cliente en servidor. Usa `NEXT_PUBLIC_*` solo para valores realmente publicos y nunca muestres secretos en logs, UI o chat.
3. Implementa solo la capacidad solicitada. No anadas modos, proveedores o automatizaciones hipoteticas.
4. Para webhooks, valida firma, idempotencia, reintentos, orden de eventos y comportamiento ante fallos.
5. Si necesita esquema nuevo, usa primero la skill `supabase-schema-change`.
6. Antes de mutar un servicio, confirma por lectura el equipo, proyecto, entorno y recurso exactos. Verifica también el estado remoto después de escribir.
7. Pide intervención a Jorge solo ante una barrera que Codex no pueda resolver: 2FA/CAPTCHA, sesión o permisos ausentes, aceptación de costes o contratos, una decisión material o falta de autorización para una acción irreversible. En ese caso, da un único paso concreto y retoma la automatización tras su confirmación.
8. Detente antes de compras, planes de pago, DNS, producción, datos reales, deploys o rotación de secretos si no hay autorización explícita.
9. Verifica localmente con mocks o modo de prueba. Explica con precisión cualquier validación externa pendiente.
