import { redirect } from "next/navigation";

import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { requireUser } from "@/modules/auth/session";
import { TaxVerificationRow } from "@/modules/professionals/components/tax-verification-row";
import { listPendingTaxVerifications } from "@/modules/professionals/data/tax-verification-reader";
import { canVerifyTaxStatus } from "@/modules/professionals/policies/can-verify-tax-status";

export const metadata = { title: "Verificación tributaria - Atlas" };

// Superficie de CNV (A2): lee el RUT de cada integrante y registra su clasificación tributaria, para que
// la liquidación pueda pagarle. Solo el rol verificador (canVerifyTaxStatus).
export default async function VerificacionesPage() {
  const user = await requireUser();
  if (!canVerifyTaxStatus(user)) redirect("/no-autorizado");

  const pending = await listPendingTaxVerifications();
  // Tiempo de request (página dinámica) para la antigüedad de las verificaciones pendientes.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();

  return (
    <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-6">
      {/* Cae la descripcion de la tarea (el formulario de abajo la muestra campo por campo) y queda la
          CONSECUENCIA, que no se ve: sin esta verificacion la comision del integrante no se paga. */}
      <TituloPantalla
        titulo="Verificación tributaria"
        descripcion="Sin esto, la comisión del integrante no puede pagarse."
      />

      {pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay RUTs pendientes de verificar.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {pending.map((item) => (
            <TaxVerificationRow key={item.professionalId} item={item} nowMs={nowMs} />
          ))}
        </div>
      )}
    </div>
  );
}
