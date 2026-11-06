/* ═══════════════════════════════════════════════════════════════════════════
   ATLAS · CLASIFICACION DEL PATRON USUAL DE CONSUMO (D1) — FROZEN
   Copia VERBATIM del bloque de clasificacion de la entrega del 4 de noviembre de 2026
   (ATLAS_v16.html, L1401-1455): D1_FREQ_TXT, d1EstadoGrupo, d1Clasificar, d1Lista y
   d1TextoPatron. NO EDITAR A MANO. Excepcion nombrada a la regla 12 (ARCHITECTURE.md),
   como el resto del frozen. ANCLADO byte a byte por `frozen-d1-clasificacion-diff.test.ts`
   contra ESA region de SU archivo; su comportamiento lo fijan los siete casos A-G de su
   §5 (d1-clasificacion.golden.test.ts).

   POR QUE ENTRA, y por que es UNA SOLA FUENTE. Su v16 nace de que una nutricionista reporto
   que la encuesta presenta como protectoras las carnes rojas y los embutidos. La causa era el
   PROMEDIO de los cuatro grupos de riesgo: embutidos 5-6 dias con los otros tres en "nunca"
   da 0,75, por debajo del corte de 1, y la tarjeta salia "Adecuado" en VERDE. Medido en la
   nube el 2026-11-05: le pasa a 11 pacientes de 631. Aqui se clasifica GRUPO POR GRUPO, asi
   que un solo grupo en exceso ya no se diluye.

   LA REGLA DE FONDO (y es por lo que este modulo nace antes que sus consumidores): la
   clasificacion es UNA. Arreglar la tarjeta a mano y portar `d1Clasificar` despues dejaria DOS
   fuentes de la misma clasificacion, que es exactamente el defecto que su v16 corrige.

   ALCANCE HOY: la tarjeta de categoria y la vista D1 del Diagnostico. Los otros cuatro
   lectores de su archivo (el resumen narrativo, el dominio alimentario de `calcularDominios`,
   los parrafos por profesion y el texto que recibe la IA) pasan a leer de aqui en el paso 5
   del plan, que va DESPUES del recalculo del ICEC: hoy ese dominio no mide nada (el componente
   Alimentacion vale 30 para todos, medido por la causa el 2026-11-05).

   FREQ_GROUPS NO SE DUPLICA: se requiere de `engine.patron.js`, que lo trae verbatim del v8.
   Verificado el 2026-11-06 que el bloque de datos es IDENTICO en el v8 y en el v16 (las
   unicas diferencias del diff son lineas vecinas, no la tabla), asi que no hay dos tablas que
   puedan divergir. Esa linea `require` y el `module.exports` final son el UNICO andamiaje que
   su archivo no tiene.
   ═══════════════════════════════════════════════════════════════════════════ */

const { FREQ_GROUPS } = require('./engine.patron.js');

// ─── v16 · Clasificación del patrón usual por grupo (D1) ─────────────
// Un solo criterio para el resumen del diagnóstico, el dominio alimentario, la
// vista de la encuesta, los párrafos por profesión y el texto que recibe la IA.
// Se clasifica grupo por grupo: un grupo de riesgo frecuente ya no se diluye
// al promediarlo con los demás. Frecuencia: 0 nunca · 1 1–2 d · 2 3–4 d ·
// 3 5–6 d · 4 diario.
//   Protectores 1–7 ............ adecuado ≥ 3 · déficit ≤ 1
//   Carnes procesadas (12) ..... exceso ≥ 2 · a moderar 1 (IARC grupo 1; WCRF «poco o nada»)
//   Riesgo 11, 13, 14 .......... exceso ≥ 2
//   Carnes rojas (15) .......... exceso ≥ 3 · a moderar 2 (WCRF/AICR: ≤ 3 porciones por semana)
//   Cereales integrales, tubérculos, carnes blancas (8, 9, 10): sin señal de riesgo
const D1_FREQ_TXT = ["nunca", "1 a 2 días por semana", "3 a 4 días por semana", "5 a 6 días por semana", "todos los días"];
function d1EstadoGrupo(g, v) {
  if (!g || v == null || v === "" || isNaN(Number(v)) || Number(v) < 0) return null;
  v = Number(v);
  if (g.cat === "protector") return v >= 3 ? "ok" : v <= 1 ? "deficit" : "mejorar";
  if (g.n === 12) return v >= 2 ? "exceso" : v === 1 ? "moderar" : "ok";
  if (g.cat === "riesgo") return v >= 2 ? "exceso" : "ok";
  if (g.n === 15) return v >= 3 ? "exceso" : v === 2 ? "moderar" : "ok";
  return "neutro";
}
function d1Clasificar(enc, conRespaldo) {
  const e = enc || {};
  const val = n => {
    let v = e["d1_" + n + "_i"];
    if ((v == null || v === "") && conRespaldo) v = e["d1_" + n];
    const x = Number(v);
    return (v == null || v === "" || isNaN(x)) ? null : x;
  };
  const grupos = FREQ_GROUPS.map(g => { const v = val(g.n); return { n: g.n, cat: g.cat, label: g.label, v, estado: d1EstadoGrupo(g, v) }; });
  const de = st => grupos.filter(g => g.estado === st);
  const exceso = de("exceso"), moderar = de("moderar"), deficit = de("deficit");
  const prot = grupos.filter(g => g.cat === "protector" && g.v != null);
  const protAvg = prot.length ? prot.reduce((a, g) => a + g.v, 0) / prot.length : null;
  const respondidos = grupos.filter(g => g.v != null).length;
  const patron = !respondidos ? null
    : exceso.length ? "riesgo"
    : (moderar.length || deficit.length || protAvg == null || protAvg < 3) ? "moderado"
    : "protector";
  return { grupos, exceso, moderar, deficit, protAvg, patron, respondidos };
}
function d1Lista(gs) {
  const a = gs.map(g => g.label.toLowerCase().replace("(pcbu)", "(PCBU)") + " (" + (D1_FREQ_TXT[g.v] || "—") + ")");
  return a.length <= 1 ? (a[0] || "") : a.slice(0, -1).join(", ") + " y " + a[a.length - 1];
}
function d1TextoPatron(c) {
  if (!c || !c.patron) return "Al evaluar el patrón usual de consumo de alimentos no se registraron frecuencias.";
  const partes = [];
  if (c.exceso.length) partes.push("consumo elevado de " + d1Lista(c.exceso));
  if (c.moderar.length) partes.push("consumo a moderar de " + d1Lista(c.moderar));
  if (c.deficit.length) partes.push("bajo consumo de " + d1Lista(c.deficit));
  const nom = c.patron === "riesgo" ? "un patrón de riesgo" : c.patron === "moderado" ? "un patrón con aspectos por mejorar" : "un patrón protector";
  return "Al evaluar el patrón usual de consumo de alimentos se encontró " + nom +
    (partes.length ? ", con " + partes.join("; ") : ", sin grupos de riesgo por encima de su frecuencia aceptable") + ".";
}

module.exports = { D1_FREQ_TXT, d1EstadoGrupo, d1Clasificar, d1Lista, d1TextoPatron };
