"use client";
import { useActionState } from "react";
import { requestCustomPlan } from "./actions";
import { inputClassName } from "@/components/ui/Input";
import { buttonClassName } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
export function RequestForm() {
  const [state,action,pending]=useActionState(requestCustomPlan,{error:null});
  return state.success?<Alert variant="success">Solicitud registrada. La revisará el equipo de Delunivo; no has contratado ni pagado un plan.</Alert>:<form action={action} className="space-y-4"><label className="block text-sm font-medium">Tus necesidades<textarea className={`${inputClassName} mt-2 min-h-40`} name="message" required minLength={10} maxLength={2000} placeholder="Biblioteca prevista, alumnos y reproducción aproximada…" /></label><button disabled={pending} className={buttonClassName("primary","md")}>{pending?"Registrando…":"Registrar solicitud"}</button>{state.error?<Alert variant="error">{state.error}</Alert>:null}</form>;
}
