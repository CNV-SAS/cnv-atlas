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

/** Azul de marca (accion, CNV Data). El "azul electrico" de Santiago. */
export const MARCA_AZUL = "#205dfd";
/** El azul hondo de las portadas, extremo oscuro del degradado de marca. */
export const MARCA_HONDA = "#071b4d";

export const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#1a1a2e", lineHeight: 1.4 },
  // Discreta: mismo gris del pie, sin negrita y sin caja. Informa, no invita ni disuade.
  derechoHc: { marginTop: 18, fontSize: 8, color: "#6b7280" },
  // Cada dia del menu junto: un dia partido entre dos hojas obliga a pasar pagina a media comida.
  diaMenu: { marginTop: 6 },
  // ═══ AIRE ENTRE EL TITULO Y LA FIRMA (Santiago, 2026-10-30: *"hoy estan pegadas"*) ═══
  //
  // Eran 2 puntos de separacion con un titulo de 18: la firma quedaba colgando del titulo en vez de
  // debajo de el, y las dos se leian como una sola linea partida. Y como estos estilos los comparten el
  // informe y la hoja del plan, la cabecera de los dos documentos que recibe el paciente se corrige a la
  // vez, que es justo la razon por la que salieron de dentro del informe.
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 8, color: MARCA_HONDA },
  // La firma, en el azul de marca y en versalitas: deja de parecer un subtitulo del informe y pasa a ser
  // lo que es, quien lo emite.
  subtitle: {
    fontSize: 9,
    color: MARCA_AZUL,
    marginBottom: 14,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  meta: { marginBottom: 12 },
  metaRow: { flexDirection: "row", marginBottom: 1 },
  metaLabel: { width: 110, color: "#555" },
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
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: "bold", marginBottom: 4, color: MARCA_HONDA },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#ddd", paddingVertical: 2 },
  cellLabel: { width: 90 },
  cellValue: { flex: 1, textAlign: "right" },
  para: { marginBottom: 2 },
  // CADA DOMINIO, UN BLOQUE (Santiago, 2026-09-21): el nombre en negrita, su etiqueta con su color y la
  // frase debajo. En parrafo corrido las cinco se leian como un solo texto y no se veia cual pedia trabajo.
  // La barra de la izquierda repite el color de la etiqueta: refuerza, no sustituye a la palabra.
  dominio: { marginTop: 5, paddingLeft: 7, borderLeftWidth: 2.5 },
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
  // LA DECORACION DE MARCA  ·  Santiago, 2026-10-30
  //
  // Su encargo, literal: *"Decorarlo un poco, con el brand de Atlas: el azul electrico y formas de fondo
  // simples. Suaves y claras: el informe se imprime y a veces se fotocopia, asi que nada que tape el texto
  // ni que gaste tinta."*
  //
  // LAS DOS CONDICIONES (fotocopia y tinta) SON LAS QUE DECIDEN LA FORMA, y descartan lo primero que uno
  // haria, que es un fondo tramado o un degradado a toda pagina:
  //
  //   · Una BANDA SOLIDA Y FINA gasta casi nada y fotocopia limpia: el toner reproduce bien un borde
  //     definido. Un tono claro al 7 % es lo contrario: la fotocopiadora lo tira a gris sucio o lo borra,
  //     y no se puede predecir cual de las dos.
  //   · Asi que el peso de la decoracion lo lleva la banda, y la forma suave se queda en la ESQUINA, en el
  //     margen, donde si la fotocopia la ensucia no estorba a ninguna palabra.
  //
  // NADA DE ESTO ENTRA EN EL AREA DE TEXTO: la banda vive en los 40 puntos de margen superior y el circulo
  // sale de la hoja por la esquina. No hay texto detras que pueda quedar tapado.
  // ══════════════════════════════════════════════════════════════════════════════════════════════════

  /** La banda de marca del borde superior, a sangre. Fina, solida y en todas las paginas. */
  bandaDeMarca: { position: "absolute", top: 0, left: 0, right: 0, height: 5, backgroundColor: MARCA_AZUL },
  /**
   * La forma suave de la esquina: un circulo que sale de la hoja, al 7 %.
   *
   * SALE DE LA HOJA A PROPOSITO (top y right negativos): un circulo completo dentro de la pagina se lee
   * como una figura y pide ser interpretada; un arco que entra por la esquina se lee como lo que es,
   * decoracion.
   */
  formaDeMarca: {
    position: "absolute",
    // ═══ LA GEOMETRIA LA FIJA SU CONDICION, NO EL GUSTO (y el candado la midio) ═══
    //
    // La primera version era un circulo de 230 con top y right de -96. Dibujaba bien y SE METIA EN LA
    // COLUMNA DE TEXTO: su borde izquierdo caia en 478 y el texto llega hasta 572, asi que entre y=40 y
    // y=134 habia forma detras de las lineas. Al 7 % no tapa nada legible, pero su condicion no era "que
    // no moleste", era *"nada que tape el texto"*, y eso se puede cumplir de verdad.
    //
    // ASI QUE EL BORDE INFERIOR COINCIDE CON EL MARGEN SUPERIOR: -90 + 130 = 40, que es el `padding` de la
    // pagina. Por debajo de esa linea no hay forma, y encima de ella no hay texto. Cumplida la condicion,
    // el ancho queda libre, asi que en vez de un circulo pequeño en la esquina cabe un arco ANCHO que
    // cruza el borde superior, que es mas cerca de las *"formas de fondo simples"* que pidio.
    //
    // Si manana cambia el `padding` de la pagina, el candado falla y hay que recalcular `top`. Es
    // deliberado: es la unica forma de que la condicion no se pierda en un ajuste de margenes.
    top: -90,
    right: -40,
    width: 320,
    height: 130,
    borderRadius: 65,
    backgroundColor: MARCA_AZUL,
    opacity: 0.07,
  },
});
