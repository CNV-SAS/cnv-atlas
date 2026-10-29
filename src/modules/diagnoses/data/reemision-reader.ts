import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// ¿ESTE DIAGNOSTICO FUE REEMITIDO?  ·  LECTURA (regla dura 1)
//
// ═══ DE DONDE SALE (Santiago, 2026-10-29) ═══
//
// *"En el diagnostico no se ve que se reemitio. La auditoria si lo tiene (diagnosis.reemitted). Que el
// diagnostico diga 'Reemitido el ... por recalibracion cientifica (motor 1.0.0 a 2.0.0)' y deje ver la
// version anterior."*
//
// ═══ SE DERIVA, NO SE SELLA ═══
//
// No hay columna de "reemitido" y no hace falta: si una evaluacion tiene MAS DE UN diagnostico, el
// vigente (la ultima fila) sucede a otro, y el anterior es la fila que le sigue. De ahi salen las dos
// versiones y la fecha, sin nada que acordarse de poner ni de quitar.
//
// Es la misma decision que la marca del tratamiento apoyado en un diagnostico anterior: lo derivado no
// puede quedar desincronizado de lo que describe.
//
// ═══ POR QUE NO SE LEE DEL RASTRO DE AUDITORIA ═══
//
// El rastro TIENE el evento (`diagnosis.reemitted`, con las dos versiones y el motivo), pero el
// `clinical_audit_log` es registro, no fuente de pantalla: lo leen la auditoria y la direccion bajo
// permiso. Una pantalla clinica que dependa de el ataria la vista del profesional a una tabla que su rol
// no deberia necesitar. La version anterior esta en `diagnoses`, que es donde vive el hecho.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export type CifrasAnteriores = {
  /** La EB-BIS que decia el documento anterior. */
  eb: number;
  /** El IAE que decia el documento anterior. */
  iae: number;
};

export type Reemision = {
  /** Cuando se reemitio (la fecha del diagnostico vigente), en ISO. */
  fecha: string;
  /** La version del motor con que se habia emitido antes. */
  versionAnterior: string;
  /** La version con que se reemitio. */
  versionNueva: string;
  /**
   * Cuantas veces se reemitio en total. Casi siempre 1; si algun dia hubiera una v8, el mismo documento
   * podria llevar dos, y decir "reemitido" sin mas esconderia la segunda.
   */
  veces: number;
  /** Las cifras del documento anterior, o null si su snapshot no las trae. */
  anterior: CifrasAnteriores | null;
};

/**
 * `null` cuando la evaluacion tiene un solo diagnostico, que es el caso normal.
 *
 * NO distingue el MOTIVO de la reemision, y hoy no hace falta: el unico flujo que inserta un segundo
 * diagnostico sobre la misma evaluacion es la recalibracion cientifica (la correccion crea una
 * evaluacion NUEVA, no un diagnostico nuevo). Si algun dia hubiera otro, este lector tendria que leer el
 * motivo del rastro y el texto de pantalla dejaria de poder afirmarlo.
 */
export async function leerReemision(evaluationId: string): Promise<Reemision | null> {
  const supabase = await createSupabaseServerClient();

  const { data: dxs, error } = await supabase
    .from("diagnoses")
    .select("id, engine_version, created_at")
    .eq("evaluation_id", evaluationId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`reemision-reader: diagnoses: ${error.message}`);
  if (!dxs || dxs.length < 2) return null;

  const vigente = dxs[0];
  const anterior = dxs[1];

  // LAS CIFRAS DE ANTES VIVEN EN SU FILA DE `reports`, no en `diagnoses`: el snapshot del motor se guarda
  // con el informe. Se busca la ultima fila ANTERIOR a la reemision, que es la que estaba vigente hasta
  // ese momento. Comparar por fecha y no tomar `reports[1]` importa porque un informe puede tener varias
  // filas por reenvios, y entonces la segunda fila no seria la del documento anterior.
  const { data: informes, error: rErr } = await supabase
    .from("reports")
    .select("snapshot, created_at")
    .eq("evaluation_id", evaluationId)
    .eq("type", "paciente")
    .lt("created_at", vigente.created_at as string)
    .order("created_at", { ascending: false })
    .limit(1);
  if (rErr) throw new Error(`reemision-reader: reports: ${rErr.message}`);

  return {
    fecha: vigente.created_at as string,
    versionAnterior: (anterior.engine_version as string) ?? "(sin versión)",
    versionNueva: (vigente.engine_version as string) ?? "(sin versión)",
    veces: dxs.length - 1,
    anterior: cifrasDelSnapshot(informes?.[0]?.snapshot),
  };
}

/**
 * Las dos cifras del snapshot anterior, mirando los DOS sitios donde pueden estar.
 *
 * La v7 las puso en `ebBis` (para que el informe del paciente no tenga que tocar `indicators`); los
 * snapshots de la v5, que son los que va a tener cualquier documento reemitido hoy, solo las tienen en
 * `indicators`. Un lector que mirara un solo sitio dejaria la comparacion vacia justo en el caso para el
 * que existe.
 */
export function cifrasDelSnapshot(snapshot: unknown): CifrasAnteriores | null {
  const s = snapshot as
    | { ebBis?: { eb?: number | null; iae?: number | null } | null; indicators?: { eb?: number | null; iae?: number | null } | null }
    | null
    | undefined;
  const eb = s?.ebBis?.eb ?? s?.indicators?.eb ?? null;
  const iae = s?.ebBis?.iae ?? s?.indicators?.iae ?? null;
  if (typeof eb !== "number" || typeof iae !== "number") return null;
  if (!Number.isFinite(eb) || !Number.isFinite(iae)) return null;
  return { eb, iae };
}
