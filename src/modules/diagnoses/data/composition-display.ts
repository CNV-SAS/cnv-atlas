// ══════════════════════════════════════════════════════════════════════════════════════════════
// CAPA DE DISPLAY de la tabla de Wang — NO es el motor sellado (frozen).
//
// Todo lo de este archivo es TEXTO/LÓGICA DE PRESENTACIÓN de Gildardo: vive en el RENDER de su tabla
// "Diagnóstico por Niveles de Wang" (ATLAS_v8.html, funciones `d*` ~L14085-14189 y el bloque REF_POB
// ~L6621-6725), NO en su motor clínico congelado (engine.core*). Se porta VERBATIM (cortes y etiquetas)
// con la línea de origen.
//
// ⚠️ IMPORTANTE (care Santiago 2026-08-15): como estas lecturas NO salen del motor sellado, si algún día
// el motor cambia (swap de Gildardo), ESTAS NO SE MUEVEN SOLAS. Son display suyo, no ciencia frozen. El
// que las toque después debe saber: los clasificadores POR INDICADOR del motor viven en indicator-ranges /
// classifications (cIFC, cFMI, cAF, cIR, cASMI...); ESTOS son de su capa de tabla. No mezclar.
// ══════════════════════════════════════════════════════════════════════════════════════════════

// El clasificador AEC/MCA vive en composition-map (modulo NEUTRO, puro); se reusa aca para que la fila
// aec_mca salga por la misma fuente unica (wangRowDx). composition-map NO importa este archivo: sin ciclo.
import { clasificarAecMca } from "./composition-map";

export type DisplayDx = { label: string; sev: number } | null;
// NHLBI devuelve ademas la clase (para la columna Valor) y el texto de cintura (para la columna Δ).
export type NhlbiDx = { label: string; sev: number; clase: string; ccAltaText: string } | null;

// Color del frozen -> severidad 0-3 para el semaforo (SEV_CLS). Ambar = leve (1); naranja = moderado (2);
// rojo (todas las variantes) = alto (3); verde = optimo (0).
//
// EL AZUL NO SE PUEDE LEER POR EL TONO (2026-08-24). Esta capa lo trataba como "optimo/informativo" junto
// al verde, y con eso **"Desnutricion" (FFMI bajo) y "Bajo peso" (IMC < 18,5) se pintaban de OPTIMO** en la
// tabla de Wang del Diagnostico. Es la SEGUNDA copia de la misma suposicion: `colorSev` (severity.ts) la
// tenia igual, se arreglo primero, y arreglar una sola dejaba viva la otra, que es justo la que pinta esta
// tabla. Barrer una regla exige los mismos sitios que barrer un umbral.
//
// Lo grave no era el color: era el FILTRO. La historia clinica muestra solo los indices alterados, asi que
// un paciente DESNUTRIDO habria salido con "Sin indices alterados": un documento clinico afirmando que un
// desnutrido esta bien. Ese caso es el que justifica todo el trabajo del filtro.
//
// El desempate lo da la ETIQUETA, que es lo unico inequivoco, y el default cae del lado seguro: un azul
// cuya etiqueta no reconozcamos se trata como alteracion. En un documento que filtra por alteracion es
// mejor que algo aparezca de mas y el profesional decida no mirarlo; al reves no se recupera.
const AZUL = new Set(["#3b82f6", "#60a5fa"]);
// Los DOS azules benignos del archivo: "Optimo" (SMM/W) y "Bajo (atleta)" (FM_pct/FFMI en deportistas).
const AZUL_BENIGNO = /óptim|optim|\(atleta\)/i;
// Comparador generico: su otra mitad ("Por debajo de la referencia") es ambar = 1, asi que la de arriba va
// al MISMO nivel. Es alteracion (algo se desvia), pero leve: no es un veredicto clinico, es un contraste.
const AZUL_LEVE = /por encima de la referencia/i;

