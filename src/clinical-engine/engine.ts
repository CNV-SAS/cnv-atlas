// runEngine REAL (B11): reemplaza el stub. Orquesta el adaptador (que envuelve la
// ciencia congelada) y mapea su salida al contrato EngineOutput de la app. TS puro.
//
// Dos rutas (opcion 1 de B11): la BIS (analizarDesdeBiody) siempre corre y da los 12
// indicadores + fenotipo EFR + estructural + FyR; el DFI (analizarDFI) corre completo
// cuando hay encuesta y DEGRADADO cuando no (marcado explicito en dfi.complete, no null
// silencioso). Cuando se porte la encuesta real, el DFI se enciende sin tocar el motor.

import { analizarDesdeBiody, analizarDFI, calcLE8 } from "./analysis";
import { suspendSurveyRoutes } from "./dfi-routes";
import { classifyFenotipo } from "./protocolo-fenotipo";
// Derivado: engine.core.js + 6 exports aditivos (efrProf, clasificadores). Mecanismo de archivo
// derivado, no edita el frozen (ver engine.core.derived.js y DIFF C).
import * as core from "./frozen/engine.core.derived.js";
import {
  bandToLetter,
  efrStateNumber,
  type EngineDfi,
  type EngineIndicators,
  type EngineInput,
  type EngineOutput,
  type IndicatorClass,
} from "./types";
import { ENGINE_VERSION } from "./version";

