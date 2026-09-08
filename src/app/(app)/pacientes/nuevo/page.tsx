import { redirect } from "next/navigation";

import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { requireUser } from "@/modules/auth/session";
import { CONSENT_TEXT_V1_0 } from "@/modules/consent/text/consent-v1.0";
import { getProfessionalForConsent } from "@/modules/evaluations/data/survey-links-reader";
import { getProfessionalProfileIdByUser } from "@/modules/payments/data/payments-repository";
import { NuevoPacientePresencial } from "@/modules/patients/components/nuevo-paciente-presencial";
import { canCreatePatientPresencial } from "@/modules/patients/policies/can-create-patient";

export const metadata = { title: "Nuevo paciente - Atlas" };

// CREAR UN PACIENTE EN CONSULTA (dictamen legal 2026-09-08). Autorizacion de ruta por policy (regla 3);
// solo profesional, porque quien crea firma tambien la declaracion de lo que vio.
//
// EL BLOQUE DEL PROFESIONAL DEL CONSENTIMIENTO se lee AQUI, en servidor, y del profesional AUTENTICADO:
// el documento que el paciente va a leer nombra a quien lo atiende, y ese nombre no puede salir de un
// campo del formulario.
export default async function NuevoPacientePage() {
  const user = await requireUser();
  if (!canCreatePatientPresencial(user)) {
    redirect("/no-autorizado");
  }

  const professionalId = await getProfessionalProfileIdByUser(user.id);
  const professional = (professionalId ? await getProfessionalForConsent(professionalId) : null) ?? {
    fullName: user.fullName,
    profession: "",
    license: null,
  };

  return (
    <div className="mx-auto flex w-full max-w-[52rem] flex-col gap-4">
      <TituloPantalla
        titulo="Nuevo paciente en consulta"
        descripcion="Crea el paciente y toma su consentimiento aquí mismo, antes de la encuesta."
      />
      <NuevoPacientePresencial consentText={CONSENT_TEXT_V1_0} professional={professional} />
    </div>
  );
}
