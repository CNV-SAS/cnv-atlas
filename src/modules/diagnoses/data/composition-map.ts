import { BIODY_COLUMNS } from "@/clinical-engine";
import {
  MEASURED_HIPS_HEADER,
  MEASURED_WAIST_HEADER,
  normalizeHeader,
} from "@/modules/bis/services/header-map";

// Mapeo PURO de los crudos BIS a la composicion corporal (tabla "Niveles de Wang"). Separado del
// reader server-only para que sea testeable (candado del mapeo). Solo display: no toca snapshot ni
// registry.
//
// DOS DISPOSICIONES, DOS PROPOSITOS (Santiago + Gildardo, 2026-08-17): la tabla ya no es una sola con
// una columna que se apaga. Son dos tablas con proposito distinto y FILAS/ORDEN distintos:
//  - `eval`  (subpestaña "Antropometria y BIS"): lo MEDIDO y lo CRUDO. Masas del equipo, aguas, y los
//            parametros bioelectricos crudos REPARTIDOS en su nivel (impedancias en III, Cole-Cole en II),
//            cada uno con su icono. SIN los indicadores clasificados (IMC, FFMI, E/I, AF...).
//  - `diag`  (subpestaña "Composicion Corporal"): lo CLASIFICADO. Indices con su diagnostico. SIN los
//            crudos bioelectricos ni las masas del equipo sin clasificar.
// Los valores se computan UNA vez; cada disposicion es una lista ordenada de filas que los reusa. Asi una
// tabla no arrastra filas de la otra (care Santiago a). Las referencias/Δ/diagnostico siguen saliendo de
// wangRowDx (FUENTE UNICA, composition-display); esta capa solo define QUE fila va en QUE tabla y su rotulo.

export type CompositionRow = {
  key: string; // clave estable del dato crudo (BIODY_COLUMNS), unica por fila
  label: string;
  value: number | null;
  reference: number | null;
  unit: string;
  decimals?: number; // decimales de display (default 2); AEC/MCA usa 3 (ratio)
  referenceLabel?: string; // etiqueta de referencia si NO es el valor numerico (p. ej. "<0.45")
  refKey?: string | null; // clave del *_ref del equipo (para que la seccion aplique REF_POB donde falte)
  // Parametro bioelectrico CRUDO (resistencia, reactancia, Fo, impedancia): lleva un icono (rayo) para
  // distinguirse cuando queda entre filas de composicion en su nivel (care Santiago b). Solo en `eval`.
  bioelectric?: boolean;
};
export type CompositionLevel = { title: string; rows: CompositionRow[] };
// Correcciones del profesional sobre una medida del equipo (0089). Se conserva el MEDIDO junto al
// corregido: la pantalla tiene que poder decir cual es cual, porque un valor corregido que se ve igual
// que uno medido deja al profesional sin saber que esta mirando.
export type CompositionCorrections = Record<
  string,
  { medido: number | null; corregido: number | null; porEmail: string; en: string }
>;