function sevFromColor(c: string, label?: string): number {
  const hex = c.toLowerCase();
  if (["#f59e0b"].includes(hex)) return 1;
  if (["#f97316", "#ea580c"].includes(hex)) return 2;
  if (["#ef4444", "#dc2626", "#991b1b", "#7b0000"].includes(hex)) return 3;
  if (AZUL.has(hex)) {
    if (label && AZUL_BENIGNO.test(label)) return 0;
    if (label && AZUL_LEVE.test(label)) return 1;
    return 2; // deficit, desnutricion, edema, exceso: alteracion
  }
  return 0; // #16a34a/#10b981 (verde) y #0f766e/#0891b2 (teal, mapa informativo): optimo/informativo
}
const dx = (label: string, c: string): DisplayDx => ({ label, sev: sevFromColor(c, label) });


// ── E/I (radio AEC/AIC) — ATLAS_v8.html:14085 (dEI). Sobre el valor absoluto del radio. ──
export function dEI(v: number | null): DisplayDx {
  if (v == null) return null;
  if (v >= 0.35 && v <= 0.4) return dx("Equilibrio hídrico óptimo", "#16a34a");
  if (v > 0.4) return dx("Sobrecarga extracelular/inflamación", "#ef4444");
  return dx("Déficit extracelular/deshidratación", "#3b82f6");
}

// ── AEC% (de ACT / de MLG) — :14108 (dAECpct). ──
export function dAECpct(v: number | null): DisplayDx {
  if (v == null || v <= 0) return null;
  if (v < 35) return dx("AEC bajo", "#3b82f6");
  if (v <= 40) return dx("Equilibrio normal", "#16a34a");
  if (v <= 45) return dx("Sobrecarga leve / inflamación", "#f59e0b");
  return dx("Sobrecarga severa / edema", "#ef4444");
}

// ── AIC% (de ACT / de MLG) — :14116 (dAICpct). ──
export function dAICpct(v: number | null): DisplayDx {
  if (v == null || v <= 0) return null;
  if (v < 55) return dx("Déficit intracelular severo", "#ef4444");
  if (v < 60) return dx("Déficit intracelular leve", "#f59e0b");
  if (v <= 65) return dx("Hidratación celular adecuada", "#16a34a");
  return dx("Exceso intracelular", "#3b82f6");
}

// ── Sólidos extracelulares — :14124 (dSolEC). Sobre el Δ (valor − referencia), en kg. ──
export function dSolEC(delta: number | null): DisplayDx {
  if (delta == null) return null;
  if (delta <= -0.5) return dx("Déficit matriz — considerar colágeno", "#ef4444");
  if (delta < -0.1) return dx("Matriz limítrofe — vigilar colágeno", "#f59e0b");
  if (delta <= 0.5) return dx("Matriz extracelular adecuada", "#16a34a");
  return dx("Posible fibrosis/inflamación", "#f97316");
}

// ── Masa seca sin grasa — :14132 (dMasaSeca). Sobre el Δ (valor − referencia), en kg. ──
export function dMasaSeca(delta: number | null): DisplayDx {
  if (delta == null) return null;
  if (delta <= -0.5) return dx("Pérdida de masa magra real", "#ef4444");
  if (delta < -0.1) return dx("Tendencia a pérdida magra", "#f59e0b");
  if (delta <= 0.5) return dx("Masa magra estable", "#16a34a");
  return dx("Ganancia real (no agua/grasa)", "#0891b2");
}

// ── Grasa corporal total (% — Lípidos Wang) — :14102 (dFMpct). Por sexo, sobre el valor %. ──
export function dFMpct(v: number | null, sexoM: boolean): DisplayDx {
  if (v == null || v <= 0) return null;
  if (sexoM) {
    if (v < 10) return dx("Bajo (atleta)", "#3b82f6");
    if (v <= 22) return dx("Normal", "#16a34a");
    if (v <= 25) return dx("Sobrepeso adiposo", "#f59e0b");
    return dx("Obesidad adiposa", "#ef4444");
  }
  if (v < 18) return dx("Bajo (atleta)", "#3b82f6");
  if (v <= 32) return dx("Normal", "#16a34a");
  if (v <= 35) return dx("Sobrepeso adiposo", "#f59e0b");
  return dx("Obesidad adiposa", "#ef4444");
}

