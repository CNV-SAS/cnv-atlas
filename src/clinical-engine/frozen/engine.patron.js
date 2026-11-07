/* ═══════════════════════════════════════════════════════════════════════════
   ATLAS · PATRON ALIMENTARIO (C9) — FROZEN
   Datos y funcion extraidos VERBATIM del archivo de Gildardo. NO EDITAR A MANO. Excepcion
   nombrada a la regla 12 (ARCHITECTURE.md), como el resto del frozen. ANCLADO por DIFF-patron
   (frozen-patron-diff.test.ts) byte a byte; su comportamiento lo fija el golden
   (patron.golden.test.ts).

     · datos (FREQ_GROUPS, FREQ_OPC, catColor, catLabel, FREQ_SUP): IDENTICOS del v8 al v16, y
       el candado lo comprueba pieza por pieza contra el v16.
     · calcPatron: RE-PORTADO del `ATLAS_v16.html` del 4 de noviembre de 2026 (antes salia del
       v8 del 4 de agosto).

   ═══ QUE CAMBIO EN EL RE-PORTE, Y POR QUE NO ES UNA MODIFICACION NUESTRA (2026-11-06) ═══

   Su v16 §4.2 reescribe el puntaje, y el motivo es de campo: una nutricionista reporto que la
   encuesta presentaba las carnes rojas y los embutidos como PROTECTORAS. Lo verifico en su HTML y
   en Atlas, y la causa era la misma en los dos. Las cuatro cosas que cambian:

     1. Los protectores entran los SIETE grupos (antes `prot.slice(0, 6)` dejaba fuera los huevos),
        con la misma escala por grupo reescalada (`* 6 / 7`) para que el maximo siga siendo 60.
     2. Los embutidos (grupo 12) se penalizan DOBLE (−2, −8, −14, −20): la penalizacion generica de
        riesgo se aplica y despues se repite solo para ese grupo.
     3. Las carnes rojas (grupo 15) dejan de SUMAR por comerlas a menudo. Antes estaban en el bono
        de neutros y daban +3 desde 3-4 dias; ahora suman 3 solo con 2 dias o menos, no suman ni
        restan con 3-4, y restan 4 y 7 con 5-6 y diario.
     4. Con embutidos 3-4 dias o mas, el puntaje se TOPA en 54, que es "Mejorable": un consumo
        frecuente de embutidos no puede quedar en "Adecuado" aunque los protectores esten completos.

   SU PROPIA DECLARACION DE FUENTE, que es lo que permite que estos cortes entren (regla de
   Santiago del 2026-10-02: ningun umbral sin su fuente al lado). Textual de su §4.2: los puntos de
   las carnes rojas y de los embutidos y el tope de 54 *"son una calibracion de ATLAS sobre la
   escala que ya existia, no valores tomados de la literatura"*; la literatura fija el ORDEN
   (procesadas mas que rojas) y los UMBRALES DE FRECUENCIA, y para eso cita IARC grupo 1 para las
   procesadas y 2A para las rojas, y el "poco o nada" de WCRF/AICR. Sus 15 referencias estan
   verificadas por PMID y DOI en su bitacora.

   ESTE SCORE SI ALIMENTA EL DIAGNOSTICO, y el comentario de aqui decia lo contrario hasta hoy:
   `LE8_MAPEO_CORREGIDO` esta en `true` desde el 2026-09-06 (CA-8a/CA-8b del manifiesto, por su
   instruccion del 2026-09-05), asi que el dominio Alimentacion del ICEC ES `calcPatron(enc).score`
   y por el ICEC entra al dominio 5 del DFI. O sea que el re-porte mueve DOS cosas: la tarjeta del
   patron, que se calcula al mostrar, y el ICEC sellado de las consultas nuevas.

   FREQ_OPC es el mapa ORDINAL canonico de los 15 grupos (0=Nunca .. 4=Todos los dias); los
   3 horarios (d1f_*) tienen su propio set en FREQ_SUP. El reader (patron.ts) resuelve el
   ordinal de cada respuesta contra ESTOS textos (acoplamiento por texto + posicion), y el
   candado (patron-coupling.test.ts) verifica que la semilla los tenga byte a byte.
   ═══════════════════════════════════════════════════════════════════════════ */

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
const FREQ_OPC = ["Nunca", "1–2 días", "3–4 días", "5–6 días", "Todos los días"];
const catColor = {
  protector: "#2d6a4f",
  neutro: "#1d4ed8",
  riesgo: "#dc2626"
};
const catLabel = {
  protector: "✅ Alimentación Real protectora",
  neutro: "⚖️ Alimentación Real energética (moderar)",
  riesgo: "⚠️ Procesados y ultraprocesados (PCBU)"
};
const FREQ_SUP = [{
  key: "d1f_sal_i",
  label: "¿Con qué frecuencia añade sal extra a la comida ya servida?",
  opts: ["Nunca", "Rara vez", "Con frecuencia", "Siempre"],
  alertIdx: 2
}, {
  key: "d1f_des_i",
  label: "¿Desayuna regularmente (antes de las 10 am)?",
  opts: ["Sí, todos los días", "A veces (3–4 días)", "Rara vez o nunca"],
  alertIdx: 2
}, {
  key: "d1f_noche_i",
  label: "¿A qué hora suele cenar?",
  opts: ["Antes de las 7 pm", "Entre 7 y 8 pm", "Entre 8 y 9 pm", "Después de las 9 pm"],
  alertIdx: 3
}];

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
  // Protectores: máx. 60 pts. v16: entran los 7 grupos, huevos incluidos,
  // con la misma escala por grupo reescalada a 60.
  let protPts = 0;
  prot.forEach(v => {
    if (v === 4) protPts += 10;else if (v === 3) protPts += 8;else if (v === 2) protPts += 5;else if (v === 1) protPts += 2;
  });
  score += protPts * 6 / 7;
  // Riesgo: penalización max -30 pts
  riesgo.forEach(v => {
    if (v === 4) score -= 10;else if (v === 3) score -= 7;else if (v === 2) score -= 4;else if (v === 1) score -= 1;
  });
  // v16 · Carnes procesadas y embutidos (n12): penalización doble
  // (−2, −8, −14, −20). IARC grupo 1; WCRF/AICR «poco o nada».
  const emb = riesgo[1];
  if (emb === 4) score -= 10;else if (emb === 3) score -= 7;else if (emb === 2) score -= 4;else if (emb === 1) score -= 1;
  // Neutros bonus leve (cereales integrales, tubérculos, carnes blancas)
  neutro.slice(0, 3).forEach(v => {
    if (v >= 2) score += 3;
  });
  // v16 · Carnes rojas (n15): suma solo cuando el consumo es bajo y penaliza
  // por encima de 3–4 días por semana. Antes sumaba 3 puntos al comerlas a menudo.
  const rojas = neutro[3];
  if (rojas === 0 || rojas === 1) score += 3;else if (rojas === 3) score -= 4;else if (rojas === 4) score -= 7;
  score = Math.max(0, Math.min(100, Math.round(score + 10))); // base +10
  // v16 · Con embutidos en exceso (3–4 días o más) el puntaje no llega a
  // «Adecuado» (≥ 55), aunque los protectores estén completos.
  if (riesgo[1] >= 2) score = Math.min(score, 54);

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

module.exports = { FREQ_GROUPS, FREQ_OPC, catColor, catLabel, FREQ_SUP, calcPatron };
