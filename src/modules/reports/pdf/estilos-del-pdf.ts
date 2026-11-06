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

export const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#1a1a2e", lineHeight: 1.4 },
  // Discreta: mismo gris del pie, sin negrita y sin caja. Informa, no invita ni disuade.
  derechoHc: { marginTop: 18, fontSize: 8, color: "#6b7280" },
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
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: "bold", marginBottom: 4, color: MARCA_HONDA },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#ddd", paddingVertical: 2 },
  cellLabel: { width: 90 },
  cellValue: { flex: 1, textAlign: "right" },
  para: { marginBottom: 2 },

  // ══════════════════════════════════════════════════════════════════════════════════════════════════
  // LA CIFRA GRANDE Y SOLA  ·  Santiago, 2026-11-05
  //
  // *"La edad biologica estimada, grande, 'estimada por el modelo ANI-BIS-E'."*
  //
  // Era una fila mas entre bloques, con la cifra en negrita dentro de un parrafo de 10 puntos. Ahora es la
  // pieza que sostiene la primera hoja. CENTRADA y con aire arriba y abajo: es lo unico de esa hoja que se
  // lee de un vistazo, y centrada deja de competir con el encabezado.
  //
  // LOS 34 PUNTOS NO SON UN GUSTO, son la unica medida que hace que la cifra se lea ANTES que el texto que
  // la rodea: a 24 todavia parece un titulo de seccion, y por encima de 40 no cabe con su delta al lado en
  // una hoja carta con estos margenes.
  //
  // SIN CAJA NI FONDO DE COLOR, a proposito: una caja la convertiria en un aviso, y un aviso se lee como
  // alerta. La cifra no alerta de nada, informa; el veredicto es la banda del IAE que va debajo.
  // ══════════════════════════════════════════════════════════════════════════════════════════════════
  cifraBloque: { alignItems: "center", marginTop: 8, marginBottom: 16 },
  cifraRotulo: {
    fontSize: 8,
    color: "#6b7280",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  cifraGrande: { fontSize: 34, fontWeight: "bold", color: MARCA_HONDA },
  /** El IAE con su banda: la unica linea de este bloque que lleva un veredicto, asi que va destacada. */
  cifraDelta: { fontSize: 11, fontWeight: "bold", color: MARCA_TINTA, marginTop: 2 },
  cifraPie: { fontSize: 8, color: "#6b7280", marginTop: 4, textAlign: "center" },
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