// ── ACT/MLG (Hidratación masa sin grasa %) — :14086 (dACTMLG). Sobre el valor %. ──
export function dACTMLG(v: number | null): DisplayDx {
  if (v == null) return null;
  if (v >= 71 && v <= 74) return dx("Normal", "#16a34a");
  if (v < 71) return dx("Deshidratación relativa", "#f59e0b");
  return dx("Sobrehidratación/edema", "#3b82f6");
}

// ── Clasificación IMC + cintura (NHLBI) — :14168 (clasifIMCcintura). Combina IMC y cintura por sexo. ──
// Cortes de cintura NIH/NHLBI 1998: H >102 cm · M >88 cm.
export function clasifNHLBI(imc: number | null, cintura: number | null, sexoM: boolean): NhlbiDx {
  const b = imc || 0;
  const c = cintura || 0;
  if (!(b > 0)) return null;
  const ccAlta = c > 0 ? c > (sexoM ? 102 : 88) : null;
  let clase: string;
  let riesgo: string | null;
  if (b < 18.5) { clase = "Bajo peso"; riesgo = null; }
  else if (b < 25) { clase = "Peso normal"; riesgo = null; }
  else if (b < 30) { clase = "Sobrepeso"; riesgo = ccAlta === null ? null : ccAlta ? "Alto" : "Aumentado"; }
  else if (b < 35) { clase = "Obesidad clase I"; riesgo = ccAlta === null ? null : ccAlta ? "Muy alto" : "Alto"; }
  else if (b < 40) { clase = "Obesidad clase II"; riesgo = "Muy alto"; }
  else { clase = "Obesidad clase III"; riesgo = "Extremadamente alto"; }
  if (riesgo === null && b >= 18.5 && b < 25 && ccAlta === true) riesgo = "Aumentado";
  const COL: Record<string, string> = {
    Aumentado: "#f59e0b",
    Alto: "#f97316",
    "Muy alto": "#ef4444",
    "Extremadamente alto": "#991b1b",
  };
  const label = clase + (riesgo ? " · riesgo " + riesgo.toLowerCase() : "");
  const color = riesgo ? COL[riesgo] : b >= 18.5 && b < 25 ? "#16a34a" : "#64748b";
  const base = dx(label, color);
  const ccAltaText = ccAlta === null ? "—" : ccAlta ? "CC elevada" : "CC normal";
  return base ? { ...base, clase, ccAltaText } : null;
}

// dAF / dIR de la tabla de display (ATLAS_v8:14082-14083). Coinciden con el motor cAF/cIR (cortes y
// etiquetas), pero se portan aca para que TODA la tabla salga de una fuente (el display).
export function dAF(v: number | null, sexoM: boolean): DisplayDx {
  if (!v) return null;
  if (sexoM) return v < 6.5 ? dx("Bajo", "#ef4444") : v <= 7.0 ? dx("Normal", "#16a34a") : dx("Alto", "#3b82f6");
  return v < 6.0 ? dx("Bajo", "#ef4444") : v <= 6.5 ? dx("Normal", "#16a34a") : dx("Alto", "#3b82f6");
}
export function dIR(v: number | null, sexoM: boolean): DisplayDx {
  if (!v) return null;
  return v < (sexoM ? 0.78 : 0.82) ? dx("Óptimo", "#16a34a") : dx("Inflamación de bajo grado", "#ef4444");
}

