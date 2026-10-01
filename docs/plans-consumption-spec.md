# Prompt maestro para implementar los planes y el control de consumo de Delunivo

## Encargo y resultado esperado

Actúa como responsable de implementación de Delunivo. Implementa y verifica de principio a fin los planes comerciales, facturación, ampliaciones, medición de vídeo, cuotas, paneles y ciclo de conservación definidos aquí. Entrega código integrado y comprobado, migraciones ensayadas, evidencia y procedimiento de lanzamiento. No te limites a analizar, proponer otro plan o maquetar pantallas sin funcionamiento real.

Trabaja en el repositorio existente `C:/Users/jorge/Documents/paginas-web/delunivo`. Si ya estás en un worktree de ese repositorio, comprueba su origen y continúa allí. No reconstruyas la aplicación ni crees otro proyecto. Lee primero `AGENTS.md`, las instrucciones aplicables, `docs/project-status.md`, `docs/database.md` y el estado de Git. Protege los cambios ajenos. Utiliza una rama de trabajo; comprueba si un push puede desplegar automáticamente antes de hacerlo.

Sigue la skill `desarrollo-fluxia`, las skills locales pertinentes de `.agents/skills/` y las de Supabase, pagos y Vercel cuando corresponda. Para UI, lee `.agents/skills/delunivo-ui-system/SKILL.md`. El repositorio pide consultar la documentación local de la versión instalada de Next.js antes de programar. No actualices dependencias por rutina.

Este prompt recoge las decisiones comerciales aceptadas por Jorge y sustituye las propuestas anteriores incompatibles: un solo plan público, 5.000–6.000 minutos en el plan base y ampliaciones de biblioteca renovadas manualmente. Las cifras históricas son evidencia fechada, no el estado garantizado del día de ejecución.

## Autonomía y alcance autorizado

Ejecuta todas las decisiones técnicas rutinarias necesarias dentro de este alcance. No preguntes si puedes continuar entre fases. Investiga y resuelve errores, completa las rutas afectadas y vuelve a comprobar el resultado final. Si falta acceso a un servicio, completa el trabajo independiente y pide únicamente el paso concreto necesario; no solicites secretos por chat.

Puedes editar código y documentación, preparar y ejecutar migraciones en bases aisladas, utilizar Stripe de pruebas y servicios de prueba gratuitos o ya autorizados, consultar servicios reales en lectura y ejecutar verificaciones locales o CI que hayas comprobado que no despliegan ni modifican producción. No crees gastos nuevos ni uses clientes o cobros reales para probar.

El despliegue, las migraciones de producción, la activación de precios LIVE, los mensajes reales a clientes y las eliminaciones de contenido real requieren un paso de lanzamiento expresamente autorizado. Este encargo deja todo preparado y verificado para ese paso; no deduzcas autorización de un push o una acción de CI. Respeta la regla de despliegue de AGENTS.md.

No vuelvas a pedir aprobación sobre las decisiones comerciales de este documento. Solo eleva una decisión material no resuelta, una contradicción con evidencia nueva o un bloqueo de acceso real. No rebajes las pruebas por carecer de permisos: distingue comprobaciones aisladas, simuladas y en destino.

## Planes aprobados

Los precios comerciales son en euros e incluyen los impuestos que correspondan. La intención es mostrar un precio final, sin añadir por sorpresa impuestos al importe anunciado. La configuración fiscal debe verificarse con la cuenta y la integración existentes; esta decisión comercial no establece tipos impositivos, registros fiscales ni reglas de todas las jurisdicciones.

| Plan | Precio mensual | Biblioteca de vídeo | Entrega de vídeo por ciclo | Gracia de entrega |
|---|---:|---:|---:|---:|
| Inicio | 30 € | 20 horas | 3.000 minutos | 300 minutos |
| Crece | 69 € | 50 horas | 8.000 minutos | 800 minutos |
| Academia | 149 € | 100 horas | 20.000 minutos | 2.000 minutos |
| A medida | Presupuesto | Acordada | Acordada | Acordada |

Todos los planes públicos incluyen cursos y alumnos registrados sin límite numérico comercial, 0 % de comisión Delunivo por venta y vídeo adaptativo hasta 1080p. Las tarifas del procesador de pagos son independientes. No confundir las comisiones de afiliación de plataforma existentes con una nueva comisión por venta de cursos.

