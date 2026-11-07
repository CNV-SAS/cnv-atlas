// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS ESTILOS DE LOS PDF DEL PACIENTE  ·  UNA SOLA HOJA DE ESTILO
//
// Vivian dentro de `report-document.tsx`, y salieron de ahi el 2026-10-28, cuando el plan paso a tener su
// PROPIO PDF (el adjunto del correo que pidio Santiago). Dos hojas de estilo para dos documentos que el
// mismo paciente recibe el mismo dia se leen como dos sistemas distintos, y divergen por donde nadie mira:
// es el mismo motivo por el que los dos comparten los BLOQUES (`bloques-del-plan.tsx`).
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import { StyleSheet } from "@react-pdf/renderer";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS DOS ANCLAS DE MARCA, CON SU HEX EXACTO DE BRAND.md  ·  un PDF no lee variables CSS
//
// Son los mismos dos que globals.css declara como anclas de Atlas: el azul de accion y el azul hondo de
// las portadas. Se escriben aqui porque @react-pdf no resuelve `var(--primary)`; si cambian alla, cambian
// aqui (igual que los hexadecimales del radar, que tienen su propio candado contra globals.css).
//
// Y SE PUEDE DECORAR CON ELLOS, que no es obvio: BRAND.md reserva el color que CODIFICA RIESGO (verde,
// ambar, rojo) para lo clinico, y deja libre el azul de marca para *"marca, estructura de la interfaz,
// encabezados de seccion"*. Un informe decorado en azul no insinua ninguna severidad.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * El margen de la hoja del informe, en un solo sitio. Lo usa `pageInforme` y lo usan, EN NEGATIVO, la
 * franja de marca y el pie de la plantilla, que sangran hasta el borde del papel. Si los dos numeros se
 * escribieran por separado, ajustar el margen dejaria la franja flotando sin que nadie supiera por que.
 *
 * EL LATERAL SE QUEDA EN 32 y no sube con la plantilla (que usa 72): la plantilla es de documentos de
 * texto corrido, y esta hoja lleva una figura de 272 puntos de ancho y cinco areas que tienen que caber
 * en UNA hoja. Ochenta puntos menos de ancho parten el informe en dos, que es justo lo que Santiago
 * pidio evitar. El de ARRIBA y el de ABAJO si son los que piden la franja y el pie.
 */
export const RELLENO_DEL_INFORME = { arriba: 28, abajo: 32, lado: 32 } as const;

/** Azul de marca (accion, CNV Data). El "azul electrico" de Santiago. */
export const MARCA_AZUL = "#205dfd";
/** El azul hondo de las portadas, extremo oscuro del degradado de marca. */
export const MARCA_HONDA = "#071b4d";
/**
 * EL TINTA DE ATLAS (`--foreground` de globals.css, el "ink" de BRAND.md). Lo usa el texto, no la franja.
 */
export const MARCA_TINTA = "#15161a";

/**
 * AQUI VIVIA `MARCA_FRANJA`, el azul de la franja del borde superior, y el `mezclar()` que lo derivaba de
 * los dos anclas. Salieron el 2026-11-05 con la franja (Santiago: *"Fuera la franja y la nube."*).
 *
 * SE DEJA LA NOTA PORQUE EL COLOR COSTO DOS RONDAS y la leccion no es del color: el 3 de noviembre dijo
 * primero que la franja era *"un azul electrico algo chillon"* y se puso el tinta de Atlas; al verla
 * impresa, *"se ve muy extraño... que tampoco quede gris como este color, ya que ahora se mezcla con el
 * gris del fondo del PDF"*. Las dos observaciones eran correctas y el diagnostico de la primera no: el
 * problema no era la claridad, era el TONO. Si manana vuelve una decoracion de marca a un documento
 * impreso, el tinta casi negro sobre el gris del visor no se lee como marca, se lee como borde de la hoja.
 */

/**
 * EL CUERPO DEL TITULO DEL DOCUMENTO, en un solo sitio.
 *
 * Lo usan el titulo del encabezado (los tres documentos) y la cifra de la edad biologica del informe,
 * que desde el 2026-11-07 sale a ESTE tamaño (Santiago: *"la cifra de la edad biologica, al tamano del
 * titulo principal"*). Escrito dos veces se separarian en cuanto alguien mueva la escala tipografica, y
 * el dia que el titulo crezca la cifra se quedaria chica sin que nada falle.
 */
