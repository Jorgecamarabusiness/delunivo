import { NextResponse } from "next/server";

/**
 * Whop está desactivado: responder 200 evita reintentos del proveedor, pero el
 * evento no envía correos, no crea compras y no concede acceso.
 */
export async function POST() {
  return NextResponse.json({ received: true, disabled: true });
}
