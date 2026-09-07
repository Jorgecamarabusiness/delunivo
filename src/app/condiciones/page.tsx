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
          La oferta y la pantalla de pago muestran el importe que se va a cobrar.
          Cada vendedor es responsable de informar correctamente sobre sus impuestos
          y de emitir las facturas que correspondan. La suscripción
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
          La solicitud de acceso inmediato, por sí sola, no elimina derechos:
          deben cumplirse todos los requisitos legales, incluida la confirmación
          del contrato en un soporte duradero. No se aplica una regla general de
          «sin reembolsos». Las condiciones particulares de cada escuela deben
          respetar los derechos obligatorios del comprador.
        </p>
      </LegalSection>
      <LegalSection title="Cursos gratuitos y cambios de precio">
        <p>
          Un curso marcado como Gratis permite obtener acceso a ese curso mediante
          una cuenta verificada, sin un pago ni una tarjeta. El acceso gratuito
          obtenido válidamente se conserva si el curso pasa a ser de pago, sujeto
          a las condiciones de acceso y publicación aplicables. Si un curso de
          pago pasa a ser gratuito, no se tramita un reembolso automático y se
          conserva el historial de la compra. Una expulsión o revocación requiere
          resolverla con la escuela antes de volver a acceder.
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
