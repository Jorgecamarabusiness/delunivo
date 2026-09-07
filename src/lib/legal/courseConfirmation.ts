export function courseConfirmationText(purchase: {
  id: string; created_at: string; amount_paid: number | string;
  contract_snapshot: Record<string, unknown> | null;
}) {
  const snapshot = purchase.contract_snapshot;
  const lines = ["Justificante de compra de curso", `Referencia: ${purchase.id}`,
    `Fecha del pago: ${purchase.created_at}`, `Importe registrado: ${purchase.amount_paid} EUR`,
    "Este documento no sustituye la factura que debe emitir el vendedor."];
  if (!snapshot) return [...lines, "No se conserva una copia de la oferta original para esta compra anterior. Solicita sus condiciones y factura a la escuela."].join("\n\n");
  const labels: Record<string, string> = {
    recorded_at: "Oferta registrada", course_title: "Curso", course_description: "Descripción",
    school_name: "Escuela", seller_name: "Vendedor", seller_tax_id: "Identificador fiscal",
    seller_address: "Domicilio", seller_email: "Contacto", seller_country: "País o territorio",
    access_terms: "Duración y condiciones de acceso", refund_terms: "Condiciones de reembolso",
    rights_notice: "Derechos del comprador", service_notice: "Servicio",
  };
  for (const [key, label] of Object.entries(labels)) {
    const value = snapshot[key];
    lines.push(`${label}: ${typeof value === "string" && value.trim() ? value : "No facilitado por el vendedor en la oferta registrada."}`);
  }
  lines.push(`Solicitud expresa de acceso inmediato: ${snapshot.immediate_access_requested === true ? "Sí" : "No consta"}`);
  return lines.join("\n\n");
}