export type Composition = {
  // Vacio cuando no se corrigio nada. Solo lo llena el reader; el resto de la composicion no cambia.
  corrections?: CompositionCorrections;
  // Disposicion de EVALUACION (medido + crudo) y de DIAGNOSTICO (clasificado). Ver nota de arriba.
  eval: CompositionLevel[];
  diag: CompositionLevel[];
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

// Todas las filas (deduplicadas por clave) de AMBAS disposiciones. Para consumidores que necesitan el
// UNION de claves sin que importe en cual tabla vive cada una (p. ej. leer ASMI/AF para la sarcopenia, o
// los candados de mapeo). El render usa `eval`/`diag` directamente; esto NO es para render.
export function allCompositionRows(comp: Composition): CompositionRow[] {
  const seen = new Map<string, CompositionRow>();
  for (const layout of [comp.eval, comp.diag])
    for (const l of layout) for (const r of l.rows) if (!seen.has(r.key)) seen.set(r.key, r);
  return [...seen.values()];
}

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

// Fila de una disposicion: [etiqueta, clave de valor, clave de referencia|null, unidad, opciones?]. Las
// claves son de BIODY_COLUMNS (o computadas). El QUE se muestra y en QUE tabla es de Gildardo (su HTML) +
// el listado de Santiago; el rotulo puede diferir entre tablas (misma clave, dos marcos: p. ej. la
// circunferencia de cintura es "Cintura" cruda en Evaluacion y "Circunferencia de cintura" clasificada en
// Diagnostico). `bioelectric` marca los crudos que llevan icono (solo en Evaluacion).
type RowOpts = { bioelectric?: boolean };
type LevelRow = [string, string, string | null, string, RowOpts?];
const bio: RowOpts = { bioelectric: true };

// ── EVALUACION: lo MEDIDO y lo CRUDO. Sin indicadores clasificados. Bioelectrico repartido en su nivel. ──
const EVAL_LEVELS: { title: string; rows: LevelRow[] }[] = [
  {
    title: "Nivel V · Cuerpo entero",
    rows: [
      ["Peso", "peso", null, "kg"],
      ["Estatura", "talla", null, "cm"],
      ["Cintura", "cintura", null, "cm"],
      ["Cadera", "cadera", null, "cm"],
      ["Metabolismo basal (GEB)", "GEB", "GEB_ref", "kcal"],
      ["Gasto energético total (GET)", "GET", null, "kcal"],
    ],
  },
  {
    title: "Nivel IV · Tejidos y sistemas",
    rows: [
      // Nombres del equipo (HTML de Gildardo): "Masa grasa bruta" para las columnas crudas de grasa.
      ["Masa grasa bruta", "FM", "FM_ref", "kg"],
      ["Masa grasa bruta", "FM_pct", "FM_pct_ref", "%"],
      ["Masa grasa (hidratación constante)", "FM_hid", "FM_hid_ref", "%"],
      ["Masa libre de grasa", "FFM", "FFM_ref", "kg"],
      // SMM = Skeletal Muscle Mass (masa muscular esqueletica); MMEM = la de miembros/apendicular (Gildardo).
      ["Masa muscular esquelética", "SMM", "SMM_ref", "kg"],
      ["Masa muscular de miembros", "MMEM", "MMEM_ref", "kg"],
    ],
  },
  {
    title: "Nivel III · Celular",
    rows: [
      ["MCA - Masa celular activa", "MCA", "MCA_ref", "kg"],
      ["Sólidos extracelulares", "solEC", "solEC_ref", "kg"],
      ["Masa seca sin grasa", "masaSeca", "masaSeca_ref", "kg"],
      ["AEC con grasa", "ECW", "ECW_ref", "L"],
      ["AEC con grasa", "ECW_pct", "ECW_pct_ref", "% de ACT"],
      ["AEC sin grasa", "ECW_sg", "ECW_sg_ref", "L"],
      ["AEC sin grasa", "ECW_sg_pct", "ECW_sg_pct_ref", "% de MLG"],
      ["AIC con grasa", "ICW", "ICW_ref", "L"],
      ["AIC con grasa", "ICW_pct", "ICW_pct_ref", "% de ACT"],
      ["AIC sin grasa", "ICW_sg", "ICW_sg_ref", "L"],
      ["AIC sin grasa", "ICW_sg_pct", "ICW_sg_pct_ref", "% de MLG"],
      // Bioelectrico crudo del nivel celular: impedancias (Gildardo las reparte a Nivel III). Icono de rayo.
      ["Resistencia 50 kHz (R50)", "R50", null, "Ω", bio],
      ["Reactancia 50 kHz (Xc)", "Xc", null, "Ω", bio],
      ["Impedancia 5 kHz (Z5)", "Z5", null, "Ω", bio],
      ["Impedancia 50 kHz (Z50)", "Z50", null, "Ω", bio],
      ["Impedancia 200 kHz (Z200)", "Z200", null, "Ω", bio],
    ],
  },
  {
    title: "Nivel II · Molecular",
    rows: [
      ["ACT - Agua corporal total", "TBW", "TBW_ref", "L"],
      ["FFW - Agua libre de grasa", "FFW", "FFW_ref", "L"],
      ["Hidratación sin grasa - deshidratación", "hidSG", "hidSG_ref", "%"],
      ["Proteína total", "protTotal", "protTotal_ref", "kg"],
      ["Proteína metabólica activa", "protActiva", "protActiva_ref", "kg"],
      ["CMO - Contenido mineral óseo", "CMO", "CMO_ref", "kg"],
      ["Mineral no óseo", "minNoOseo", "minNoOseo_ref", "kg"],
      // Bioelectrico crudo del nivel molecular: Cole-Cole (Gildardo lo reparte a Nivel II). Icono de rayo.
      ["Resistencia extracelular (Re)", "Re", null, "Ω", bio],
      ["Resistencia intracelular (Ri)", "Ri", null, "Ω", bio],
      ["Resistencia infinita (R∞)", "Rinf", null, "Ω", bio],
      ["Capacitancia de membrana (C)", "C", null, "nF", bio],
      ["Frecuencia característica (Fo)", "Fo", null, "kHz", bio],
    ],
  },
];

// ── DIAGNOSTICO: lo CLASIFICADO. Indices con su diagnostico. Sin crudos bioelectricos ni masas sin clasificar. ──
const DIAG_LEVELS: { title: string; rows: LevelRow[] }[] = [
  {
    title: "Nivel V · Cuerpo entero",
    rows: [
      ["IMC", "imc", null, "kg/m²"],
      ["Circunferencia de cintura", "cintura", null, "cm"],
      // NHLBI: clasificacion combinada IMC + cintura (capa de display, clasifNHLBI). Sin valor numerico
      // propio (la clasificacion va en la columna Diagnostico); referencia sexo-dependiente en la seccion.
      ["Clasificación IMC + cintura (NHLBI)", "nhlbi", null, ""],
      // ICC/ICT: ratios antropometricos (valor computado en buildComposition). Su REFERENCIA (umbral OMS,
      // sexo-dependiente el ICC) y su clasificacion las resuelve composition-section, que tiene el sexo.
      ["Índice cintura-cadera (ICC)", "icc", null, ""],
      ["Índice cintura-talla (ICT)", "ict", null, ""],
    ],
  },
  {
    title: "Nivel IV · Tejidos y sistemas",
    rows: [
      ["FFMI - Índice de masa libre de grasa", "FFMI", "FFMI_ref", "kg/m²"],
      // FMI: DERIVADO (FM / talla^2). Rango del MOTOR (3-6/5-9) y clasificacion las resuelve la seccion.
      ["FMI - Índice de masa grasa", "FMI", null, "kg/m²"],
      // Grasa corporal total % (Lipidos Wang): Gildardo autorizo dejarla en Nivel IV (NO se duplica a Nivel
      // II). Es la misma columna que Evaluacion muestra como "Masa grasa bruta %"; aqui va con su clasificacion.
      ["Grasa corporal total - Lípidos Wang", "FM_pct", "FM_pct_ref", "%"],
      // ASMI = MMEM/talla^2 (computado); SMM/W = columna del equipo. Clasificadores del motor cASMI/cSMM.
      ["ASMI - Masa muscular apendicular", "asmi", null, "kg/m²"],
      ["SMM/W - Radio músculo/peso", "smmW", null, "%"],
      // Fenotipo MCCB (FFMI x FMI) lo appende la seccion al final de este nivel (sale del snapshot sellado).
    ],
  },
  {
    title: "Nivel III · Celular",
    rows: [
      ["MCA - Masa celular activa", "MCA", "MCA_ref", "kg"],
      // En Diagnostico el sufijo es LECTURA CLINICA (explica que significa el numero): se conserva. En
      // Evaluacion (dato medido) va corto. Mismo nombre BASE, marco de cada tabla (Santiago 2026-08-17).
      ["Sólidos extracelulares - matriz colágena", "solEC", "solEC_ref", "kg"],
      ["Masa seca sin grasa - ganancia real magra", "masaSeca", "masaSeca_ref", "kg"],
      // AEC/MCA (C12): ratio derivado ECW/MCA. Referencia = corte 0.45 (verbatim ATLAS_v7.html:12734).
      ["AEC/MCA - Radio extracelular/celular", "aec_mca", null, ""],
      ["AEC con grasa", "ECW", "ECW_ref", "L"],
      ["AEC con grasa", "ECW_pct", "ECW_pct_ref", "% de ACT"],
      ["AEC sin grasa", "ECW_sg", "ECW_sg_ref", "L"],
      ["AEC sin grasa", "ECW_sg_pct", "ECW_sg_pct_ref", "% de MLG"],
      ["AIC con grasa", "ICW", "ICW_ref", "L"],
      ["AIC con grasa", "ICW_pct", "ICW_pct_ref", "% de ACT"],
      ["AIC sin grasa", "ICW_sg", "ICW_sg_ref", "L"],
      ["AIC sin grasa", "ICW_sg_pct", "ICW_sg_pct_ref", "% de MLG"],
      ["Extracelular/intracelular con grasa (E/I)", "ei", null, ""],
      ["Extracelular/intracelular sin grasa (E/I)", "ei_sg", null, ""],
      // AF e IR en Nivel III (celular), donde Gildardo los tiene. DESPUES de los dos E/I (smoke l).
      ["AF - Ángulo de fase", "AF", null, "°"],
      ["IR - Radio de impedancia", "IR", null, ""],
      // Mapa AFxIR (PSC): no tiene valor numerico; su lectura sale de AF e IR, por eso va al final.
      ["Mapa AFxIR (PSC)", "psc", null, ""],
    ],
  },
  {
    title: "Nivel II · Molecular",
    rows: [
      ["ACT - Agua corporal total", "TBW", "TBW_ref", "L"],
      ["FFW - Agua libre de grasa", "FFW", "FFW_ref", "L"],
      ["Hidratación sin grasa - deshidratación", "hidSG", "hidSG_ref", "%"],
      ["ACT/MLG - Hidratación masa sin grasa", "act_mlg", null, "%"],
      ["CMO - Contenido mineral óseo", "CMO", "CMO_ref", "kg"],
      ["Proteína total", "protTotal", "protTotal_ref", "kg"],
      ["Proteína metabólica activa", "protActiva", "protActiva_ref", "kg"],
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
  // AEC/AIC SIN GRASA en % (smoke Santiago h/k, causa D): el equipo no siempre trae la columna. Se DERIVA
  // sobre la FFW (agua libre de grasa), NO sobre ACT: es el denominador que fija la identidad confirmada por
  // Gildardo (RESPUESTA 2026-08-15 §0) AEC_sg + AIC_sg = FFW, con la que los dos % suman 100. Coincide con la
  // columna del equipo donde existe (verificado: ECW_sg/FFW = ECW_sg_pct del export). El equipo manda si la trae.
  const _ffwVal = get("FFW");
  const ecwSgPct = get("ECW_sg_pct") ?? div(get("ECW_sg"), _ffwVal, 2, 100);
  const icwSgPct = get("ICW_sg_pct") ?? div(get("ICW_sg"), _ffwVal, 2, 100);

  // Valores COMPUTADOS (no columnas del equipo): circunferencias medidas, ratios y derivados. El resto
  // sale por su header. La clasificacion sexo-dependiente la resuelve composition-section.
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
    ECW_sg_pct: ecwSgPct,
    ICW_sg_pct: icwSgPct,
  };

  // Resuelve una fila de disposicion a una CompositionRow (valor + referencia). MISMA logica para las dos
  // tablas: el valor no depende de la tabla, solo el rotulo y el orden. aec_mca y FFW tienen tratamiento
  // especial (referencia = corte 0.45 / FFW - FFW_dif).
  const resolveRow = ([label, valueKey, refKey, unit, opts]: LevelRow): CompositionRow => {
    if (valueKey === "aec_mca") {
      return { key: valueKey, label, value: aecMca, reference: 0.45, referenceLabel: "<0.45", decimals: 3, unit };
    }
    const value = valueKey in computed ? computed[valueKey] : get(valueKey);
    const reference = valueKey === "FFW" ? ffwRef : refKey ? get(refKey) : null;
    return {
      key: valueKey,
      label,
      value,
      reference,
      unit,
      refKey,
      ...(opts?.bioelectric ? { bioelectric: true } : {}),
    };
  };
  const buildLevels = (defs: { title: string; rows: LevelRow[] }[]): CompositionLevel[] =>
    defs.map((lvl) => ({ title: lvl.title, rows: lvl.rows.map(resolveRow) }));

  return {
    eval: buildLevels(EVAL_LEVELS),
    diag: buildLevels(DIAG_LEVELS),
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