// ── Mapa AFxIR (Perfil de Salud Celular) — :13448-13470 (afPSC/irPSC/PSC_INTERP). ──
const PSC_INTERP: Record<string, string> = {
  Elevado_Bajo: "Disfunción celular severa · Desequilibrio hídrico · Inflamación de bajo grado",
  Elevado_Normal: "Inflamación de bajo grado con función celular conservada",
  Elevado_Alto: "Masa celular activa elevada con desequilibrio hídrico",
  Normal_Bajo: "Déficit de masa celular activa",
  Normal_Normal: "Perfil de Salud Celular adecuado",
  Normal_Alto: "Buena Masa Celular Activa",
  Bajo_Bajo: "Déficit celular con hidratación conservada",
  Bajo_Normal: "Hidratación óptima · Masa celular límite",
  Bajo_Alto: "Perfil de salud celular ideal",
};
export function pscAFxIR(
  af: number | null,
  ir: number | null,
  sexoM: boolean,
): { valueText: string; dx: DisplayDx } {
  const afK = !af || af <= 0 ? "N/D" : sexoM ? (af < 6.5 ? "Bajo" : af <= 7 ? "Normal" : "Alto") : af < 6 ? "Bajo" : af <= 6.5 ? "Normal" : "Alto";
  const t = sexoM ? 0.78 : 0.82;
  const irK = !ir || ir <= 0 ? "N/D" : ir < t * 0.97 ? "Bajo" : ir <= t * 1.03 ? "Normal" : "Elevado";
  const valueText = afK !== "N/D" && irK !== "N/D" ? `IR ${irK} · AF ${afK}` : "—";
  const interp = PSC_INTERP[`${irK}_${afK}`];
  return { valueText, dx: interp ? dx(interp, "#0f766e") : null };
}

// ── Clasificadores de la tabla que en el HTML son DISTINTOS de los del motor (verbatim, ATLAS_v8:14072+).
// El HTML muestra ESTOS (no los cIMC/cCintura/cFFMI del motor): para igualar el HTML se usan estos. La
// UNICA excepcion es FMI, donde Gildardo dijo que manda el motor (3-6, no el 6-9 de dFMI): FMI no pasa por
// aca, lo resuelve la seccion con el motor.
export function dIMC(v: number | null): DisplayDx {
  if (!v) return null;
  if (v < 18.5) return dx("Bajo peso", "#3b82f6");
  if (v < 25) return dx("Normal", "#16a34a");
  if (v < 30) return dx("Sobrepeso", "#f59e0b");
  if (v < 35) return dx("Obesidad I", "#ef4444");
  if (v < 40) return dx("Obesidad II", "#b91c1c");
  return dx("Obesidad III", "#7f1d1d");
}
export function dCC(v: number | null, sexoM: boolean): DisplayDx {
  if (!v) return null;
  const [lo, hi] = sexoM ? [94, 102] : [80, 88];
  if (v < lo) return dx("Normal", "#16a34a");
  if (v <= hi) return dx("Riesgo", "#f59e0b");
  return dx("Riesgo alto", "#ef4444");
}
export function dICC(v: number | null, sexoM: boolean): DisplayDx {
  if (!v) return null;
  return v < (sexoM ? 0.9 : 0.85) ? dx("Normal", "#16a34a") : dx("Riesgo cardiovascular", "#ef4444");
}
export function dICT(v: number | null): DisplayDx {
  if (!v) return null;
  if (v < 0.5) return dx("Normal", "#16a34a");
  if (v <= 0.6) return dx("Riesgo", "#f59e0b");
  return dx("Riesgo alto", "#ef4444");
}
export function dFFMI(v: number | null, sexoM: boolean): DisplayDx {
  if (!v) return null;
  if (sexoM) {
    if (v < 17) return dx("Desnutrición", "#3b82f6");
    if (v <= 25) return dx("Normal", "#16a34a");
    if (v <= 28) return dx("Sospecha anabolizantes", "#f59e0b");
    return dx("Uso esteroides", "#ef4444");
  }
  if (v < 15) return dx("Desnutrición", "#3b82f6");
  if (v <= 23) return dx("Normal", "#16a34a");
  if (v <= 25) return dx("Sospecha anabolizantes", "#f59e0b");
  return dx("Uso esteroides", "#ef4444");
}
// dMCA/dCMO/dProt operan sobre el Δ (valor − referencia).
export function dMCA(delta: number | null): DisplayDx {
  if (delta == null) return null;
  if (delta >= 0) return dx("Adecuado", "#16a34a");
  if (delta >= -1) return dx("Leve déficit", "#f59e0b");
  return dx("Déficit MCA", "#ef4444");
}
export function dCMO(delta: number | null): DisplayDx {
  if (delta == null) return null;
  if (delta >= 0) return dx("Normal", "#16a34a");
  if (delta >= -1) return dx("Riesgo de osteopenia", "#f59e0b");
  return dx("Riesgo de osteoporosis", "#ef4444");
}
export function dProt(delta: number | null): DisplayDx {
  if (delta == null) return null;
  if (delta >= 0) return dx("Reserva proteica adecuada", "#16a34a");
  if (delta >= -1) return dx("Déficit proteico leve", "#f59e0b");
  return dx("Déficit proteico", "#ef4444");
}
// Hidratacion sin grasa (dHidDef): sobre el valor %.
export function dHidDef(v: number | null): DisplayDx {
  if (v == null) return null;
  if (v >= 73) return v > 78 ? dx("Sobrehidratación", "#3b82f6") : dx("Normohidratación (≥73%)", "#16a34a");
  const def = 73 - v;
  if (def < 5) return dx("Deshidratación leve", "#f59e0b");
  if (def <= 10) return dx("Deshidratación moderada", "#f97316");
  return dx("Deshidratación severa", "#ef4444");
}

