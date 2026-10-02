"use client";
import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { inputClassName } from "@/components/ui/Input";
import { buttonClassName } from "@/components/ui/Button";
import {
  grantCapacityExceptionAction,
  recordProviderEvidenceAction,
} from "@/app/admin/plataforma/capacityOperations";
export function PlatformCapacityTools({
  organizations,
  nonce,
}: {
  organizations: { id: string; name: string }[];
  nonce: string;
}) {
  const [evidence, record, recording] = useActionState(
    recordProviderEvidenceAction,
    { error: null },
  );
  const [grant, grantAction, granting] = useActionState(
    grantCapacityExceptionAction,
    { error: null },
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-4 p-5">
        <h3 className="font-semibold">Conciliar fuentes de proveedor</h3>
        <p className="text-sm text-muted-foreground">
          Registra la exportación normalizada y su fuente verificada. Importes
          de cuenta en céntimos; líneas en millonésimas de moneda. Mux solo
          atribuye por asset y entorno exactos. Los créditos pertenecen a la
          cuenta.
        </p>
        <form action={record} className="space-y-3">
          <label className="block text-sm">
            Evidencia JSON (statement y lines)
            <textarea
              name="evidence"
              required
              maxLength={100000}
              rows={8}
              className={`${inputClassName} mt-2 h-auto font-mono text-xs`}
            />
          </label>
          <button
            disabled={recording}
            className={buttonClassName("outline", "md")}
          >
            {recording ? "Conciliando…" : "Registrar fuente"}
          </button>
        </form>
        {evidence.error ? (
          <Alert variant="error">{evidence.error}</Alert>
        ) : evidence.message ? (
          <Alert variant="success">{evidence.message}</Alert>
        ) : null}
      </Card>
      <Card className="space-y-4 p-5">
        <h3 className="font-semibold">Excepción temporal auditada</h3>
        {!organizations.length ? <Alert variant="info">No hay escuelas disponibles para conceder una excepción.</Alert> : <form action={grantAction} className="grid gap-3">
          <input type="hidden" name="nonce" value={nonce} />
          <label className="text-sm">
            Escuela
            <select name="organizationId" className={`${inputClassName} mt-1`}>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Recurso
            <select name="resource" className={`${inputClassName} mt-1`}>
              <option value="library">Biblioteca</option>
              <option value="delivery">Entrega (bolsa gratuita)</option>
              <option value="admission">Admisión excepcional</option>
            </select>
          </label>
          <label className="text-sm">
            Cantidad en segundos (admisión: 0)
            <input
              name="seconds"
              type="number"
              min={0}
              max={36000000}
              required
              className={`${inputClassName} mt-1`}
            />
          </label>
          <label className="text-sm">
            Vencimiento UTC (formato ISO, terminado en Z)
            <input
              name="expiresAt"
              type="text"
              placeholder="2026-10-15T18:00:00Z"
              pattern=".*Z"
              required
              className={`${inputClassName} mt-1`}
            />
          </label>
          <label className="text-sm">
            Motivo
            <input
              name="reason"
              minLength={5}
              required
              className={`${inputClassName} mt-1`}
            />
          </label>
          <button
            disabled={granting}
            className={buttonClassName("outline", "md")}
          >
            {granting ? "Registrando…" : "Conceder excepción"}
          </button>
        </form>}
        {grant.error ? (
          <Alert variant="error">{grant.error}</Alert>
        ) : grant.message ? (
          <Alert variant="success">{grant.message}</Alert>
        ) : null}
      </Card>
    </div>
  );
}
