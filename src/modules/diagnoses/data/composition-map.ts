import { BIODY_COLUMNS } from "@/clinical-engine";
import {
  MEASURED_HIPS_HEADER,
  MEASURED_WAIST_HEADER,
  normalizeHeader,
} from "@/modules/bis/services/header-map";

// Mapeo PURO de los crudos BIS a la composicion corporal (tabla "Niveles de Wang"). Separado del
// reader server-only para que sea testeable (candado del mapeo). Solo display: no toca snapshot ni
// registry.

export type CompositionRow = {
  key: string; // clave estable del dato crudo (BIODY_COLUMNS), unica por fila
  label: string;
  value: number | null;
  reference: number | null;
  unit: string;
  decimals?: number; // decimales de display (default 1); AEC/MCA usa 3 (ratio)
  referenceLabel?: string; // etiqueta de referencia si NO es el valor numerico (p. ej. "<0.45")
};
export type CompositionLevel = { title: string; rows: CompositionRow[] };
export type Composition = {
  levels: CompositionLevel[];
  // Derivados para la clasificacion antropometrica (referencia OMS de display).
  imc: number | null;
  cintura: number | null; // circunferencia MEDIDA (Waist Size cm), NO el umbral de referencia
  cadera: number | null; // circunferencia MEDIDA (Hips Size cm)
  ict: number | null;
  icc: number | null;
  aecMca: number | null; // AEC/MCA = ECW/MCA (C12, ver clasificarAecMca)
  // Fecha de la medicion BIS (del Biody), para confirmar QUE se importo. null si no se conoce.
  measurementDate: string | null;
  // true si la medicion trae algun valor DERIVADO (el export corto no lo trajo y se reconstruyo por
  // las identidades de Gildardo). Enciende la nota al pie de procedencia (EA1). Solo display.
  hasDerivedValues: boolean;
};

// Clasificacion de AEC/MCA (radio agua extracelular / masa celular activa). Cortes y etiquetas
// PORTADOS VERBATIM del HTML vigente de Gildardo (ATLAS_v7.html:12734, `dAECMCA`): v<0.45 Óptimo,
// v<=0.55 Alerta, else Riesgo. sev 0/2/3 para la capa de color de BRAND.
//
// OJO (familia Q20): este clasificador es de la familia de DISPLAY (`dAECMCA`); NO existe un
// clasificador CIENTIFICO (`cAECMCA`, por sexo) para AEC/MCA. Q20 pregunta cual familia (c vs d) es
// la vigente. Es la unica opcion disponible hoy, pero si Q20 resuelve a favor de los `c`, este
// indicador necesitaria un clasificador que hoy no existe. No se sella (es display), asi que el
// dia que aparezca el `c` se recomputa; no queda nada inmutable atado a esta eleccion.
export function clasificarAecMca(v: number | null): { label: string; sev: number } | null {
  if (v == null) return null;
  if (v < 0.45) return { label: "Óptimo", sev: 0 };
  if (v <= 0.55) return { label: "Alerta", sev: 2 };
  return { label: "Riesgo", sev: 3 };
}

