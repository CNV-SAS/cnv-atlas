import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { modelVersions } from "@/db/schema/model-registry";

/**
 * LA VERSION DEL MODELO Y LA DE SUS REGLAS, que viven en BASE DE DATOS y no en el codigo.
 *
 * ═══ POR QUE UN LECTOR PROPIO Y NO `readActiveModel` ═══
 *
 * `clinical-pipeline/data/pipeline-reader` ya lee esta fila, pero arrastra con ella los tres catalogos
 * completos (definiciones de indicador, fenotipos, sectores FyR) porque los necesita para resolver los FK
 * al sellar un diagnostico. Para mostrar dos cadenas en una pantalla eso son tres consultas de mas en
 * cada carga.
 *
 * DEVUELVE null SI NO HAY FILA ACTIVA, y la pantalla lo dice en vez de inventar un "1.0.0": si el registro
 * del modelo no esta sembrado, el diagnostico tampoco puede sellarse, y callarlo seria afirmar que todo
 * esta en orden.
 */
export type VersionDelModelo = { modelo: string; reglas: string };

export async function leerVersionDelModelo(): Promise<VersionDelModelo | null> {
  // UNA SOLA FILA ACTIVA por construccion: `model_versions_one_active_idx` es un indice unico parcial
  // sobre status = 'active'. El `limit(1)` es cinturon, no la garantia.
  const [fila] = await db
    .select({ modelo: modelVersions.versionName, reglas: modelVersions.rulesVersion })
    .from(modelVersions)
    .where(eq(modelVersions.status, "active"))
    .limit(1);
  return fila ?? null;
}
