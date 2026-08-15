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

export type DisplayDx = { label: string; sev: number } | null;

// Color del frozen -> severidad 0-3 para el semaforo (SEV_CLS). Verde/azul/teal = optimo/informativo (0);
// ambar = leve (1); naranja = moderado (2); rojo (todas las variantes) = alto (3).
function sevFromColor(c: string): number {
  const hex = c.toLowerCase();
  if (["#f59e0b"].includes(hex)) return 1;
  if (["#f97316", "#ea580c"].includes(hex)) return 2;
  if (["#ef4444", "#dc2626", "#991b1b", "#7b0000"].includes(hex)) return 3;
  return 0; // #16a34a/#10b981 (verde), #3b82f6/#60a5fa (azul), #0f766e/#0891b2 (teal): optimo/informativo
}
const dx = (label: string, c: string): DisplayDx => ({ label, sev: sevFromColor(c) });

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
export function clasifNHLBI(imc: number | null, cintura: number | null, sexoM: boolean): DisplayDx {
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
  return dx(label, color);
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
// valor derivado y si esta "en validacion" (constante no aprobada por Gildardo). Las 2 validadas en §9
// (hidratFFM 73,2% y mcaPctFFM 52,4%) van SIN marca; las 5 introducidas sin aprobar (aguaEC 42, y la
// composicion proteico-mineral de la MLG) van MARCADAS.
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
  // composicion de la MLG: proteinas/minerales (NO validadas, marca) + MCA (52,4 validada, sin marca)
  if (ffmR != null) {
    const protTotalR = put("protTotal_ref", rd((ffmR * 19.4) / 100), true);
    if (protTotalR != null) put("protActiva_ref", rd((protTotalR * 70.0) / 100), true);
    put("CMO_ref", rd((ffmR * 5.6) / 100), true);
    put("minNoOseo_ref", rd((ffmR * 1.2) / 100), true);
    put("MCA_ref", rd((ffmR * 52.4) / 100), false);
    // masa seca sin grasa = MLG − agua (identidad, sin marca)
    if (tbwR != null) put("masaSeca_ref", rd(ffmR - tbwR), false);
    // solEC = masaSeca − protActiva − minNoOseo (depende de las no validadas -> marca)
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
