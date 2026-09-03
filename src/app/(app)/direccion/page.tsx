import { TarjetaMetrica } from "@/components/shared/tarjeta-metrica";
import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { redirect } from "next/navigation";

import { getDireccionDashboard } from "@/modules/direccion/data/dashboard-reader";
import { canViewDireccion } from "@/modules/direccion/policies/can-view-direccion";
import { requireUser } from "@/modules/auth/session";

export const metadata = { title: "Dirección - Atlas" };

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

// Tablero consolidado de direccion (B14): agregados financieros e inventario. La
// autorizacion va por policy (regla 3); los datos, por RLS. Sin PII.
export default async function DireccionPage() {
  const user = await requireUser();
  if (!canViewDireccion(user)) {
    redirect("/no-autorizado");
  }

  const d = await getDireccionDashboard();

  const cards: { label: string; value: string; hint?: string }[] = [
    { label: "Ingreso bruto facturado", value: cop.format(d.grossPaid), hint: `${d.paidCount} pagos` },
    { label: "Ingreso CNV", value: cop.format(d.cnvRevenue) },
    { label: "Comisiones a profesionales", value: cop.format(d.professionalCommissions) },
    {
      label: "Inventario",
      value: `${d.inventoryUnits} unidades`,
      hint: `${d.inventoryItems} referencias`,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        {/* Cae "vista consolidada de finanzas e inventario" (son las tarjetas de abajo) y queda que son
            AGREGADOS SIN DATOS PERSONALES, que es una garantia de gobernanza y no se ve en las cifras. */}
        <TituloPantalla titulo="Dirección" descripcion="Agregados, sin datos personales." />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* LA TARJETA COMPARTIDA (2026-09-03): estas cifras estaban hechas a mano, con su propia escala
            y su propio borde. Es la misma pieza que /pacientes, y tenerla dos veces es como se llega a
            dos dialectos para lo mismo. El `hint` pasa a `detalle`, que es donde va el ALCANCE de la
            cifra. */}
        {cards.map((c) => (
          <TarjetaMetrica key={c.label} rotulo={c.label} valor={c.value} detalle={c.hint} />
        ))}
      </div>
    </div>
  );
}
