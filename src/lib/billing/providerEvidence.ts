export function parseProviderEvidence(raw: string) {
  if (raw.length > 100_000)
    throw new Error("La evidencia supera el tamaño permitido.");
  const value = JSON.parse(raw);
  const s = value.statement;
  if (!s || !Array.isArray(value.lines) || value.lines.length > 1000)
    throw new Error("Incluye statement y hasta 1.000 lines.");
  for (const field of ["id", "provider", "environment", "currency", "source"])
    if (typeof s[field] !== "string" || !s[field].trim())
      throw new Error(`Falta ${field}.`);
  if (
    !["mux", "supabase", "vercel", "resend", "other"].includes(s.provider) ||
    !["usd", "eur"].includes(s.currency)
  )
    throw new Error("Proveedor o moneda no admitidos.");
  for (const field of [
    "grossCents",
    "discountCents",
    "creditCents",
    "taxCents",
    "paidCents",
  ])
    if (!Number.isSafeInteger(s[field]) || s[field] < 0)
      throw new Error(`Importe inválido: ${field}.`);
  if (
    s.grossCents - s.discountCents - s.creditCents + s.taxCents !==
    s.paidCents
  )
    throw new Error(
      "Bruto, descuentos, créditos e impuestos no concilian con el pago.",
    );
  if (
    !Number.isFinite(Date.parse(s.startsAt)) ||
    !(Date.parse(s.endsAt) > Date.parse(s.startsAt))
  )
    throw new Error("Ventana de proveedor inválida.");
  if (
    s.usdToEur != null &&
    (!(s.usdToEur > 0) || !s.fxSource || !Number.isFinite(Date.parse(s.fxAt)))
  )
    throw new Error(
      "La conversión requiere valor, fuente y fecha verificados.",
    );
  const keys = new Set();
  for (const line of value.lines) {
    if (
      typeof line.key !== "string" ||
      keys.has(line.key) ||
      !line.category ||
      !Number.isSafeInteger(line.amountMicroUnits) ||
      line.amountMicroUnits < 0
    )
      throw new Error("Línea de coste inválida o duplicada.");
    keys.add(line.key);
    if (
      !Number.isFinite(Date.parse(line.startsAt)) ||
      !(Date.parse(line.endsAt) > Date.parse(line.startsAt)) ||
      Date.parse(line.startsAt) < Date.parse(s.startsAt) ||
      Date.parse(line.endsAt) > Date.parse(s.endsAt)
    )
      throw new Error("Línea fuera de la ventana de fuente.");
  }
  return { statement: s, lines: value.lines };
}