La reproducción incluida se comparte entre todos los alumnos de la escuela; no es una asignación por alumno. Los cursos gratuitos y las previsualizaciones del propietario también consumen. Las funciones actuales necesarias para crear, vender y consumir cursos se mantienen en todos los planes, respetando sus permisos.

No implementes planes anuales en esta entrega. No añadas apps móviles, IA, certificados, live, DRM, descargas masivas o compromisos de soporte que no estén implementados y presupuestados. A medida debe permitir registrar una solicitud de contacto o utilizar un canal existente verificado; no inventar una tarifa o activar un contrato automáticamente.

## Ampliaciones y pruebas

- Biblioteca: 8 € al mes, impuestos incluidos, por cada bloque adicional de 10 horas. Renovación mensual automática aceptada expresamente. Alinear su ciclo con la suscripción base y mostrar antes de pagar el importe inicial, el recurrente y la fecha. No trasladar literalmente la propuesta antigua de 30 días independientes.
- Entrega: bolsa de 5.000 minutos por 20 €, impuestos incluidos, pago único y validez de 90 días desde su activación confirmada. No se renueva automáticamente.
- Consumir primero la capacidad incluida y después las bolsas válidas por orden de caducidad, con desempate estable. Agotadas ambas, utilizar la gracia disponible. La gracia es una por ciclo y no se reinicia con compras, recargas, cambios de plan o eventos duplicados.
- Una bolsa conserva su saldo entre ciclos hasta caducar. No habilita playback con una suscripción sin derecho de acceso. Mostrar vencimiento y saldo, sin prometer devoluciones o exclusiones de derechos no verificadas.
- Prueba nueva: 14 días, 2 horas alojadas y 300 minutos de entrega total, sin cobro automático al finalizar. Contratar un plan requiere aceptación y pago explícitos. La prueba no tiene otros 300 minutos de gracia ni se reinicia creando un usuario. Conservar las excepciones de prueba ya concedidas.
- Implementar la compra y la renovación de ampliaciones como parte de esta entrega. Un mecanismo administrativo auditado puede servir durante el desarrollo, pero no sustituye el flujo final de compra, pago, concesión y recuperación de errores.

## Cambios de plan y cobros

Reutiliza Stripe y la integración actuales. Distingue las suscripciones que pagan las escuelas a Delunivo de los pagos que reciben los creadores de sus alumnos mediante Connect. No mezcles propietarios, cuentas, eventos, facturas ni metadatos de ambos circuitos.

Mantén una versión inmutable de la oferta aceptada: precio, moneda, tratamiento de impuestos, límites, ampliaciones y condiciones. La portada, el checkout, la confirmación y el panel deben mostrar la misma oferta.

Cambio hacia arriba: mostrar una previsualización exacta del cobro y activar después de pago confirmado. Mantener fecha de renovación y consumo previo. Cobro y aumento de entrega proporcional al tiempo restante del ciclo, calculado con intervalos temporales reales. Para almacenamiento, que es capacidad ocupable y no un saldo consumible mensual, habilitar el nuevo techo después del pago. No volver a cobrar ni conceder por reintentos.

Ejemplo de entrega: Inicio → Crece a mitad exacta del ciclo añade `(8.000 − 3.000) × 0,5 = 2.500` minutos al derecho de ese ciclo, no otros 8.000. Al renovar se asigna el derecho normal de Crece. Aplicar la misma lógica al aumento de gracia, conservando lo ya gastado. No reembolsar ni regenerar bolsas consumidas antes del cambio. Decidir redondeo determinista en segundos y probarlo.

Cambio hacia abajo: efectivo en la siguiente renovación. Antes de aceptar la programación, comprobar si la biblioteca cabe o si el propietario quiere mantener ampliaciones. No borrar vídeos ni aceptar un cambio cuyo precio o capacidad final resulten engañosos. Si surge exceso después de programarlo, avisar y aplicar el tratamiento de exceso publicado, sin renovar silenciosamente el plan caro contra la voluntad del cliente.

La cancelación voluntaria termina al final del periodo pagado, salvo derechos o condiciones existentes aplicables. No iniciar la cuenta atrás de conservación al pulsar cancelar si el acceso pagado continúa. Para pagos fallidos, respetar y conciliar el estado real y las reglas de recuperación existentes; un webhook fallido o una actualización pendiente no equivale a cancelación definitiva.

Una pantalla de éxito no prueba el pago. Validar eventos firmados, idempotencia, orden temporal, reembolsos y conciliación. Un pago confirmado concede una sola vez. Un evento viejo no revierte un estado más reciente. Concesiones gratuitas requieren cantidad, autor, motivo y vencimiento.

