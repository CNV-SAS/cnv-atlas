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
  {
    caId: "CA-2",
    decision: "D-002",
    date: "2026-08-09",
    targetFile: "atlas-tratamiento.js",
    // Instruccion verbatim de Gildardo (respuesta 2026-08-09 §5, enmienda 2 a D-002): "cuando hay
    // riesgo de trastorno de la conducta alimentaria, la decision sigue partiendo del peso meta, igual
    // que en cualquier otro caso, y se genera la alerta... el plan no se bloquea. Lo que hace el sistema
    // es avisar -al profesional, con la marca de remision- y el peso meta acordado sigue gobernando el
    // calculo." El mensaje viejo AFIRMA que el modulo PAUSA la restriccion calorica; en Atlas eso ni
    // siquiera ocurre (nada consume tcaFlag en la cadena calorica: el deficit no se anula), asi que el
    // texto ademas MIENTE sobre lo que hace el sistema. Se reemplaza por lo que SI pasa: alerta + remision,
    // el plan no se bloquea, el peso meta gobierna. Solo cambia el mensaje (string); la conducta ya era
    // correcta. El v8 2026-08-04 de nuestro repo aun trae el texto viejo (Gildardo lo corrigio en un v8
    // posterior que no tenemos); la autoridad es su instruccion escrita (D-014), no el archivo archivado.
    instruction:
      "Salvaguarda de TCA: alerta, NO bloqueo. El plan no se pausa; se avisa con marca de remision y el peso meta acordado sigue gobernando el calculo (D-002 enmienda 2, §5).",
    oldSlice:
      '  var salvaguarda=tcaFlag?"Salvaguarda activa: el módulo nutricional PAUSA la restricción calórica automática (prescribir dieta hipocalórica en TCA es dañino).":null;',
    newSlice:
      '  var salvaguarda=tcaFlag?"Alerta de conducta alimentaria de riesgo: se marca remisión a psicología clínica o psiquiatría. El plan no se bloquea; el peso meta acordado sigue gobernando el cálculo (no se fuerza dieta normocalórica).":null;',
  },
  {
    caId: "CA-3",
    decision: "D-007",
    date: "2026-08-13",
    targetFile: "engine.dfi.js",
    // Instruccion verbatim de Gildardo (2026-08-13 §1): "Hagan ademas que calcLE8 deje de rellenar con
    // ceros en silencio: que distinga 'el paciente respondio 0' de 'el paciente no respondio'. Si algun
    // dia el bloqueo falla o alguien llega por otra ruta, el sistema no emitira una edad bioelectrica
    // inventada." Guarda: sin los insumos del LE8, total = null. Un 0 respondido (0 dias, "Nunca"=0) SI
    // cuenta; d5_39=[] ("sin diagnosticos") es respuesta valida y cuenta; solo la AUSENCIA frena.
    // ALCANCE: con LE8_MAPEO_CORREGIDO=false (estado vigente, P-04 cerrada), calcLE8 lee para alimentacion
    // d1_9/d1_10 y para hidratacion d1_16, campos que la encuesta NO captura (Q3): esos dos dominios corren
    // en default SIEMPRE (no es ausencia del paciente, es un hueco del modelo de datos). Los insumos que
    // calcLE8 lee Y la encuesta captura son SEIS: d3_23/d3_24 (actividad), d3_30 (tabaco), d3_26 (sueno),
    // d5_39 (glucosa/colesterol/presion), d5_36 (presion). La guarda exige esos. Si algun dia se activa el
    // mapeo (flag true), calcLE8 pasa a leer d1_N_i (calcPatron) y d7_agua: esta lista debe revisarse ahi.
    instruction:
      "Guarda en calcLE8: sin los 6 insumos capturados del LE8 (d3_23/d3_24/d3_30/d3_26/d5_39/d5_36) no se emite total (null); un 0 respondido cuenta, la ausencia no. Alimentacion/hidratacion corren en default por hueco de datos (Q3), no son ausencia (§1, 2026-08-13).",
    oldSlice: "const calcLE8 = enc => {\n  const scores = [];",
    newSlice: `const calcLE8 = enc => {
  // Guarda (Gildardo 2026-08-13 §1): no se calcula el LE8 sobre AUSENCIAS. Un 0 respondido (0 dias,
  // "Nunca"=0) SI cuenta; el campo NO respondido no. d5_39 es arreglo ([] = "sin diagnosticos" = respuesta
  // valida). Los insumos que calcLE8 LEE y la encuesta CAPTURA son 6 (con LE8_MAPEO_CORREGIDO=false, P-04):
  // alimentacion (d1_9/d1_10) e hidratacion (d1_16) NO se capturan (Q3), corren en default SIEMPRE, no son
  // ausencia del paciente. Sin los 6 capturados, total = null (EB/ICEC no salen sobre respuestas inventadas).
  var _le8Req = ["d3_23","d3_24","d3_30","d3_26","d5_39","d5_36"];
  var _le8Pres = function (k) { return k === "d5_39" ? Array.isArray(enc.d5_39) : (enc[k] != null && String(enc[k]) !== ""); };
  if (!_le8Req.every(_le8Pres)) return { scores: [], total: null };
  const scores = [];`,
  },
  {
    caId: "CA-4",
    decision: "D-007",
    date: "2026-08-29",
    targetFile: "engine.dfi.js",
    // Instruccion verbatim de Gildardo, escrita en su propio ATLAS_v8.html del 2026-08-29 sobre este
    // mismo punto (ronda del 28, punto 4): "el insumo ausente entra hoy como 0, y en una desviacion
    // respecto del teorico el 0 afirma que el paciente esta en su valor esperado -una lectura
    // favorable- sin marca de que faltaba el dato. La conducta correcta es NO EMITIR EL INDICE. No se
    // cambia aqui todavia porque propagar el sin dato obliga a tocar las siete pantallas que consumen
    // el ISCM con Number(x)||0 y luego .toFixed(), y eso se hace con la app corriendo."
    //
    // ES LA MISMA INSTRUCCION QUE CA-3, aplicada a otro indice: "que deje de rellenar con ceros en
    // silencio: que distinga el paciente respondio 0 de el paciente no respondio".
    //
    // LO QUE ATLAS YA HACIA BIEN, y por eso esto es mas chico de lo que parece: analizarDesdeBiody ya
    // devuelve ISCM = null cuando falta alguno de los cuatro insumos secundarios (MCA_dif entre ellos).
    // El defecto estaba AGUAS ABAJO: num() convertia ese null en 0 y iscmCl lo clasificaba como "Leve"
    // (0 <= 1). Suprimir la cifra no basta si lo derivado sigue visible.
    //
    // LO QUE NO SE TOCA, A PROPOSITO: el "?? 1" con que el dominio 2 puntua una clasificacion
    // desconocida. Es suyo y esta escrito para exactamente este caso (etiqueta fuera del mapa), asi que
    // dejarlo respeta su decision; cambiarlo seria tomarla nosotros. Queda preguntado en la ronda.
    instruction:
      "El ISCM ausente no se emite ni se clasifica: el 0 afirma que el paciente esta en su valor esperado, una lectura favorable sin marca de que faltaba el dato (ronda 2026-08-28 punto 4, respondido en su archivo del 29).",
    oldSlice:
      '  const iehh = num("IEHH", "iehh"), iscm = num("ISCM", "iscm"), iae = num("IAE", "iae"),',
    newSlice: [
      '  const iehh = num("IEHH", "iehh"), iae = num("IAE", "iae"),',
      '        // AUSENTE != 0: si el ISCM no se pudo calcular (falta MCA_dif u otro insumo',
      '        // secundario) vale null y no se clasifica. Con num() valia 0, y 0 sale "Leve".',
      '        iscm = (d.ISCM != null && d.ISCM !== "" && !isNaN(Number(d.ISCM))) ? Number(d.ISCM)',
      '             : (d.iscm != null && d.iscm !== "" && !isNaN(Number(d.iscm))) ? Number(d.iscm) : null,',
    ].join(String.fromCharCode(10)),  // sin secuencia de escape: mas legible y no se rompe al editar
  },
  {
    caId: "CA-5",
    decision: "D-007",
    date: "2026-08-29",
    targetFile: "engine.dfi.js",
    // Segunda mitad de CA-4: con el ISCM en null la clasificacion tiene que ser null tambien, no
    // "Leve". Los consumidores del frozen ya escriben idx.iscmCl?.l || "-", asi que en cuanto esto es
    // null la pantalla dice "-" sola, sin tocar ninguno de los siete.
    instruction:
      "El ISCM ausente no se clasifica (misma instruccion de CA-4).",
    oldSlice:
      '    iscmCl: { l: (iscm <= -1 ? "Bajo" : iscm <= 1 ? "Leve" : iscm <= 2.5 ? "Moderado" : "Alto") },',
    newSlice:
      '    iscmCl: iscm == null ? null : { l: (iscm <= -1 ? "Bajo" : iscm <= 1 ? "Leve" : iscm <= 2.5 ? "Moderado" : "Alto") },',
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