// ── ASMI y SMM/W — cortes del clasificador del MOTOR (frozen engine.core.derived.js:212 cASMI, :178
// cSMM; estándar EWGSOP2/AWGS2019). Se portan aca por su corte para la tabla de display (no estan
// expuestos en `classifications`, que solo trae los 12 indicadores). Son cortes del MOTOR, no display puro.
export function clasificarASMI(v: number | null, sexoM: boolean): DisplayDx {
  if (v == null || v <= 0) return null;
  return v < (sexoM ? 7.0 : 5.5) ? dx("Riesgo de Sarcopenia", "#ef4444") : dx("Normal", "#10b981");
}
export function clasificarSMMW(v: number | null, sexoM: boolean): DisplayDx {
  if (v == null || v <= 0) return null;
  const [lo, hi] = sexoM ? [27, 33] : [22, 28];
  if (v < lo) return dx("Sarcopenia", "#ef4444");
  if (v <= hi) return dx("Normal", "#10b981");
  return dx("Óptimo", "#3b82f6");
}

// ── Genérico valor vs referencia teórica — :14140 (dVsRef). Tolerancia 5% por defecto. ──
export function dVsRef(val: number | null, ref: number | null, tolFrac = 0.05): DisplayDx {
  if (val == null || ref == null || !isFinite(val) || !isFinite(ref) || ref === 0) return null;
  const tol = Math.abs(ref) * tolFrac;
  const d = val - ref;
  if (Math.abs(d) <= tol) return dx("En referencia", "#16a34a");
  return d > 0 ? dx("Por encima de la referencia", "#3b82f6") : dx("Por debajo de la referencia", "#f59e0b");
}

