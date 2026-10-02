# Continuación — 2026-10-02, 13:55 UTC

Rama codex/plans-consumption-20261001. Maestro único escritor. Especificación completa leída antes de editar; copia plans-consumption-spec.md. Autorización de integración/publicación recibida. Decisión final: piloto solo Iván Orgánico, España/Península y Baleares, IVA 21 % incluido. Sin compras LIVE, mensajes a clientes ni borrado permanente en las comprobaciones.

PR4 corrige redirecciones de Run as caducado; www funciona con sesión real. PR5 implementa el encargo comercial completo; PR6/7 diagnóstico privado y catálogo LIVE. PR8 integrado 75b6ddf455603974e4a5cf826a40797bd761a972, producción READY dpl_6tGgjRPsdCHNFwYz9dgyUYHk1AKZ. CI 37014132098 y Supabase 37014126064 verdes: 147 unitarios, lint, TS, build, 23 E2E; Supabase 128 pgTAP, concurrencia, Auth/Storage y consumidores reales.

Backup privado cifrado: 64 tablas/1.758 filas, 12:07 UTC, SHA256 20568de6d94ef5c8480df9a4e6989d24c0beb8f93515f47febfe94b527b97620. Descifrado/JSON comprobados en memoria. Sin nuevo backup de bytes multimedia ni restore completo de este snapshot. Migraciones atómicas 12:11 UTC: 33 recibos, 23 tablas nuevas RLS/service-only; ocho legacy en observe, sin WARN nuevos.

Stripe LIVE acct_1TwKtKJD1wCl42uL: cinco precios inclusivos exactos creados y configurados en Vercel. Webhook principal conserva URL/secreto y tiene nueve eventos verificados; Connect intacto. Tarifa manual creada desde dashboard: txr_1UM6nLJD1wCl42uLPf3zp9dl, VAT/ES/21 %/inclusive/active; captura stripe-tax-production-2026-10-02.png. Stripe TEST real anterior: checkout, descuento, biblioteca, upgrades/decline/recovery/refunds, firmas y Test Clock; impuesto sintético 7 %. Avisos probados con transporte interceptado, sin entrega real.

Mux real tkrqi3/3cnmn5: nombre Production, tipo development. Worker/import habilitados para medición; 27 ledger reconciliados; tres assets del proveedor sin dueño atribuible quedan desconocidos. Importación falló con ventana exacta y count=undefined. Fix: count opcional; recorrer hasta página vacía explícita, mantener rechazo de null/count inválido/cambiante, duplicados, ventana incorrecta y error intermedio. Regresión reprodujo defecto anterior y pasa ahora. Revisión read-only sin hallazgos. Local: 152 unitarios (incluye cuatro fiscales aún en desarrollo), lint, TS y build pasan. Publicar fix y verificar cobertura SQL tras cron.

Fiscal en desarrollo: revisión detectó recovery/worker y listas vacías fail-open. Implementar domicilio fiscal canónico Stripe, ES/código postal permitido, Customer previo/vinculado, Checkout sin reescritura de domicilio, guards en recuperación/cambios y allowlists obligatorias. Sin duplicar domicilio en Supabase. Iván corresponde a Grow Organic, slug grow-organic, dueño Ivan fernandez; UUID 7125f160-3c4b-4225-a6b9-f6756c317930, legacy cancelado.

Controles efectivos: plans=false, notices=false, retención sin activar, MUX_DELETION_MODE=off; worker/import=true. Fiscal LIVE/allowlists pendientes tras código/pruebas/revisión. No activar con listas vacías ni aceptar oferta/comprar por el propietario.

Siguiente: publicar/verificar Mux; terminar fiscal y TEST real; revisión calidad/UI; configurar solo Iván/tarifa validada; publicar/verificar destino; actualizar estado/runbook. Observación 14 días/dos ciclos posterior a activación. Vídeo real 12 h/20 GiB no probado; límites y reservas sí.
