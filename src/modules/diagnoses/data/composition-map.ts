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
  decimals?: number; // decimales de display (default 2); AEC/MCA usa 3 (ratio)
  referenceLabel?: string; // etiqueta de referencia si NO es el valor numerico (p. ej. "<0.45")
  refKey?: string | null; // clave del *_ref del equipo (para que la seccion aplique REF_POB donde falte)
  // Grupo de DETALLE colapsable dentro de su nivel: "agua" (desglose extra/intracelular con/sin grasa,
  // L y %) y "bioelectrico" (Cole-Cole crudo + impedancias). Las filas sin `detail` son las principales,
  // siempre visibles; las de detalle van bajo un desplegable (el dato completo esta, quien no lo necesita
  // no tropieza). Ver composition-section.
  detail?: "agua" | "bioelectrico";
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
  fmi: number | null; // FMI = FM / talla^2 (derivado); rango/clasificacion sexo-dependientes en la seccion
  peso: number | null; // para computar REF_POB en la seccion (necesita peso/talla/sexo)
  talla: number | null; // cm
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

// Filas de la tabla por nivel de Wang: [etiqueta, clave de valor, clave de referencia|null, unidad, grupo
// de detalle?]. Las claves son de BIODY_COLUMNS; se muestran TODAS las que el contrato cubre (el HTML de
// Gildardo manda en QUE se muestra; el COMO -que sea colapsable- es nuestro). El 5o elemento marca las
// filas de DETALLE que van bajo un desplegable ("agua" / "bioelectrico"); sin el, la fila es principal.
type LevelRow = [string, string, string | null, string, ("agua" | "bioelectrico")?];
const LEVELS: { title: string; rows: LevelRow[] }[] = [
  {
    title: "Nivel V · Cuerpo entero",
    rows: [
      ["Peso", "peso", null, "kg"],
      ["Estatura", "talla", null, "cm"],
      ["IMC", "imc", null, "kg/m²"],
      ["Cintura", "cintura", null, "cm"],
      ["Cadera", "cadera", null, "cm"],
      // ICC/ICT: ratios antropometricos (valor computado en buildComposition). Su REFERENCIA (umbral OMS,
      // sexo-dependiente el ICC) y su clasificacion las resuelve composition-section, que tiene el sexo:
      // el mapa se mantiene PURO (sin sexo, testeable sin sesion). refKey null: no hay _ref del equipo.
      ["Índice cintura-cadera (ICC)", "icc", null, ""],
      ["Índice cintura-talla (ICT)", "ict", null, ""],
      // NHLBI: clasificacion combinada IMC + cintura (capa de display, clasifNHLBI). Sin valor numerico
      // propio (la clasificacion va en la columna Diagnostico); referencia sexo-dependiente en la seccion.
      ["Clasificación IMC + cintura (NHLBI)", "nhlbi", null, ""],
      ["Metabolismo basal (GEB)", "GEB", "GEB_ref", "kcal"],
      ["Gasto energético total (GET)", "GET", null, "kcal"],
    ],
  },
  {
    title: "Nivel IV · Tejidos y sistemas",
    rows: [
      ["Masa grasa", "FM", "FM_ref", "kg"],
      ["Masa grasa", "FM_pct", "FM_pct_ref", "%"],
      ["Masa grasa (hidratación constante)", "FM_hid", "FM_hid_ref", "%"],
      ["Masa libre de grasa", "FFM", "FFM_ref", "kg"],
      ["Masa muscular esqueletica", "SMM", "SMM_ref", "kg"],
      ["Masa muscular de miembros", "MMEM", "MMEM_ref", "kg"],
      ["Indice de masa libre de grasa (FFMI)", "FFMI", "FFMI_ref", "kg/m²"],
      // FMI: DERIVADO (FM / talla^2), no una columna del equipo. Valor computado en buildComposition; la
      // referencia (rango del MOTOR 3-6/5-9, sexo) y la clasificacion las resuelve composition-section.
      ["Indice de masa grasa (FMI)", "FMI", null, "kg/m²"],
      // ASMI y SMM/W: indices de masa muscular (clasificadores del motor cASMI/cSMM, EWGSOP2/AWGS; portados
      // a composition-display por su corte). ASMI = MMEM/talla^2 (computado); SMM/W = columna del equipo.
      ["ASMI - Masa muscular apendicular", "asmi", null, "kg/m²"],
      ["SMM/W - Radio músculo/peso", "smmW", null, "%"],
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
      // Agua extra/intracelular, con/sin grasa, L y %. YA NO colapsable (Santiago 2026-08-15): el HTML no
      // lo colapsa, y ahora que las filas llevan diagnostico el desglose deja de ser ruido.
      ["AEC con grasa", "ECW", "ECW_ref", "L"],
      ["AEC con grasa", "ECW_pct", "ECW_pct_ref", "%"],
      ["AEC sin grasa", "ECW_sg", "ECW_sg_ref", "L"],
      ["AEC sin grasa", "ECW_sg_pct", "ECW_sg_pct_ref", "%"],
      ["AIC con grasa", "ICW", "ICW_ref", "L"],
      ["AIC con grasa", "ICW_pct", "ICW_pct_ref", "%"],
      ["AIC sin grasa", "ICW_sg", "ICW_sg_ref", "L"],
      ["AIC sin grasa", "ICW_sg_pct", "ICW_sg_pct_ref", "%"],
      // AF e IR van en Nivel III (celular), donde Gildardo los tiene, NO en la tabla de indices. Su
      // clasificacion es la del MOTOR (classifications["AF"]/["IR"], cAF/cIR); referencia y Δ los resuelve
      // composition-section (rango del motor via indicator-ranges). El valor es la columna cruda del equipo.
      ["Ángulo de fase (AF)", "AF", null, "°"],
      ["IR - Radio de impedancia", "IR", null, ""],
      // E/I (radio agua extra/intracelular) y Mapa AFxIR (Perfil de Salud Celular): clasificadores de
      // display (dEI / pscAFxIR). E/I referencia fija "0.35-0.40"; el mapa no tiene valor numerico.
      ["E/I con grasa (AEC/AIC)", "ei", null, ""],
      ["E/I sin grasa (AEC_sg/AIC_sg)", "ei_sg", null, ""],
      ["Mapa AFxIR (PSC)", "psc", null, ""],
    ],
  },
  {
    title: "Nivel II · Molecular",
    rows: [
      ["Agua corporal total", "TBW", "TBW_ref", "L"],
      // FFW (agua libre de grasa): la referencia PRIMARIA se computa FFW - FFW_dif (verbatim ATLAS_v8.html
      // Nivel II), en buildComposition. refKey "FFW_ref" para que, si el export NO trae FFW_dif (ffwRef
      // null), la seccion caiga al respaldo REF_POB (FFW_ref = TBW_ref), y la fila no quede sin referencia.
      ["FFW - Agua libre de grasa", "FFW", "FFW_ref", "L"],
      ["Hidratación sin grasa", "hidSG", "hidSG_ref", "%"],
      // ACT/MLG (hidratacion de la masa sin grasa, %): clasificador de display dACTMLG, referencia "71-74%".
      ["ACT/MLG - Hidratación masa sin grasa", "act_mlg", null, "%"],
      ["Proteína total", "protTotal", "protTotal_ref", "kg"],
      ["Proteína metabólica activa", "protActiva", "protActiva_ref", "kg"],
      ["Contenido mineral oseo", "CMO", "CMO_ref", "kg"],
      ["Mineral no oseo", "minNoOseo", "minNoOseo_ref", "kg"],
    ],
  },
  {
    // DIVERGENCIA DELIBERADA (DIV-8): el frozen reparte lo bioelectrico crudo entre Nivel III (impedancias
    // R50/Z...) y Nivel II (Cole-Cole Re/Ri/R∞/C/Fo). Aca se CONSOLIDA en un bloque propio, mas coherente
    // (todo lo crudo junto) y consistente con nuestro nivel Bioelectrico ya existente. El "que" (todos los
    // campos) es fiel; el "como" (el agrupamiento) es nuestro. El angulo de fase queda como principal (es el
    // marcador clinico); el resto va al desplegable.
    title: "Bioeléctrico (Cole-Cole)",
    rows: [
      // El angulo de fase se movio a Nivel III (con su clasificacion). Aca queda solo lo crudo sin
      // diagnostico (resistencias, reactancia, Fo, impedancias), que ademas solo se muestra en Evaluacion.
      ["Resistencia extracelular (Re)", "Re", null, "Ω", "bioelectrico"],
      ["Resistencia intracelular (Ri)", "Ri", null, "Ω", "bioelectrico"],
      ["Resistencia infinita (R∞)", "Rinf", null, "Ω", "bioelectrico"],
      ["Capacitancia de membrana (C)", "C", null, "nF", "bioelectrico"],
      ["Frecuencia caracteristica (Fo)", "Fo", null, "kHz", "bioelectrico"],
      ["Resistencia 50 kHz (R50)", "R50", null, "Ω", "bioelectrico"],
      ["Reactancia 50 kHz (Xc)", "Xc", null, "Ω", "bioelectrico"],
      ["Impedancia 5 kHz (Z5)", "Z5", null, "Ω", "bioelectrico"],
      ["Impedancia 50 kHz (Z50)", "Z50", null, "Ω", "bioelectrico"],
      ["Impedancia 200 kHz (Z200)", "Z200", null, "Ω", "bioelectrico"],
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
  // Cintura y cadera usan la circunferencia MEDIDA (Waist/Hips Size cm), NO el umbral de BIODY_COLUMNS.
  const cintura = measured(MEASURED_WAIST_HEADER);
  const cadera = measured(MEASURED_HIPS_HEADER);
  // AEC/MCA = ECW / MCA (C12; ATLAS_v7.html:5696, `datos.aec_mca = ECW/MCA`). ECW ("Extracellular
  // water") y MCA ("Masa celular activa") son los valores MEDIDOS (VALEURCALCULEE en BIODY_COLUMNS),
  // no los umbrales de referencia: evita la familia del bug de cintura. Mismo redondeo que el HTML.
  const _ecw = get("ECW");
  const _mca = get("MCA");
  const aecMca =
    _ecw != null && _mca != null && _mca > 0 ? parseFloat((_ecw / _mca).toFixed(3)) : null;
  // FFW (agua libre de grasa): su referencia se computa FFW - FFW_dif (no hay columna FFW_ref).
  const _ffw = get("FFW");
  const _ffwDif = get("FFW_dif");
  const ffwRef = _ffw != null && _ffwDif != null ? _ffw - _ffwDif : null;
  const icc = get("icc");
  const ict = get("ict");
  // FMI = FM / talla^2 (DERIVADO, ATLAS_v7 L5650). Valor PURO (sin sexo); su rango/clasificacion las
  // resuelve composition-section. talla en cm -> m.
  const _fm = get("FM");
  const _tallaM = get("talla") != null ? (get("talla") as number) / 100 : null;
  const div = (a: number | null, b: number | null, dec: number, mult = 1): number | null =>
    a != null && b != null && b !== 0 ? parseFloat(((a / b) * mult).toFixed(dec)) : null;
  const fmi = _fm != null && _tallaM != null && _tallaM > 0 ? div(_fm, _tallaM * _tallaM, 2) : null;
  // Filas de indices de Nivel III/IV (valores computados; su clasificacion la resuelve composition-section):
  const asmi = _tallaM != null && _tallaM > 0 ? div(get("MMEM"), _tallaM * _tallaM, 2) : null;
  // smmW no se pre-computa: la fila "smmW" sale directo de get("smmW") (columna del equipo, ver `computed`).
  const ei = div(get("ECW"), get("ICW"), 3); // radio E/I con grasa
  const eiSg = div(get("ECW_sg"), get("ICW_sg"), 3); // radio E/I sin grasa
  const actMlg = div(get("TBW"), get("FFM"), 1, 100); // ACT/MLG % (hidratacion masa sin grasa)

  const levels: CompositionLevel[] = LEVELS.map((lvl) => ({
    title: lvl.title,
    rows: lvl.rows.map(([label, valueKey, refKey, unit, detail]) => {
      // AEC/MCA (C12): valor derivado + referencia = corte 0.45 (verbatim 12734), 3 decimales.
      if (valueKey === "aec_mca") {
        return { key: valueKey, label, value: aecMca, reference: 0.45, referenceLabel: "<0.45", decimals: 3, unit };
      }
      // Valores COMPUTADOS (no columnas del equipo): circunferencias medidas, ratios y derivados. Su
      // clasificacion sexo-dependiente la resuelve composition-section. El resto sale por su header.
      const computed: Record<string, number | null> = {
        cintura,
        cadera,
        icc,
        ict,
        FMI: fmi,
        asmi,
        ei,
        ei_sg: eiSg,
        act_mlg: actMlg,
      };
      const value = valueKey in computed ? computed[valueKey] : get(valueKey);
      const reference = valueKey === "FFW" ? ffwRef : refKey ? get(refKey) : null;
      return { key: valueKey, label, value, reference, unit, refKey, ...(detail ? { detail } : {}) };
    }),
  }));

  return {
    levels,
    imc: get("imc"),
    cintura,
    cadera,
    ict,
    icc,
    fmi,
    peso: get("peso"),
    talla: get("talla"),
    aecMca,
    measurementDate,
    hasDerivedValues,
  };
}
