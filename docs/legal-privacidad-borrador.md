# Preparación legal y privacidad — borrador interno

Actualizado: 2026-09-07. **No publicar como política vigente.** No contiene datos identificativos de titulares, plataforma ni vendedores. La configuración de variables legales de producción fue revisada, pero falta comprobar su uso en runtime.

## Modelo observado

Delunivo presta un SaaS mensual a escuelas. Cada escuela debe identificarse como vendedor/facturador de sus cursos. Stripe Connect puede facilitar cobros, pero no determina por sí solo parte contractual, responsabilidad fiscal ni rol de protección de datos.

La ficha por escuela permite nombre legal, identificador fiscal local, domicilio, contacto, país y textos opcionales de acceso y cambios/reembolsos. No impone formatos españoles ni publica condiciones predeterminadas. Esos campos existen en código y están pendientes de migración/CI; no sustituyen información precontractual ni derechos imperativos.

## Datos y decisiones pendientes

- Identidad, domicilio y contacto de plataforma ya facilitados en el chat y configurados en Production; no volver a solicitarlos ni copiarlos aquí. Su publicación efectiva requiere verificar el nuevo runtime.
- Datos de cada vendedor, territorio, soporte, facturación y política aplicable.
- Roles contractuales y de protección de datos según tratamientos efectivos; DPO solo si procede.
- Base, información y retención de cada tratamiento; DPA, regiones, subencargados y transferencias.
- Fiscalidad de SaaS y cursos. No presumir IVA, exención ni uniformidad territorial.

No inferir estos datos desde cuentas, pagos, backups o el workspace. Referencias: [LSSI art. 10](https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758), [RGPD](https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=celex%3A32016R0679) y [AEPD responsable/encargado](https://www.aepd.es/preguntas-frecuentes/2-tus-obligaciones-como-responsable-del-tratamiento/8-responsable-y-encargado-del-tratamiento/FAQ-0251-como-se-si-soy-responsable-o-encargado).

## Compra y contenido digital

Antes de Checkout deben ser claros vendedor, curso, precio final, acceso, soporte e incidencias. Si se pretende basar la pérdida del desistimiento en el inicio inmediato, hace falta consentimiento expreso previo, reconocimiento específico, prueba durable y revisión jurídica. Hasta entonces no debe aparecer una renuncia ni una regla general de “sin reembolsos”. La descarga contractual inmutable está pendiente de SQL y CI. Referencia: [RDL 1/2007, arts. 97, 98, 102 y 103](https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555).

## Privacidad, cookies y medios

El inventario técnico incluye cuentas/verificación, escuelas/roles, compras/suscripciones, cursos/progreso/medios, soporte y logs. La restauración privada acredita capacidad técnica acotada, no una política de conservación ni base jurídica. El borrado conserva datos mínimos de pagos o reclamaciones según diseño; plazos y alcance final requieren validación.

No se detectó un módulo propio de píxel publicitario en la revisión estática. Eso no prueba la ausencia de cookies o almacenamiento no esencial de Auth, Stripe, Mux, embeds o proveedores. Medir red y almacenamiento en un entorno autorizado antes de decidir banner, bloqueo previo o consentimiento. Para usos no exentos, aceptar, rechazar y configurar deben tener igual facilidad; marketing separado y no premarcado. Referencias: [guía AEPD de cookies](https://www.aepd.es/guias/guia-cookies.pdf) y [AEPD sobre información y consentimiento](https://www.aepd.es/preguntas-frecuentes/2-tus-obligaciones-como-responsable-del-tratamiento/6-el-deber-de-informacion/FAQ-0248-sobre-si-el-usuario-tiene-que-dar-consentimiento-a-clausula-de-privacidad).

## Criterio para publicar

Confirmar identidades y contratos, tratamientos y plazos, fiscalidad, proveedores y transferencias; aplicar y verificar migraciones; comprobar runtime de enlaces/textos; verificar consentimiento cuando proceda; y hacer revisión jurídica/fiscal. Este documento no concede aprobación legal ni declara conformidad.