// Filas de la tabla por nivel de Wang: [etiqueta, clave de valor, clave de referencia|null, unidad].
// Las claves son de BIODY_COLUMNS; se omiten las que el contrato no cubre.
const LEVELS: { title: string; rows: [string, string, string | null, string][] }[] = [
  {
    title: "Nivel V · Cuerpo entero",
    rows: [
      ["Peso", "peso", null, "kg"],
      ["Estatura", "talla", null, "cm"],
      ["IMC", "imc", null, "kg/m²"],
      ["Cintura", "cintura", null, "cm"],
      ["Metabolismo basal (GEB)", "GEB", "GEB_ref", "kcal"],
      ["Gasto energético total (GET)", "GET", null, "kcal"],
    ],
  },
  {
    title: "Nivel IV · Tejidos y sistemas",
    rows: [
      ["Masa grasa", "FM", "FM_ref", "kg"],
      ["Masa grasa", "FM_pct", "FM_pct_ref", "%"],
      ["Masa libre de grasa", "FFM", "FFM_ref", "kg"],
      ["Masa muscular esqueletica", "SMM", "SMM_ref", "kg"],
      ["Masa muscular de miembros", "MMEM", "MMEM_ref", "kg"],
      ["Indice de masa libre de grasa (FFMI)", "FFMI", "FFMI_ref", "kg/m²"],
    ],
  },
  {
    title: "Nivel III · Celular",
    rows: [
      ["Masa celular activa", "MCA", "MCA_ref", "kg"],
      ["Solidos extracelulares", "solEC", "solEC_ref", "kg"],
      ["Masa seca sin grasa", "masaSeca", "masaSeca_ref", "kg"],
      // AEC/MCA (C12): ratio derivado ECW/MCA, no una columna cruda. Referencia = corte 0.45 (verbatim
      // ATLAS_v7.html:12734). Valor y Δ especiales, se resuelven en buildComposition.
      ["AEC/MCA - Radio extracelular/celular", "aec_mca", null, ""],
      ["Agua extracelular", "ECW", "ECW_ref", "L"],
      ["Agua intracelular", "ICW", "ICW_ref", "L"],
    ],
  },
  {
    title: "Nivel II · Molecular",
    rows: [
      ["Agua corporal total", "TBW", "TBW_ref", "L"],
      ["Hidratación sin grasa", "hidSG", "hidSG_ref", "%"],
      ["Proteína total", "protTotal", "protTotal_ref", "kg"],
      ["Proteína metabólica activa", "protActiva", "protActiva_ref", "kg"],
      ["Contenido mineral oseo", "CMO", "CMO_ref", "kg"],
      ["Mineral no oseo", "minNoOseo", "minNoOseo_ref", "kg"],
    ],
  },
  {
    title: "Bioelectrico (Cole-Cole)",
    rows: [
      ["Resistencia extracelular (Re)", "Re", null, "Ω"],
      ["Resistencia intracelular (Ri)", "Ri", null, "Ω"],
      ["Resistencia infinita (R∞)", "Rinf", null, "Ω"],
      ["Capacitancia de membrana (C)", "C", null, "nF"],
      ["Angulo de fase 50 kHz", "AF", null, "°"],
    ],
  },
];

// Mapea los crudos (variable_name normalizado -> valor) a la composicion. PURA y testeable: es el
// candado del mapeo. cintura/cadera se resuelven desde las circunferencias MEDIDAS (Waist/Hips Size
// cm), NO desde BIODY_COLUMNS.cintura, que apunta al UMBRAL de referencia (102 cm = corte OMS
// masculino) y causaba un falso positivo de riesgo CV sistematico (cada paciente comparado consigo
// mismo). El resto de variables se resuelve por su header de contrato (BIODY_COLUMNS).
export function buildComposition(
  raw: Record<string, number>,
  measurementDate: string | null,
  hasDerivedValues = false,
): Composition {
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  // Valor por clave de contrato: header exacto -> normalizeHeader -> crudo.
  const get = (key: string): number | null => {
    const col = BIODY_COLUMNS[key];
    return col ? num(raw[normalizeHeader(col.header)]) : null;
  };
  // Valor por header MEDIDO directo (para las circunferencias planas del export).
  const measured = (header: string): number | null => num(raw[normalizeHeader(header)]);
  const cintura = measured(MEASURED_WAIST_HEADER);
  // AEC/MCA = ECW / MCA (C12; ATLAS_v7.html:5696, `datos.aec_mca = ECW/MCA`). ECW ("Extracellular
  // water") y MCA ("Masa celular activa") son los valores MEDIDOS (VALEURCALCULEE en BIODY_COLUMNS),
  // no los umbrales de referencia: evita la familia del bug de cintura. Mismo redondeo que el HTML.
  const _ecw = get("ECW");
  const _mca = get("MCA");
  const aecMca =
    _ecw != null && _mca != null && _mca > 0 ? parseFloat((_ecw / _mca).toFixed(3)) : null;

  const levels: CompositionLevel[] = LEVELS.map((lvl) => ({
    title: lvl.title,
    rows: lvl.rows.map(([label, valueKey, refKey, unit]) => {
      // AEC/MCA (C12): valor derivado + referencia = corte 0.45 (verbatim 12734), 3 decimales.
      if (valueKey === "aec_mca") {
        return { key: valueKey, label, value: aecMca, reference: 0.45, referenceLabel: "<0.45", decimals: 3, unit };
      }
      return {
        key: valueKey,
        label,
        // La fila "Cintura" tambien usa la MEDIDA, no el umbral (BIODY_COLUMNS.cintura).
        value: valueKey === "cintura" ? cintura : get(valueKey),
        reference: refKey ? get(refKey) : null,
        unit,
      };
    }),
  }));

  return {
    levels,
    imc: get("imc"),
    cintura,
    cadera: measured(MEASURED_HIPS_HEADER),
    ict: get("ict"),
    icc: get("icc"),
    aecMca,
    measurementDate,
    hasDerivedValues,
  };
}
