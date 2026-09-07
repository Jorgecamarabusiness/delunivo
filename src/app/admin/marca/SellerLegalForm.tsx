"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Field } from "@/components/ui/Field";
import { Input, inputClassName } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import {
  hasCompleteSellerLegalInfo,
  sellerLegalMissingFields,
  type SellerLegalInfo,
} from "@/lib/organizations/sellerLegal";
import { updateSellerLegalAction, type SellerLegalActionState } from "./actions";

const INITIAL: SellerLegalActionState = { error: null };

export function SellerLegalForm({ seller }: { seller: SellerLegalInfo }) {
  const [state, formAction] = useActionState(updateSellerLegalAction, INITIAL);
  const missing = sellerLegalMissingFields(seller);
  const complete = hasCompleteSellerLegalInfo(seller);

  return (
    <section className="mt-12 border-t border-border pt-10" aria-labelledby="seller-legal-title">
      <h2 id="seller-legal-title" className="text-lg font-semibold">
        Vendedor y contacto público
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Cada escuela vende y factura sus propios cursos. Estos datos se mostrarán
        junto a la oferta para identificar al vendedor y facilitar el contacto.
        La suscripción mensual de Delunivo es un servicio distinto.
      </p>

      {!complete ? (
        <Alert variant="warning" className="mt-5">
          Pendiente de completar: {missing.join(", ")}. Stripe Connect no sustituye
          la identificación pública del vendedor.
        </Alert>
      ) : null}

      <form action={formAction} className="mt-6 flex max-w-2xl flex-col gap-5">
        <Field
          label="Nombre legal o razón social"
          htmlFor="seller-legal-name"
          hint="El nombre con el que vendes y facturas los cursos."
        >
          <Input
            id="seller-legal-name"
            aria-describedby="seller-legal-name-hint"
            name="legalName"
            defaultValue={seller.seller_legal_name ?? ""}
            maxLength={160}
            autoComplete="organization"
          />
        </Field>

        <Field
          label="NIF, CIF o identificador fiscal"
          htmlFor="seller-tax-id"
          hint="Usa el identificador que corresponde a tu país o territorio."
        >
          <Input
            id="seller-tax-id"
            aria-describedby="seller-tax-id-hint"
            name="taxId"
            defaultValue={seller.seller_tax_id ?? ""}
            maxLength={80}
            autoComplete="off"
          />
        </Field>

        <Field label="Domicilio del vendedor" htmlFor="seller-address">
          <textarea
            id="seller-address"
            name="address"
            defaultValue={seller.seller_address ?? ""}
            maxLength={500}
            rows={3}
            className={`${inputClassName} min-h-24 resize-y`}
            autoComplete="street-address"
          />
        </Field>

        <Field label="País o territorio" htmlFor="seller-country" hint="Recomendado para que el comprador interprete el identificador fiscal.">
          <Input
            id="seller-country"
            aria-describedby="seller-country-hint"
            name="country"
            defaultValue={seller.seller_country ?? ""}
            maxLength={100}
            autoComplete="country-name"
          />
        </Field>

        <Field
          label="Correo de contacto del vendedor"
          htmlFor="seller-contact-email"
          hint="Se publicará para consultas sobre la oferta, compra o el curso."
        >
          <Input
            id="seller-contact-email"
            aria-describedby="seller-contact-email-hint"
            name="contactEmail"
            type="email"
            defaultValue={seller.seller_contact_email ?? ""}
            maxLength={254}
            autoComplete="email"
          />
        </Field>

        {state.error ? <Alert variant="error">{state.error}</Alert> : null}
        {state.saved ? <Alert variant="success">Datos del vendedor guardados.</Alert> : null}

        <div>
          <SubmitButton pendingLabel="Guardando datos…">
            Guardar datos del vendedor
          </SubmitButton>
        </div>
      </form>
    </section>
  );
}
