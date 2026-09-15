"use server";

import { reportServerError } from "@/lib/observability/report-error";
import { canAccessAdmin } from "@/modules/auth/policies/can-access-admin";
import { getCurrentUser } from "@/modules/auth/session";

import * as repo from "./data/avisos-repository";
import { canAtenderPendientesVentas } from "./policies/can-atender-pendientes";
import { enGestionSchema, marcaSchema, type AvisoFormState } from "./validations";

const vacio: AvisoFormState = { error: null, success: null, warning: null };

function hoyEnColombia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

/**
 * "EN GESTION HASTA" (Bloque A): quien atiende un pendiente deja escrito que lo esta mirando, por que, y hasta
 * cuando no hace falta avisarle. Sale del correo hasta esa fecha o hasta su plazo, lo que llegue primero.
 */
export async function marcarEnGestionFormAction(_prev: AvisoFormState, formData: FormData): Promise<AvisoFormState> {
  const user = await getCurrentUser();
  if (!user) return { ...vacio, error: "Inicia sesión." };
  if (!canAtenderPendientesVentas(user)) return { ...vacio, error: "No tienes permiso para atender pendientes de ventas." };
  const parsed = enGestionSchema.safeParse({
    tipo: String(formData.get("tipo") ?? ""),
    transactionId: String(formData.get("transactionId") ?? ""),
    nota: String(formData.get("nota") ?? ""),
    hasta: String(formData.get("hasta") ?? ""),
  });
  if (!parsed.success) return { ...vacio, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  if (parsed.data.hasta < hoyEnColombia()) return { ...vacio, error: "La fecha no puede ser anterior a hoy." };
  try {
    await repo.registrarEnGestion({ ...parsed.data, actorId: user.id });
    return { ...vacio, success: "Marcado en gestión. No vuelve al correo hasta esa fecha, salvo que venza su plazo." };
  } catch (e) {
    reportServerError("avisos.en-gestion", e);
    return { ...vacio, error: "No se pudo marcar en gestión." };
  }
}

/** Poner o quitar la marca de avisos a un usuario interno. Solo el administrador. */
export async function cambiarMarcaFormAction(_prev: AvisoFormState, formData: FormData): Promise<AvisoFormState> {
  const user = await getCurrentUser();
  if (!user) return { ...vacio, error: "Inicia sesión." };
  if (!canAccessAdmin(user)) return { ...vacio, error: "Solo el administrador cambia quién recibe los avisos." };
  const parsed = marcaSchema.safeParse({
    profileId: String(formData.get("profileId") ?? ""),
    tipo: String(formData.get("tipo") ?? ""),
    poner: String(formData.get("poner") ?? ""),
  });
  if (!parsed.success) return { ...vacio, error: "Datos inválidos." };
  try {
    if (parsed.data.poner === "si") await repo.ponerMarca(parsed.data.profileId, parsed.data.tipo, user.id);
    else await repo.quitarMarca(parsed.data.profileId, parsed.data.tipo);
    const nadie = !(await repo.hayQuienRecibaPendientes());
    return nadie
      ? { ...vacio, warning: "Guardado. Ojo: ahora NADIE recibe los pendientes de ventas." }
      : { ...vacio, success: "Guardado." };
  } catch (e) {
    reportServerError("avisos.marca", e);
    return { ...vacio, error: "No se pudo guardar. La marca solo se pone a admin, dirección o soporte." };
  }
}
