import "server-only";

function configured(name: string): string | null {
  const value = process.env[name]?.trim();
  return value || null;
}

export function getLegalIdentity() {
  const name = configured("LEGAL_NAME");
  const taxId = configured("LEGAL_TAX_ID");
  const address = configured("LEGAL_ADDRESS");
  const email = configured("LEGAL_CONTACT_EMAIL") ?? "hola@mail.delunivo.com";

  return {
    name: name ?? "Titular pendiente de configurar",
    taxId: taxId ?? "Pendiente de configurar",
    address: address ?? "Pendiente de configurar",
    email,
    complete: Boolean(name && taxId && address && email),
  };
}
