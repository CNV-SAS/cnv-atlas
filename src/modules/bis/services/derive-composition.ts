import { BIODY_COLUMNS } from "@/clinical-engine";
import {
  derivarFaltantes,
  ESPECTRO_FORMULAS_V,
} from "@/clinical-engine/frozen/derivar-composicion.js";

import { MEASURED_HIPS_HEADER, MEASURED_WAIST_HEADER, normalizeHeader } from "./header-map";

// Deriva la composicion que el export CORTO del Biody BIS no trae (EA1). El equipo con el firmware
// nuevo exporta la espectroscopia y lo que el motor nucleo necesita, pero omite ~77 columnas de
// composicion (FFW, agua sin grasa, MCA, proteica metabolica, hidratacion sin grasa, SMM/W, ECM/BCM...).
// Las identidades CONGELADAS de Gildardo (clinical-engine/frozen/derivar-composicion.js, verificadas
// sobre 5.073 registros) las reconstruyen a partir de lo que SI viene. Aqui solo se ORQUESTA esa
// ciencia y se traduce a filas listas para persistir; no se reimplementa ninguna formula (regla 5/16).
//
// Reglas invariantes:
//   - SOLO rellena huecos: un campo que el equipo trajo JAMAS se deriva ni se reemite (doble guarda: el
//     `poner` del frozen no pisa un valor presente, y aqui se excluyen del emit los campos medidos).
//   - Emite SOLO campos con header de contrato (BIODY_COLUMNS): los que el motor y la tabla de Wang leen.
//     Los indices sin columna que el frozen tambien calcula (ei, ei_sg, aec_mca, ECM) no se persisten.
//   - La derivacion corre por COMPOSICION faltante, no por espectroscopia (el gate del v8 no anticipo
//     este firmware); ese gate vive en el llamador (el import), aqui la funcion es incondicional.

export type DerivedValue = { variableName: string; value: number };

// Version de la ciencia de derivacion con la que se produjeron estos valores (se sella en
// bis_raw_values.derived_formula_version). Reexportada para que el writer la estampe sin volver a
// importar el frozen.
export const DERIVED_FORMULA_VERSION: string = ESPECTRO_FORMULAS_V;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const round4 = (v: number): number => parseFloat(v.toFixed(4)); // mismo redondeo que el frozen

/**
 * `measured`: crudos MEDIDOS keyed por header NORMALIZADO (como se guardan en bis_raw_values). Devuelve
 * las filas DERIVADAS (variableName por header normalizado + valor) para insertar junto a las medidas.
 * Un export completo (todo presente) devuelve []: no cambia ni una fila.
 */
export function deriveMissingComposition(measured: Record<string, number>): DerivedValue[] {
  // 1. Objeto canonico de composicion (claves = campos de BIODY_COLUMNS, las que espera el frozen).
  const comp: Record<string, number | null | undefined> = {};
  const measuredFields = new Set<string>(); // campos que el equipo SI trajo (no se tocan)
  for (const [field, col] of Object.entries(BIODY_COLUMNS)) {
    const v = measured[normalizeHeader(col.header)];
    if (isNum(v)) {
      comp[field] = v;
      measuredFields.add(field);
    }
  }

  // 2. Ciencia congelada: rellena los huecos de composicion (agua sin grasa, MCA, MPM, hidSG, SMM/W...).
  derivarFaltantes(comp);

  // 3. icc/ict: ratios antropometricos que el export corto no trae, desde las circunferencias MEDIDAS
  //    (Waist/Hips Size cm, no el umbral de referencia) + talla. NO estan en el bloque congelado: son
  //    razones antropometricas estandar (glue de Atlas, autorizado por Santiago 2026-08-09). icc =
  //    cintura/cadera (cotejado contra el corte 0,90/0,85 de R2); ict = cintura/talla (corte 0,50).
  const cintura = measured[normalizeHeader(MEASURED_WAIST_HEADER)];
  const cadera = measured[normalizeHeader(MEASURED_HIPS_HEADER)];
  const talla = comp.talla;
  if (!measuredFields.has("icc") && isNum(cintura) && isNum(cadera) && cadera !== 0) {
    comp.icc = round4(cintura / cadera);
  }
  if (!measuredFields.has("ict") && isNum(cintura) && isNum(talla) && talla !== 0) {
    comp.ict = round4(cintura / talla);
  }

  // 4. Emite solo los campos AUSENTES en lo medido, que tengan header de contrato y quedaron numericos
  //    y FISICAMENTE PLAUSIBLES. Guarda de cordura (glue, no frozen): la composicion es no-negativa; una
  //    identidad de resta (FFW = ACT - 0,15FM, ECW_sg, MPM = MSSG - SES - MNO, ECM = FFM - MCA) puede dar
  //    un negativo con datos corruptos. Mejor mostrar VACIO que persistir basura que alimente un
  //    diagnostico. El frozen solo guarda isFinite; no se agregan topes superiores por campo (necesitarian
  //    los rangos de Gildardo, y estos valores son secundarios/display, no insumos del motor nucleo).
  const out: DerivedValue[] = [];
  for (const [field, col] of Object.entries(BIODY_COLUMNS)) {
    if (measuredFields.has(field)) continue; // el equipo lo trajo: intocable
    const v = comp[field];
    if (isNum(v) && v > 0) out.push({ variableName: normalizeHeader(col.header), value: round4(v) });
  }
  return out;
}
