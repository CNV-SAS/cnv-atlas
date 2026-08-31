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
  // CA-2 RETIRADA el 2026-08-29. Su ATLAS_v8.html del 29 ya trae la correccion CON SUS PROPIAS
  // PALABRAS: "Salvaguarda activa: el sistema AVISA y marca remision; NO pausa el plan. El deficit sigue
  // partiendo del peso meta acordado con el paciente y la decision de restringir es del profesional".
  //
  // Es la regla de VIGENCIA que este mismo archivo exige al portar un motor nuevo: "sigue haciendo falta"
  // o "Gildardo ya la absorbio en su archivo, se retira de aqui". Absorbida. El original se re-porto con
  // su texto, asi que ahora el generado dice lo suyo y no una parafrasis nuestra que decia lo mismo.
  //
  // Lo encontro el candado de deriva contra la entrega vigente (`frozen-deriva-vigente.test.ts`), no una
  // revision a mano: nadie se acuerda de revisar vigencia si nada lo pregunta.
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
    // EL "?? 1" DEL DOMINIO 2: preguntado en la ronda del 29 y RESPONDIDO el 30 (punto 4). Lo dejamos
    // aqui a proposito porque cambiarlo habria sido tomar su decision; el contesto que sin dato el
    // dominio NO puntua, y que ese `?? 1` estaba escrito para otra cosa (una clasificacion fuera del
    // mapa, donde SI hay dato). Lo aplica CA-6, que ademas encontro otros tres sitios con esa forma.
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
  // ── CA-6 · El dominio sin dato no puntua (Gildardo 2026-08-30 §4) ──────────────────────────────
  //
  // EL NOMBRO UNO Y HAY CUATRO. Su punto 4 senala el `?? 1` del dominio 2 (ISCM). Al ir a aplicarlo
  // aparecieron los otros tres, y uno NO es del mismo tipo:
  //   · d1 Celular      · `if(s1==null) s1=1` colapsa DOS casos: combinacion fuera del mapa (lo que
  //                       el quiso) y ausencia de IFC o IRC (lo que no).
  //   · d2 Metabolico   · el que el nombro.
  //   · d5 Epigenetico  · `if(icecTotal==null) s5=1`, mismo patron.
  //   · d3 Envejecimiento · SIN `iaeCl` la cadena cae al `else` y da 2. Eso NO es una lectura favorable
  //                       de un vacio: es una AFIRMACION DE PATOLOGIA sobre un vacio ("Envejecimiento
  //                       acelerado: intervenir sobre funcion y masa") en un dominio que nadie midio.
  //
  // Se parte en varias entradas pequenas a proposito: cada una es un corte revisable a mano, que es lo
  // que este mecanismo garantiza. Todas comparten la misma instruccion suya.
  {
    caId: "CA-6a",
    decision: "D-007",
    date: "2026-08-31",
    targetFile: "engine.dfi.js",
    instruction: "Un dominio SIN DATO no puntua y el radar no dibuja ese vertice (Gildardo 2026-08-30 punto 4): \"Un vertice de susceptibilidad leve dibujado sobre un dominio que no se midio es la misma lectura favorable de un vacio que corregimos en el ISCM, y en el radar pesa mas porque se ve de un golpe. Ese ?? 1 esta escrito para una clasificacion fuera del mapa, que es otra cosa: ahi si hay dato y no lo reconoce el clasificador. Sin dato, el dominio no puntua y el radar no dibuja ese vertice.\"",
    oldSlice: "  let s1 = D1[`${ifcL}|${ircL}`]; if(s1==null) s1=1;",
    newSlice: "  // Etiqueta unica del dominio no medido. Vive aqui (primera modificacion del bloque) para que las\n  // cinco lecturas usen LA MISMA cadena y no cinco copias que puedan divergir.\n  const _DFI_SIN_DATO = \"Sin dato: este dominio no se midió, así que no puntúa ni entra al radar.\";\n  // Se separan los dos casos que antes colapsaban en el mismo 1: sin IFC o sin IRC no hay dominio\n  // que puntuar; con los dos presentes y una combinacion que el mapa no tiene, se conserva SU 1.\n  let s1 = (ifcL == null || ircL == null) ? null : (D1[`${ifcL}|${ircL}`] ?? 1);",
  },
  {
    caId: "CA-6b",
    decision: "D-007",
    date: "2026-08-31",
    targetFile: "engine.dfi.js",
    instruction: "Un dominio SIN DATO no puntua y el radar no dibuja ese vertice (Gildardo 2026-08-30 punto 4): \"Un vertice de susceptibilidad leve dibujado sobre un dominio que no se midio es la misma lectura favorable de un vacio que corregimos en el ISCM, y en el radar pesa mas porque se ve de un golpe. Ese ?? 1 esta escrito para una clasificacion fuera del mapa, que es otra cosa: ahi si hay dato y no lo reconoce el clasificador. Sin dato, el dominio no puntua y el radar no dibuja ese vertice.\"",
    oldSlice: "  if(iehhAlt) s1=_dfiCap3(s1+1);",
    newSlice: "  if(iehhAlt && s1 != null) s1=_dfiCap3(s1+1); // un matiz no crea severidad donde no hay dato",
  },
  {
    caId: "CA-6c",
    decision: "D-007",
    date: "2026-08-31",
    targetFile: "engine.dfi.js",
    instruction: "Un dominio SIN DATO no puntua y el radar no dibuja ese vertice (Gildardo 2026-08-30 punto 4): \"Un vertice de susceptibilidad leve dibujado sobre un dominio que no se midio es la misma lectura favorable de un vacio que corregimos en el ISCM, y en el radar pesa mas porque se ve de un golpe. Ese ?? 1 esta escrito para una clasificacion fuera del mapa, que es otra cosa: ahi si hay dato y no lo reconoce el clasificador. Sin dato, el dominio no puntua y el radar no dibuja ese vertice.\"",
    oldSlice: "    clasif: idx.frL || `IFC ${ifcL} · IRC ${ircL}`,",
    newSlice: "    clasif: s1==null ? \"IFC — · IRC —\" : (idx.frL || `IFC ${ifcL} · IRC ${ircL}`),",
  },
  {
    caId: "CA-6d",
    decision: "D-007",
    date: "2026-08-31",
    targetFile: "engine.dfi.js",
    instruction: "Un dominio SIN DATO no puntua y el radar no dibuja ese vertice (Gildardo 2026-08-30 punto 4): \"Un vertice de susceptibilidad leve dibujado sobre un dominio que no se midio es la misma lectura favorable de un vacio que corregimos en el ISCM, y en el radar pesa mas porque se ve de un golpe. Ese ?? 1 esta escrito para una clasificacion fuera del mapa, que es otra cosa: ahi si hay dato y no lo reconoce el clasificador. Sin dato, el dominio no puntua y el radar no dibuja ese vertice.\"",
    oldSlice: "    lectura: s1>=3?",
    newSlice: "    lectura: s1==null?_DFI_SIN_DATO:s1>=3?",
  },
  {
    caId: "CA-6e",
    decision: "D-007",
    date: "2026-08-31",
    targetFile: "engine.dfi.js",
    instruction: "Un dominio SIN DATO no puntua y el radar no dibuja ese vertice (Gildardo 2026-08-30 punto 4): \"Un vertice de susceptibilidad leve dibujado sobre un dominio que no se midio es la misma lectura favorable de un vacio que corregimos en el ISCM, y en el radar pesa mas porque se ve de un golpe. Ese ?? 1 esta escrito para una clasificacion fuera del mapa, que es otra cosa: ahi si hay dato y no lo reconoce el clasificador. Sin dato, el dominio no puntua y el radar no dibuja ese vertice.\"",
    oldSlice: "  let s2 = iscmMap[idx.iscmCl?.l] ?? 1;",
    newSlice: "  // El caso que el nombro. El `?? 1` se conserva para lo que el lo escribio: una etiqueta que existe\n  // y el mapa no reconoce. Lo que cambia es la AUSENCIA de clasificacion, que ya no puntua.\n  let s2 = idx.iscmCl?.l == null ? null : (iscmMap[idx.iscmCl.l] ?? 1);",
  },
  {
    caId: "CA-6f",
    decision: "D-007",
    date: "2026-08-31",
    targetFile: "engine.dfi.js",
    instruction: "Un dominio SIN DATO no puntua y el radar no dibuja ese vertice (Gildardo 2026-08-30 punto 4): \"Un vertice de susceptibilidad leve dibujado sobre un dominio que no se midio es la misma lectura favorable de un vacio que corregimos en el ISCM, y en el radar pesa mas porque se ve de un golpe. Ese ?? 1 esta escrito para una clasificacion fuera del mapa, que es otra cosa: ahi si hay dato y no lo reconoce el clasificador. Sin dato, el dominio no puntua y el radar no dibuja ese vertice.\"",
    oldSlice: "  if(/Sarcop|Déficit|Deficit/i.test(fen)) s2=_dfiCap3(s2+1);",
    newSlice: "  if(/Sarcop|Déficit|Deficit/i.test(fen) && s2 != null) s2=_dfiCap3(s2+1);",
  },
  {
    caId: "CA-6g",
    decision: "D-007",
    date: "2026-08-31",
    targetFile: "engine.dfi.js",
    instruction: "Un dominio SIN DATO no puntua y el radar no dibuja ese vertice (Gildardo 2026-08-30 punto 4): \"Un vertice de susceptibilidad leve dibujado sobre un dominio que no se midio es la misma lectura favorable de un vacio que corregimos en el ISCM, y en el radar pesa mas porque se ve de un golpe. Ese ?? 1 esta escrito para una clasificacion fuera del mapa, que es otra cosa: ahi si hay dato y no lo reconoce el clasificador. Sin dato, el dominio no puntua y el radar no dibuja ese vertice.\"",
    oldSlice: "    lectura: s2>=3?",
    newSlice: "    lectura: s2==null?_DFI_SIN_DATO:s2>=3?",
  },
  {
    caId: "CA-6h",
    decision: "D-007",
    date: "2026-08-31",
    targetFile: "engine.dfi.js",
    instruction: "Un dominio SIN DATO no puntua y el radar no dibuja ese vertice (Gildardo 2026-08-30 punto 4): \"Un vertice de susceptibilidad leve dibujado sobre un dominio que no se midio es la misma lectura favorable de un vacio que corregimos en el ISCM, y en el radar pesa mas porque se ve de un golpe. Ese ?? 1 esta escrito para una clasificacion fuera del mapa, que es otra cosa: ahi si hay dato y no lo reconoce el clasificador. Sin dato, el dominio no puntua y el radar no dibuja ese vertice.\"",
    oldSlice: "  let s3;\n  if(idx.iaeCl?.l===\"Enlentecido\") s3=0;\n  else if(idx.iaeCl?.l===\"Concordante\") s3 = iae>3?1:0;\n  else s3 = iae>10?3:2;",
    newSlice: "  // EL PEOR DE LOS CUATRO. Sin EB-BIS no hay `iaeCl`, ninguna rama coincidia y la cadena caia al\n  // `else`, que con iae = 0 devuelve 2: envejecimiento acelerado AFIRMADO sobre lo no medido.\n  let s3;\n  if(idx.iaeCl?.l == null) s3=null;\n  else if(idx.iaeCl.l===\"Enlentecido\") s3=0;\n  else if(idx.iaeCl.l===\"Concordante\") s3 = iae>3?1:0;\n  else s3 = iae>10?3:2;",
  },
  {
    caId: "CA-6i",
    decision: "D-007",
    date: "2026-08-31",
    targetFile: "engine.dfi.js",
    instruction: "Un dominio SIN DATO no puntua y el radar no dibuja ese vertice (Gildardo 2026-08-30 punto 4): \"Un vertice de susceptibilidad leve dibujado sobre un dominio que no se midio es la misma lectura favorable de un vacio que corregimos en el ISCM, y en el radar pesa mas porque se ve de un golpe. Ese ?? 1 esta escrito para una clasificacion fuera del mapa, que es otra cosa: ahi si hay dato y no lo reconoce el clasificador. Sin dato, el dominio no puntua y el radar no dibuja ese vertice.\"",
    oldSlice: "    clasif:`IAE ${_dfiSigned(iae)} años · ${idx.iaeCl?.l||\"-\"}`,",
    newSlice: "    clasif: s3==null ? \"IAE — · sin dato\" : `IAE ${_dfiSigned(iae)} años · ${idx.iaeCl?.l||\"-\"}`,",
  },
  {
    caId: "CA-6j",
    decision: "D-007",
    date: "2026-08-31",
    targetFile: "engine.dfi.js",
    instruction: "Un dominio SIN DATO no puntua y el radar no dibuja ese vertice (Gildardo 2026-08-30 punto 4): \"Un vertice de susceptibilidad leve dibujado sobre un dominio que no se midio es la misma lectura favorable de un vacio que corregimos en el ISCM, y en el radar pesa mas porque se ve de un golpe. Ese ?? 1 esta escrito para una clasificacion fuera del mapa, que es otra cosa: ahi si hay dato y no lo reconoce el clasificador. Sin dato, el dominio no puntua y el radar no dibuja ese vertice.\"",
    oldSlice: "    lectura: s3>=3?",
    newSlice: "    lectura: s3==null?_DFI_SIN_DATO:s3>=3?",
  },
  {
    caId: "CA-6k",
    decision: "D-007",
    date: "2026-08-31",
    targetFile: "engine.dfi.js",
    instruction: "Un dominio SIN DATO no puntua y el radar no dibuja ese vertice (Gildardo 2026-08-30 punto 4): \"Un vertice de susceptibilidad leve dibujado sobre un dominio que no se midio es la misma lectura favorable de un vacio que corregimos en el ISCM, y en el radar pesa mas porque se ve de un golpe. Ese ?? 1 esta escrito para una clasificacion fuera del mapa, que es otra cosa: ahi si hay dato y no lo reconoce el clasificador. Sin dato, el dominio no puntua y el radar no dibuja ese vertice.\"",
    oldSlice: "  if(icecTotal==null) s5=1;",
    newSlice: "  if(icecTotal==null) s5=null;",
  },
  {
    caId: "CA-6l",
    decision: "D-007",
    date: "2026-08-31",
    targetFile: "engine.dfi.js",
    instruction: "Un dominio SIN DATO no puntua y el radar no dibuja ese vertice (Gildardo 2026-08-30 punto 4): \"Un vertice de susceptibilidad leve dibujado sobre un dominio que no se midio es la misma lectura favorable de un vacio que corregimos en el ISCM, y en el radar pesa mas porque se ve de un golpe. Ese ?? 1 esta escrito para una clasificacion fuera del mapa, que es otra cosa: ahi si hay dato y no lo reconoce el clasificador. Sin dato, el dominio no puntua y el radar no dibuja ese vertice.\"",
    oldSlice: "  if(barrera) s5=_dfiCap3(s5+1);",
    newSlice: "  if(barrera && s5 != null) s5=_dfiCap3(s5+1);",
  },
  {
    caId: "CA-6m",
    decision: "D-007",
    date: "2026-08-31",
    targetFile: "engine.dfi.js",
    instruction: "Un dominio SIN DATO no puntua y el radar no dibuja ese vertice (Gildardo 2026-08-30 punto 4): \"Un vertice de susceptibilidad leve dibujado sobre un dominio que no se midio es la misma lectura favorable de un vacio que corregimos en el ISCM, y en el radar pesa mas porque se ve de un golpe. Ese ?? 1 esta escrito para una clasificacion fuera del mapa, que es otra cosa: ahi si hay dato y no lo reconoce el clasificador. Sin dato, el dominio no puntua y el radar no dibuja ese vertice.\"",
    oldSlice: "    lectura: s5>=3?",
    newSlice: "    lectura: s5==null?_DFI_SIN_DATO:s5>=3?",
  },
  {
    caId: "CA-6n",
    decision: "D-007",
    date: "2026-08-31",
    targetFile: "engine.dfi.js",
    instruction: "Un dominio SIN DATO no puntua y el radar no dibuja ese vertice (Gildardo 2026-08-30 punto 4): \"Un vertice de susceptibilidad leve dibujado sobre un dominio que no se midio es la misma lectura favorable de un vacio que corregimos en el ISCM, y en el radar pesa mas porque se ve de un golpe. Ese ?? 1 esta escrito para una clasificacion fuera del mapa, que es otra cosa: ahi si hay dato y no lo reconoce el clasificador. Sin dato, el dominio no puntua y el radar no dibuja ese vertice.\"",
    oldSlice: "  const W=[0.30,0.25,0.15,0.15,0.15];\n  const score01 = domains.reduce((a,d,i)=>a+W[i]*(d.sev/3),0);",
    newSlice: "  // EL RIESGO INTEGRADO SE RENORMALIZA sobre los dominios medidos, y esta parte SI es decision\n  // nuestra (declarada en la ronda del 31, no dada por buena): dejar el termino en cero es lo que\n  // hacia solo, porque en JavaScript null/3 es 0, y eso BAJA el riesgo por no haber medido, que es\n  // la misma lectura favorable de un vacio. El denominador nunca es cero: el dominio 4 arranca en 0\n  // y siempre tiene severidad, asi que su peso siempre cuenta.\n  const W=[0.30,0.25,0.15,0.15,0.15];\n  const _wMedidos = domains.reduce((a,d,i)=>a+(d.sev==null?0:W[i]),0);\n  const score01 = domains.reduce((a,d,i)=>a+(d.sev==null?0:W[i]*(d.sev/3)),0)/_wMedidos;",
  },
  {
    caId: "CA-6o",
    decision: "D-007",
    date: "2026-08-31",
    targetFile: "engine.dfi.js",
    instruction: "Un dominio SIN DATO no puntua y el radar no dibuja ese vertice (Gildardo 2026-08-30 punto 4): \"Un vertice de susceptibilidad leve dibujado sobre un dominio que no se midio es la misma lectura favorable de un vacio que corregimos en el ISCM, y en el radar pesa mas porque se ve de un golpe. Ese ?? 1 esta escrito para una clasificacion fuera del mapa, que es otra cosa: ahi si hay dato y no lo reconoce el clasificador. Sin dato, el dominio no puntua y el radar no dibuja ese vertice.\"",
    oldSlice: "  return { domains, riesgo:{...NIV[nivel], score:Math.round(score01*100)}, veto, rutas };",
    newSlice: "  // `sinDato` viaja con el resultado para que la pantalla pueda DECIRLO. Sin esto, el riesgo\n  // integrado saldria calculado sobre menos dominios sin que nadie lo supiera, que es cambiar una\n  // cifra clinica en silencio.\n  return { domains, riesgo:{...NIV[nivel], score:Math.round(score01*100)}, veto, rutas,\n    sinDato: domains.filter(d=>d.sev==null).map(d=>d.id) };",
  },
  // ── CA-7 · El adaptador deja de clasificar ceros fabricados: IAE, EB-BIS e IEHH ───────────────
  //
  // MISMA FORMA QUE CA-4/CA-5, aplicada a los tres indices que quedaban. `num()` devuelve 0 cuando el
  // dato no esta, y aguas abajo ese 0 SE CLASIFICA: cIAE(0) da "Concordante" y cIEHH(0) da "Optimo".
  // Un paciente sin EB-BIS salia con el dominio Envejecimiento en severidad 0 y la frase "su ritmo de
  // envejecimiento es acorde con su edad cronologica", afirmada sobre lo que nadie midio.
  //
  // CORRIGE ADEMAS UN HALLAZGO NUESTRO MAL DESCRITO, y queda escrito para no repetirlo: reportamos que
  // el dominio 3 sin dato AFIRMABA PATOLOGIA (severidad 2, "envejecimiento acelerado"). Esa rama existe
  // en `computeDFI`, pero por el camino REAL no se alcanza, porque el adaptador nunca deja `iaeCl`
  // vacio: lo que de verdad pasaba era la lectura FAVORABLE. La correccion es la misma; el relato no.
  //
  // POR QUE NO VA EN LA LINEA DE CA-4, que seria lo natural: esa linea ya la reescribe CA-4 con OTRA
  // instruccion suya (la del ISCM), y el mecanismo prohibe modificaciones solapadas a proposito. Se
  // repone el valor en `_idx`, que es por donde los tres entran al calculo.
  {
    caId: "CA-7a",
    decision: "D-007",
    date: "2026-08-31",
    targetFile: "engine.dfi.js",
    instruction: "Un dato que falta no puede entrar al calculo como si fuera una respuesta, y menos como una respuesta favorable (Gildardo 2026-08-30 punto 1, CONDUCTA GENERAL: \"aplica a todo el sistema, no solo a esa regla. No me lo pregunten regla por regla\"). Aplicado al IAE, la EB-BIS y el IEHH, donde el adaptador seguia fabricando un 0 y clasificandolo.",
    oldSlice: "  const _obSarc = _fmiElev && (_ffmiLow || _asmiLow || _smmwLow);",
    newSlice: "  const _obSarc = _fmiElev && (_ffmiLow || _asmiLow || _smmwLow);\n  // ¿Vino el dato, o lo fabrico `num()` con su cero? La misma prueba de presencia de CA-4, extraida\n  // para reusarla en los tres indices de CA-7.\n  const _presente = (...ks) => ks.some(k => d[k] != null && d[k] !== \"\" && !isNaN(Number(d[k])));",
  },
  {
    caId: "CA-7b",
    decision: "D-007",
    date: "2026-08-31",
    targetFile: "engine.dfi.js",
    instruction: "Un dato que falta no puede entrar al calculo como si fuera una respuesta, y menos como una respuesta favorable (Gildardo 2026-08-30 punto 1, CONDUCTA GENERAL: \"aplica a todo el sistema, no solo a esa regla. No me lo pregunten regla por regla\"). Aplicado al IAE, la EB-BIS y el IEHH, donde el adaptador seguia fabricando un 0 y clasificandolo.",
    oldSlice: "    ifc, irc, iehh, iscm, iae, ebBis, icaBis, pabu,",
    newSlice: "    ifc, irc, iscm, icaBis, pabu,\n    // AUSENTE != 0: se repone null cuando el valor lo puso el fallback de `num()` y no el paciente.\n    iehh: _presente(\"IEHH\", \"iehh\") ? iehh : null,\n    iae: _presente(\"IAE\", \"iae\") ? iae : null,\n    ebBis: _presente(\"EB_BIS\", \"eb\", \"ebBis\") ? ebBis : null,",
  },
  {
    caId: "CA-7c",
    decision: "D-007",
    date: "2026-08-31",
    targetFile: "engine.dfi.js",
    instruction: "Un dato que falta no puede entrar al calculo como si fuera una respuesta, y menos como una respuesta favorable (Gildardo 2026-08-30 punto 1, CONDUCTA GENERAL: \"aplica a todo el sistema, no solo a esa regla. No me lo pregunten regla por regla\"). Aplicado al IAE, la EB-BIS y el IEHH, donde el adaptador seguia fabricando un 0 y clasificandolo.",
    oldSlice: "    iehhCl: { l: (() => { const x = cIEHH(iehh).l; return x === \"Severo\" ? \"Alto\" : x; })() },",
    newSlice: "    iehhCl: !_presente(\"IEHH\", \"iehh\") ? null : { l: (() => { const x = cIEHH(iehh).l; return x === \"Severo\" ? \"Alto\" : x; })() },",
  },
  {
    caId: "CA-7d",
    decision: "D-007",
    date: "2026-08-31",
    targetFile: "engine.dfi.js",
    instruction: "Un dato que falta no puede entrar al calculo como si fuera una respuesta, y menos como una respuesta favorable (Gildardo 2026-08-30 punto 1, CONDUCTA GENERAL: \"aplica a todo el sistema, no solo a esa regla. No me lo pregunten regla por regla\"). Aplicado al IAE, la EB-BIS y el IEHH, donde el adaptador seguia fabricando un 0 y clasificandolo.",
    oldSlice: "    iaeCl: { l: (() => { const x = cIAE(iae || 0).l; return x === \"Desacelerado\" ? \"Enlentecido\" : x; })() },",
    newSlice: "    iaeCl: !_presente(\"IAE\", \"iae\") ? null : { l: (() => { const x = cIAE(iae).l; return x === \"Desacelerado\" ? \"Enlentecido\" : x; })() },",
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
