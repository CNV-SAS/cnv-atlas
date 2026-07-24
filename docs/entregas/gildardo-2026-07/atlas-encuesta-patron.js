/**
 * atlas-encuesta-patron.js
 * Encuesta: grupos de frecuencia (GABA/ICBF) y patron usual de consumo.
 *
 * Dependencias externas: ninguna (datos puros). calcPatron usa solo el objeto enc.
 * Extraido de ATLAS_v7.html (estado actual, 2026-07-23).
 */

const FREQ_GROUPS = [
// ── ALIMENTACIÓN REAL PROTECTORA ──
{ n: 1,  cat: "protector", label: "Verduras y hortalizas",
  sub: "espinaca, acelga, brócoli, tomate, zanahoria, ahuyama, remolacha, pepino (frescas, de hoja verde y fuente de vitamina A)",
  anc: "📏 Un puño cerrado" },
{ n: 2,  cat: "protector", label: "Frutas enteras",
  sub: "banano, mango, papaya, guayaba, naranja, lulo, tomate de árbol (enteras, no en jugo)",
  anc: "📏 1 fruta mediana o un pocillo" },
{ n: 3,  cat: "protector", label: "Leguminosas",
  sub: "fríjol, lenteja, garbanzo, arveja, habas",
  anc: "📏 Un pocillo arriero cocido" },
{ n: 4,  cat: "protector", label: "Pescado y mariscos",
  sub: "atún, sardina, bocachico, tilapia, salmón, camarón (frescos, refrigerados o congelados)",
  anc: "📏 Tamaño de su celular" },
{ n: 5,  cat: "protector", label: "Grasas saludables (aguacate, aceite de oliva y frutos secos)",
  sub: "aguacate, aceite de oliva (preferiblemente extra virgen), maní, nueces, almendras, semillas, coco",
  anc: "📏 ¼ aguacate, 1 cucharadita de aceite o un puñado de frutos secos" },
{ n: 6,  cat: "protector", label: "Lácteos y fermentados",
  sub: "leche, yogur natural, kumis, kéfir, queso fresco",
  anc: "📏 1 vaso o 2 cucharadas de queso" },
{ n: 7,  cat: "protector", label: "Huevos",
  sub: "huevo entero",
  anc: "📏 1 unidad" },
// ── ALIMENTACIÓN REAL ENERGÉTICA (moderar cantidad) ──
{ n: 8,  cat: "neutro",    label: "Cereales integrales y otros",
  sub: "avena, quinua, maíz, arroz integral, cebada, cuchuco, pan integral",
  anc: "📏 ½ pocillo cocido o 1 tajada" },
{ n: 9,  cat: "neutro",    label: "Raíces, tubérculos y plátanos",
  sub: "papa, yuca, plátano, arracacha, ñame, batata",
  anc: "📏 1 papa mediana o ½ plátano" },
{ n: 10, cat: "neutro",    label: "Carnes blancas",
  sub: "pollo, pavo, aves sin piel",
  anc: "📏 Tamaño de su celular (~90 g)" },
{ n: 15, cat: "neutro",    label: "Carnes rojas",
  sub: "res, cerdo magro, cordero (frescas); vísceras 1 vez por semana (hierro)",
  anc: "📏 Tamaño de su celular (~90 g)" },
// ── PROCESADOS Y ULTRAPROCESADOS (PCBU): reducir ──
{ n: 11, cat: "riesgo",    label: "Cereales refinados y harinas blancas",
  sub: "pan blanco, arroz blanco, pasta blanca, galletas, arepa de harina refinada",
  anc: "📏 ½ pocillo o 1 unidad" },
{ n: 12, cat: "riesgo",    label: "Carnes procesadas y embutidos",
  sub: "salchicha, chorizo, jamón, tocineta, mortadela, enlatados",
  anc: "📏 Tamaño de su celular (~90 g)" },
{ n: 13, cat: "riesgo",    label: "Azúcares añadidos y bebidas azucaradas",
  sub: "gaseosas, jugos de caja, dulces, chocolatinas, postres, exceso de panela o azúcar",
  anc: "📏 1 vaso o 1 unidad" },
{ n: 14, cat: "riesgo",    label: "Ultraprocesados (PCBU)",
  sub: "productos de paquete, papas fritas, comidas rápidas, hamburguesa, pizza, perro, sopas de sobre, caldos concentrados y sazonadores industriales",
  anc: "📏 1 paquete o 1 porción" }];

const catLabel = {
  protector: "✅ Alimentación Real protectora",
  neutro: "⚖️ Alimentación Real energética (moderar)",
  riesgo: "⚠️ Procesados y ultraprocesados (PCBU)"
};

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

export { FREQ_GROUPS, catLabel, calcPatron };
