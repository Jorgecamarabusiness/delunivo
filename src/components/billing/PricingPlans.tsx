import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { buttonClassName } from "@/components/ui/Button";
import {
  PLANS,
  LIBRARY_EXTENSION,
  DELIVERY_PACK,
  TRIAL,
} from "@/lib/billing/catalog";
import { formatPlatformPrice } from "@/lib/billing/access";

export function PricingPlans({ isAdmin = false }: { isAdmin?: boolean }) {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => (
          <Card
            key={plan.key}
            className={`flex flex-col gap-5 p-6 ${plan.key === "crece" ? "border-accent ring-1 ring-accent" : ""}`}
          >
            <div className="min-h-7">
              {plan.key === "crece" ? (
                <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                  Recomendado
                </span>
              ) : null}
            </div>
            <div>
              <h3 className="text-xl font-bold">{plan.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {plan.audience}
              </p>
            </div>
            <p className="text-3xl font-bold">
              {formatPlatformPrice(plan.priceCents)}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                /mes
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Precio final, impuestos incluidos.
            </p>
            <ul className="space-y-3 text-sm">
              <li>
                <strong>{plan.libraryHours} horas</strong> de biblioteca de
                vídeo
              </li>
              <li>
                <strong>
                  {plan.deliveryMinutes.toLocaleString("es-ES", {
                    useGrouping: true,
                  })}{" "}
                  minutos
                </strong>{" "}
                de reproducción por ciclo
              </li>
              <li>
                {plan.graceMinutes.toLocaleString("es-ES")} minutos de gracia
                por ciclo
              </li>
              <li>Cursos y alumnos registrados ilimitados</li>
              <li>0 % de comisión Delunivo por venta</li>
              <li>Vídeo adaptativo hasta 1080p</li>
            </ul>
            <Link
              href={
                isAdmin
                  ? "/admin/facturacion"
                  : `/crear-empresa?plan=${plan.key}`
              }
              className={buttonClassName(
                plan.key === "crece" ? "primary" : "outline",
                "md",
                "mt-auto text-center",
              )}
            >
              {isAdmin ? "Ver mi plan" : `Empezar con ${plan.name}`}
            </Link>
          </Card>
        ))}
        <Card className="flex flex-col gap-5 p-6">
          <div className="min-h-7" />
          <h3 className="text-xl font-bold">A medida</h3>
          <p className="text-sm text-muted-foreground">
            Para necesidades que superan los planes públicos.
          </p>
          <p className="text-2xl font-bold">Presupuesto</p>
          <p className="text-sm">
            Biblioteca y reproducción acordadas. Registra tu solicitud y
            revisaremos tus necesidades antes de contratar.
          </p>
          <Link
            href="/a-medida"
            className={buttonClassName("outline", "md", "mt-auto text-center")}
          >
            Solicitar contacto
          </Link>
        </Card>
      </div>
      <div className="grid gap-6 md:grid-cols-2 text-sm text-muted-foreground">
        <div>
          <h3 className="font-semibold text-foreground">
            Biblioteca y reproducción
          </h3>
          <p className="mt-2">
            La biblioteca mide las horas alojadas, incluidos borradores. La
            reproducción se comparte entre todos los alumnos: un vídeo de una
            hora reproducido por 50 alumnos consume unos 3.000 minutos. Las
            previsualizaciones y los cursos gratuitos también consumen.
          </p>
          <p className="mt-2">
            Las tarifas de Stripe se cobran por separado. Al agotar el saldo y
            la gracia se pausan nuevas reproducciones; la compra y el progreso
            se conservan. No hay cargos automáticos por exceso.
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-foreground">
            Amplía cuando lo necesites
          </h3>
          <p className="mt-2">
            Biblioteca: +{LIBRARY_EXTENSION.hours} horas por{" "}
            {formatPlatformPrice(LIBRARY_EXTENSION.priceCents)}/mes, con
            renovación automática junto al plan. Reproducción:{" "}
            {DELIVERY_PACK.minutes.toLocaleString("es-ES")} minutos por{" "}
            {formatPlatformPrice(DELIVERY_PACK.priceCents)}, válidos{" "}
            {DELIVERY_PACK.validityDays} días, sin renovación automática.
          </p>
          <p className="mt-2">
            Prueba {TRIAL.days} días con {TRIAL.libraryHours} horas de
            biblioteca y {TRIAL.deliveryMinutes} minutos de reproducción total,
            sin cobro automático al finalizar.
          </p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        <Link className="underline" href="/condiciones-planes">
          Condiciones de los planes y conservación del contenido
        </Link>
      </p>
    </div>
  );
}