export const CUERPO_DEL_TITULO = 18;

/**
 * EL FILETE DE LOS CUADROS DEL INFORME, EN UN SOLO SITIO (2026-11-07).
 *
 * Nacio dentro de `encabezado-en-cuadros` para la caja de identidad (gris 400, que es el que se ve
 * impreso; el gris 300 de antes desaparecia en el papel). Sube aqui el dia que el cuadro de la edad
 * biologica adopta el MISMO filete: dos cuadros a diez puntos uno del otro con dos grises distintos es
 * justo lo que Santiago llamo *"no cuadra"*, y escrito dos veces se separan en cuanto alguien ajuste uno.
 *
 * El encabezado lo sigue exportando con su nombre (`BORDE_DEL_ENCABEZADO`) porque sus lectores lo piden
 * asi; lo que ya no hace es tener su propia copia del color.
 */
export const BORDE_DEL_CUADRO = "#9ca3af";

/** El gris de los rotulos en versalitas, el mismo en los cuadros del encabezado y en el de la edad. */
export const ROTULO_DEL_CUADRO = "#6b7280";

export const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#1a1a2e", lineHeight: 1.4 },
  // ═══ LA HOJA DEL INFORME VA MAS APRETADA QUE LA DEL PLAN, Y ES MEDIDO (2026-11-06) ═══
  //
  // Santiago pidio que la hoja 1 del informe no se parta: *"que no haga espacio a otra hoja, ya que queda
  // toda una hoja casi limpia"*. Con `page` a 40 puntos de margen y 1,4 de interlinea, el contenido
  // medido (encabezado, cifra, figura de 272 puntos, cinco areas y la nota de interpretacion) daba 2
  // hojas: se iban el quinto dominio y la nota.
  //
  // SE APRIETA LA TIPOGRAFIA, NO SE QUITA CONTENIDO: 32 puntos de margen y 1,3 de interlinea ganan los
  // 110 puntos que faltaban. Verificado renderizando con un nombre de 47 caracteres y los cinco dominios.
  //
  // Y ES UN ESTILO PROPIO, NO un cambio en `page`, porque `page` lo comparte la HOJA DEL PLAN, que no
  // tiene este problema (no lleva figura) y que Santiago ya reviso con su densidad. Apretar las dos por
  // arreglar una seria cambiarle la maqueta a un documento que nadie pidio tocar.
  //
  // ═══ Y DESDE EL 2026-11-06 LOS CUATRO MARGENES SON DISTINTOS, POR LA PLANTILLA DE SANTIAGO ═══
  //
  // La franja de colores sangra por el borde de ARRIBA y el pie de la plantilla (dos lineas de datos mas
  // la barra degradada) ocupa el de ABAJO. Las dos piezas se dibujan en absoluto desde fuera del margen,
  // asi que el margen es justo el hueco que tienen que dejarles: 30 arriba (9 de franja y 21 de aire) y
  // 42 abajo (tres lineas pequeñas, la barra y su aire).
  //
  // LOS NUMEROS SE EXPORTAN (`RELLENO_DEL_INFORME`) porque la franja y el pie se posicionan con su
  // NEGATIVO. Escritos dos veces, el dia que alguien ajuste el margen la franja se queda flotando a
  // medio centimetro del borde y nadie sabe por que.
  pageInforme: {
    paddingTop: RELLENO_DEL_INFORME.arriba,
    paddingBottom: RELLENO_DEL_INFORME.abajo,
    paddingHorizontal: RELLENO_DEL_INFORME.lado,
    fontSize: 10,
    color: "#1a1a2e",
    lineHeight: 1.3,
  },
  // Discreta: mismo gris del pie, sin negrita y sin caja. Informa, no invita ni disuade.
  derechoHc: { marginTop: 2, fontSize: 8, color: "#6b7280" },
  // La nota de interpretacion del informe: letra pequeña, al cierre de la hoja, como en su maqueta.
  notaAlPie: { marginTop: 2, fontSize: 8, color: "#4b5563", lineHeight: 1.3 },
  // Cada dia del menu junto: un dia partido entre dos hojas obliga a pasar pagina a media comida.
  diaMenu: { marginTop: 6 },
  // ═══ EL TITULO, LA FIRMA Y LAS FILAS DEL ENCABEZADO SE FUERON AL COMPONENTE (2026-11-05) ═══
  //
  // Vivian aqui `title`, `subtitle`, `meta`, `metaRow` y `metaLabel`: el titulo del documento, la firma
  // de CNV y las filas etiqueta-valor del encabezado. Los tres documentos pintan ahora el MISMO
  // encabezado en cuadros (`encabezado-en-cuadros.tsx`), que trae sus propios estilos porque la historia
  // clinica tiene otra hoja de estilo y "el mismo encabezado" habrian sido tres encabezados parecidos.
  //
  // SE BORRAN EN VEZ DE QUEDARSE SIN USO, por lo mismo que la marca de fondo: un estilo huerfano invita a
  // montar una segunda cabecera con el, y volveriamos a tener dos.
  //
  // (`notice` y `disclaimer` tambien estan sin uso, y son de ANTES de este cambio: el aviso naranja y el
  // rotulo de advertencia permanente que se retiro el 2026-09-01. No se tocan aqui para no mezclar dos
  // limpiezas en el mismo commit.)
  notice: {
    backgroundColor: "#fff4e5",
    borderColor: "#d99a2b",
    borderWidth: 1,
    borderRadius: 4,
    padding: 8,
    marginBottom: 14,
    color: "#8a5a00",
    fontSize: 9,
  },
  // Rotulo de advertencia permanente (siempre visible; preview interno y version al
  // paciente). El motor produce asociaciones a valorar, no un diagnostico.
  disclaimer: {
    backgroundColor: "#eef2f7",
    borderColor: MARCA_HONDA,
    borderWidth: 1,
    borderRadius: 4,
    padding: 8,
    marginBottom: 12,
    color: MARCA_HONDA,
    fontSize: 9,
    fontWeight: "bold",
  },
  // EL TITULO Y EL SUBTITULO DE LA HOJA 2 (seguimiento, 2026-11-06). Mismo tamaño que el titulo del
  // encabezado y mismo subtitulo pequeño: las dos hojas tienen que leerse como el mismo documento.
  // CON SU ALTURA DECLARADA, por lo mismo que el titulo del encabezado: sin ella el subtitulo se le
  // montaba encima (medido el 2026-11-06, 4,9 puntos de solape).
  tituloDeHoja: { fontSize: 18, fontWeight: "bold", color: MARCA_HONDA, lineHeight: 1.2, marginBottom: 1 },
  subtituloDeHoja: { fontSize: 9, color: "#4b5563", lineHeight: 1.3, marginBottom: 14 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: "bold", lineHeight: 1.2, marginBottom: 3, color: MARCA_HONDA },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#ddd", paddingVertical: 2 },
  cellLabel: { width: 90 },
  cellValue: { flex: 1, textAlign: "right" },
  para: { marginBottom: 2 },

  // ══════════════════════════════════════════════════════════════════════════════════════════════════
  // EL CUADRO DE LA EDAD BIOLOGICA  ·  Santiago, 2026-11-07 (segunda vuelta)
  //
  // ═══ QUE ESTABA MAL, EN SUS PALABRAS ═══
  //
  // *"El cuadro de la edad biologica: hoy esta centrado, en negrita, mezcla gris y azul, y no cuadra."*
  //
  // Las cuatro observaciones son UNA sola: el bloque no era un cuadro, era una pila de cuatro lineas
  // centradas, cada una con su color y su peso. Centrado, nada se alinea con nada (la hoja entera va a la
  // izquierda), y sin un filete que lo cierre las cuatro lineas flotan entre el encabezado y lo que sigue.
  // "No cuadra" es literal: no tenia cuadro.
  //
  // ═══ LA FORMA SALE DE SU REFERENCIA, EL CONTENIDO ES EL QUE EL ESCRIBIO ═══
  //
  // La referencia (`Informe_BiodyBis_diseno_revisado`) resuelve el mismo problema en su lista de areas:
  // todo contra el margen izquierdo, un rotulo, el dato destacado y la explicacion debajo en gris pequeño,
  // dentro de un bloque con su filete. Se adopta ESO. Lo que no se adopta es su paleta por severidad en
  // este cuadro: la cifra informa, no alerta (ver abajo).
  //
  // Y EL FILETE ES EL MISMO DE LA CAJA DE IDENTIDAD (`BORDE_DEL_CUADRO`), no uno parecido. Dos cuadros a
  // diez puntos de distancia con dos grises distintos se leen como dos piezas de documentos distintos.
  //
  // ═══ LO QUE NO CAMBIO, Y ES DELIBERADO ═══
  //
  // SIN FONDO DE COLOR: un fondo convertiria el cuadro en un aviso, y un aviso se lee como alerta. La
  // cifra no alerta de nada; el veredicto es la banda del IAE, que va en palabras.
  //
  // Y LA CIFRA SIGUE AL CUERPO DEL TITULO (18), que es su decision de esta manana: una cifra mas grande
  // que el titulo de la hoja se lee como el titulo.
  // ══════════════════════════════════════════════════════════════════════════════════════════════════
  cifraBloque: {
    borderWidth: 1.1,
    borderColor: BORDE_DEL_CUADRO,
    borderRadius: 3,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginTop: 1,
    marginBottom: 4,
  },
  // ═══ LA CIFRA Y LA EDAD REAL, EN EL MISMO RENGLON ═══
  //
  // Y la razon es MEDIDA, no de gusto. El filete y el relleno del cuadro cuestan doce puntos de alto, y
  // el informe inicial tiene que caber en UNA hoja con el nombre mas largo de la cohorte, las cinco areas
  // en el nivel peor y el mensaje al paciente en su tope: con la edad real en su propia linea se iba a
  // la hoja 2 el derecho a pedir la historia clinica. Este renglon devuelve justo esos doce puntos.
  //
  // Y ademas se lee mejor: "58,0 años" y "Tu edad: 54 años" uno al lado del otro SON la comparacion, que
  // es para lo que existe la segunda. En dos lineas hay que hacerla con la vista.
  cifraLinea: { flexDirection: "row", alignItems: "baseline" },
  // EL ROTULO ES EL MISMO QUE EL DE LAS TRES CAJAS DE ARRIBA: mismo cuerpo, mismo gris, mismo espaciado y
  // la misma negrita que Santiago pidio hoy para PACIENTE, DOCUMENTO y FECHA DE MEDICION. Si este se
  // quedara fino, el unico rotulo distinto de la hoja seria justo el del bloque principal.
  cifraRotulo: {
    fontSize: 7,
    fontWeight: "bold",
    color: ROTULO_DEL_CUADRO,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  // ═══ EL `lineHeight` DE ESTA LINEA NO ES DECORACION: SIN EL, SE MONTABA SOBRE LA DE ABAJO ═══
  //
  // Medido sobre el PDF de una paciente real (2026-11-06): el "76,4 años" salia en y=610,5 y la linea
  // siguiente en y=612,6, o sea DOS PUNTOS por encima y cruzandose en horizontal. En el arbol de vistas
  // esto es una columna y parece imposible; en el papel se solapaban, porque sin altura declarada la
  // linea de 30 puntos no reserva su espacio. Las tres lineas del bloque la llevan ahora.
  // ═══ Y AL TAMAÑO DEL TITULO PRINCIPAL, NO MAS GRANDE (Santiago, 2026-11-07) ═══
  //
  // Estuvo en 30 puntos desde el 5 de noviembre, cuando se pidio "grande, sola". Al verla impresa,
  // Santiago la bajo al cuerpo del titulo del documento (18): una cifra mas grande que el titulo de la
  // hoja se lee como el titulo, y el titulo deja de ser la entrada del documento. Los 12 puntos que
  // devuelve son ademas parte del aire que la hoja 1 necesitaba para las cinco areas.
  //
  // EL 18 NO ES UN NUMERO SUELTO: es el del titulo (`encabezado-en-cuadros`, `titulo.fontSize`), y el
  // candado los compara para que no puedan separarse sin que se vea.
  cifraGrande: { fontSize: CUERPO_DEL_TITULO, fontWeight: "bold", color: MARCA_HONDA, lineHeight: 1.15 },
  /** La edad cronologica, AL LADO de la cifra: es lo que le da sentido al numero grande. */
  cifraEdadReal: { fontSize: 9, color: ROTULO_DEL_CUADRO, lineHeight: 1.3, marginLeft: 10 },
  /**
   * La frase con la banda al final: la unica linea con veredicto, asi que va destacada.
   *
   * YA NO VA CENTRADA (Santiago, 2026-11-07): el cuadro entero se alinea a la izquierda, con el resto de
   * la hoja. Una sola linea centrada dentro de un bloque alineado es lo que hacia que el bloque no
   * "cuadrara" aunque cada pieza por separado estuviera bien.
   */
  cifraDelta: {
    fontSize: 10,
    fontWeight: "bold",
    color: MARCA_TINTA,
    lineHeight: 1.3,
    marginTop: 5,
  },
  /**
   * LA MEDIA LINEA DE SEGURIDAD, en letra pequeña y debajo del veredicto (Santiago, 2026-11-07).
   *
   * Viajaba DENTRO de la frase, asi que salia en negrita de 10 puntos, igual que el veredicto. Una
   * advertencia sobre como leer la cifra y el veredicto sobre el paciente no pueden pesar lo mismo: al
   * mismo cuerpo, la advertencia se lee como parte del diagnostico.
   */
  cifraSeguridad: { fontSize: 7.5, color: ROTULO_DEL_CUADRO, lineHeight: 1.3, marginTop: 3 },
  // CADA DOMINIO, UN BLOQUE (Santiago, 2026-09-21): el nombre en negrita, su etiqueta con su color y la
  // frase debajo. En parrafo corrido las cinco se leian como un solo texto y no se veia cual pedia trabajo.
  // La barra de la izquierda repite el color de la etiqueta: refuerza, no sustituye a la palabra.
  //
  // Y CON AIRE ENTRE LAS CINCO (Santiago, 2026-11-07): *"hoy las rayas de color quedan pegadas"*. Con
  // medio punto de separacion las cinco barras de color se leian como una sola barra rayada, que es lo
  // contrario de lo que cada barra existe para hacer. Cuatro puntos las separan sin convertirlas en
  // cinco bloques sueltos. El mismo estilo lo usa la hoja de seguimiento, asi que el aire entra en las
  // dos a la vez.
  dominio: { marginTop: 4, paddingLeft: 7, borderLeftWidth: 2.5 },
  dominioLectura: { marginTop: 1, color: "#374151" },
  bold: { fontWeight: "bold" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#888",
    borderTopWidth: 0.5,
    borderColor: "#ddd",
    paddingTop: 6,
  },

  // ══════════════════════════════════════════════════════════════════════════════════════════════════
  // LA DECORACION DE MARCA SALIO EL 2026-11-05  ·  Santiago: *"Fuera la franja y la nube."*
  //
  // Vivian aqui dos estilos, `bandaDeMarca` (la franja solida del borde superior) y `formaDeMarca` (el
  // arco azul al 7 % que entraba por la esquina), y un componente que los pintaba en los dos documentos
  // del paciente. Se pusieron el 30 de octubre por un encargo suyo (*"decorarlo un poco, con el brand de
  // Atlas"*) y su geometria se ajusto dos veces mas, el 3 de noviembre, por el tono de la franja.
  //
  // ═══ POR QUE SE VAN, Y NO ES QUE ESTUVIERAN MAL HECHAS ═══
  //
  // La maqueta nueva consigue lo que la decoracion buscaba (que el documento se vea de la casa) con
  // JERARQUIA TIPOGRAFICA: el encabezado en cuadros y la cifra grande. Y lo consigue mejor en las dos
  // condiciones que el propio encargo imponia, que eran *"nada que tape el texto ni que gaste tinta"*: un
  // encabezado no gasta tinta y no puede quedar detras de una palabra.
  //
  // SE BORRAN EN VEZ DE QUEDARSE SIN LLAMADORES, igual que el `plan` del informe el 30 de octubre: una
  // pieza muerta es el cable que alguien vuelve a conectar sin saber por que se desconecto. Los DOS AZULES
  // de marca se quedan arriba, porque los usa el encabezado; `MARCA_FRANJA`, que solo existia para la
  // franja, se va con ella.
  // ══════════════════════════════════════════════════════════════════════════════════════════════════
});
