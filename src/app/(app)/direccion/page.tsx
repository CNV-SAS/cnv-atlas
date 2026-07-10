import { redirect } from "next/navigation";

import { getDireccionDashboard } from "@/modules/direccion/data/dashboard-reader";
import { canViewDireccion } from "@/modules/direccion/policies/can-view-direccion";
import { requireUser } from "@/modules/auth/session";

export const metadata = { title: "Direccion - Atlas" };

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
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Direccion</h1>
        <p className="text-muted-foreground">
          Vista consolidada de finanzas e inventario. Agregados sin datos personales.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="flex flex-col gap-1 rounded-xl border border-border p-5">
            <span className="text-sm text-muted-foreground">{c.label}</span>
            <span className="text-2xl font-bold text-foreground">{c.value}</span>
            {c.hint ? <span className="text-xs text-muted-foreground">{c.hint}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
