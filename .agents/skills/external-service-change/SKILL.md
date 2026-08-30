---
name: external-service-change
description: Integra o modifica servicios externos de Delunivo como Stripe, Resend, Mux, Whop, Vercel o configuracion externa de Supabase. No usar para cambios locales sin dependencia externa.
---

# Servicios externos de Delunivo

Separa siempre dos carriles: codigo reversible que puede ejecutar Codex y pasos de dashboard que debe realizar Jorge.

1. Inspecciona el wrapper existente en `src/lib/<servicio>/`, rutas de webhook, variables documentadas y pruebas antes de crear una integracion nueva.
2. Centraliza el SDK o cliente en servidor. Usa `NEXT_PUBLIC_*` solo para valores realmente publicos y nunca muestres secretos en logs, UI o chat.
3. Implementa solo la capacidad solicitada. No anadas modos, proveedores o automatizaciones hipoteticas.
4. Para webhooks, valida firma, idempotencia, reintentos, orden de eventos y comportamiento ante fallos.
5. Si necesita esquema nuevo, usa primero la skill `supabase-schema-change`.
6. Para cada accion manual, da un solo paso numerado con ruta exacta del menu, campo, valor esperado, verificacion y rollback cuando proceda. Espera confirmacion antes de continuar.
7. Detente antes de compras, planes de pago, DNS, produccion, datos reales, deploys o rotacion de secretos si no hay autorizacion explicita.
8. Verifica localmente con mocks o modo de prueba. Explica con precision cualquier validacion externa pendiente.
