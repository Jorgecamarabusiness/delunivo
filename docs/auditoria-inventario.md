# Inventario de superficie — auditoría 2026-09-06

Generado desde el árbol local. Una ruta inventariada no equivale a un flujo probado. Los prefijos `/o/<slug>` se reescriben a las mismas páginas (incluidas variantes de auth/admin). Roles y cobertura: `auditoria-profesional.md`.

## Páginas y handlers

| Archivo | Superficie |
|---|---|
| src/app/admin/configuracion/page.tsx | Pantalla |
| src/app/admin/cursos/[id]/ajustes/page.tsx | Pantalla |
| src/app/admin/cursos/[id]/lecciones/[lessonId]/page.tsx | Pantalla |
| src/app/admin/cursos/[id]/page.tsx | Pantalla |
| src/app/admin/cursos/page.tsx | Pantalla |
| src/app/admin/emails/page.tsx | Pantalla |
| src/app/admin/estadisticas/page.tsx | Pantalla |
| src/app/admin/facturacion/page.tsx | Pantalla |
| src/app/admin/marca/page.tsx | Pantalla |
| src/app/admin/page.tsx | Pantalla |
| src/app/admin/plataforma/page.tsx | Pantalla |
| src/app/admin/usuarios/page.tsx | Pantalla |
| src/app/api/admin/media/upload/route.ts | HTTP handler |
| src/app/api/admin/mux/uploads/route.ts | HTTP handler |
| src/app/api/admin/mux/video-assets/[id]/route.ts | HTTP handler |
| src/app/api/cron/mux-deletions/route.ts | HTTP handler |
| src/app/api/support/run-as/exit/route.ts | HTTP handler |
| src/app/api/video/[id]/playback/route.ts | HTTP handler |
| src/app/api/webhooks/mux/route.ts | HTTP handler |
| src/app/api/webhooks/stripe-connect/route.ts | HTTP handler |
| src/app/api/webhooks/stripe/route.ts | HTTP handler |
| src/app/api/webhooks/whop/route.ts | HTTP handler |
| src/app/crear-empresa/page.tsx | Pantalla |
| src/app/cursos/[id]/aprender/page.tsx | Pantalla |
| src/app/cursos/[id]/page.tsx | Pantalla |
| src/app/cursos/page.tsx | Pantalla |
| src/app/forgot-password/page.tsx | Pantalla |
| src/app/invitaciones/[token]/page.tsx | Pantalla |
| src/app/login/page.tsx | Pantalla |
| src/app/page.tsx | Pantalla |
| src/app/perfil/page.tsx | Pantalla |
| src/app/referidos/[code]/route.ts | HTTP handler |
| src/app/register/page.tsx | Pantalla |
| src/app/reset-password/page.tsx | Pantalla |
| src/app/verificar/page.tsx | Pantalla |

## Server Actions

