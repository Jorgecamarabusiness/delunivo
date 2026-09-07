"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input, inputClassName } from "@/components/ui/Input";
import type { AccountDeletionPreview } from "@/lib/account-deletion/preview";
import { requestAccountDeletionAction } from "@/app/cuenta/eliminar/actions";

type FormState = { error?: string };
const INITIAL: FormState = {};

export function AccountDeletionRequestForm({
  preview,
}: {
  preview: AccountDeletionPreview;
}) {
  const [state, formAction, pending] = useActionState(
    requestAccountDeletionAction,
    INITIAL
  );
  const organizationsWithoutSuccessor = preview.organizations.filter(
    (organization) => organization.needsSuccessor && organization.candidates.length === 0
  );
  const lacksSuperAdminSuccessor =
    preview.lastSuperAdmin && preview.superAdminCandidates.length === 0;
  const isBlocked = Boolean(preview.blockedReason) || organizationsWithoutSuccessor.length > 0 || lacksSuperAdminSuccessor;

  return (
    <form action={formAction} className="mt-8 flex max-w-3xl flex-col gap-7">
      <input type="hidden" name="targetId" value={preview.targetId} />

      <Alert variant="warning">
        Esta solicitud elimina tu identidad global, el perfil, las sesiones y el progreso
        en todas las escuelas de Delunivo. Perderás el acceso desde esta cuenta a sus cursos.
        Las escuelas, cursos, medios y los registros mínimos de pagos o reclamaciones
        se conservan. Si la cuenta es propietaria de una escuela, primero debe quedar
        una persona administradora que pueda hacerse cargo.
      </Alert>

      <section className="rounded-lg border border-border p-5" aria-labelledby="deletion-scope-title">
        <h2 id="deletion-scope-title" className="font-semibold">Alcance comprobado</h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Escuelas</dt>
            <dd className="mt-1 text-lg font-semibold">{preview.counts.schools}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Cursos que se conservan</dt>
            <dd className="mt-1 text-lg font-semibold">{preview.counts.courses}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Compras conservadas</dt>
            <dd className="mt-1 text-lg font-semibold">{preview.counts.purchases}</dd>
          </div>
        </dl>
      </section>

      {preview.organizations.some((organization) => organization.needsSuccessor) ? (
        <section className="rounded-lg border border-border p-5" aria-labelledby="successors-title">
          <h2 id="successors-title" className="font-semibold">Sucesión de escuelas</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Las suscripciones SaaS y cuentas Connect de la escuela continúan. Elige
            un administrador existente para cada escuela que hoy depende de esta cuenta.
          </p>
          <div className="mt-5 flex flex-col gap-5">
            {preview.organizations
              .filter((organization) => organization.needsSuccessor)
              .map((organization) => (
                <div key={organization.id} className="rounded-md bg-muted/50 p-4">
                  <p className="font-medium">{organization.name}</p>
                  {organization.candidates.length > 0 ? (
                    <Field label="Nueva persona propietaria" htmlFor={`successor-${organization.id}`} className="mt-3">
                      <select
                        id={`successor-${organization.id}`}
                        name={`successor_${organization.id}`}
                        required
                        defaultValue=""
                        className={inputClassName}
                      >
                        <option value="" disabled>Elige un administrador</option>
                        {organization.candidates.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.name || candidate.email} · {candidate.email}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : (
                    <Alert variant="warning" className="mt-3">
                      No hay otro administrador activo que pueda asumir esta escuela. Invita
                      y deja que acepte la invitación antes de volver aquí. {" "}
                      <Link href={`/o/${organization.slug}/admin/usuarios`} className="font-medium underline">
                        Gestionar administradores de {organization.name}
                      </Link>
                    </Alert>
                  )}
                </div>
              ))}
          </div>
        </section>
      ) : null}

      {preview.lastSuperAdmin ? (
        <section className="rounded-lg border border-border p-5" aria-labelledby="superadmin-successor-title">
          <h2 id="superadmin-successor-title" className="font-semibold">Sucesión de la plataforma</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta es la última cuenta superadministradora. Selecciona otra cuenta activa
            para que la plataforma no quede sin administración.
          </p>
          {preview.superAdminCandidates.length > 0 ? (
            <Field label="Nuevo superadministrador" htmlFor="superadmin-successor" className="mt-4">
              <select
                id="superadmin-successor"
                name="superAdminSuccessor"
                required
                defaultValue=""
                className={inputClassName}
              >
                <option value="" disabled>Elige una cuenta activa</option>
                {preview.superAdminCandidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name || candidate.email} · {candidate.email}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Alert variant="warning" className="mt-4">
              No hay una cuenta activa disponible para asumir la administración de la plataforma.
              La persona sucesora debe registrarse y verificar su correo en {" "}
              <Link href="/register" className="font-medium underline">el registro de Delunivo</Link>.
              Después vuelve a esta pantalla para seleccionarla y confirmar la transferencia.
            </Alert>
          )}
        </section>
      ) : null}

      {!preview.isSelf ? (
        <Field
          label="Motivo de la eliminación administrativa"
          htmlFor="deletion-reason"
          hint="Solo para el registro interno de la solicitud. Entre 5 y 500 caracteres."
        >
          <textarea
            id="deletion-reason"
            name="reason"
            required
            minLength={5}
            maxLength={500}
            rows={4}
            className={`${inputClassName} min-h-28 resize-y`}
          />
        </Field>
      ) : null}

      <section className="rounded-lg border border-red-200 p-5" aria-labelledby="confirmation-title">
        <h2 id="confirmation-title" className="font-semibold">Confirmación</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Para continuar, escribe exactamente <strong className="text-foreground">{preview.email}</strong>
          {preview.isSelf ? " y confirma tu contraseña actual." : " y confirma tu contraseña actual de superadministración."}
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Correo de la cuenta que se elimina" htmlFor="deletion-email-confirmation">
            <Input
              id="deletion-email-confirmation"
              name="confirmation"
              type="email"
              required
              autoComplete="off"
            />
          </Field>
          <Field label="Tu contraseña actual" htmlFor="deletion-password">
            <Input
              id="deletion-password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </Field>
        </div>
      </section>

      {preview.blockedReason ? <Alert variant="error">{preview.blockedReason}</Alert> : null}
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" variant="danger" disabled={pending || isBlocked} aria-busy={pending}>
          {pending ? "Solicitando eliminación…" : preview.isSelf ? "Solicitar eliminación de mi cuenta" : "Solicitar eliminación de esta cuenta"}
        </Button>
        <Link href={preview.isSelf ? "/perfil" : "/admin/plataforma/cuentas"} className="text-sm font-medium underline underline-offset-4">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
