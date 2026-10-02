import { Container } from "@/components/ui/Container";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PricingPlans } from "@/components/billing/PricingPlans";
import { OFFER_VERSION } from "@/lib/billing/catalog";

export default function PlanConditions() {
  return <><Header /><main id="contenido-principal"><Container className="space-y-8 py-12"><h1 className="text-3xl font-bold">Condiciones de planes</h1><p className="text-sm text-muted-foreground">Oferta y política de conservación: versión {OFFER_VERSION}. La aceptación se registra antes de contratar. Las ofertas anteriores mantienen sus condiciones hasta una transición expresa.</p><h2 className="text-xl font-semibold">Planes disponibles</h2><PricingPlans />
    <div className="max-w-3xl space-y-5 text-sm leading-relaxed">
      <h2 className="text-xl font-semibold">Ciclos, cambios y ampliaciones</h2>
      <p>Los ciclos siguen la suscripción mensual de tu escuela. Los aumentos de plan y biblioteca muestran el pago inicial, precio recurrente y fecha de renovación antes de confirmar. Se activan tras pago confirmado. La reproducción y gracia añadidas por un aumento de plan son proporcionales al tiempo restante; conservas lo consumido. Los cambios a un plan inferior y reducciones de biblioteca se aplican en la siguiente renovación.</p>
      <p>Las ampliaciones de biblioteca se renuevan automáticamente con el plan. Al reducir capacidad tendrás que comprobar que cabe tu contenido o mantener ampliaciones. Si después aparece un exceso, se bloquean nuevas subidas y dispones de siete días para ampliar o reducir biblioteca. Después se pausan nuevas reproducciones mientras continúe el exceso. No se borran vídeos por este motivo.</p>
      <p>Las bolsas de reproducción se consumen después del saldo incluido, por orden de vencimiento, y antes de la gracia. Conservan el saldo entre ciclos hasta vencer a los 90 días del pago confirmado. Comprar una bolsa no renueva una suscripción ni reinicia la gracia.</p>
      <h2 className="text-xl font-semibold">Subidas y medición</h2>
      <p>La duración del proveedor confirma la ocupación de cada vídeo. Al sustituirlo se mantiene el anterior hasta validar el nuevo. Puede quedar capacidad pendiente de liberar después de eliminar contenido; se muestra antes de subir junto con su fecha prevista. Una reserva fallida no pausa los vídeos existentes.</p>
      <p>La medición de reproducción puede llegar con retraso y contempla los segmentos entregados, incluido el buffering. Las sesiones iniciadas pueden continuar al agotarse el saldo. Estos controles no garantizan un límite instantáneo de gasto; no se cobran excesos automáticamente.</p>
      <h2 className="text-xl font-semibold">Prueba, cancelación y conservación</h2>
      <p>La prueba dura 14 días y no se convierte automáticamente en una suscripción. Contratar exige aceptación y pago explícitos. La cancelación voluntaria mantiene acceso hasta terminar el periodo pagado. Los impagos se concilian según el estado real de Stripe y su recuperación.</p>
      <p>Para ofertas que acepten esta política, el contenido se conserva 30 días después del fin efectivo de acceso. Durante ese plazo el propietario puede recuperar la suscripción o extraer contenido y datos propios. No se admiten nuevas subidas ni nuevas sesiones de alumnos sin acceso vigente. La salida incluye datos educativos y acceso seguro a las versiones de vídeo disponibles; no promete originales que el proveedor no conserve. La descarga puede consumir reproducción. Las facturas y evidencia contractual conservan sus obligaciones independientes.</p>
      <p>Los precios son finales en euros. El piloto admite escuelas con domicilio fiscal en España, solo Península y Baleares, e incluye el 21 % de IVA. El propietario declara y confirma su domicilio fiscal antes de contratar. Canarias, Ceuta, Melilla y otros países quedan fuera del piloto. Las tarifas del procesador de pagos son independientes. Estas condiciones no excluyen derechos aplicables.</p>
    </div></Container></main><Footer /></>;
}