| Archivo | Función |
|---|---|
| src/app/verificar/actions.ts | verifyCodeAction |
| src/app/verificar/actions.ts | resendCodeAction |
| src/app/reset-password/actions.ts | resetPasswordAction |
| src/app/register/actions.ts | registerAction |
| src/app/invitaciones/[token]/actions.ts | acceptInvitationWithNewAccountAction |
| src/app/invitaciones/[token]/actions.ts | acceptInvitationWithExistingSessionAction |
| src/app/forgot-password/actions.ts | forgotPasswordAction |
| src/app/login/actions.ts | loginAction |
| src/app/cursos/[id]/aprender/actions.ts | setLessonCompletedAction |
| src/app/cursos/[id]/actions.ts | createStripeCheckoutAction |
| src/app/actions.ts | createCompanyAction |
| src/app/admin/usuarios/actions.ts | inviteStudentAction |
| src/app/admin/usuarios/actions.ts | inviteAdminAction |
| src/app/admin/usuarios/actions.ts | removeStudentAction |
| src/app/admin/usuarios/actions.ts | reactivateStudentAction |
| src/app/admin/usuarios/actions.ts | removeAdminAction |
| src/app/admin/usuarios/actions.ts | revokeInvitationAction |
| src/app/admin/facturacion/actions.ts | subscribeAction |
| src/app/admin/facturacion/actions.ts | openBillingPortalAction |
| src/app/admin/facturacion/actions.ts | ensureReferralCodeAction |
| src/app/admin/plataforma/runAsActions.ts | startRunAsAction |
| src/app/admin/plataforma/runAsActions.ts | stopRunAsAction |
| src/app/admin/plataforma/actions.ts | updatePlatformPriceAction |
| src/app/admin/plataforma/actions.ts | updateOrganizationCommercialTermsAction |
| src/app/admin/marca/actions.ts | updateBrandingAction |
| src/app/admin/emails/actions.ts | addAdminEmailAction |
| src/app/admin/emails/actions.ts | toggleAdminEmailAction |
| src/app/admin/emails/actions.ts | deleteAdminEmailAction |
| src/app/admin/configuracion/actions.ts | connectStripeAction |
| src/app/admin/cursos/actions.ts | createCourseAction |
| src/app/admin/cursos/actions.ts | deleteCourseAction |
| src/app/admin/cursos/[id]/lecciones/[lessonId]/actions.ts | updateLessonBlocksAction |
| src/app/admin/cursos/[id]/lecciones/[lessonId]/actions.ts | updateLessonTitleAction |
| src/app/admin/cursos/[id]/lecciones/[lessonId]/actions.ts | deleteLessonAction |
| src/app/admin/cursos/[id]/ajustes/actions.ts | updateCourseSettingsAction |
| src/app/admin/cursos/[id]/actions.ts | createLessonAction |
| src/app/admin/cursos/[id]/actions.ts | createSectionAction |
| src/app/admin/cursos/[id]/actions.ts | updateCourseTitleAction |
| src/app/admin/cursos/[id]/actions.ts | updateCourseStatusAction |
| src/app/admin/cursos/[id]/actions.ts | updateSectionTitleAction |
| src/app/admin/cursos/[id]/actions.ts | updateSectionStatusAction |
| src/app/admin/cursos/[id]/actions.ts | updateLessonStatusAction |
| src/app/admin/cursos/[id]/actions.ts | deleteSectionAction |
| src/app/admin/cursos/[id]/actions.ts | deleteLessonAction |
| src/app/admin/cursos/[id]/actions.ts | reorderSectionsAction |
| src/app/admin/cursos/[id]/actions.ts | reorderLessonsAction |

Además: `src/lib/auth/actions.ts` (`signOutAction`) y `src/lib/storage/actions.ts` (`getVideoPreviewUrlAction`).

## Límites de confianza

Navegador → Server Actions/HTTP (sesión, campos, origen); servidor → Supabase privilegiado (scope y grants); PostgREST directo → RLS/RPC; Stripe/Mux → webhook firmado (estado/idempotencia); reproductor → Mux (JWT bearer temporal); contenido del autor → HTML/iframe/media; soporte → sesión separada auditada; CI/fixtures → base aislada.

## Base de datos pública confirmada por catálogo (solo lectura)

Proyecto `jgxqdzmmeveksseflyst`, 2026-09-06. Las 25 tablas tienen RLS activa; no hay vistas ni vistas materializadas públicas. Que exista RLS no prueba su aislamiento completo.

- `admin_emails`
- `courses`
- `invitation_courses`
- `invitations`
- `lessons`
- `mux_deletion_jobs`
- `mux_webhook_events`
- `organization_admins`
- `organization_billing`
- `organization_integrations`
- `organization_referral_codes`
- `organization_referrals`
- `organization_students`
- `organizations`
- `platform_settings`
- `profiles`
- `purchases`
- `sections`
- `stripe_checkout_attempts`
- `stripe_platform_webhook_events`
- `student_course_access`
- `support_impersonation_sessions`
- `verification_codes`
- `video_assets`
- `video_views`

### Funciones y RPC

Incluye funciones de trigger, que no equivalen a endpoints invocables; los grants se revisan por firma y rol. El inventario no concede aprobación automática a una función `SECURITY DEFINER`.

