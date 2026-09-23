import { redirect } from "next/navigation";

import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { requireUser } from "@/modules/auth/session";
import { VentaRetroactivaForm } from "@/modules/payments/components/venta-retroactiva-form";
import { VentasRetroactivasRegistradas } from "@/modules/payments/components/ventas-retroactivas-registradas";
import { listarVentasRetroactivas } from "@/modules/payments/data/venta-retroactiva-writer";
import { leerContextoDeVentaRetroactiva } from "@/modules/payments/data/venta-retroactiva-reader";
import { canViewRevenue } from "@/modules/payments/policies/can-view-revenue";

export const metadata = { title: "Ventas que ya ocurrieron - Atlas" };

// LA RECONSTRUCCION DE LA HISTORIA COMERCIAL (Bloque R). Una integrante ya vendia con el HTML antes de que
// Atlas existiera para lo comercial, y esas ventas se facturaron a mano. Esta pantalla las pone en Atlas con
// su fecha real y con el numero de la factura que YA existe, sin llamar a Alegra.
//
// Solo Direccion: toca ingresos, comisiones e inventario de otra persona.
export default async function VentasRetroactivasPage() {
  const user = await requireUser();
  if (!canViewRevenue(user)) redirect("/no-autorizado");

  const [contexto, registradas] = await Promise.all([
    leerContextoDeVentaRetroactiva(),
    listarVentasRetroactivas(),
  ]);
  if (!contexto) redirect("/no-autorizado");

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <TituloPantalla
        titulo="Ventas que ya ocurrieron"
        descripcion="Para poner en Atlas las ventas hechas antes de que existiera lo comercial. Se registran con su fecha real y con el número de la factura que ya se emitió: Atlas no vuelve a facturarlas, no cobra nada y no le pide nada al paciente. Sí descuenta el inventario, que es lo que deja el saldo bien."
      />
      <VentaRetroactivaForm
        organizationId={contexto.organizationId}
        profesionales={contexto.profesionales}
        pacientes={contexto.pacientes}
        productos={contexto.productos}
      />
      <VentasRetroactivasRegistradas ventas={registradas} />
    </div>
  );
}