Preserva los afiliados, descuentos, gratuidades y ofertas aceptadas existentes. En los nuevos planes, los descuentos porcentuales deben conservar el porcentaje y duración autorizados; no extenderlos por defecto a bolsas o ampliaciones. Investiga las reglas reales antes de conectar estos conceptos y registra su efecto económico.

No fijes un 21 % universal ni actives servicios fiscales de pago sin autorización. Si falta un dato fiscal imprescindible, documenta exactamente cuál, sigue con el resto de la implementación y deja impedida la activación LIVE incorrecta.

## Mux y medición

Mantén Mux Pay as you go, `video_quality: basic`, máximo 1080p y reproducción firmada. No migres de proveedor ni cambies planes de servicios externos.

Referencia consultada el 1 de octubre de 2026: Basic 1080p, almacenamiento estándar 0,003 USD por minuto/mes y entrega 0,001 USD por minuto. Sin bonificaciones, las capacidades completas de Inicio, Crece y Academia cuestan respectivamente 6,60, 17 y 38 USD por ciclo mensual estable. No son beneficios ni máximos garantizados. Verifica tarifas y reglas vigentes antes de presentar cálculos actuales. No restes los créditos de toda la cuenta del presupuesto individual de cada escuela.

En aquella consulta, Mux Production contenía 30 assets y aproximadamente 88,52 minutos. El ciclo 30/08–30/09/2026 registró 105 minutos entregados, 26 a 1440p, y factura de 0 USD después de bonificaciones. Atribuye esos datos cuando sea posible; no conviertas la falta de acceso o las diferencias de agregación en ceros. No declares consumo representativo de clientes a partir de esa muestra.

Mantén una relación persistente entre asset, vídeo interno, entorno y escuela que sobreviva al borrado. Aprovecha el `passthrough` existente. Cualquier dato sin atribución debe quedar en una partida explícita sin adjudicarlo por suposición.

Importa consumo mediante API/exportación oficial adecuada, paginación completa y ventanas identificables. Consulta documentación vigente de Mux sobre retrasos, resolución temporal, dimensiones y correcciones. Un importador debe admitir reejecución y correcciones sin duplicar datos. Registra cobertura temporal, fecha de actualización y errores.

Los ciclos de la escuela siguen su suscripción, no la factura general de Mux. Usa intervalos UTC `[inicio, fin)` y unidades precisas antes de redondear para mostrar. Asigna datos tardíos al momento del consumo y a los derechos o bolsas vigentes entonces. Si la fuente solo ofrece agregados, no inventes precisión que no permite; documenta y prueba una política de frontera reproducible.

Separa consumo confirmado, estimación de la ventana reciente y datos pendientes. No sumes confirmado y estimado sobre la misma ventana. La telemetría del navegador ayuda a prever y detectar abuso, pero no es fuente autoritativa de facturación.

Concilia costes brutos, descuentos, créditos y pago de la cuenta Mux por separado de los costes atribuidos y de referencia de cada escuela. Incluye aparte el contenido que aún esté en Supabase Storage u otros proveedores; un contador Mux no cubre todos los costes.

## Biblioteca y subidas

Cuenta duración de todos los assets alojados atribuibles a la escuela, incluidos borradores. La reutilización del mismo asset no duplica ocupación; otro asset sí. La duración confirmada por Mux es autoritativa. La metadata del navegador solo permite una estimación inicial.

Reserva capacidad atómicamente antes de crear una subida y conserva los controles de ráfagas y concurrencia existentes. Prueba carreras, reservas huérfanas, expiración, metadata manipulada y reconciliación de la duración real. Una subida fuera de cuota no se publica; debe existir una resolución y limpieza documentadas, sin olvidar el coste ya generado.

Basic puede mantener un compromiso mínimo de almacenamiento tras borrar. Verifica su regla vigente y conserva un registro del compromiso pendiente. Además del techo de biblioteca activa, usa un presupuesto de duración equivalente del 120 % para activos, reservas y compromisos pendientes: 24, 60 y 120 horas para los tres planes, y 12 horas económicas por ampliación de 10. Para la prueba, 2,4 horas económicas y 2 horas activas. No anunciar ese margen como almacenamiento activo adicional.

Explica antes de subir o sustituir si hay capacidad pendiente de liberar y cuándo se prevé recuperarla. No bloquear sorpresivamente por una condición escondida. Adaptar el presupuesto al calendario real y a altas prorrateadas: cobrar pocos días no elimina un mínimo de almacenamiento de proveedor. Mostrar esta exposición en el panel interno.

