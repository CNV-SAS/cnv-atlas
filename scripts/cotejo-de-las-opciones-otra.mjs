// ══════════════════════════════════════════════════════════════════════════════════════════════════
// ¿EN CUANTAS PREGUNTAS EL HTML Y ATLAS ESCRIBEN DISTINTO LA OPCION "OTRA"?  ·  SOLO LECTURA
//
// ═══ EL CASO QUE LO ORIGINA (Santiago, 2026-10-07) ═══
//
// Paciente importado del HTML, pregunta 35 (suplementos). Tres sintomas que parecian tres defectos:
//
//   · la encuesta dice "63 de 64 · falta 1 pregunta", sabiendo que la 35 tiene respuestas;
//   · en modo LECTURA salen tres opciones marcadas (Omega-3, Magnesio y "Otros", sin texto);
//   · en modo EDICION solo salen dos (Omega-3 y Magnesio).
//
// ═══ Y SON UNA SOLA CAUSA: EL VALOR GUARDADO NO EXISTE EN EL CATALOGO ═══
//
// El HTML escribe esa opcion "Otros" (plural) y el catalogo de Atlas la tiene como "Otra" (singular). La
// importacion copia el valor TAL CUAL, asi que queda guardado "Otros", que no es ninguna opcion de Atlas.
// De ahi salen los tres sintomas:
//
//   1. LECTURA pinta el valor guardado verbatim -> se ve "Otros" marcado.
//   2. EDICION pinta el CATALOGO y marca por texto exacto -> "Otros" no casa con "Otra" -> sale sin marcar
//      (y si se guarda desde ahi, el valor se pierde, porque el widget emite solo lo que esta marcado).
//   3. COMPLETITUD trata un "Otr*" PELADO (sin texto) como "eligio otra y no especifico", y eso invalida la
//      respuesta ENTERA: `isAnswered` devuelve false aunque haya dos opciones buenas al lado. De ahi el
//      "falta 1 pregunta".
//
// LA REVISION PREVIA A IMPORTAR NO LO ATRAPO A PROPOSITO: `revisar-lote` considera que "Otras"/"Otros" CALZAN
// si la pregunta tiene "Otra" (esta escrito en su comentario). O sea que es tolerante al importar y estricto
// al editar: las dos mitades no comparten la nocion de "calza".
//
// ESTE SCRIPT CONTESTA LA PREGUNTA QUE IMPORTA: ¿pasa solo en la 35, o en mas preguntas? Si el HTML y Atlas
// difieren en varias, hay pacientes importados con respuestas que no se pueden editar y preguntas contadas
// como sin responder.
//
// NO TOCA LA BASE. Compara el SEED de la encuesta contra el HTML congelado, los dos en el repo.
//
// COMO SE CORRE:   node scripts/cotejo-de-las-opciones-otra.mjs
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";

const SEED = "drizzle/0099_encuesta_v6.sql";
const HTML = "docs/entregas/Gildardo responses/html actualizado 21 septiembre/ATLAS_v9.html";

const ES_OTRA = /^otr[oa]s?$/i;

// ── (1) EL CATALOGO DE ATLAS: por clave de pregunta, como escribe su opcion "Otra" ────────────────
const seed = readFileSync(SEED, "utf8");

// Las preguntas: ('<id>', '<versionId>', '<texto>', '<tipo>', '<clave>', ...
const preguntas = new Map(); // id -> { clave, texto }
for (const m of seed.matchAll(
  /\('([0-9a-f-]{36})',\s*'[0-9a-f-]{36}',\s*'((?:[^']|'')*)',\s*'[a-z_]+',\s*'([a-z0-9_]+)'/g,
)) {
  preguntas.set(m[1], { clave: m[3], texto: m[2].replace(/''/g, "'") });
}

// Las opciones: ('<id>', '<preguntaId>', '<texto>', ...
const otraDeAtlas = new Map(); // clave -> texto de su opcion Otra*
for (const m of seed.matchAll(/\('[0-9a-f-]{36}',\s*'([0-9a-f-]{36})',\s*'((?:[^']|'')*)'/g)) {
  const p = preguntas.get(m[1]);
  if (!p) continue;
  const texto = m[2].replace(/''/g, "'");
  if (ES_OTRA.test(texto)) otraDeAtlas.set(p.clave, { texto, pregunta: p.texto });
}