function r4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// Coercion de un crudo del Biody (number | null) a numero para el clasificador, igual que el
// protocolo (num): null/NaN -> 0. classifyFenotipo tolera 0 en sus guardas.
function num(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

// Un campo de encuesta esta RESPONDIDO si no es null, ni cadena vacia, ni array vacio (un
// multi-select sin marcar llega como []). Sirve tanto para "hay algun dato" como para medir
// completitud campo a campo.
function answered(v: unknown): boolean {
  if (v == null || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

// La encuesta trae ALGUN dato util (patron de ID del prototipo dN_M). Habilita el computo de
// LE8/EB (se calcula con lo que haya); es DISTINTO de dfi.complete (que exige TODOS los
// field_key declarados). Un parcial produce EB/rutas sobre lo presente, pero se marca incompleto.
function hasSurveyData(survey: Record<string, unknown>): boolean {
  return Object.keys(survey).some((k) => /^d\d+_\d+$/.test(k) && answered(survey[k]));
}

const NO_SURVEY_REASON =
  "Sin datos de encuesta: el diagnóstico funcional integral (dominios de encuesta, EB/IAE y LE8) está incompleto hasta integrar la encuesta.";

export function runEngine(input: EngineInput): EngineOutput {
  const { sexo, edad, bisRow, survey, expectedFieldKeys, model } = input;
  const surveyPresent = hasSurveyData(survey);

  // Completitud REAL (regla 7, definicion aprobada 2026-08-02): la encuesta esta completa si
  // TODOS los field_key que declara su version estan respondidos. expectedFieldKeys debe venir
  // NO vacio (el que arma el input falla fuerte si no lo puede leer); si aun asi llega vacio, es
  // una violacion de contrato y se falla fuerte aqui, NUNCA se cae a "completo" por defecto.
  if (expectedFieldKeys.length === 0) {
    throw new Error(
      "runEngine: expectedFieldKeys vacío; no se puede medir dfi.complete sin la lista declarada por la versión de la encuesta (regla 7).",
    );
  }
  const missingFieldKeys = expectedFieldKeys.filter((k) => !answered(survey[k]));
  const surveyComplete = missingFieldKeys.length === 0;
  // degradedReason: sin encuesta -> mensaje de "sin datos"; parcial -> cuenta de lo que falta
  // (la vista traduce missingFieldKeys a dominios). El "por que" no lleva etiquetas de dominio
  // para que el texto sellado sea estable; los dominios se computan al mostrar.
  const degradedReason = !surveyPresent
    ? NO_SURVEY_REASON
    : surveyComplete
      ? null
      : `Encuesta incompleta: faltan ${missingFieldKeys.length} de ${expectedFieldKeys.length} respuestas que usa el diagnóstico. El profesional puede completarla en consulta.`;

  // LE8/ICEC desde la encuesta (solo si hay): habilita EB/IAE.
  const le8 = surveyPresent ? calcLE8(survey) : null;
  const icec = le8 != null ? le8.total : null;

  // Ruta BIS (siempre): indices, clases, fenotipo EFR/estructural/FyR, nutraceuticos.
  const a = analizarDesdeBiody(bisRow, sexo, { icec, edad });

  const bands = {
    ifc: a.clases.IFC.k,
    irc: a.clases.IRC.k,
    ffmi: a.clases.FFMI.k,
    fmi: a.clases.FMI.k,
  };

  const efrKey = a.fenotipoEFR.key;
  const stateNumber = efrStateNumber(bands);

  // Fenotipo estructural (STRUCT_LABELS: FFMI_FMI) y sector FyR (FYR_LABELS: ifcK_ircK).
  const structKey = `${bandToLetter(bands.ffmi)}_${bandToLetter(bands.fmi)}`;
  const structural = { key: structKey, nombre: core.STRUCT_LABELS[structKey] ?? structKey };
  const fyrKey = `${bands.ifc}_${bands.irc}`;
  const fyr = core.FYR_LABELS[fyrKey];
  const frSector = { key: fyrKey, nombre: fyr?.l ?? fyrKey };

  // Indicadores (12). AF/IR de las columnas del Biody; ICA-BIS = |PABU - phi| (ATLAS_v7
  // L5721). ISCM/IEHH/IAE/EB pueden ser null (no se inventan).
  const rawAF = a.fuente.raw.AF;
  const rawIR = a.fuente.raw.IR;
  const indicators: EngineIndicators = {
    ifc: a.indices.IFC,
    irc: a.indices.IRC,
    pabu: a.indices.PABU,
    icaBis: r4(Math.abs(a.indices.PABU - 1.618)),
    iscm: a.indices.ISCM,
    iehh: a.indices.IEHH,
    // SUSPENSION por encuesta incompleta (Q28, Gildardo): EB-BIS e IAE dependen del ICEC (LE8, encuesta),
    // asi que con la encuesta incompleta NO se emiten (null), no se emite una edad inflada sobre defaults.
    // El eje envejecimiento (EB + IAE) es una sola salida; se suspenden juntos. ISCM/IEHH son BIS: se
    // conservan. Con encuesta completa, sin cambio (los golden de paridad no se tocan).
    iae: surveyComplete ? a.indices.IAE : null,
    eb: surveyComplete ? a.indices.EB_BIS : null,
    FMI: a.indices.FMI,
    FFMI: a.indices.FFMI,
    AF: typeof rawAF === "number" ? rawAF : 0,
    IR: typeof rawIR === "number" ? rawIR : 0,
  };

  // Fenotipo MCCB (F1-F12), la OTRA clasificacion estructural (Q19). Se computa aqui, a nivel del
  // DIAGNOSTICO, con el mismo clasificador ya portado (classifyFenotipo, con golden+DIFF) y los mismos
  // insumos que usa el protocolo. Depende SOLO de FMI/FFMI (mas MCA para partir el tramo alto); la
  // rama de sarcopenia/prensil alimenta el protocolo, no este rotulo. Se sella id+nombre (+riesgo/color
  // para el display) en el snapshot; ver types.ts (por que snapshot y no columna).
  const fenMCCB = classifyFenotipo({
    FMI: indicators.FMI,
    FFMI: indicators.FFMI,
    MCA: num(a.fuente.raw.MCA),
    MCA_ref: num(a.fuente.raw.MCA_ref),
    smmW: num(a.fuente.raw.smmW),
    ASMI: a.fuente.ASMI,
    AF: indicators.AF,
    sexoM: sexo === "M",
  }).fenotipo;
  const fenotipoMCCB = {
    id: fenMCCB.id,
    nombre: fenMCCB.nombre,
    riesgo: fenMCCB.riesgo,
    color: fenMCCB.color,
  };

  // Clasificaciones por codigo. AF e IR SI se clasifican: sus clasificadores cAF/cIR existen en el
  // frozen y ahora estan expuestos (mecanismo de archivo derivado); antes quedaban null solo porque
  // no se llamaban (port incompleto, no exclusion deliberada). Verificado que cAF/cIR del frozen ==
  // los clasificadores del HTML (cortes y etiquetas identicos; cAF == dAF de la tabla). Es display
  // (tabla + composicion), no toca DFI/rutas/severidad. ICA-BIS y EB no tienen clasificador en el
  // frozen (no hay cICA/cEB): quedan null.
  const classifications: Record<string, IndicatorClass> = {
    IFC: { label: a.clases.IFC.l, k: a.clases.IFC.k },
    IRC: { label: a.clases.IRC.l, k: a.clases.IRC.k },
    PABU: { label: a.clases.PABU.l },
    FMI: { label: a.clases.FMI.l, k: a.clases.FMI.k },
    FFMI: { label: a.clases.FFMI.l, k: a.clases.FFMI.k },
    ISCM: a.clases.ISCM ? { label: a.clases.ISCM.l } : null,
    IEHH: a.clases.IEHH ? { label: a.clases.IEHH.l } : null,
    IAE: a.clases.IAE ? { label: a.clases.IAE.l } : null,
    "ICA-BIS": null,
    EB: null,
    AF: indicators.AF > 0 ? { label: core.cAF(indicators.AF, sexo).l } : null,
    IR: indicators.IR > 0 ? { label: core.cIR(indicators.IR, sexo).l } : null,
  };

  // DFI (autoritativo). Se computa con lo que haya (LE8/EB sobre lo presente); la marca de
  // completitud es surveyComplete (todos los field_key declarados), no "hay algun dato".
  // Q28 (pendiente): complete=false NO impide emitir el diagnostico hoy, solo lo marca.
  const dfiRaw = analizarDFI(bisRow, { ...survey, sexo, edad });
  const dfi: EngineDfi = {
    complete: surveyComplete,
    missingFieldKeys,
    degradedReason,
    domains: dfiRaw.domains.map((d) => ({
      id: d.id,
      nombre: d.nombre,
      sev: d.sev,
      clasif: d.clasif,
      lectura: d.lectura,
      items: d.items,
      veto: d.veto,
    })),
    riesgo: {
      nivel: dfiRaw.riesgo.l,
      score: dfiRaw.riesgo.score,
      descripcion: dfiRaw.riesgo.d,
    },
    veto: dfiRaw.veto,
    // SUSPENSION (Q28): con encuesta incompleta se conservan las rutas BIS (R1/R2, de la medicion) y se
    // suspenden las de encuesta (R3/R4/R5/R6). Ver dfi-routes.ts (mapeo verificado contra el frozen).
    rutas: surveyComplete ? dfiRaw.rutas : suspendSurveyRoutes(dfiRaw.rutas),
    // ICEC/LE8 depende de la encuesta: con incompleta NO se emite (antes se anulaba solo si NO habia
    // ningun dato; ahora tambien si esta incompleta, para no sellar un ICEC calculado con defaults).
    le8Total: surveyComplete ? dfiRaw.le8.total : null,
    // Dominios sin dato (CA-6). Se SELLA con el diagnostico, no se recalcula al mostrar: un diagnostico
    // emitido tiene que poder decir sobre cuantos dominios se calculo su riesgo, aunque manana el
    // paciente complete lo que faltaba.
    dfiSinDato: dfiRaw.sinDato,
  };

  const rutasTxt = dfi.rutas.length ? dfi.rutas.join("; ") : "sin rutas activas";
  const resumenClinico =
    `Fenotipo EFR ${efrKey}: ${a.fenotipoEFR.dx ?? "sin diagnóstico"}. ` +
    `Nutraceuticos sugeridos: ${a.fenotipoEFR.nutraceuticos}. ` +
    `Rutas de atencion (DFI${surveyComplete ? "" : ", encuesta incompleta"}): ${rutasTxt}.`;

  return {
    sexo: a.sexo,
    indicators,
    classifications,
    efrPhenotype: {
      key: efrKey,
      stateNumber,
      bands,
      diagnostico: a.fenotipoEFR.dx ?? "",
      nutraceuticos: a.fenotipoEFR.nutraceuticos,
    },
    structural,
    fenotipoMCCB,
    frSector,
    dfi,
    nutraceuticos: a.fenotipoEFR.nutraceuticos,
    resumenClinico,
    // ASMI ya esta computado (a.fuente.ASMI, alimenta el fenotipo); se SELLA para los motores de
    // tratamiento (medico/ejercicio). null si falta MMEM (NaN -> null, JSON no tiene NaN).
    asmi: Number.isFinite(a.fuente.ASMI) ? a.fuente.ASMI : null,
    versions: {
      engine: ENGINE_VERSION,
      model: model.version,
      rules: model.rulesVersion,
    },
  };
}
