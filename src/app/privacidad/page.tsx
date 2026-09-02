import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { getLegalIdentity } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacidad — Delunivo" };

export default function PrivacidadPage() {
  const legal = getLegalIdentity();
  return (
    <LegalPage title="Política de privacidad" identityComplete={legal.complete}>
      <LegalSection title="Responsable y datos tratados">
        <p>
          Responsable: {legal.name}, NIF/CIF {legal.taxId}, con domicilio en
          {` ${legal.address}`}. Contacto para privacidad: {legal.email}.
        </p>
        <p>
          Tratamos los datos de cuenta, contacto, pertenencia a escuelas,
          compras, progreso, soporte y registros técnicos necesarios para
          prestar y proteger el servicio.
        </p>
      </LegalSection>
      <LegalSection title="Finalidades y bases jurídicas">
        <p>
          Usamos los datos para crear y mantener la cuenta, ejecutar contratos y
          pagos, entregar cursos, atender soporte, cumplir obligaciones legales y
          prevenir fraude o accesos indebidos. Las bases son el contrato, el
          cumplimiento legal, el interés legítimo de seguridad y, cuando proceda,
          el consentimiento.
        </p>
      </LegalSection>
      <LegalSection title="Proveedores y transferencias">
        <p>
          Para operar el servicio intervienen proveedores de alojamiento, base
          de datos, autenticación, pagos, vídeo y correo, entre ellos Vercel,
          Supabase, Stripe, Mux y Resend. Se aplican los contratos y garantías de
          transferencia internacional que correspondan.
        </p>
      </LegalSection>
      <LegalSection title="Conservación y derechos">
        <p>
          Conservamos los datos mientras exista la cuenta o relación contractual
          y después durante los plazos exigidos para responsabilidades legales,
          contables y de seguridad. Puedes solicitar acceso, rectificación,
          supresión, oposición, limitación o portabilidad escribiendo a
          {` ${legal.email}`}, y reclamar ante la AEPD.
        </p>
      </LegalSection>
      <LegalSection title="Escuelas y creadores">
        <p>
          Cuando una organización gestiona sus alumnos y cursos, también puede
          actuar como responsable del tratamiento para esa relación. Debe
          facilitar su propia identidad y condiciones cuando corresponda.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
