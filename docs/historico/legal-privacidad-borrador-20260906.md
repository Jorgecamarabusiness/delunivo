# Preparación legal y privacidad — borrador interno

2026-09-06. **No publicar este documento como una política vigente.** Faltan identidades y decisiones contractuales verificadas. Este lote no cambia precios, comisiones, impuestos configurados ni derechos adquiridos.

## Modelo observado y decisiones pendientes

El código usa Stripe Connect para enviar ventas de cursos a la escuela y una suscripción separada de plataforma. Esto sugiere que la escuela vende el curso y Delunivo vende el SaaS; no demuestra por sí solo quién es el vendedor contractual. Confirmar contrato, cuenta de Stripe, Checkout, facturas y soporte antes de redactar condiciones públicas.

Preparar cuatro textos de alcance distinto: aviso legal de Delunivo; condiciones SaaS de escuelas; condiciones de venta de cada escuela; privacidad/cookies conforme a los tratamientos efectivos. Un enlace genérico de plataforma no sustituye la identidad del vendedor del curso.

## Datos que faltan para completar el aviso legal

- Nombre/entidad legal de Delunivo, NIF, datos registrales cuando proceda, domicilio profesional y canal de contacto autorizado para publicar.
- Identidad y datos correspondientes de cada vendedor/escuela, soporte, política contractual y territorios de venta.
- Responsable de facturas, tratamiento fiscal por producto/país y justificación de una posible exención.
- Canales para derechos de privacidad y reclamaciones; DPO sólo si procede y existe.

No completar esos campos con datos privados del workspace ni inferirlos de la cuenta bancaria. La [LSSI, art. 10](https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758) es la referencia de información del prestador y precios.

## Condiciones que deben reflejar el producto

**Plataforma:** servicio de creación y gestión de escuela, precio vigente leído de platform_settings, periodicidad mensual, renovaciones/cancelación, descuentos aplicables a cada contrato, soporte e incidencias. Diferenciar cancelación de suscripción, suspensión comercial y supresión de datos. Conservar el acceso de alumnos ya concedido ante suspensión comercial según la decisión vigente.

**Curso:** identificar vendedor, contenido/temario, requisitos técnicos, modalidad, alcance/duración del acceso y precio final aplicable antes de Checkout. La compra es única y exclusiva del curso; no suscribe al catálogo. Reflejar política de incidencias/reembolsos y derechos legales sin convertir el silencio en renuncia.

**Inicio inmediato:** si se pretende invocar pérdida del desistimiento para contenido digital, preparar consentimiento previo expreso y reconocimiento específico, evidencia versionada y confirmación en soporte duradero. Hasta entonces conservar los derechos aplicables; no introducir “sin reembolsos”. Revisar también falta de conformidad y soporte. Fuentes: [RDL 1/2007, arts. 97, 98, 102 y 103](https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555).

**Fiscalidad:** mantener los importes contratados mientras se valida su desglose. El 21 % es el tipo general, no universal. Formación impartida, contenido automatizado, acreditación del prestador, país, tipo de comprador y reglas de localización pueden alterar el tratamiento. No presumir exención educativa. Preparar revisión del Checkout/factura y configuración fiscal antes de ampliar ventas. Fuentes: [AEAT tipos](https://sede.agenciatributaria.gob.es/Sede/iva/calculo-iva-repercutido-clientes/tipos-impositivos-iva.html), [Ley IVA, art. 20](https://www.boe.es/buscar/act.php?id=BOE-A-1992-28740), [AEAT servicios electrónicos](https://sede.agenciatributaria.gob.es/Sede/no-residentes/iva-empresarios-profesionales-no-establecidos/iva-telecomunicaciones-servicios-electronicos.html).

## Inventario inicial de tratamientos

| Finalidad / datos | Código/proveedor observado | Decisión pendiente |
|---|---|---|
| Cuenta: correo, nombre, credenciales de Auth, códigos temporales | Supabase Auth, profiles, verification_codes; Resend | Base por finalidad, información al registrarse, retención/códigos, exportación y baja |
| Escuelas, roles, alumnos e invitaciones | organizations, memberships, invitations, acceso por curso | Escuela responsable y Delunivo encargado sólo cuando actúe por instrucciones; contrato art. 28 y alcance del perfil entre escuelas |
| Compras, suscripciones, descuentos, afiliados | Stripe/Connect, purchases, billing, referrals | Vendedor, obligaciones legales, plazos fiscales y prevención de fraude; no reutilizar para marketing sin base |
| Vídeos, HTML, archivos y progreso | Mux, Supabase Storage, lessons, video_views | Licencias, acceso, retención y eliminación; telemetría de Mux y transferencias |
| Soporte Run as, sesión original cifrada y auditoría | support_impersonation_sessions; AES-GCM | Acceso por personal autorizado, plazo de auditoría, información al interesado y procedimiento de incidentes |
| Hosting/logs de infraestructura | Vercel y proveedores | Datos efectivamente registrados, minimización, región, DPA/subencargados y alertas |

Modelo **propuesto, pendiente de validar**: Delunivo responsable de cuentas SaaS/seguridad/facturación propia; escuela responsable de alumnos/venta/marketing; Delunivo encargado de tratamientos del curso ejecutados exclusivamente por instrucciones. El perfil entre escuelas, soporte y analítica necesitan evaluación específica. La etiqueta contractual no decide los hechos. Fuentes: [AEPD responsable/encargado](https://www.aepd.es/preguntas-frecuentes/2-tus-obligaciones-como-responsable-del-tratamiento/8-responsable-y-encargado-del-tratamiento/FAQ-0251-como-se-si-soy-responsable-o-encargado), [RGPD](https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=celex%3A32016R0679).

## Cookies y embeds

Inventario estático: cookies de sesión Supabase; referido de plataforma; cookies de soporte/salida; reproductor Mux y iframes de autores. No se detectó módulo propio de píxel publicitario. Esto **no prueba** que todos los accesos sean técnicos/exentos: registrar red y almacenamiento antes/después de login, referral, playback y embed, con un entorno aislado equivalente.

No añadir banner sin usos no exentos acreditados. Para esos usos, diseñar bloqueo previo efectivo, aceptar/rechazar/configurar con igual facilidad y retirada posterior. El consentimiento de marketing debe ser separado, voluntario y no premarcado. El texto de privacidad informa; no exige por sí mismo un consentimiento genérico. Fuentes: [AEPD cookies](https://www.aepd.es/guias/guia-cookies.pdf), [AEPD información y consentimiento](https://www.aepd.es/preguntas-frecuentes/2-tus-obligaciones-como-responsable-del-tratamiento/6-el-deber-de-informacion/FAQ-0248-sobre-si-el-usuario-tiene-que-dar-consentimiento-a-clausula-de-privacidad).

## Criterios de cierre del lote legal

Identidades/contratos y tratamientos confirmados; plazos concretos de conservación; DPA/regiones/transferencias revisados; rutas y enlaces implementados; prueba de consentimiento/bloqueo cuando proceda; compra y confirmación duradera verificadas sin cobros reales; revisión jurídica/fiscal; evaluación de accesibilidad aplicable ([Ley 11/2023](https://www.boe.es/buscar/act.php?id=BOE-A-2023-11022)). No hay publicación ni aprobación jurídica implícitas en este borrador.
