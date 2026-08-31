# Delunivo: estado y decisiones vigentes

Ultima actualizacion: 2026-08-31.

## Producto

Delunivo es una plataforma SaaS multi-tenant para que creadores y academias creen cursos, organicen modulos y lecciones, suban video, gestionen alumnos y vendan acceso. Ivan Organico es la primera organizacion real y sirve para validar el producto antes de generalizarlo.

## Arquitectura actual

- Next.js 16.3.3 App Router, React 19, TypeScript y Tailwind CSS 4.
- Supabase para autenticacion, Postgres y Storage.
- Stripe y Stripe Connect para cobros. Whop está desactivado: su endpoint
  responde sin efectos y el acceso vigente se obtiene mediante Stripe o una
  invitacion explicita del admin.
- Mux para video y Resend para email.
- Tenancy publica por rutas `/o/<slug>`; no depende de subdominios.
- Administracion en `/admin`; catalogo, compra y aprendizaje en las rutas publicas.
- Control comercial exclusivo de superadministradores en `/admin/plataforma`: precio para nuevas altas, estado real de Stripe, acceso gratuito, pruebas, descuentos y correos de prueba.
- Afiliados de plataforma con enlace opaco: 10% para el referente por cada empresa con pago vigente, 10% de bienvenida durante tres facturas pagadas y tope normal del 50%, ampliable por el superadministrador para una excepción documentada.
- Soporte “Run as” exclusivo de superadministradores, con motivo obligatorio, sesión Auth separada, auditoría, caducidad de 15 minutos y restauración de la sesión original. Las acciones de facturación e integraciones permanecen bloqueadas durante la intervención.
- El header global ofrece accesos segun rol a la portada de Delunivo, la portada de la empresa, administracion, control de plataforma y perfil. El perfil agrupa los cursos comprados o invitados del usuario aunque pertenezcan a empresas distintas.
- Identidad de plataforma centralizada en `src/lib/brand.ts` y marca de cada organizacion en su configuracion.

## Decisiones que no deben reabrirse sin nueva evidencia

- El nombre de producto y de los recursos externos visibles es Delunivo.
- La infraestructura base de produccion (dominio, hosting, base de datos, email, video y cobros) debe estar activa antes de incorporar al primer cliente real; la ampliacion posterior se decide por uso medido.
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
- La URL canonica de produccion es `https://www.delunivo.com`; `https://delunivo.com` redirige a `www` y la URL tecnica de Vercel no se entrega como URL de producto. Supabase Auth admite el dominio canonico y conserva la URL tecnica solo como redirect de compatibilidad.
- El equipo de Vercel esta en Pro, con tarjeta activa y datos fiscales de autonomo. El aviso de gasto bajo demanda esta fijado en 20 USD adicionales, con notificaciones activas y sin pausa automatica de produccion.
- La organizacion de Supabase esta en Pro con Spend Cap activo y un unico proyecto, `Delunivo` (`jgxqdzmmeveksseflyst`). El proyecto inicial vacio fue verificado sin tablas, usuarios ni archivos y eliminado el 2026-08-31; el coste proyectado quedo en 25 USD/mes.
- Resend entrega desde `Delunivo <hola@mail.delunivo.com>` con el dominio `mail.delunivo.com` verificado (DKIM, SPF y DMARC). Un restablecimiento real de contrasena llego correctamente en produccion.
- Stripe live esta activo para la suscripcion de plataforma y Stripe Connect. Produccion usa clave live y Preview clave de prueba; los webhooks de plataforma y Connect apuntan a `www.delunivo.com`. La cuenta bancaria de Jorge recibe la suscripcion de Delunivo; cada profesor debe conectar su propia cuenta para recibir ventas de cursos.
- La politica fiscal provisional no bloquea la auditoria: los precios publicados se consideran finales con IVA incluido y, para operaciones espanolas, se reserva el 21 % general. La suscripcion de Delunivo se clasifica como SaaS y los cursos grabados bajo demanda como servicios electronicos; no se presume exencion educativa. Stripe Tax y OSS se automatizaran antes de escalar ventas internacionales o superar el umbral B2C intracomunitario aplicable. Mientras no exista esa automatizacion, cualquier cobro real debe facturarse y contabilizarse con su desglose fiscal.
- Mux usa el entorno `Production`, plan Pay as you go, reproduccion firmada y webhook `https://www.delunivo.com/api/webhooks/mux`. El webhook real respondio 200 y aplico un video de 53:12 a 720p; tambien hay evidencia separada de subida y reproduccion a 1080p.
- Los identificadores internos estables, referencias de proyecto, buckets, tablas, claves y URLs de API no se renombran cuando el cambio no es cosmetico: preservarlos evita roturas y no expone una marca distinta al usuario.
- El esquema real vive en Supabase. `docs/database.md` mantiene el inventario confirmado y el SQL historico; desde 2026-08-30, los cambios nuevos tambien se guardan como migraciones versionadas. Un archivo de migracion no demuestra que se haya aplicado.
- El precio inicial de plataforma es 30 EUR/mes y se lee de `platform_settings`; cambiarlo no altera las suscripciones de Stripe ya creadas.
- La suspensión comercial se aplica tanto en la interfaz como en server actions y RLS; no se puede editar una empresa suspendida mediante la Data API. Los alumnos mantienen el acceso ya concedido.
- Los IDs de cliente y suscripción de Stripe son únicos por empresa y los webhooks fallan explícitamente si no encuentran exactamente una fila, para que Stripe pueda reintentarlos.
- Un propietario de varias empresas puede elegir cuál gestionar en `/admin/facturacion`; el ID seleccionado se vuelve a validar como owner antes de abrir Checkout o el portal de Stripe.
- Los cursos se crean privados, pueden alternarse entre públicos y privados y solo se eliminan si no tienen ventas; la base de datos protege ese historial con `ON DELETE RESTRICT`. Los recursos de Mux se limpian mediante una cola persistente con reintento diario.
- La compra de cursos es un pago unico y concede acceso exclusivamente al curso comprado; no es una suscripcion del alumno ni desbloquea el catalogo completo de la empresa.
- El control de plataforma lista alumnos con filtro por empresa y mantiene las fichas comerciales de empresa cerradas hasta que el superadministrador decide desplegarlas. Los descuentos manuales pueden aplicarse una vez o para siempre y se sincronizan con Stripe de forma idempotente.
- El esquema de afiliados y “Run as” está aplicado y verificado en Supabase. Las tablas son server-only y los eventos de Stripe exigen el ID exacto de la suscripción vigente para que una factura o baja antigua no cambie estado ni descuentos.
- Las transiciones de ruta y los envíos de formularios usan indicadores de carga compartidos; las consultas independientes de cursos y membresías se ejecutan en paralelo para reducir esperas.
- Codex usa `AGENTS.md`, las skills de `.agents/skills/` y dos revisores read-only en `.codex/agents/`. No se mantienen instrucciones duplicadas para otros agentes.

