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
  // Nada que mostrar si no hay comision aun (el aviso va desde la primera venta) o si ya se verifico.
  if (view.pendingCommission <= 0 || view.verified) return null;

  const monto = view.pendingCommission.toLocaleString("es-CO");

  // "Completo" = el integrante dio su parte, NO que este verificado. Dos estados distintos, para que no
  // crea que ya puede cobrar apenas envia: (1) falta completar; (2) enviado, en verificacion.
  if (view.submitted) {
    return (
      <div className="flex flex-col gap-1 rounded-xl border border-border bg-muted/40 p-4">
        <h2 className="text-sm font-semibold text-foreground">Recibimos tus datos; los estamos verificando</h2>
        <p className="text-sm text-muted-foreground">
          Tienes {monto} COP en comisiones. En cuanto verifiquemos tu RUT, tu comisión entra en la próxima
          liquidación. No necesitas hacer nada más por ahora.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-foreground">
          Tienes {monto} COP en comisiones esperando tus datos
        </h2>
        <p className="text-sm text-muted-foreground">
          Esa comisión ya es tuya (se causó con tus ventas). Para poder pagártela necesitamos tus datos
          tributarios y tu cuenta: CNV, como agente de retención, debe retener un porcentaje de tu comisión
          y girarlo a la DIAN a tu nombre, con certificado. Es una obligación legal, no un descuento nuestro.
          Ejemplo: si tu comisión es 100.000 y aplica retención del 11%, recibes 89.000 y CNV gira 11.000 a
          la DIAN a tu nombre.
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
