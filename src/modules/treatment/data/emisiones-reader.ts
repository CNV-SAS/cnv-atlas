import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// LAS EMISIONES DE UNA CONSULTA: que salio hacia el paciente, cuando y por donde.
//
// SE LEE BAJO RLS (cliente de sesion, no owner): la policy de la 0115 da acceso al profesional del
// paciente y a admin, que es exactamente quien puede verlo. Un lector con service role tendria que
// reimplementar ese alcance a mano, y es donde se cuelan las fugas.
//
// PARA QUE SE LEE. Dos consumidores, con necesidades distintas:
//   · La HISTORIA CLINICA y el plan del paciente leen la ULTIMA emision, que es la prescripcion que
//     gobierna ese documento. Sin ella, esos documentos se arman del estado VIVO y cambian
//     retroactivamente cada vez que alguien mueve un ajuste.
//   · La pantalla lista TODAS, para que el profesional vea que entrego y cuando.

export type EmisionPrescripcion = {
  id: string;
  emittedAt: string;
  via: "impresa" | "correo" | "anterior";
  emittedByEmail: string | null;
  kcalObjetivo: number | null;
  proteinaG: number | null;
  /** La prescripcion efectiva tal como salio. Misma forma que el antiguo `protocol_approved`. */
  prescripcion: Record<string, unknown>;
};

/** Todas las emisiones de una evaluacion, de la mas reciente a la mas antigua. */
export async function listEmisiones(evaluationId: string): Promise<EmisionPrescripcion[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("prescription_emissions")
    .select("id, emitted_at, via, emitted_by_email, kcal_objetivo, proteina_g, prescripcion")
    .eq("evaluation_id", evaluationId)
    .order("emitted_at", { ascending: false });
  if (error) throw new Error(`emisiones-reader: ${error.message}`);

  return (data ?? []).map((r) => ({
    id: r.id as string,
    emittedAt: r.emitted_at as string,
    via: r.via as EmisionPrescripcion["via"],
    emittedByEmail: (r.emitted_by_email as string | null) ?? null,
    kcalObjetivo: (r.kcal_objetivo as number | null) ?? null,
    proteinaG: (r.proteina_g as number | null) ?? null,
    prescripcion: (r.prescripcion ?? {}) as Record<string, unknown>,
  }));
}

/**
 * La ULTIMA emision, o `null` si nunca se emitio nada.
 *
 * EL `null` ES UNA RESPUESTA, NO UN HUECO, y el cuidado (c) de Santiago va justo aqui: la historia
 * clinica de una consulta sin documento entregado tiene que DECIRLO, no quedarse vacia ni caer al estado
 * vivo por descuido. Quien lo consume tiene que distinguir los dos casos a proposito.
 */
export async function getUltimaEmision(evaluationId: string): Promise<EmisionPrescripcion | null> {
  const todas = await listEmisiones(evaluationId);
  return todas[0] ?? null;
}
