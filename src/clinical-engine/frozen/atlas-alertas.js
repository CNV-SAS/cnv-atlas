/**
 * ALERTAS CLINICAS del modelo ANI-BIS-E. Autoria clinica de Gildardo; Atlas no lo edita ni reinterpreta.
 * Portado VERBATIM del ATLAS_v8.html del 2026-08-29 (`generarAlertas`). Lo unico que no esta en la
 * fuente es el module.exports final.
 *
 * QUINCE REGLAS, y hoy solo UNA puede correr. No es un porte a medias: es lo que da su archivo.
 *
 *   DIEZ necesitan `cons` (consumo nutricional: kcal, sodio, fibra, hierro, calcio, proteina, omega-3).
 *   Atlas todavia no lo calcula, y su archivo tampoco: falta el puente frecuencia -> porciones. Estas se
 *   apagan SOLAS al llamar con `cons` y `rda` vacios, sin lista blanca que mantener: `undefined > 3000`
 *   es false y `undefined < NaN` tambien. Ese es el motivo de llamar asi y no de filtrar por nombre.
 *
 *   CUATRO leen campos de una encuesta ANTERIOR, de 18 items de frecuencia, que ya no existe: d1_14
 *   (azucares), d1_15 (bebidas azucaradas) y d1_16 (agua). No es sospecha nuestra, lo dice su propio
 *   archivo sobre el mismo grupo de campos: "Los campos d1_9, d1_10 y d1_16 que lee calcLE8 NO existen
 *   en la encuesta: solo viven en el objeto DEMO, y por eso el defecto paso inadvertido". La encuesta
 *   vigente tiene 15 items `_i` y numeracion distinta.
 *
 *   La UNA que corre es "TCA activo detectado", sobre `d2_21`, que Atlas si captura y ya llega al motor.
 *
 * POR QUE NO ARREGLAMOS LOS CUATRO CAMPOS AQUI, aunque el mapeo del agua ya lo dio el (d1_16 -> d7_agua,
 * confirmado el 2026-07-28) y el de azucares se adivina (d1_13_i). Dos razones, y la segunda pesa mas:
 *   1. Seria sustituir su diseno por el nuestro en contenido clinico, que es justo lo que la regla 0
 *      prohibe: la pregunta no es "lo construimos?", es "por que no esta?", y se le hace a el.
 *   2. Santiago esta por cotejar Atlas contra su archivo. Una regla que nosotros "arreglamos" hace que
 *      los dos dejen de coincidir, y el reportaria nuestra mejora COMO DEFECTO.
 *
 * Y una de las cuatro no solo esta muerta, MIENTE: "Deshidratacion probable" pide `agua <= 3`, y como
 * `agua` es siempre 0 esa mitad se cumple SIEMPRE. La regla queda reducida a "orina oscura" y el texto
 * afirma "Agua: 0 vasos" a un profesional que no pregunto eso. Por eso el adaptador la excluye explicita
 * y ruidosamente, en vez de dejarla pasar (ver `alertas-disponibles.ts`).
 */

