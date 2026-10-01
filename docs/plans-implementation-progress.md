# Planes y consumo — progreso

Encargo: prompt maestro de Jorge del 2026-10-01, leído completo. Rama:
`codex/plans-consumption-20261001`. No desplegar ni migrar producción.

## Estado 2026-10-01

- Inspección terminada: billing SaaS y Connect separados; descuentos/afiliados,
  checkout idempotente, reservas Mux y cola de borrado existentes se reutilizan.
- Esquema de producción contrastado en solo lectura; no tiene planes ni ledger
  de consumo. Un único proyecto Supabase real; no existe rama aislada activa.
- Next 16.3.3 y guías locales de actions/route handlers consultadas.
- Windows sin Docker/Postgres/WSL; SQL/RLS real se ensayará en workflow aislado
  de GitHub, con fixtures sintéticos. La rama tiene despliegue Vercel desactivado.
- Catálogo versionado, ledger y reservas/cuotas escritos; Stripe TEST tiene cinco
  precios inclusivos y una tarifa sintética 7% exclusivamente para probar aritmética.
- Unitarios 121/121, lint y TypeScript pasan sobre el primer lote (13:45 UTC).
  SQL todavía pendiente del workflow aislado; revisión de calidad read-only en curso.
- Inspección API real: Stripe TEST disponible sin tarifas fiscales existentes;
  credenciales locales antiguas Stripe Production y Mux responden 401. Véase
  `evidencias/plans-2026-10-01/provider-read-only.json`. No se modificó producción.
- Checkout/cambios/packs y webhooks escritos; catálogo, portada, condiciones,
  paneles de escuela/plataforma y solicitud A medida integrados. Pendiente recorrido final.
- Primer CI aislado 36872372197: migraciones aplicadas; pgTAP detectó duración
  legacy cero y conversión numeric→integer. Corregidos; nueva ejecución pendiente.
- Revisión de calidad encontró quota_mode de nuevas altas, checkout caducado,
  renovación de sesiones y job ausente de conservación. Correcciones integradas.
- Cron autenticado de capacidad, importador, avisos con outbox, estimaciones y
  worker de conservación añadidos. Ejecución/envíos siguen desactivados por defecto.
- Exportación segura propia con manifiesto, Storage verificable y HLS procesado;
  originales Mux no prometidos. Cleanup Storage persiste y excluye referencias ajenas.
- TypeScript pasa tras el lote integrado de workers/exportación (15:10 aprox. UTC).
- PostgreSQL/PostgREST portables descargados a TEMP para probar Stripe TEST con
  SQL local además de Supabase completo en CI; no instalación de servicio global.

## Invariantes

- Precio final inclusivo, catálogo versionado; preservación de contratos legacy.
- Duraciones en segundos precisos, ciclos UTC [inicio, fin); packs por caducidad.
- Gracia única por ciclo; upgrade proporcional sin reiniciar consumo.
- Metadata de upload estimativa, duración Mux autoritativa; reservas atómicas.
- Desconocido no es cero; consumo tardío/corregido reconstruye asignaciones.
- Sesión de playback persistida, permisos revocables comprobados periódicamente.
- Prueba 14 días sin autorrenovación; conservación nueva política 30 días.
- Cuotas legacy en observación; borrado por cierre desactivado hasta lanzamiento.

## Próximo trabajo

Catálogo/derechos y migración → medición/reservas → Stripe test → paneles/cuotas
→ conservación/exportación → revisores read-only y pruebas finales.
