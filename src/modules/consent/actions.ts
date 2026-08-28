"use server";

import { revalidatePath } from "next/cache";

import { getClientIp } from "@/core/http/client-ip";
import { requireUser } from "@/modules/auth/session";

import { revokeConsentForPatient } from "./services/revoke-consent";

// Server action de la revocacion. Aqui solo se resuelve el actor y se refresca lo que cambia; la
// autorizacion, la validacion y la escritura viven en el servicio (regla 2).

export type RevokeConsentState = {
  error: string | null;
  /** Los que de verdad se revocaron, para que el aviso hable del RESULTADO y no del intento. */
  revocados: string[];
};

export async function revokeConsentAction(input: {
  patientId: string;
  types: string[];
  motivo: string;
  canal: string;
}): Promise<RevokeConsentState> {
  const user = await requireUser();
  const ip = await getClientIp();

  const result = await revokeConsentForPatient(input, {
    user,
    ip: ip === "unknown" ? null : ip,
  });
  if (!result.ok) return { error: result.error.message, revocados: [] };

  // El chip de la lista y el estado en la ficha salen de las autorizaciones vigentes: los dos cambian.
  revalidatePath("/pacientes");
  revalidatePath(`/pacientes/${input.patientId}`);
  return { error: null, revocados: result.value.revocados };
}
