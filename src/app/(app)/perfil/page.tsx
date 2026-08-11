import { redirect } from "next/navigation";

import { requireUser } from "@/modules/auth/session";
import { getProfessionalProfileIdByUser } from "@/modules/payments/data/payments-repository";
import { TaxStatusForm } from "@/modules/professionals/components/tax-status-form";
import { getTaxStatusView } from "@/modules/professionals/data/tax-status-reader";

export const metadata = { title: "Mi perfil - Atlas" };

// Perfil del integrante: hoy, su estado tributario (para poder cobrar la comision). Solo integrantes; un
// usuario sin perfil profesional no tiene datos tributarios que capturar.
export default async function PerfilPage() {
  const user = await requireUser();
  const professionalId = await getProfessionalProfileIdByUser(user.id);
  if (!professionalId) redirect("/no-autorizado");

  const view = await getTaxStatusView(professionalId);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Mi perfil</h1>
        <p className="text-muted-foreground">Tus datos para la operación con CNV.</p>
      </header>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold tracking-tight text-foreground">Datos tributarios y cuenta</h2>
          <p className="text-sm text-muted-foreground">
            CNV te paga tu comisión y, como agente de retención, retiene el impuesto en la fuente y te
            entrega el certificado. Con tu RUT tomamos tu clasificación del documento, no de lo que
            recuerdes.
            {view.verified ? (
              <span className="ml-1 font-medium text-primary">Tus datos están verificados.</span>
            ) : view.submitted ? (
              <span className="ml-1 font-medium text-foreground">
                Recibimos tus datos; los estamos verificando. Puedes actualizarlos si algo cambió.
              </span>
            ) : (
              <span className="ml-1 font-medium text-foreground">
                Mientras no los completes, tu comisión queda a la espera (ya es tuya; solo falta esto).
              </span>
            )}
          </p>
        </div>
        <TaxStatusForm professionalId={professionalId} current={view.fields} />
      </section>
    </div>
  );
}
