---
name: supabase-schema-change
description: Planifica e implementa cambios de tablas, columnas, indices, funciones, triggers, RLS o datos estructurales de Supabase en Delunivo. No usar para consultas que no cambian el esquema.
---

# Cambios de esquema de Supabase

1. Lee `docs/database.md`, `supabase/migrations/`, rollbacks relacionados y el codigo consumidor. No asumas que la documentacion coincide con el esquema real.
2. Confirma con evidencia las columnas, defaults, constraints y policies existentes antes de escribir SQL.
3. Crea una migracion versionada en `supabase/migrations/` y documenta un rollback razonable en `supabase/rollbacks/`. Marca con claridad cualquier perdida de datos. Nunca ejecutes automaticamente un rollback destructivo ni lo hagas sin autorizacion independiente y una verificacion previa del objetivo. No des la migracion por aplicada.
4. Incluye aislamiento por organizacion, RLS e indices solo cuando el flujo actual los necesite. Nunca uses `profiles.is_admin`; sigue los helpers y roles multi-tenant vigentes.
5. Si existe una API o CLI autenticada, o puedes controlar una sesion autenticada del navegador, ejecuta directamente el cambio externo cuando este dentro de la autorizacion expresa de la tarea. Verifica primero el proyecto y el objetivo con una consulta de solo lectura. Prefiere API o CLI; usa el navegador cuando la operacion solo este disponible en el dashboard. No pidas ni expongas secretos en el chat.
6. Pide a Jorge un unico paso concreto y espera su confirmacion solo si existe una barrera real: 2FA o CAPTCHA, ausencia de sesion o permisos, aceptacion de costes o contratos, una decision de producto que cambie materialmente el resultado, o una accion destructiva o irreversible que no haya autorizado expresamente.
7. No dependas del cambio hasta verificar el estado remoto real. Despues sincroniza `docs/database.md`, tipos y codigo afectado con la evidencia observada.
8. Ejecuta pruebas enfocadas de autorizacion, aislamiento y regresion. YAGNI: no anadas tablas o columnas para necesidades hipoteticas.
