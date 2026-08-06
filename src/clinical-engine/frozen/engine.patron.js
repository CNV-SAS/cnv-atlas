/* ═══════════════════════════════════════════════════════════════════════════
   ATLAS · PATRON ALIMENTARIO (C9) — FROZEN DISPLAY
   Funcion de PANTALLA extraida VERBATIM del prototipo VIGENTE de Gildardo
   (gildardo-2026-08-04/ATLAS_v8.html, L2930-3002, bloque "PANTALLA MOTOR").
   NO EDITAR A MANO. Excepcion nombrada a la regla 12 (ARCHITECTURE.md), como el resto
   del frozen. ANCLADO por DIFF-patron (frozen-patron-diff.test.ts) byte a byte contra esa
   region; su comportamiento lo fija el golden (patron.golden.test.ts).

   ALCANCE: calcPatron alimenta el DISPLAY del patron alimentario (score 0-100 + nivel +
   conteos por grupo). NO alimenta el diagnostico: mientras LE8_MAPEO_CORREGIDO siga en
   false (engine.dfi.js), el dominio Alimentacion del LE8 NO consume este score. Cablear
   Alimentacion a calcPatron es C1 (el flip del interruptor), no este bloque.

   ENTRADA: enc keyed por los indices numericos de frecuencia d1_1_i..d1_15_i (0=Nunca .. 4=
   Todos los dias) y los de horario d1f_sal_i / d1f_des_i / d1f_noche_i. Un campo ausente se
   trata como -1 (no respondido): con la encuesta actual (esos field_key en NULL) calcPatron
   devuelve respondidos=0 y nivel "Deficiente". Es correcto: aun no llegan al motor.
   ═══════════════════════════════════════════════════════════════════════════ */

const calcPatron = enc => {
  // Frecuencia: 0=Nunca 1=1-2d 2=3-4d 3=5-6d 4=Todos los días
  const freq = key => enc[key] ?? null;
  const freqN = key => enc[key] ?? -1;

  // ── Grupos protectores (n 1-7) ──
  const prot = [1, 2, 3, 4, 5, 6, 7].map(n => freqN(`d1_${n}_i`));
  const neutro = [8, 9, 10, 15].map(n => freqN(`d1_${n}_i`));
  const riesgo = [11, 12, 13, 14].map(n => freqN(`d1_${n}_i`));
  const protAltos = prot.filter(v => v >= 3).length; // 5-6d o todos
  const protModerado = prot.filter(v => v >= 2).length; // ≥3-4d
  const riesgoAltos = riesgo.filter(v => v >= 3).length; // come ≥5d riesgo
  const riesgoNunca = riesgo.filter(v => v === 0).length;

  // ── Puntuación de calidad 0-100 ──
  let score = 0;
  // Protectores: max 60 pts (hasta 10 pts c/u, primeros 6)
  prot.slice(0, 6).forEach(v => {
    if (v === 4) score += 10;else if (v === 3) score += 8;else if (v === 2) score += 5;else if (v === 1) score += 2;
  });
  // Riesgo: penalización max -30 pts
  riesgo.forEach(v => {
    if (v === 4) score -= 10;else if (v === 3) score -= 7;else if (v === 2) score -= 4;else if (v === 1) score -= 1;
  });
  // Neutros bonus leve
  neutro.forEach(v => {
    if (v >= 2) score += 3;
  });
  score = Math.max(0, Math.min(100, score + 10)); // base +10

  const nivel = score >= 75 ? {
    l: "Óptimo",
    col: "#16a34a",
    ico: "🟢"
  } : score >= 55 ? {
    l: "Adecuado",
    col: "#2563eb",
    ico: "🔵"
  } : score >= 35 ? {
    l: "Mejorable",
    col: "#d97706",
    ico: "🟡"
  } : {
    l: "Deficiente",
    col: "#dc2626",
    ico: "🔴"
  };

  // ── Diversidad ──
  const respondidos = [...prot, ...neutro, ...riesgo].filter(v => v >= 0).length;
  const activos = [...prot, ...neutro].filter(v => v >= 2).length;

  // ── Horarios ──
  const salExtra = enc.d1f_sal_i ?? -1;
  const desayuna = enc.d1f_des_i ?? -1;
  const cenaHora = enc.d1f_noche_i ?? -1;
  return {
    score,
    nivel,
    protAltos,
    protModerado,
    riesgoAltos,
    riesgoNunca,
    prot,
    neutro,
    riesgo,
    respondidos,
    activos,
    salExtra,
    desayuna,
    cenaHora
  };
};

module.exports = { calcPatron };