## Prioridades

1. Validar que Sata pueda crear, vender y entregar cursos sin friccion.
2. Corregir bloqueos reales de activacion, cobro y experiencia del alumno.
3. Mantener seguridad, aislamiento y fiabilidad de integraciones.
4. Consolidar componentes o tokens solo cuando aparezca duplicacion real.
5. Completar la auditoria final de produccion y entregar una cuenta real a Sata en cuanto pase el checklist bloqueante.

## Riesgos y pendientes conocidos

- La subida larga de Mux esta validada a 720p y la de 1080p con un archivo corto; sigue pendiente repetir ambas condiciones en un mismo video largo 1080p cuando haya un archivo real disponible.
- El bloqueo del reproductor causado por la carga server-side de `jsdom` desde `isomorphic-dompurify` quedó corregido y desplegado el 2026-08-31. El aula autenticada se verificó en `www.delunivo.com`, incluida la lección, el índice y el progreso, sin errores ni avisos de consola.
- Stripe Tax aun no esta activado en Checkout. No bloquea las pruebas ni el alta de Sata, pero antes de escalar cobros debe automatizarse con precios inclusivos, recopilacion de direccion/NIF-IVA y los codigos fiscales definidos para SaaS y cursos grabados. El checkout fail-closed que elimina el fallback de ventas a la cuenta de plataforma, bloquea duplicados y endurece el webhook esta desplegado en produccion desde el 2026-08-31, con su migracion aplicada y verificada.
- Next.js 16.3.3, el programa de afiliados y “Run as” están desplegados en producción desde el 2026-08-31. `IMPERSONATION_SESSION_KEY` está configurada como secreto de Vercel Production y el despliegue `dpl_4iEm1EK4yThAk78e82Pm4GNvZJHN` quedó promovido y verificado sin errores de runtime.
- Quedan como comprobaciones operativas no bloqueantes una entrada y salida real de “Run as” sobre una cuenta de prueba y observar un ciclo real de facturación con afiliado. No deben simularse sobre usuarios o cobros reales solo para completar el checklist.
- Las condiciones comerciales rechazan formularios obsoletos y, si una escritura optimista pierde una carrera, releen y sincronizan en Stripe la versión ganadora. Mientras solo opere un superadministrador no hay concurrencia práctica; antes de habilitar varios conviene sustituir esta reconciliación acotada por una outbox serializada por suscripción.
- Las acciones de Stripe, Resend, Vercel y Supabase pueden requerir pasos manuales y no deben darse por completadas sin confirmacion.

## Mantenimiento de este documento

Actualizalo cuando cambien de forma duradera el producto, la arquitectura, el estado de una integracion, las prioridades, una decision o un riesgo conocido. No registres aqui cambios pasajeros ni el detalle de cada tarea.
