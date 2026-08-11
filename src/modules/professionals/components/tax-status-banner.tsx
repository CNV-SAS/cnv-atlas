import Link from "next/link";

import { requireUser } from "@/modules/auth/session";
import { getProfessionalProfileIdByUser } from "@/modules/payments/data/payments-repository";

import { getTaxStatusView } from "../data/tax-status-reader";

// Banner de retencion: le avisa al integrante que complete su estado tributario para poder cobrar su
// comision. Server component DROP-IN (resuelve sesion + profesional + estado): se pone en cualquier
// pagina. No se muestra si no es integrante, si ya completo, o si aun no tiene comision (el dictamen: el
// aviso va DESDE LA PRIMERA VENTA, con el monto al lado, que es lo que mueve; no antes ni el dia de cobrar).
//
// El TONO importa (dictamen): no es "no te pagamos", es "completa esto para poder pagarte". La comision YA
// se causo, es suya; solo espera documentacion. La retencion no es un descuento de CNV, es anticipo del
// impuesto del propio integrante, y CNV le da el certificado.
export async function TaxStatusBanner() {
  const user = await requireUser();
  const professionalId = await getProfessionalProfileIdByUser(user.id);
  if (!professionalId) return null; // no es integrante

  const view = await getTaxStatusView(professionalId);
  if (view.complete || view.pendingCommission <= 0) return null;

  const monto = view.pendingCommission.toLocaleString("es-CO");
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-foreground">
          Tienes {monto} COP en comisiones esperando tus datos
        </h2>
        <p className="text-sm text-muted-foreground">
          Esa comisión ya es tuya (se causó con tus ventas). Para poder pagártela necesitamos tus datos
          tributarios: CNV retiene el impuesto en la fuente y te entrega el certificado para tu declaración.
          No es un descuento nuestro; es un anticipo de tu propio impuesto de renta.
        </p>
      </div>
      <Link
        href="/perfil"
        className="w-fit rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
      >
        Completar mis datos
      </Link>
    </div>
  );
}
