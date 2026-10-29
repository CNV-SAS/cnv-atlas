"use server";

import { getClientIp } from "@/core/http/client-ip";
import { requireUser } from "@/modules/auth/session";
import { getEvaluationOwnership } from "@/modules/evaluations/data/evaluations-repository";

import { qcBiologicoDeLaConsulta } from "./data/qc-biologico-reader";
import { darVistoBuenoAlQc } from "./data/visto-bueno-del-qc";
import { canDarVistoBuenoAlQc } from "./policies/can-ver-el-qc-biologico";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL VISTO BUENO DEL CONTROL DE CALIDAD BIOLOGICO  ·  ACTION DELGADA (regla dura 2)
//
// Orden de siempre: auth -> policy (rol) -> ownership bajo RLS -> servicio. Ninguna logica aqui.
//
// ═══ LA HUELLA SE RECOMPUTA EN EL SERVIDOR, Y NO SE RECIBE DEL FORMULARIO ═══
//
// Es la decision que importa de este archivo. Si la pantalla mandara la huella de lo que vio, un
// formulario viejo (una pestaña abierta desde ayer, un boton pulsado dos veces) daria el visto bueno a
// unos hallazgos que ya no son los de ahora, y quedaria registrado que alguien se hizo cargo de algo que
// nunca estuvo delante.
//
// Asi que el servidor vuelve a mirar la medicion y registra LO QUE HAY HOY. Si entre que se pinto la
// pantalla y se pulso el boton cambio el Excel, lo que se firma es lo nuevo, y la pantalla lo muestra al
// refrescar. Es la misma razon por la que la firma de la prescripcion se recomputa bajo el lock.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export type VistoBuenoState = {
  error: string | null;
  success: string | null;
  warning: string | null;
};

export async function darVistoBuenoAction(
  _prev: VistoBuenoState,
  form: FormData,
): Promise<VistoBuenoState> {
  const fail = (error: string): VistoBuenoState => ({ error, success: null, warning: null });

  const user = await requireUser();
  if (!canDarVistoBuenoAlQc(user)) return fail("No autorizado.");

  const evaluationId = (form.get("evaluationId") as string | null)?.trim() ?? "";
  if (!evaluationId) return fail("Evaluación inválida.");

  const ownership = await getEvaluationOwnership(evaluationId);
  if (!ownership) return fail("Evaluación no encontrada.");

  const qc = await qcBiologicoDeLaConsulta(evaluationId);
  if (qc.hallazgos.length === 0) {
    // NO ES UN ERROR, es que ya no hay nada que revisar: el profesional corrigio el dato o volvio a subir
    // el Excel, y el panel desaparecio solo mientras tenia el boton delante. Registrar un visto bueno
    // vacio dejaria en la historia que alguien se hizo cargo de nada.
    return {
      error: null,
      success: "La medición ya no tiene hallazgos: no hay nada que revisar.",
      warning: null,
    };
  }

  const ip = await getClientIp();
  await darVistoBuenoAlQc({
    evaluationId,
    huella: qc.huella,
    textos: qc.hallazgos.map((h) => h.texto),
    actorId: user.id,
    actorEmail: user.email,
    ip: ip === "unknown" ? null : ip,
  });

  // SIN `revalidatePath`, y el candado `refresco-una-sola-vez` lo atrapo bien. La pantalla ya refresca
  // (`useFormToastAndRefresh`), y los dos juntos montan los segmentos dos veces: la pagina salta al inicio
  // dos veces y el panel puede desmontarse antes de que se vea el aviso.
  return {
    error: null,
    success: "Queda registrado que revisaste la medición y decidiste continuar.",
    warning: null,
  };
}
