# Delunivo: estado y decisiones vigentes

Ultima actualizacion: 2026-08-31.

## Producto

Delunivo es una plataforma SaaS multi-tenant para que creadores y academias creen cursos, organicen modulos y lecciones, suban video, gestionen alumnos y vendan acceso. Ivan Organico es la primera organizacion real y sirve para validar el producto antes de generalizarlo.

## Arquitectura actual

- Next.js 16 App Router, React 19, TypeScript y Tailwind CSS 4.
- Supabase para autenticacion, Postgres y Storage.
- Stripe y Stripe Connect para cobros. Whop está desactivado: su endpoint
  responde sin efectos y el acceso vigente se obtiene mediante Stripe o una
  invitacion explicita del admin.
- Mux para video y Resend para email.
- Tenancy publica por rutas `/o/<slug>`; no depende de subdominios.
- Administracion en `/admin`; catalogo, compra y aprendizaje en las rutas publicas.
- Control comercial exclusivo de superadministradores en `/admin/plataforma`: precio para nuevas altas, estado real de Stripe, acceso gratuito, pruebas, descuentos y correos de prueba.
- Identidad de plataforma centralizada en `src/lib/brand.ts` y marca de cada organizacion en su configuracion.

## Decisiones que no deben reabrirse sin nueva evidencia

- El nombre de producto y de los recursos externos visibles es Delunivo.
- Se prioriza validar con el primer cliente antes de invertir en dominio, marca o infraestructura adicional.
- Se aplica YAGNI: una necesidad particular de Ivan no se convierte automaticamente en una feature general.
- El sistema debe preservar aislamiento multi-tenant en datos, permisos, cursos, alumnos, marca y cobros.
- El flujo publico vigente usa `/o/<slug>`.
- Codex ejecuta directamente los cambios externos autorizados cuando dispone de acceso; solo pide a Jorge los pasos que realmente requieren su cuenta o una decision.

## Sistema de interfaz

- Primitivas principales en `src/components/ui`.
- Layouts compartidos en `src/components/layout`.
- Tokens en `src/app/globals.css`, incluido el color dinamico `--accent` por organizacion.
- Las nuevas pantallas deben ser mobile-first y reutilizar componentes existentes antes de crear variantes locales.

## Estado operativo

- El rebranding de producto a Delunivo esta en `main`. GitHub, el equipo y proyecto de Vercel, el dominio tecnico y el nombre visible del proyecto Supabase usan Delunivo.
- La carpeta local ya se llama `delunivo`.
- La URL y la configuracion publica de Vercel usan `https://delunivo.vercel.app`; el dominio y el redirect de autenticacion anteriores se retiraron.
- Los identificadores internos estables, referencias de proyecto, buckets, tablas, claves y URLs de API no se renombran cuando el cambio no es cosmetico: preservarlos evita roturas y no expone una marca distinta al usuario.
- El esquema real vive en Supabase. `docs/database.md` mantiene el inventario confirmado y el SQL historico; desde 2026-08-30, los cambios nuevos tambien se guardan como migraciones versionadas. Un archivo de migracion no demuestra que se haya aplicado.
- El precio inicial de plataforma es 30 EUR/mes y se lee de `platform_settings`; cambiarlo no altera las suscripciones de Stripe ya creadas.
- La suspensión comercial se aplica tanto en la interfaz como en server actions y RLS; no se puede editar una empresa suspendida mediante la Data API. Los alumnos mantienen el acceso ya concedido.
- Los IDs de cliente y suscripción de Stripe son únicos por empresa y los webhooks fallan explícitamente si no encuentran exactamente una fila, para que Stripe pueda reintentarlos.
- Un propietario de varias empresas puede elegir cuál gestionar en `/admin/facturacion`; el ID seleccionado se vuelve a validar como owner antes de abrir Checkout o el portal de Stripe.
- Los cursos se crean privados, pueden alternarse entre públicos y privados y solo se eliminan si no tienen ventas; la base de datos protege ese historial con `ON DELETE RESTRICT`. Los recursos de Mux se limpian mediante una cola persistente con reintento diario.
- Las transiciones de ruta y los envíos de formularios usan indicadores de carga compartidos; las consultas independientes de cursos y membresías se ejecutan en paralelo para reducir esperas.
- Codex usa `AGENTS.md`, las skills de `.agents/skills/` y dos revisores read-only en `.codex/agents/`. No se mantienen instrucciones duplicadas para otros agentes.

## Prioridades

1. Validar que Sata pueda crear, vender y entregar cursos sin friccion.
2. Corregir bloqueos reales de activacion, cobro y experiencia del alumno.
3. Mantener seguridad, aislamiento y fiabilidad de integraciones.
4. Consolidar componentes o tokens solo cuando aparezca duplicacion real.
5. Decidir y registrar el dominio propio de Delunivo antes de sustituir la URL tecnica de Vercel.

## Riesgos y pendientes conocidos

- El vertical Mux esta configurado y validado de extremo a extremo con una
  subida y reproduccion reales.
- Resend todavia necesita un dominio propio verificado y `RESEND_FROM_EMAIL`
  en Vercel para entregar a destinatarios reales en produccion.
- Hay vulnerabilidades de dependencias previamente detectadas que requieren una tarea separada y enfocada.
- Las acciones de Stripe, Resend, Vercel y Supabase pueden requerir pasos manuales y no deben darse por completadas sin confirmacion.

## Mantenimiento de este documento

Actualizalo cuando cambien de forma duradera el producto, la arquitectura, el estado de una integracion, las prioridades, una decision o un riesgo conocido. No registres aqui cambios pasajeros ni el detalle de cada tarea.
