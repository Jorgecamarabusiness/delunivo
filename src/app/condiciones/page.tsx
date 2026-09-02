import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { getLegalIdentity } from "@/lib/legal";

export const metadata: Metadata = { title: "Condiciones — Delunivo" };

export default function CondicionesPage() {
  const legal = getLegalIdentity();
  return (
    <LegalPage title="Condiciones de contratación" identityComplete={legal.complete}>
      <LegalSection title="Partes y servicio">
        <p>
          La suscripción a Delunivo se contrata con {legal.name}. Los cursos se
          compran al creador u organización identificada en su portal; Delunivo
          facilita la infraestructura técnica y el pago se procesa en la cuenta
          conectada de ese vendedor.
        </p>
      </LegalSection>
      <LegalSection title="Precios, pago y cancelación">
        <p>
          Los precios mostrados al consumidor son finales e incluyen los
          impuestos aplicables salvo indicación expresa distinta. La suscripción
          de Delunivo es mensual y puede cancelarse para evitar renovaciones
          futuras. Stripe procesa los pagos y muestra el importe definitivo antes
          de confirmar.
        </p>
      </LegalSection>
      <LegalSection title="Contenido digital y desistimiento">
        <p>
          Antes de comprar un curso, el usuario debe solicitar expresamente que
          el acceso al contenido digital comience tras el pago y reconocer que,
          una vez iniciada la ejecución, puede perder el derecho de desistimiento
          en los supuestos previstos por la normativa de consumo. Esto no limita
          los derechos por falta de conformidad ni cualquier garantía obligatoria.
        </p>
      </LegalSection>
      <LegalSection title="Disponibilidad y uso de la cuenta">
        <p>
          La cuenta es personal. No se garantiza una disponibilidad sin
          interrupciones, pero se aplican medidas razonables de continuidad y
          seguridad. Los detalles de duración, programa y soporte de cada curso
          deben constar en la oferta de su vendedor.
        </p>
      </LegalSection>
      <LegalSection title="Contacto">
        <p>Consultas y reclamaciones: {legal.email}.</p>
      </LegalSection>
    </LegalPage>
  );
}
