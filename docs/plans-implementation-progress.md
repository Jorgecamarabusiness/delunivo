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
- TypeScript pasa tras el lote integrado de workers/exportación.
- PostgreSQL/PostgREST portables descargados a TEMP para probar Stripe TEST con
  SQL local además de Supabase completo en CI; no instalación de servicio global.
- CI 36879502597 / commit 751e287: 92 tests pgTAP/RLS (9 archivos) y 5 E2E
  de aplicación/Supabase aislado pasan. Aún anterior a las últimas ampliaciones.
- Concurrencia nativa real pasa: dos escuelas, doble reserva, huérfana vencida,
  duración falsa, importación paralela, pausa y avisos sin duplicados.
- Stripe TEST integrado pasa 6 grupos con checkout hospedado real, tarifa
  inclusiva sintética 7%, descuento once, ampliación, upgrade a mitad de ciclo,
  rechazo/recuperación, bolsa/reembolso, downgrade y renovación Test Clock,
  cancelación al final de periodo. Se detectó y corrigió la restricción Stripe
  from_subscription + metadata. Recursos de cada reloj sintético eliminados.
- Segunda migración de costes/evidencia y concesiones auditadas añadida; falta
  repetir CI con ella. Snapshot económico separa coste bruto/créditos/cambio,
  impuestos desconocidos y Storage, sin presentar beneficio neto.
- Pendiente: sesión/read-only Mux y fiscal LIVE; cobertura/telemetría sin solapar;
  recuperación/cancelación de checkout UI; piloto; verificación visual/E2E nuevo;
  revisiones finales y documentación/lanzamiento. No publicar ni activar LIVE.

## Invariantes

Actualización 16:35 UTC: 127 unitarios, lint/TS y build pasan. Stripe TEST
repetido: 7 grupos incluyendo handler firmado/duplicados/firma falsa/Connect
rechazado y reembolso previo a concesión. Último cambio temporal (inicio efectivo
pagado y activación de bolsa) requiere repetición. UI paneles/exportación pasan;
12 E2E de auditoría en repetición después de corregir selector de miles y URL
de playback con query. Revisiones UI/calidad realizadas; hallazgos corregidos,
con nuevas defensas de concurrencia Storage/importación y pruebas SQL010.
El navegador Mux sí tiene sesión: 30 assets/2 páginas, 5.311 s redondeados;
factura 0,35 USD bruto/0 pagado. Importador API sigue pendiente por credencial401;
Stripe LIVE muestra login (paso de acceso pedido). Falta CI de las 3 migraciones,
ensayo final Stripe/SQL, documentación y revisión final de capturas restantes.

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
