---
name: supabase-schema-change
description: Planifica e implementa cambios de tablas, columnas, indices, funciones, triggers, RLS o datos estructurales de Supabase en Delunivo. No usar para consultas que no cambian el esquema.
---

# Cambios de esquema de Supabase

1. Lee `docs/database.md`, `supabase/migrations/`, rollbacks relacionados y el codigo consumidor. No asumas que la documentacion coincide con el esquema real.
2. Confirma con evidencia las columnas, defaults, constraints y policies existentes antes de escribir SQL.
3. Crea una migracion versionada en `supabase/migrations/` y documenta un rollback razonable en `supabase/rollbacks/`. Marca con claridad cualquier perdida de datos. Nunca ejecutes automaticamente un rollback destructivo ni lo hagas sin autorizacion independiente y una verificacion previa del objetivo. No des la migracion por aplicada.
4. Incluye aislamiento por organizacion, RLS e indices solo cuando el flujo actual los necesite. Nunca uses `profiles.is_admin`; sigue los helpers y roles multi-tenant vigentes.
5. Entrega a Jorge un unico paso manual cada vez para aplicar el SQL en Supabase: ruta del menu, archivo o SQL, resultado esperado y consulta de verificacion. No pidas secretos en el chat.
6. Espera confirmacion antes de depender del cambio remoto. Despues sincroniza `docs/database.md`, tipos y codigo afectado con el resultado real.
7. Ejecuta pruebas enfocadas de autorizacion, aislamiento y regresion. YAGNI: no anadas tablas o columnas para necesidades hipoteticas.
