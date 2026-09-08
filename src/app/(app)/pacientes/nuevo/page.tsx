import { redirect } from "next/navigation";

import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { requireUser } from "@/modules/auth/session";
import { NuevoPacientePresencial } from "@/modules/patients/components/nuevo-paciente-presencial";
import { canCreatePatientPresencial } from "@/modules/patients/policies/can-create-patient";

export const metadata = { title: "Nuevo paciente - Atlas" };

// CREAR UN PACIENTE EN CONSULTA (dictamen legal 2026-09-08). Autorizacion de ruta por policy (regla 3);
// solo profesional, porque quien crea firma tambien la declaracion de lo que vio.
//
// EL DOCUMENTO DE CONSENTIMIENTO YA NO SE LEE AQUI: con la modalidad 1 retirada, esta pantalla no
// presenta el consentimiento. Lo presenta el enlace de consultorio (con correo) o la pagina publica del
// QR (sin correo), cada una con el nombre del profesional que corresponde.
export default async function NuevoPacientePage() {
  const user = await requireUser();
  if (!canCreatePatientPresencial(user)) {
    redirect("/no-autorizado");
  }

  return (
    <div className="mx-auto flex w-full max-w-[52rem] flex-col gap-4">
      <TituloPantalla
        titulo="Nuevo paciente en consulta"
        descripcion="Crea el paciente y toma su consentimiento aquí mismo, antes de la encuesta."
      />
      <NuevoPacientePresencial />
    </div>
  );
}