// ── REF_POB — referencias poblacionales de último recurso (ATLAS_v8.html:6621-6725). ──
// Se aplican SOLO a los `*_ref` que sigan vacíos (el equipo manda siempre). Devuelve para cada clave el
// valor derivado y si esta "en validacion" (constante aun no validada por Gildardo). SIN marca (validadas):
// hidratacion 73,2% y MCA 52,4% (§9), y el REPARTO DE WANG confirmado el 2026-08-17 §5 (proteina total 19,4%,
// CMO 5,6%, mineral no oseo 1,2%; cierran en 99,4% con la hidratacion). MARCADAS (siguen sin validar): agua EC
// 42% (la distribucion real sobre los 5.073 registros va a la ronda) y proteina ACTIVA 70% (de la que hereda
// la marca la masa proteica metabolica y solEC). El texto del asterisco dice "en validacion", no "dato malo".
export type RefPobEntry = { value: number; enValidacion: boolean };
export function computeRefPob(
  peso: number | null,
  tallaCm: number | null,
  sexoM: boolean,
  existing: (key: string) => number | null,
): Record<string, RefPobEntry> {
  const out: Record<string, RefPobEntry> = {};
  if (!peso || peso <= 0) return out;
  const tallaM = tallaCm && tallaCm > 0 ? tallaCm / 100 : 0;
  const rd = (v: number, d = 2) => (isFinite(v) ? parseFloat(v.toFixed(d)) : null);
  // Solo rellena lo vacio; devuelve el valor final (equipo o derivado) para encadenar.
  const put = (key: string, value: number | null, enValidacion: boolean): number | null => {
    const real = existing(key);
    if (real != null) return real; // el equipo manda
    if (value == null) return null;
    out[key] = { value, enValidacion };
    return value;
  };
  // grasa/MLG (grasaPct 17,5/25, ya en el archivo -> sin marca)
  const gPct = sexoM ? 17.5 : 25.0;
  put("FM_pct_ref", gPct, false);
  put("FM_hid_ref", gPct, false);
  put("FM_ref", rd((peso * gPct) / 100), false);
  const ffmR = put("FFM_ref", rd((peso * (100 - gPct)) / 100), false);
  // agua total / hidratacion (hidratFFM 73,2 -> validada, sin marca)
  const tbwR = ffmR != null ? put("TBW_ref", rd((ffmR * 73.2) / 100), false) : null;
  put("hidSG_ref", 73.2, false);
  const actMlgR = put("ACT_MLG_ref", 73.2, false);
  // reparto agua EC/IC (aguaEC 42 -> NO validada, marca)
  if (tbwR != null) {
    put("ECW_ref", rd((tbwR * 42) / 100), true);
    put("ICW_ref", rd((tbwR * 58) / 100), true);
    put("ECW_pct_ref", 42, true);
    put("ICW_pct_ref", 58, true);
    put("ECW_sg_ref", out["ECW_ref"]?.value ?? existing("ECW_ref"), true);
    put("ICW_sg_ref", out["ICW_ref"]?.value ?? existing("ICW_ref"), true);
    put("ECW_sg_pct_ref", 42, true);
    put("ICW_sg_pct_ref", 58, true);
    put("FFW_ref", tbwR, false); // = TBW_ref (de hidratFFM validada) -> sin marca
  }
  // composicion de la MLG. Gildardo CONFIRMO (RESPUESTA 2026-08-17 §5) tres como REPARTO DE WANG, sin marca:
  // proteina total 19,4%, CMO 5,6%, mineral no oseo 1,2% (cierran con la hidratacion 73,2%: 73,2+19,4+5,6+1,2
  // = 99,4%; el 0,6% es glucogeno y menores). SIGUE MARCADA la proteina ACTIVA 70% (reparto activa/estructural
  // sin constante estable). MCA 52,4% ya estaba validada (§9).
  if (ffmR != null) {
    const protTotalR = put("protTotal_ref", rd((ffmR * 19.4) / 100), false);
    if (protTotalR != null) put("protActiva_ref", rd((protTotalR * 70.0) / 100), true); // 70% sin validar -> marca
    put("CMO_ref", rd((ffmR * 5.6) / 100), false);
    put("minNoOseo_ref", rd((ffmR * 1.2) / 100), false);
    put("MCA_ref", rd((ffmR * 52.4) / 100), false);
    // masa seca sin grasa = MLG − agua (identidad, sin marca)
    if (tbwR != null) put("masaSeca_ref", rd(ffmR - tbwR), false);
    // solEC = masaSeca − protActiva − minNoOseo: depende de la proteina activa (70%, sin validar) -> hereda marca
    const ms = out["masaSeca_ref"]?.value ?? existing("masaSeca_ref");
    const pa = out["protActiva_ref"]?.value ?? existing("protActiva_ref");
    const mn = out["minNoOseo_ref"]?.value ?? existing("minNoOseo_ref");
    if (ms != null && pa != null && mn != null) {
      const se = rd(ms - pa - mn);
      if (se != null && se > 0) put("solEC_ref", se, true);
    }
  }
  // MMEM_ref = ASMI × talla² (asmi 7,0/5,5, ya en el archivo -> sin marca)
  if (tallaM > 0) put("MMEM_ref", rd((sexoM ? 7.0 : 5.5) * tallaM * tallaM), false);
  void actMlgR;
  return out;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// FUENTE ÚNICA por fila de la tabla de Wang (fix sistemático 2026-08-15): diagnóstico + referencia +
// corte del Δ, TODO de un solo lugar. Antes la referencia se escribía a mano por fila y quedaban celdas
// vacías con el clasificador ya sabiendo su rango (ver leccion dato-a-mano-junto-al-que-lo-contiene).
// Espeja el HTML (usa sus clasificadores d* y sus referencias), EXCEPTO FMI (manda el motor, 3-6, no el
// 6-9 de dFMI): FMI NO pasa por aca, lo resuelve la seccion con el motor. Las filas crudas de masa
// (FM/FFM/SMM/MMEM/peso/GEB/GET...) devuelven null: referencia del equipo, sin diagnostico (como el HTML).
// ══════════════════════════════════════════════════════════════════════════════════════════════
export type WangRowDx = {
  dx: DisplayDx;
  referenceLabel: string;
  cut: number | null; // para el Δ (valor − cut); null => sin Δ derivable de un corte
  valueText?: string; // texto en la columna Valor (NHLBI = clase, Mapa AFxIR = "IR .. · AF ..")
  deltaText?: string; // texto en la columna Δ (NHLBI = "CC normal")
};

// Regla del `cut` (para que el Δ salga de UNA fuente y sea consistente en toda la tabla). Gildardo
// 2026-08-17 (§2) FIJO el criterio: el Δ va contra EL BORDE QUE DECIDE la clasificacion, no el punto
// medio ni el borde mas cercano (revierte CA-2 opcion B / P-23c, que era punto medio). "El punto medio es
// defendible en estadistica y engañoso en clinica": FFMI 19.90 en 17–25 es normal, y contra el medio 21
// sale −1.10, que en una columna Δ roja se lee como deficit inexistente; contra el borde 17 sale +2.90,
// que dice cuanto falta para cruzar el limite.
//  - Banda de dos lados: cut = el LIMITE QUE GOBIERNA (tabla de Gildardo §2). IMC 24.9 (sup), FFMI 17/15
//    (inf), AEC% 40 (sup), AIC% 65 (inf), E/I 0.40 (sup), ACT/MLG 74 (sup), AF 6.5/6.0 (inf).
//  - Umbral de un lado ("<0.45", "≥7.0", "<94 cm", "≥73%"): cut = el umbral. Δ = valor − umbral.
//  - Fila valor-vs-referencia (MCA, ECW, TBW, FFW...): cut = la referencia efectiva (equipo/REF_POB). Es
//    la tabla de Antropometria (valor − referencia), que Gildardo mantiene APARTE: no se mezclan criterios.
//  - FM_pct (grasa %): CONFIRMADO borde SUPERIOR H 22 / M 32 (Gildardo §1, 2026-08-18: es el lado del riesgo,
//    el limite que decide el paso a "Sobrepeso adiposo"). Δ contra ese borde, como el resto de la tabla.

export function wangRowDx(
  rowKey: string,
  value: number | null,
  sexoM: boolean,
  ctx: { imc: number | null; cintura: number | null; af: number | null; ir: number | null },
  effRef: number | null,
  fmtRef: (v: number | null) => string,
): WangRowDx | null {
  const dl = value != null && effRef != null ? value - effRef : null; // Δ contra la ref (equipo/REF_POB)
  const refBased = (d: DisplayDx): WangRowDx => ({ dx: d, referenceLabel: fmtRef(effRef), cut: effRef });
  switch (rowKey) {
    case "imc": return { dx: dIMC(value), referenceLabel: "18.5–24.9", cut: 24.9 }; // borde superior (Gildardo §2)
    case "cintura": return { dx: dCC(value, sexoM), referenceLabel: sexoM ? "<94 cm" : "<80 cm", cut: sexoM ? 94 : 80 };
    case "icc": return { dx: dICC(value, sexoM), referenceLabel: sexoM ? "<0.90" : "<0.85", cut: sexoM ? 0.9 : 0.85 };
    case "ict": return { dx: dICT(value), referenceLabel: "<0.50", cut: 0.5 };
    case "nhlbi": {
      const n = clasifNHLBI(ctx.imc, ctx.cintura, sexoM);
      return {
        dx: n,
        referenceLabel: sexoM ? "IMC 18.5–24.9 · CC ≤102 cm" : "IMC 18.5–24.9 · CC ≤88 cm",
        cut: null,
        valueText: n?.clase ?? "—",
        deltaText: n?.ccAltaText ?? "—",
      };
    }
    case "FFMI": return { dx: dFFMI(value, sexoM), referenceLabel: sexoM ? "17–25" : "15–23", cut: sexoM ? 17 : 15 }; // borde inferior (Gildardo §2)
    case "asmi": return { dx: clasificarASMI(value, sexoM), referenceLabel: sexoM ? "≥7.0" : "≥5.5", cut: sexoM ? 7.0 : 5.5 };
    case "smmW": return { dx: clasificarSMMW(value, sexoM), referenceLabel: sexoM ? "≥27%" : "≥22%", cut: sexoM ? 27 : 22 };
    case "MCA": return refBased(dMCA(dl));
    case "solEC": return refBased(dSolEC(dl));
    case "masaSeca": return refBased(dMasaSeca(dl));
    case "aec_mca": return { dx: clasificarAecMca(value), referenceLabel: "<0.45", cut: 0.45 };
    case "ECW": case "ICW": case "ECW_sg": case "ICW_sg": case "TBW": case "FFW": return refBased(dVsRef(value, effRef));
    case "ECW_pct": case "ECW_sg_pct": return { dx: dAECpct(value), referenceLabel: "35–40%", cut: 40 }; // borde superior (Gildardo §2)
    case "ICW_pct": case "ICW_sg_pct": return { dx: dAICpct(value), referenceLabel: "60–65%", cut: 65 }; // borde inferior (Gildardo §2)
    case "ei": case "ei_sg": return { dx: dEI(value), referenceLabel: "0.35–0.40", cut: 0.4 }; // borde superior (Gildardo §2)
    case "AF": return { dx: dAF(value, sexoM), referenceLabel: sexoM ? "6.5–7.0°" : "6.0–6.5°", cut: sexoM ? 6.5 : 6.0 }; // borde inferior (Gildardo §2)
    case "IR": return { dx: dIR(value, sexoM), referenceLabel: sexoM ? "<0.78" : "<0.82", cut: sexoM ? 0.78 : 0.82 };
    case "psc": {
      const p = pscAFxIR(ctx.af, ctx.ir, sexoM);
      return { dx: p.dx, referenceLabel: "—", cut: null, valueText: p.valueText };
    }
    case "hidSG": return { dx: dHidDef(value), referenceLabel: "≥73% (normohidrat.)", cut: 73 };
    case "act_mlg": return { dx: dACTMLG(value), referenceLabel: "71–74%", cut: 74 }; // borde superior (Gildardo §2)
    // FM_pct (grasa %): borde SUPERIOR H22/M32 (Gildardo §1, 2026-08-18: el lado del riesgo, el limite que
    // decide el paso a "Sobrepeso adiposo"). Δ contra ese borde, como el resto de la tabla.
    case "FM_pct": return { dx: dFMpct(value, sexoM), referenceLabel: sexoM ? "10–22%" : "18–32%", cut: sexoM ? 22 : 32 }; // borde superior H22/M32 (Gildardo §1, 2026-08-18)
    case "CMO": return refBased(dCMO(dl));
    case "protTotal": case "protActiva": return refBased(dProt(dl));
    default: return null; // filas crudas de masa: sin clasificador (referencia del equipo, sin diagnostico)
  }
}