const generarAlertas = (enc, cons, get, rda, peso) => {
  const al = [];
  const dx = Array.isArray(enc.d5_39) ? enc.d5_39 : [];
  const alrg = Array.isArray(enc.d6_43) ? enc.d6_43 : [];
  const tca = Array.isArray(enc.d2_21) ? enc.d2_21 : [];
  const dias = parseInt(enc.d3_23) || 0;
  const agua = Number(enc.d1_16) || 0;
  if (["Laxantes", "Vómito", "Ejercicio excesivo"].some(t => tca.includes(t))) al.push({
    niv: "crítico",
    ico: "🚨",
    t: "TCA activo detectado",
    txt: "Banderas en ítem 21. Derivación urgente a psicología/psiquiatría.",
    dom: "D2"
  });
  if (dx.includes("Diabetes tipo 2") && (Number(enc.d1_15) || 0) >= 2) al.push({
    niv: "crítico",
    ico: "🔴",
    t: "Riesgo glucémico crítico",
    txt: `${Number(enc.d1_15)} porciones de bebidas azucaradas con DM2.`,
    dom: "D1+D5"
  });
  if (cons.sodio > 3000) al.push({
    niv: "crítico",
    ico: "🔴",
    t: "Sodio excesivo",
    txt: `${Math.round(cons.sodio)}mg/día (límite: 2300mg). Crítico con HTA.`,
    dom: "D1"
  });
  if (get && cons.kcal < get * 0.60) al.push({
    niv: "alto",
    ico: "🟠",
    t: "Déficit calórico severo",
    txt: `${Math.round(cons.kcal)} kcal = ${Math.round(cons.kcal / get * 100)}% del GET. Riesgo catabólico.`,
    dom: "D1"
  });
  if (get && cons.kcal > get * 1.40) al.push({
    niv: "alto",
    ico: "🟠",
    t: "Exceso calórico marcado",
    txt: `Consumo supera el GET en ${Math.round((cons.kcal - get) / get * 100)}%.`,
    dom: "D1"
  });
  if (dias >= 5 && peso && cons.prot < 1.2 * peso) al.push({
    niv: "alto",
    ico: "🟠",
    t: "Proteína insuficiente para nivel de actividad",
    txt: `${dias} días/sem de ejercicio + proteína ${cons.prot.toFixed(1)}g. Riesgo catabolismo.`,
    dom: "D1+D3"
  });
  if (agua <= 3 && enc.d7_58 === "Oscuro (naranja / marrón)") al.push({
    niv: "alto",
    ico: "🟠",
    t: "Deshidratación probable",
    txt: `Agua: ${agua} vasos + orina oscura.`,
    dom: "D1+D7"
  });
  if (cons.fibra < 15) al.push({
    niv: "moderado",
    ico: "🟡",
    t: "Fibra muy baja",
    txt: `${cons.fibra.toFixed(1)}g/día (RDA: ${rda.fibra}g).`,
    dom: "D1"
  });
  if (cons.hierro < rda.hierro * 0.5) al.push({
    niv: "moderado",
    ico: "🟡",
    t: "Déficit de hierro",
    txt: `${cons.hierro.toFixed(1)}mg (${Math.round(cons.hierro / rda.hierro * 100)}% RDA).`,
    dom: "D1"
  });
  if (cons.calcio < rda.calcio * 0.5) al.push({
    niv: "moderado",
    ico: "🟡",
    t: "Calcio insuficiente",
    txt: `${Math.round(cons.calcio)}mg (<50% RDA).`,
    dom: "D1"
  });
  if (enc.d3_29 >= 7 && (Number(enc.d1_14) || 0) >= 2) al.push({
    niv: "moderado",
    ico: "🟡",
    t: "Estrés alto + azúcares elevados",
    txt: "Patrón de alimentación emocional probable.",
    dom: "D3+D1"
  });
  if (alrg.includes("Leche") && cons.calcio < rda.calcio * 0.6) al.push({
    niv: "moderado",
    ico: "🟡",
    t: "Alergia a lácteos + calcio deficiente",
    txt: "Explorar fuentes alternativas o suplementación.",
    dom: "D6+D1"
  });
  if (cons.fibra >= rda.fibra) al.push({
    niv: "positivo",
    ico: "✅",
    t: "Excelente ingesta de fibra",
    txt: `${cons.fibra.toFixed(1)}g/día.`,
    dom: "D1"
  });
  if (cons.omega3 >= 1.0) al.push({
    niv: "positivo",
    ico: "✅",
    t: "Buena ingesta de Omega-3",
    txt: `${cons.omega3.toFixed(2)}g/día.`,
    dom: "D1"
  });
  if (agua >= 8) al.push({
    niv: "positivo",
    ico: "✅",
    t: "Hidratación adecuada",
    txt: `${agua} vasos de agua pura.`,
    dom: "D1+D7"
  });
  return al;
};
module.exports = { generarAlertas };
