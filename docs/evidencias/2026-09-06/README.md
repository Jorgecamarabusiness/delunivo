# Evidencia visual de auditoría

Las pruebas aisladas de Playwright escriben aquí capturas de las rutas auditadas
en 375, 768 y 1440 píxeles. Se generan con:

```powershell
npm run test:e2e:audit
```

Son evidencia de renderizado local contra el mock HTTP de auditoría. No
demuestran RLS, Supabase ni Mux reales, y no contienen datos de producción.

`cli-metrics.txt`, `cli-console.txt`, `cli-requests.txt` y `cli-landing-375.png`
proceden del CLI oficial de Playwright 0.1.19 contra el build final local.
La consola registrada es la de landing; no representa todas las rutas. Las métricas
son una única muestra sin throttling, con mocks, y no son Core Web Vitals de campo.

La revisión UI validó landing/uploader 375/768/1440 y la corrección del bloque móvil.
El título aún se elide parcialmente a 375 px, P3 aceptado: estado/controles son legibles.
La suite final pasa 7 casos, pero Next registra cierres tempranos de stream al navegar;
ese pendiente operativo consta como A17 en el informe principal.