Al sustituir un vídeo, mantener el anterior hasta que el nuevo esté validado. Borrado solicitado, borrado confirmado y coste residual son estados distintos. Reutiliza la cola persistente de borrado, con reintentos seguros. No elimines contenido ajeno para arreglar un contador.

Conserva el objetivo existente de 12 horas y 20 GiB por archivo. No afirmes haber probado una subida real de ese tamaño por haber probado sus validaciones, y no subas archivos gigantes o de pago para simular evidencia.

## Avisos y continuidad de reproducción

Estados observables: normal, aviso, gracia, pausa y actualización pendiente. Avisar al 70 % y al 90 % de cada recurso. Evitar duplicados por escuela, recurso, ciclo y umbral. Crear los correos transaccionales y verificar con destinatarios sintéticos; no enviar a clientes reales durante el desarrollo.

Si la biblioteca no admite otra subida, bloquear esa subida, explicando el motivo y las opciones. Los vídeos existentes no se pausan por una reserva fallida.

Al agotarse base, bolsas y gracia con evidencia fiable, impedir nuevas sesiones de vídeo, conservando compra, progreso y acceso al resto del curso. Confirmado un pago que aporta capacidad, recuperar admisión. No cobrar automáticamente excesos.

Reconocer sesiones existentes desde servidor, vinculadas a usuario, escuela y asset. Un campo arbitrario del cliente no demuestra una sesión antigua. La revisión periódica de seguridad sigue comprobando permisos; la cuota comercial no debe confundirse con revocación de derechos.

Actualmente se emiten tokens para la duración del vídeo más 15 minutos, y se revisa acceso cada cinco minutos. Un token emitido no se revoca instantáneamente. No acortes expiraciones o cambies renovaciones sin probar vídeos largos, pausas y saltos. Evita renovaciones ilimitadas de una misma sesión. Declara expresamente que el control de admisión y los datos retrasados no garantizan un techo instantáneo de gasto.

Ante fallo del importador, mostrar la última actualización fiable. No interpretar desconocido como cero ni cortar solo por una estimación incierta. Mantener sesiones existentes; decidir admisión según el último saldo fiable y la exposición documentada. Escalar los casos de riesgo al administrador y registrar toda excepción con vencimiento.

## Conservación y recuperación

Decisión aceptada: conservar contenido durante 30 días después de finalizar efectivamente una prueba o suscripción. Durante ese plazo, permitir al propietario recuperar la suscripción o extraer su contenido; no habilitar nuevas subidas ni nuevas sesiones de alumnos cuando ya no exista acceso vigente. Mantener roles y seguridad de todas las operaciones.

Implementa fecha de finalización, fecha prevista de eliminación, avisos y cancelación del trabajo de borrado cuando se restaura correctamente el acceso. Usa una política versionada aceptada antes de aplicarla a nuevos clientes. Los contratos anteriores no entran automáticamente en este flujo.

Reutiliza el mecanismo de salida/exportación real si existe; comprueba que permite obtener lo prometido. Si no existe, implementa una salida segura y viable para contenido y datos propios del creador. No prometas exportación de originales inaccesibles ni expongas credenciales o compras de otras escuelas. Identifica costes de descargas y operaciones y no actives extras pagados de Mux de oficio.

El vencimiento de una ampliación de biblioteca no equivale al cierre de la escuela: avisar, bloquear nuevas subidas que excedan el nuevo techo y dar siete días para renovar, ampliar o reducir contenido. Después, pausar nuevas sesiones si sigue el exceso conforme a las condiciones aceptadas. No borrar vídeos automáticamente por ese exceso.

La eliminación al terminar la conservación debe usar el flujo persistente existente, comprobar de nuevo derechos y fecha antes de actuar y distinguir datos educativos, vídeo, registros de compras y documentación de cobros. No borrar facturas, evidencia contractual u otros registros con obligaciones independientes por aplicar un plazo general de 30 días. No decidir obligaciones legales desconocidas.

Ensaya el proceso completo con datos sintéticos, incluyendo renovación simultánea al borrado y errores del proveedor. Deja la ejecución de eliminación real desactivada hasta el lanzamiento explícito y la verificación de aceptación de condiciones, avisos y salida de datos. No apliques retroactivamente la política a producción.

## Interfaz y recorrido completo

