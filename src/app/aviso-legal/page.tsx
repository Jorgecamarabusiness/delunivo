import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { getLegalIdentity } from "@/lib/legal";

export const metadata: Metadata = { title: "Aviso legal — Delunivo" };

export default function AvisoLegalPage() {
  const legal = getLegalIdentity();
  return (
    <LegalPage title="Aviso legal" identityComplete={legal.complete}>
      <LegalSection title="Titular del sitio">
        <p>Nombre o razón social: {legal.name}.</p>
        <p>NIF/CIF: {legal.taxId}.</p>
        <p>Domicilio: {legal.address}.</p>
        <p>Contacto: {legal.email}.</p>
      </LegalSection>
      <LegalSection title="Objeto y uso">
        <p>
          Delunivo proporciona software para que creadores y academias publiquen
          y gestionen sus escuelas online. Cada organización es responsable de
          la información, oferta y contenidos que publica en su portal.
        </p>
        <p>
          No está permitido usar el servicio para vulnerar derechos de terceros,
          introducir código malicioso ni intentar acceder a cuentas o datos ajenos.
        </p>
      </LegalSection>
      <LegalSection title="Propiedad intelectual y enlaces">
        <p>
          La marca, el software y los contenidos propios de Delunivo están
          protegidos. Los cursos pertenecen a sus respectivos titulares. Los
          enlaces externos se facilitan como referencia y no implican control
          sobre sus contenidos.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
