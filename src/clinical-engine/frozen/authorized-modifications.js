/**
 * authorized-modifications.js - MANIFIESTO DE MODIFICACIONES AUTORIZADAS del frozen.
 *
 * UNICA FUENTE EDITABLE de las divergencias autorizadas sobre la ciencia congelada. Cada entrada es
 * una modificacion que Gildardo autorizo por INSTRUCCION ESCRITA (regla de autoridad D-014): el
 * archivo original NUNCA se edita (asi conserva la byte-identidad con el archivo de Gildardo y su
 * DIFF-vs-fuente sigue verde); en su lugar, un generador determinista produce el archivo
 * `*.authorized.js` = original + estas modificaciones, y es ESE el que corre (los imports apuntan a el).
 *
 * REGLA 16 (con su linea de honestidad): el test byte-exacto prueba que el generado coincide con el
 * ORIGINAL mas EXACTAMENTE estas modificaciones (ninguna mas). Lo que ese test NO puede probar es que
 * cada modificacion corresponda a lo que Gildardo autorizo: eso NO es mecanico, es REVISION HUMANA via
 * el caId y su instruccion verbatim. El mecanismo garantiza trazabilidad y no-adulteracion, no
 * correccion clinica.
 *
 * VIGENCIA: al portar un motor nuevo del archivo de Gildardo, cada modificacion se revisa por VIGENCIA
 * (no solo por aplicabilidad): "sigue haciendo falta" o "Gildardo ya la absorbio en su archivo, se
 * retira de aqui". apply() ademas exige que cada oldSlice aparezca EXACTAMENTE UNA VEZ (falla en voz
 * alta si 0 o mas de 1) y prohibe modificaciones que se solapen.
 */

// Encabezado que el generador antepone al archivo generado (el que corre).
const GENERATED_HEADER = `/**
 * GENERADO - NO EDITAR A MANO. Este es el archivo que CORRE (los imports apuntan aqui).
 * Se produce con \`node scripts/gen-authorized.cjs\` = original intacto + el manifiesto
 * authorized-modifications.js. Para cambiarlo se edita el MANIFIESTO, no este archivo.
 * El original (atlas-protocolo.js) queda intacto como referencia byte-identica a Gildardo.
 */`;

// El manifiesto. Una entrada por modificacion autorizada.
const AUTHORIZED_MODIFICATIONS = [
  {
    caId: "CA-1",
    decision: "D-012",
    date: "2026-08-03",
    targetFile: "atlas-protocolo.js",
    // Instruccion verbatim de Gildardo (ronda 2026-08-03 §4): "retiren telomeros y estres oxidativo
    // del listado de sugeridos. No es un examen de laboratorio estandar y no puede figurar como
    // ordenable mientras yo no defina donde se procesa y con que protocolo. Ningun item de ese
    // listado puede citar como referencia el propio modelo." (Verificado: era el unico que lo hacia.)
    instruction:
      "Retirar telomeros/estres oxidativo del listado de examenes sugeridos (D-012).",
    // Se retira la linea completa del examen (elemento del array examenes). newSlice vacio = eliminado.
    oldSlice:
      "    iae > 5 ? { nombre:'Telómeros/estrés oxidativo', razon:'IAE acelerado +'+iae.toFixed(1)+' años', protocolo:'ANI BIS-E 2026', prioridad:'media' } : null,\n",
    newSlice: "",
  },
];

// Aplica las modificaciones sobre el texto original. Todas se ubican en el ORIGINAL (no en el texto
// progresivamente modificado): asi se exige que cada oldSlice sea unica en el original y que no se
// solapen. Falla en voz alta ante cualquier ambiguedad.
function applyAuthorized(original, mods) {
  const ranges = mods.map((m) => {
    const first = original.indexOf(m.oldSlice);
    if (first === -1) {
      throw new Error(`[authorized] ${m.caId}: oldSlice no aparece en ${m.targetFile}.`);
    }
    if (original.indexOf(m.oldSlice, first + 1) !== -1) {
      throw new Error(`[authorized] ${m.caId}: oldSlice aparece mas de una vez en ${m.targetFile} (ambiguo).`);
    }
    return { m, start: first, end: first + m.oldSlice.length };
  });
  const byStart = [...ranges].sort((a, b) => a.start - b.start);
  for (let i = 1; i < byStart.length; i++) {
    if (byStart[i].start < byStart[i - 1].end) {
      throw new Error(`[authorized] modificaciones solapadas: ${byStart[i - 1].m.caId} y ${byStart[i].m.caId}.`);
    }
  }
  let out = original;
  for (const r of [...ranges].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, r.start) + r.m.newSlice + out.slice(r.end);
  }
  return out;
}

// Produce el contenido del archivo generado: encabezado de "generado" + (original sin su encabezado de
// custodia, con las modificaciones aplicadas). El original conserva su encabezado; el generado lo
// reemplaza por el suyo para no afirmar "referencia intacta" dentro del archivo que si corre.
function buildAuthorizedFile(originalText, mods, generatedHeader) {
  const afterHeader = originalText.slice(originalText.indexOf("*/") + 2).replace(/^\r?\n+/, "");
  return generatedHeader + "\n" + applyAuthorized(afterHeader, mods);
}

module.exports = { AUTHORIZED_MODIFICATIONS, applyAuthorized, buildAuthorizedFile, GENERATED_HEADER };