| Nombre | Firma | Seguridad |
|---|---|---|
| bind_support_impersonation_auth_session | p_token_hash text, p_target_auth_session_id uuid, p_target_user_id uuid | DEFINER |
| consume_verification_code | p_email text, p_code_hash text, p_purpose text | DEFINER |
| create_invitation_with_courses | p_organization_id uuid, p_email text, p_invite_type text, p_token_hash text, p_expires_at timestamp with time zone, p_note text, p_course_ids uuid[] | DEFINER |
| handle_new_user | (sin argumentos) | DEFINER |
| has_course_access | target_course_id uuid | DEFINER |
| is_admin | (sin argumentos) | DEFINER |
| is_org_admin | org_id uuid | DEFINER |
| is_org_owner | org_id uuid | DEFINER |
| is_org_student | org_id uuid | DEFINER |
| is_super_admin | (sin argumentos) | DEFINER |
| issue_verification_code | p_email text, p_code_hash text, p_purpose text | DEFINER |
| queue_mux_video_deletion | (sin argumentos) | DEFINER |
| revoke_invitation | p_invitation_id uuid | DEFINER |
| apply_mux_video_event | p_video_asset_id uuid, p_mux_upload_id text, p_mux_asset_id text, p_mux_playback_id text, p_status text, p_event_created_at timestamp with time zone, p_duration_seconds numeric, p_aspect_ratio text, p_error_type text, p_error_message text | INVOKER |
| apply_platform_billing_status_event | p_customer_id text, p_subscription_id text, p_status text, p_event_at timestamp with time zone | INVOKER |
| apply_platform_subscription_checkout_event | p_organization_id uuid, p_customer_id text, p_subscription_id text, p_event_at timestamp with time zone | INVOKER |
| apply_stripe_affiliate_billing_event | p_event_id text, p_organization_id uuid, p_event_kind text, p_event_at timestamp with time zone, p_amount_paid integer | INVOKER |
| attach_organization_referral | p_code text, p_referred_organization_id uuid, p_referred_owner_id uuid | INVOKER |
| claim_mux_deletion_jobs | p_limit integer | INVOKER |
| claim_mux_webhook_event | p_event_id text, p_event_type text, p_payload jsonb, p_mux_created_at timestamp with time zone | INVOKER |
| claim_stripe_platform_webhook_event | p_event_id text, p_event_type text | INVOKER |
| close_support_impersonation_audit | p_token_hash text, p_status text, p_ended_by uuid, p_end_reason text | INVOKER |
| complete_invitation_acceptance | p_invitation_id uuid, p_user_id uuid | INVOKER |
| has_org_platform_access | org_id uuid | INVOKER |
| refresh_organization_effective_discount | p_organization_id uuid | INVOKER |
| register_mux_direct_upload | p_video_asset_id uuid, p_organization_id uuid, p_course_id uuid, p_lesson_id uuid, p_block_id uuid, p_created_by uuid, p_mux_upload_id text | INVOKER |
| start_support_impersonation_audit | p_actor_user_id uuid, p_target_user_id uuid, p_token_hash text, p_encrypted_actor_session text, p_reason text, p_expires_at timestamp with time zone, p_ip_address inet, p_user_agent text | INVOKER |
| touch_affiliate_row | (sin argumentos) | INVOKER |
| touch_mux_video_row | (sin argumentos) | INVOKER |
| update_lesson_blocks_with_mux_assets | p_lesson_id uuid, p_blocks jsonb | INVOKER |
| validate_organization_referral_scope | (sin argumentos) | INVOKER |
| validate_referral_code_creator | (sin argumentos) | INVOKER |
| validate_video_asset_scope | (sin argumentos) | INVOKER |

## Storage, tareas y terceros

| Superficie | Evidencia y alcance |
|---|---|
| `course-videos` | Privado, vacío en consulta agregada; contradice su eliminación documentada. No se ha eliminado. |
| `lesson-media` | Privado, 7 objetos agregados; contenido y acceso de cada objeto pendientes. |
| `public-media` | Público, 4 objetos agregados; falta trazabilidad de propósito/propietario en código y docs. No se inspeccionaron objetos. |
| Cron Mux | `vercel.json`: `/api/cron/mux-deletions`, `0 3 * * *`; autenticación `CRON_SECRET`, cola persistente/reintentos. Ejecución real no observada. |
| Stripe plataforma | Suscripción SaaS, portal, afiliados, webhook `/api/webhooks/stripe`; llamadas reales no ejecutadas. |
| Stripe Connect | Cuenta por escuela, Checkout por curso, webhook `/api/webhooks/stripe-connect`; cancelación/reembolso pendientes. |
| Mux | Upload directo por chunks, assets firmados, webhook `/api/webhooks/mux`, borrado en cola; proveedor no mutado. |
| Whop | Endpoint histórico `/api/webhooks/whop` desactivado sin efectos; tablas/campos históricos preservados. |
| Supabase | Auth, PostgREST/RPC y Storage. Único proyecto real confirmado; desarrollo local apuntaba a él y no es aislado por su nombre. |
| Resend | Email transaccional centralizado; apagado en pruebas, ningún envío real. |
| Vercel | Hosting/cron; no deploy ni cambios de configuración remota. |
| Contenido externo | Rich HTML, imágenes, iframes de autor y reproductor Mux: política/red/consentimiento por completar. |

No se inventaría el contenido de tablas de sistema ni datos personales. La revisión del catálogo público no demuestra ausencia de otros jobs/extensiones en esquemas internos; queda pendiente la revisión operativa con baseline aislada.