Respeta la marca y el sistema de componentes Delunivo. Usa la jerarquía de tarjetas de Teachable como referencia de comparación, sin copiar identidad ni promesas de prestaciones.

Portada: Inicio, Crece, Academia y A medida. Destaca Crece como «Recomendado», sin inventar «Más popular». Muestra precio final, público al que sirve, biblioteca, reproducción, 0 % de comisión Delunivo y límites comprensibles. Añade comparación y ejemplos de horas alojadas frente a consumo entre alumnos. Usa los mismos datos canónicos en todas las pantallas.

Panel de escuela: plan vigente, precio y descuentos reales, ciclo, ocupación activa y reservada, compromiso pendiente, reproducción confirmada y estimada, actualización, bolsas y vencimientos, ampliaciones recurrentes, estado y acciones para comprar, cambiar y cancelar. Solo el propietario autorizado acepta operaciones comerciales; respeta la prohibición existente de facturación durante «Run as».

Panel de plataforma: por escuela, derechos, ingreso real o desconocido, consumo, coste bruto atribuido y coste de referencia, margen parcial, datos pendientes, excepciones, gracia, avisos y borrados. No mostrar beneficio neto si faltan gastos. Mantén las herramientas de superadministración existentes.

La subida debe explicar capacidad antes de empezar. El alumno debe recibir una explicación breve de la pausa temporal sin presentar su compra como perdida. La recuperación de pago y capacidad debe funcionar sin que vuelva a comprar el curso.

Comprueba carga, vacío, error, datos pendientes, permiso denegado y éxito en móvil estrecho, tablet y escritorio. Accesibilidad de formularios, teclado y mensajes; sin desbordamientos ni errores de consola nuevos.

## Datos y seguridad

Parte del esquema real; no crees una segunda fuente de verdad junto a facturación y membresías existentes. Versiona la oferta, derechos de capacidad, reservas, uso importado, bolsas, concesiones y estados operativos. Los agregados deben ser reconstruibles y las correcciones auditables.

Garantiza aislamiento por escuela en lectura y escritura, RLS y permisos de servidor. Los saldos y precios autorizados no se aceptan desde el navegador. Credenciales privilegiadas solo en servidor. Importadores, webhooks y tareas programadas deben estar autenticados y resistir ejecución duplicada o concurrente.

Utiliza importes enteros en la unidad monetaria menor y medidas precisas de duración. Documenta redondeos, zona temporal, semántica de renovaciones, distribución de consumo y vigencia de bolsas. No derives el derecho de acceso exclusivamente de una etiqueta de precio o un rol del cliente.

Los cambios de base deben ser compatibles con el estado previo y admitir despliegue ordenado. Prepara recuperación y reconciliación de fallos entre proveedor y base, especialmente cuando un proveedor confirma una operación y falla la escritura local.

## Ejecución por lotes

1. Inspección breve y mapa de rutas, estado actual y fuentes. Confirma qué ya existe. Guarda una especificación vigente que identifique decisiones cerradas y bloqueos comprobados.
2. Catálogo comercial versionado, derechos, migraciones compatibles y pruebas aisladas de datos. Preserva ofertas actuales.
3. Medición Mux, atribución, conciliación, reservas y panel interno. Añade importación periódica y observabilidad usando la infraestructura existente; prueba el calendario sin activar tareas reales fuera de alcance.
4. Planes, impuestos verificados, checkout, cambios, ampliaciones, webhooks y recuperación de pagos. Prueba el recorrido completo con Stripe test.
5. Cuotas, avisos, admisión, interfaz de escuela, portada y A medida. No publiques prestaciones aún sin implementar.
6. Finalización de prueba, conservación, recuperación, salida de datos y eliminación segura ensayada.
7. Revisión independiente, resolución de hallazgos, pruebas finales y paquete de lanzamiento.

No pares al terminar un lote si puedes seguir. Registra brevemente progreso y evidencias para continuar tras una compactación o interrupción. No registres un componente como terminado cuando solo exista su UI o sus mocks.

El piloto previsto es de hasta cinco escuelas, mínimo 14 días, con dos ciclos comerciales para valorar la economía. Prepara activación gradual y medición sin bloqueo para clientes anteriores. No inventes resultados del piloto ni esperes 14 días dentro de esta tarea para terminar la implementación. Distingue preparación técnica y observación real posterior.

## Pruebas y revisión necesarias

