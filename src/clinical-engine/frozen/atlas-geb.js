// GASTO ENERGETICO BASAL · UNA SOLA FUENTE.
//
// PORTE VERBATIM de su entrega del 2026-09-02, extraido por script del HTML vigente y no transcrito: una
// transcripcion a mano de una formula clinica es una fuente nueva.
//
// SU DECISION (§9.6): "manda el gasto basal del equipo... Calcularlo con una formula propia es sustituir
// una medicion por una estimacion". Y lo que lo motiva, medido por el sobre ONCE mediciones reales: el
// equipo usa HARRIS-BENEDICT (20 kcal de error medio; Cunningham 60, Mifflin 71).
//
// LO QUE ESTO RETIRA DE NUESTRA CADENA, y por eso el port pesa: nuestra `computeProtocoloCalorico` usaba
// `500 + 22 x FFM` rotulado "Cunningham", que el acaba de declarar MAL ROTULADO (Cunningham es
// 370 + 21,6 x FFM). Entre esa y la Mifflin del otro motor habia hasta 205 kcal de diferencia sobre el
// mismo paciente. Su frase, que es la que resume el hallazgo: "esa diferencia no era de criterio clinico,
// era de no haber usado el dato que ya estaba".

// ── GASTO ENERGÉTICO BASAL · UNA SOLA FUENTE ─────────────────────────────
// El BiodyManager YA entrega el gasto basal en el export, y ATLAS ya lo importa
// (campo `GEB`). Calcularlo con una fórmula propia es sustituir una medición por
// una estimación, y encima por varias a la vez: en este archivo había TRES caminos
// distintos —Mifflin sobre peso actual, Mifflin sobre peso meta, y un
// `500 + 22 × FFM` rotulado «Cunningham» que no es Cunningham (370 + 21,6)—.
// Entre ellas llegaban a 205 kcal de diferencia sobre el mismo paciente.
//
// Verificado sobre once mediciones reales: el equipo usa HARRIS-BENEDICT. Es la
// que reproduce su cifra con 20 kcal de error medio; Cunningham se desvía +18 de
// media y Mifflin sobre peso meta −79.
//
// Regla: manda el dato del equipo. Cuando no venga, el respaldo es Harris-Benedict
// —la del propio equipo—, para que la estimación dé la misma cifra que habría dado
// la medición y no un tercer criterio.
function ATLAS_GEB_HB(peso, talla, edad, sexoM) {
  var p = Number(peso), t = Number(talla), e = Number(edad);
  if (!(p > 0 && t > 0 && e > 0)) return null;
  return Math.round(sexoM
    ? 66.473 + 13.7516 * p + 5.0033 * t - 6.755 * e
    : 655.0955 + 9.5634 * p + 1.8496 * t - 4.6756 * e);
}
// Devuelve { kcal, origen }. `origen` es 'equipo' o 'Harris-Benedict', y se muestra
// en pantalla: el profesional tiene que saber si mira una medición o una estimación.
function ATLAS_GEB(bis, peso, talla, edad, sexoM) {
  var medido = Number(bis && (bis.GEB || bis.geb)) || 0;
  if (medido > 0) return { kcal: Math.round(medido), origen: 'equipo' };
  var hb = ATLAS_GEB_HB(peso, talla, edad, sexoM);
  return hb ? { kcal: hb, origen: 'Harris-Benedict' } : { kcal: null, origen: null };
}

module.exports = { ATLAS_GEB_HB, ATLAS_GEB };
