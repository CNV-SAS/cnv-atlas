// ─────────────────────────────────────────────────────────────────────────────
// IMPORT BIODY — parseo por contrato + validación que FALLA EN VOZ ALTA.
//
// Regla de oro para proteger el modelo clínico en CUALQUIER plataforma:
//   un import incompleto o corrupto NO debe producir un diagnóstico plausible
//   pero falso. Debe detenerse y decir exactamente qué falta.
//
// Reemplaza el `nv(row['Header exacto'])` disperso del prototipo: si el Biody
// renombra una columna (cambio de versión, espacio extra), aquí salta el error
// en vez de meter un null que el motor convierte en 0 y arruina el índice.
// ─────────────────────────────────────────────────────────────────────────────

import { BIODY_COLUMNS, ENGINE_REQUIRED } from './biody-columns';
import { toNum, ClinicalInputError } from './normalize';

export interface BiodyImport {
  // BIS core (obligatorios para IFC/IRC/PABU)
  Re: number; Ri: number; Rinf: number; C: number;
  // composición (obligatorios para FMI derivado y clasificación)
  FM: number; FFM: number; FFMI: number; peso: number; talla: number;
  // derivado en el borde, igual que el prototipo (L5650)
  FMI: number;
  // resto de campos mapeados (opcionales) quedan en `raw`
  raw: Record<string, number | null>;
}

// Rangos fisiológicos de cordura para los insumos que mueven el diagnóstico.
// No son cortes clínicos (esos viven en el motor); son un cinturón de seguridad
// contra basura/unidades equivocadas antes de dejar correr la ciencia.
const SANITY: Record<string, [number, number]> = {
  Re:   [200, 1200],   // Ω
  Ri:   [400, 4000],   // Ω
  Rinf: [150, 1000],   // Ω
  C:    [0.3, 8],      // nF
  peso: [25, 350],     // kg
  talla:[120, 230],    // cm
  FM:   [1, 200],      // kg
  FFM:  [20, 200],     // kg
  FFMI: [8, 40],       // kg/m²
};

/** Lee una fila del Biody usando los headers EXACTOS del contrato. */
export function parseBiodyRow(row: Record<string, unknown>): BiodyImport {
  const raw: Record<string, number | null> = {};
  const missingCols: string[] = [];

  for (const [field, def] of Object.entries(BIODY_COLUMNS)) {
    if (!(def.header in row)) {
      if (def.required) missingCols.push(`${field} ("${def.header}")`);
      raw[field] = null;
      continue;
    }
    raw[field] = toNum(row[def.header]);
  }

  if (missingCols.length) {
    throw new ClinicalInputError(
      'COLUMNAS_FALTANTES',
      `El Excel del Biody no trae columnas requeridas (¿versión distinta del equipo?): ${missingCols.join(', ')}.`,
    );
  }

  // FMI derivado — replica exacta del prototipo: FM / (tallaM^2)
  const tallaM = (raw.talla ?? 0) / 100;
  const FMI = tallaM > 0 && raw.FM != null
    ? parseFloat((raw.FM / (tallaM * tallaM)).toFixed(3))
    : NaN;

  const imp = {
    Re: raw.Re!, Ri: raw.Ri!, Rinf: raw.Rinf!, C: raw.C!,
    FM: raw.FM!, FFM: raw.FFM!, FFMI: raw.FFMI!, peso: raw.peso!, talla: raw.talla!,
    FMI, raw,
  };
  assertEngineInputs(imp);
  return imp;
}

/** Puerta dura: todo insumo del motor presente, numérico y en rango. Si no, LANZA. */
export function assertEngineInputs(imp: BiodyImport): void {
  const faltan: string[] = [];
  const fuera: string[] = [];

  for (const f of ENGINE_REQUIRED) {
    const v = (imp as unknown as Record<string, number>)[f];
    if (v == null || Number.isNaN(v)) { faltan.push(f); continue; }
    const rng = SANITY[f];
    if (rng && (v < rng[0] || v > rng[1])) fuera.push(`${f}=${v} (rango ${rng[0]}–${rng[1]})`);
  }
  if (Number.isNaN(imp.FMI)) faltan.push('FMI (requiere FM y talla)');

  if (faltan.length) {
    throw new ClinicalInputError('INSUMOS_MOTOR_AUSENTES',
      `Faltan insumos que el motor necesita: ${faltan.join(', ')}. No se calcula diagnóstico.`);
  }
  if (fuera.length) {
    throw new ClinicalInputError('INSUMOS_FUERA_DE_RANGO',
      `Valores fuera de rango fisiológico (probable unidad/columna equivocada): ${fuera.join('; ')}.`);
  }
}