Sigue las comprobaciones de AGENTS.md y los comandos reales del repositorio. A fecha de preparación existen `npm run test:unit`, `npm run lint`, `npm run build`, `npm run test:e2e` y `npm run test:e2e:audit`; revisa su configuración antes de ejecutarlos. No permitas que el entorno local o las pruebas escriban en el único Supabase real. Usa la infraestructura aislada disponible y comprueba sus destinos.

Valida al menos:

- Aislamiento real entre dos escuelas, propietario, administrador, alumno y superadministrador; sin compras durante Run as.
- RLS y concurrencia contra Postgres real aislado, no solo mocks.
- Dos subidas intentando reservar el mismo saldo; duración falsa; reservas caducadas; sustitución y borrado fallidos.
- Importación repetida, paginación, corrección tardía, asset borrado, asset sin atribución y frontera de ciclo.
- Checkout alterado, pago rechazado, webhook firmado repetido o desordenado, confirmación perdida y conciliación posterior.
- Impuestos incluidos en los escenarios fiscales efectivamente configurados, sin afirmar cobertura mundial no comprobada.
- Upgrade parcial, upgrade repetido, downgrade, cambio junto a renovación y cancelación de ampliación.
- Bolsa a punto de vencer, dos consumos concurrentes, compra junto al agotamiento, refund y saldo corregido.
- Gracia una sola vez, reactivación y diferencias entre agotamiento comercial y pérdida de permisos.
- Reproducción larga, pausa, seek y enlace emitido antes de llegar al límite.
- Prueba vencida, cuenta existente exenta, conservación de 30 días, recuperación en el borde y eliminación idempotente solo de datos sintéticos.
- Recorrido completo desde la oferta hasta pago, capacidad visible, reproducción y panel de plataforma; móvil, tablet y escritorio.

Para regresiones importantes, demuestra en un entorno seguro que la comprobación detecta el defecto antes de corregirlo. No añadas tests triviales que solo reproduzcan la implementación.

De acuerdo con AGENTS.md, delega revisión read-only a `quality_reviewer` después de los cambios de migraciones, permisos, pagos, webhooks e integraciones y a `ui_reviewer` para las pantallas y cambios visuales amplios. El agente principal integra y verifica; evita escritores simultáneos sobre los mismos archivos. Si el entorno no admite subagentes, informa de esa limitación, realiza una revisión separada y no la presentes como independiente.

## Cierre y entrega

Entrega implementación completa dentro del alcance y un resumen breve para Jorge con lo implementado, pruebas y entornos, hallazgos resueltos, bloqueos reales y siguiente paso. Actualiza `docs/project-status.md`, el esquema cuando cambie y la especificación de esta función sin borrar decisiones históricas relevantes.

Prepara un procedimiento concreto de publicación: migraciones y orden, precios/configuración LIVE pendientes, variables por nombre sin valores secretos, programación de importaciones y avisos, activación gradual, rollback/recuperación y comprobaciones posteriores. No habilites cuotas o borrado para clientes anteriores sin su transición.

Si falta un acceso o dato fiscal, entrega el resto terminado y señala exactamente la parte no verificada o no activable. No declares «todo listo» por un build verde ni uses una dependencia externa como motivo para abandonar el trabajo independiente.

Empieza ahora por inspeccionar el repositorio y continúa con la implementación y verificación. No me devuelvas únicamente un plan.

## Fuentes de contexto para consultar

Los documentos de esta investigación están en `C:/Users/jorge/Documents/Codex/2026-10-01/delunivo-reunir-consumo-y-facturaci-n/outputs/`:

- `Delunivo-costes-Mux-2026-10-01.md`: evidencia y cálculo histórico.
- `Mux_invoice_2026-09-30.csv`: factura consultada.
- `Delunivo-plan-de-decisiones-y-ejecucion-2026-10-01.md`: propuesta anterior; usar sus detalles compatibles, dando precedencia a este prompt en las decisiones actualizadas.

Si esos archivos no están disponibles, este prompt contiene las decisiones necesarias para implementar. No afirmes haber consultado todo Jorge HQ ni conversaciones inaccesibles. El repositorio es la fuente del estado técnico real.

Referencias de proveedor para verificar antes de integrar:

- https://www.mux.com/docs/pricing/overview
- https://www.mux.com/docs/api-reference/video/delivery-usage/list-delivery-usage
- https://www.mux.com/docs/pricing/export-usage-data-as-a-csv
- https://www.mux.com/docs/guides/secure-video-playback
- https://www.teachable.com/pricing

La referencia Teachable orienta la presentación de planes; no incorpora sus condiciones contractuales ni sus costes a Delunivo.