// ── (2) EL HTML: como escribe la suya ─────────────────────────────────────────────────────────────
//
// SE BUSCA POR CONTEXTO y no por clave, porque el HTML define las opciones en arreglos sueltos. Para cada
// flexion que aparezca entre comillas en el archivo se cuenta cuantas veces esta: eso dice que escribe el
// HTML, aunque no diga en que pregunta. Con eso basta para saber SI hay divergencia.
const html = readFileSync(HTML, "utf8");
const flexionesEnElHtml = new Map();
for (const m of html.matchAll(/["']\s*(Otr[oa]s?)\s*["']/g)) {
  flexionesEnElHtml.set(m[1], (flexionesEnElHtml.get(m[1]) ?? 0) + 1);
}

console.log("══ LO QUE ESCRIBE CADA LADO ══\n");
console.log("ATLAS, por pregunta:");
const porFlexion = new Map();
for (const [clave, v] of [...otraDeAtlas].sort()) {
  porFlexion.set(v.texto, [...(porFlexion.get(v.texto) ?? []), clave]);
  console.log(`  ${clave.padEnd(8)} "${v.texto}"   ${v.pregunta.slice(0, 60)}`);
}
console.log(`\n  Resumen de Atlas: ${[...porFlexion].map(([t, cs]) => `"${t}" en ${cs.length}`).join(", ")}`);

console.log("\nHTML, flexiones que usa (y cuantas veces aparece cada una):");
for (const [t, n] of [...flexionesEnElHtml].sort()) console.log(`  "${t}" x${n}`);

// ── (3) LO QUE ESTE SCRIPT PUEDE AFIRMAR, Y LO QUE NO ─────────────────────────────────────────────
//
// PUEDE afirmar que las DOS PARTES USAN FLEXIONES DISTINTAS, y eso ya es una divergencia: el HTML escribe
// cuatro ("Otra", "Otras", "Otro", "Otros") y Atlas dos ("Otra" en once preguntas y "Otros" en d5_40).
//
// NO PUEDE afirmar CUALES preguntas estan descalzadas, y conviene decirlo en vez de dar un numero bonito: el
// HTML define sus opciones en arreglos sueltos, sin la clave al lado, asi que comparar los CONJUNTOS de
// flexiones no prueba nada por pregunta. Que las dos partes usen "Otros" no significa que la usen en LA MISMA.
//
// LO QUE SI ESTA VERIFICADO A MANO: en d4_35 (suplementos) el HTML dice "Otros" y Atlas "Otra". Ese es el caso
// que Santiago reporto, y de ahi salen sus tres sintomas.
//
// Y LA RESPUESTA COMPLETA LA DA LA BASE, no el repo: lo que decide es el VALOR GUARDADO en cada respuesta
// importada. Esa consulta esta en `scripts/OTRAS_HUERFANAS_EN_LOS_IMPORTADOS_2026-10-07.sql`, y dice cuantos
// pacientes y cuantas preguntas, con nombre.
console.log("\n══ QUE SE PUEDE CONCLUIR DE AQUI ══\n");
console.log(
  `Las dos partes usan flexiones distintas: el HTML ${[...flexionesEnElHtml.keys()].length} y Atlas ` +
    `${new Set([...otraDeAtlas.values()].map((v) => v.texto)).size}. Eso es una divergencia real.`,
);
console.log(
  "\nPERO ESTE SCRIPT NO DICE CUALES PREGUNTAS ESTAN DESCALZADAS: el HTML define sus opciones en arreglos\n" +
    "sueltos, sin la clave al lado, asi que comparar conjuntos de flexiones no prueba nada por pregunta.",
);
console.log(
  "\nVERIFICADO A MANO: en d4_35 el HTML dice \"Otros\" y Atlas \"Otra\". Ese es el caso reportado.",
);
console.log(
  "\nLA RESPUESTA COMPLETA LA DA LA BASE (los valores guardados):\n" +
    "  scripts/OTRAS_HUERFANAS_EN_LOS_IMPORTADOS_2026-10-07.sql",
);
console.log(`\n(Atlas: ${otraDeAtlas.size} preguntas con opcion Otra*; cualquiera puede estar afectada.)`);
