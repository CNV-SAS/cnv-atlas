import "server-only";

import { BIODY_COLUMNS } from "@/clinical-engine";
import {
  huellaDeLosHallazgos,
  identidadesVioladas,
  type HallazgoQc,
  type InsumosQcBiologico,
} from "@/clinical-engine/qc-biologico";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { normalizeHeader } from "../services/header-map";

import { leerVistoBueno } from "./visto-bueno-del-qc";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS HALLAZGOS DEL CONTROL DE CALIDAD BIOLOGICO DE UNA CONSULTA  ·  LECTURA (regla dura 1)
//
// ═══ LOS NOMBRES SE DERIVAN, NO SE TRANSCRIBEN, Y ESTO ME ACABA DE MORDER ═══
//
// `bis_raw_values.variable_name` guarda el encabezado del equipo PASADO POR `normalizeHeader`, que traduce
// los sufijos del Biody (`measurementDetails.VALEURCALCULEEEXPORT` -> `valor`). Al medir las identidades
// con un script escribi los encabezados de `BIODY_COLUMNS` tal cual, y las CINCO identidades de
// composicion salieron todas en cero: no es que nadie las violara, es que no se estaban evaluando. El
// peor resultado posible, porque tranquiliza con nada.
//
// Aqui no puede pasar: el nombre sale de `normalizeHeader(BIODY_COLUMNS[campo].header)`, la misma
// composicion que usa el writer al guardar. Si manana cambia la traduccion, cambia en los dos lados a la
// vez. Es lo mismo que ya hace la huella de la medicion, y por la misma razon.
//
// ═══ SE COMPUTA AL LEER, NO SE SELLA ═══
//
// Igual que la vigencia de la emision y que los delta de los rangos: si el visto bueno guardara los
// hallazgos y luego alguien vuelve a subir el Excel, lo guardado describiria una medicion que ya no esta.
// Lo UNICO que se guarda es el visto bueno del profesional con la huella de LO QUE VIO (ver la migracion
// 0233), y eso se compara contra lo que se computa hoy.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Los campos de `BIODY_COLUMNS` que entran en las identidades. */
const CAMPOS: (keyof InsumosQcBiologico)[] = [
  "peso",
  "Re",
  "Ri",
  "Rinf",
  "C",
  "Fo",
  "Rc",
  "Xc",
  "Z5",
  "Z200",
  "FM",
  "FM_pct",
  "FFM",
  "TBW",
  "ECW",
  "ICW",
  "SMM",
  "MCA",
];

/** `variable_name` tal como se guarda -> campo de los insumos. Derivado, nunca escrito a mano. */
const CAMPO_POR_VARIABLE = new Map<string, keyof InsumosQcBiologico>(
  CAMPOS.map((campo) => {
    const col = BIODY_COLUMNS[campo as keyof typeof BIODY_COLUMNS];
    if (!col) throw new Error(`qc-biologico-reader: ${String(campo)} no esta en BIODY_COLUMNS`);
    return [normalizeHeader(col.header), campo];
  }),
);

export type QcBiologicoDeLaConsulta = {
  /** Las identidades violadas. Vacio = ninguna, que es el caso normal (2 de 400 el 2026-10-29). */
  hallazgos: HallazgoQc[];
  /** La huella de esos hallazgos, para comparar contra el visto bueno guardado. */
  huella: string;
  /** Si el profesional ya dio el visto bueno A ESTOS MISMOS hallazgos. */
  visto: boolean;
  /** Cuando se dio ese visto bueno, si sigue valiendo. */
  vistoEl: string | null;
};

/**
 * El control de calidad de la consulta: que viola, y si ya se dio por visto.
 *
 * SIN MEDICION NO HAY NADA QUE COMPROBAR, y eso NO es un hallazgo: una consulta que todavia no tiene su
 * Biody esta incompleta, no equivocada. Devuelve la lista vacia.
 */
export async function qcBiologicoDeLaConsulta(
  evaluationId: string,
): Promise<QcBiologicoDeLaConsulta> {
  const supabase = await createSupabaseServerClient();

  // LA MEDICION VIGENTE: la ultima, y nunca una marcada como de otro paciente (esa ya salio de la
  // consulta por la correccion, asi que comprobar su fisica seria frenar por un dato que ya se retiro).
  const { data: medicion, error: mErr } = await supabase
    .from("bis_measurements")
    .select("id")
    .eq("evaluation_id", evaluationId)
    .is("no_es_del_paciente_at", null)
    .order("measurement_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (mErr) throw new Error(`qc-biologico-reader: bis_measurements: ${mErr.message}`);
  if (!medicion) return { hallazgos: [], huella: "", visto: false, vistoEl: null };

  const { data: crudos, error: cErr } = await supabase
    .from("bis_raw_values")
    .select("variable_name, value")
    .eq("measurement_id", medicion.id)
    .in("variable_name", [...CAMPO_POR_VARIABLE.keys()]);
  if (cErr) throw new Error(`qc-biologico-reader: bis_raw_values: ${cErr.message}`);

  const insumos: InsumosQcBiologico = {};
  for (const fila of crudos ?? []) {
    const campo = CAMPO_POR_VARIABLE.get(fila.variable_name as string);
    if (!campo) continue;
    // `numeric` llega como cadena: "43.95" no es un numero hasta que se convierte.
    const n = fila.value != null ? Number(fila.value) : null;
    if (n != null && Number.isFinite(n)) insumos[campo] = n;
  }

  const hallazgos = identidadesVioladas(insumos);
  const huella = huellaDeLosHallazgos(hallazgos);

  // SIN HALLAZGOS NO SE PREGUNTA POR EL VISTO BUENO, y asi la consulta se ahorra una ida a la base en el
  // caso normal, que es el 99,5 % (2 de 400 el 2026-10-29).
  if (huella === "") return { hallazgos, huella, visto: false, vistoEl: null };

  const guardado = await leerVistoBueno(evaluationId);
  // EL VISTO BUENO VALE SOLO PARA LO QUE SE VIO. Su regla: *"si despues cambia un dato y aparece un
  // hallazgo distinto, se pide de nuevo"*. Comparar las huellas es lo que lo cumple sin una bandera que
  // alguien tenga que acordarse de bajar.
  const visto = guardado.cuando != null && guardado.huella === huella;

  return { hallazgos, huella, visto, vistoEl: visto ? guardado.cuando : null };
}
