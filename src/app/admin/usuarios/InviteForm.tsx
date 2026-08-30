"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import type { InvitationInput } from "./actions";

type CourseOption = { id: string; title: string };

export function InviteForm({
  studentAction,
  adminAction,
  canInviteAdmins,
  courses,
}: {
  studentAction: (
    input: InvitationInput
  ) => Promise<{ error: string | null; created?: boolean }>;
  adminAction: (
    input: InvitationInput
  ) => Promise<{ error: string | null; created?: boolean }>;
  canInviteAdmins: boolean;
  courses: CourseOption[];
}) {
  const router = useRouter();
  const formId = "user-invite";
  const [inviteType, setInviteType] = useState<"student" | "admin">("student");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const action = inviteType === "admin" ? adminAction : studentAction;
    const result = await action({
      email,
      note,
      courseIds: inviteType === "student" ? selectedCourseIds : [],
    });
    setPending(false);

    if (result.error) {
      setError(result.error);
      if (result.created) router.refresh();
      return;
    }

    setEmail("");
    setNote("");
    setSelectedCourseIds([]);
    setSent(true);
    router.refresh();
    setTimeout(() => setSent(false), 4000);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-4 rounded-lg border border-border p-4 sm:p-5"
    >
      {canInviteAdmins ? (
        <Field label="Invitar como" htmlFor={`${formId}-type`}>
          <select
            id={`${formId}-type`}
            value={inviteType}
            onChange={(event) => {
              const nextType = event.target.value === "admin" ? "admin" : "student";
              setInviteType(nextType);
              if (nextType === "admin") setSelectedCourseIds([]);
            }}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/20"
          >
            <option value="student">Alumno — acceso a cursos seleccionados</option>
            <option value="admin">Administrador — puede editar todos los cursos</option>
          </select>
        </Field>
      ) : null}

      <Field label="Correo electrónico" htmlFor={`${formId}-email`}>
        <Input
          id={`${formId}-email`}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={inviteType === "admin" ? "correo@admin.com" : "correo@alumno.com"}
          required
        />
      </Field>

      {inviteType === "student" ? (
        <fieldset>
          <legend className="text-sm font-medium">Cursos incluidos</legend>
          {courses.length === 0 ? (
            <Alert variant="warning" className="mt-2">
              Crea al menos un curso antes de invitar alumnos.
            </Alert>
          ) : (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {courses.map((course) => (
                <label
                  key={course.id}
                  className="flex min-w-0 items-start gap-3 rounded-md border border-border p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    value={course.id}
                    checked={selectedCourseIds.includes(course.id)}
                    onChange={(event) => {
                      setSelectedCourseIds((current) =>
                        event.target.checked
                          ? [...current, course.id]
                          : current.filter((id) => id !== course.id)
                      );
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                  />
                  <span className="min-w-0 break-words">{course.title}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      ) : null}

      <Field
        label="Nota interna"
        htmlFor={`${formId}-note`}
        hint="Opcional. Sirve para recordar quién es o por qué recibió el acceso; el invitado no la verá."
      >
        <Textarea
          id={`${formId}-note`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Ejemplo: alumno del evento presencial de agosto"
        />
      </Field>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {sent ? <Alert variant="success">Invitación enviada.</Alert> : null}

      <div>
        <Button
          type="submit"
          size="sm"
          disabled={pending || (inviteType === "student" && courses.length === 0)}
        >
          {pending ? "Enviando..." : "Enviar invitación"}
        </Button>
      </div>
    </form>
  );
}
