import { StyleSheet, View } from "@react-pdf/renderer";

// El `Text` que traduce los simbolos que la fuente del PDF no dibuja (ver `text-seguro`).
import { Text } from "./text-seguro";

import { CUERPO_DEL_TITULO, MARCA_AZUL, MARCA_HONDA } from "./estilos-del-pdf";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL ENCABEZADO EN CUADROS  ·  EL MISMO EN LOS TRES DOCUMENTOS  ·  Santiago, 2026-11-05
//
// ═══ DE DONDE SALE ═══
//
// De la jerarquia de la sugerencia que dejo para revisar: una CAJA DE TRES COLUMNAS rotuladas, en vez de
// la lista de filas etiqueta-valor que tenian los tres documentos. Es mas legible y pone la identidad del
// paciente donde la vista cae primero.
//
// Y SU DECISION DE HOY: *"El encabezado nuevo va a los tres documentos (informe, hoja del plan y HC),
// como recomendaste."* La razon por la que se recomendo: un paciente que recibe dos documentos el mismo
// dia no deberia tener que descubrir que son del mismo sistema.
//
// ═══ POR QUE ESTE COMPONENTE TRAE SUS PROPIOS ESTILOS ═══
//
// El informe y la hoja del plan comparten `estilos-del-pdf`; la historia clinica tiene su PROPIA hoja de
// estilo (nacio aparte, con otra escala tipografica). Si el encabezado se compusiera con estilos de la
// hoja de cada documento, "el mismo encabezado" serian tres encabezados parecidos, que es exactamente lo
// que este cambio viene a cerrar. Asi que el bloque es autonomo y de los modulos de marca solo toma los
// dos azules, que es lo unico que debe seguir al brand.
//
// ═══ LA TERCERA CAJA NO ES LA MISMA FECHA EN LOS TRES, Y SE DECLARA ═══
//
// El informe sale de una MEDICION y se fecha por ella; la hoja del plan y la historia clinica salen de la
// CONSULTA. Un rotulo fijo ("FECHA DE MEDICION") obligaria a la hoja del plan a mentir o a dejar la caja
// vacia, asi que el rotulo entra como dato. Lo que NO es opcional es que cada fecha diga CUAL es: el
// informe ya llevaba dos fechas rotuladas desde el smoke del 2026-09-01, porque el paciente puede haberse
// medido un dia y haber sido atendido otro.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Una caja del encabezado: su rotulo en versalitas y su valor debajo. */
export type CuadroDelEncabezado = { rotulo: string; valor: string };

export type DatosDelEncabezado = {
  /** El titulo del documento ("Informe de evaluación bioeléctrica"). */
  titulo: string;
  /**
   * El subtitulo, pequeño, debajo del titulo. Solo el informe lo lleva (Santiago, 2026-11-06): posiciona
   * el modelo sin meter su nombre en el titulo, que es lo que el paciente lee primero.
   */
  subtitulo?: string;
  /**
   * Apaga la firma de CNV de ARRIBA. El informe la baja al pie, donde la pone su maqueta; la hoja del
   * plan y la historia clinica la siguen llevando aqui. La firma no desaparece del documento: cambia de
   * sitio, y por eso esto es una bandera y no un borrado.
   */
  sinFirma?: boolean;
  paciente: string;
  /** "CC 1.020.304". Vacio = no se pudo resolver, y la caja dice que no consta en vez de quedar en blanco. */
  documento: string;
  /** La tercera caja: la fecha que FECHA a este documento, con su rotulo. */
  tercera: CuadroDelEncabezado;
  /** Quien atendio. null = no se pudo resolver, y la linea no sale: no se inventa un autor. */
  profesional?: { nombre: string; profesion: string | null } | null;
  /**
   * EL ROTULO DE ESA LINEA, porque los tres documentos no hablan en el mismo registro. El informe y la
   * hoja del plan se dirigen al paciente y tutean ("Te atendió"); la HISTORIA CLINICA es un documento
   * probatorio que se lee tambien de aqui a quince años, y ahi la linea dice "Profesional". Cambiar el
   * encabezado no es razon para cambiarle el tono a la historia clinica.
   */
  rotuloDelProfesional?: string;
  /** La otra fecha, a la derecha de la linea del profesional. null = este documento solo tiene una. */
  otraFecha?: CuadroDelEncabezado | null;
};

/** El filete de la caja. EXPORTADO para que el candado mida que la caja se dibuja, y no solo que su
 *  texto salga: tres rotulos sueltos se leerian igual en el texto del PDF y no serian una caja. */
// ═══ UN POCO MAS OSCURO DESDE EL 2026-11-07 (Santiago) ═══
//
// Era `#d1d5db`, el gris 300 de la escala. Impreso, la caja de identidad casi desaparecia: un filete de
// 0,75 puntos en gris claro se pierde en el papel y el bloque que sostiene la hoja dejaba de leerse como
// un bloque. Sube al gris 400 (`#9ca3af`) y el filete a 1,1 puntos. No es decoracion: esa caja es lo
// primero que el paciente mira para saber que el documento es suyo.
export const BORDE_DEL_ENCABEZADO = "#9ca3af";
const BORDE = BORDE_DEL_ENCABEZADO;
const ROTULO = "#6b7280";


const estilos = StyleSheet.create({
  titulo: { fontSize: CUERPO_DEL_TITULO, fontWeight: "bold", color: MARCA_HONDA, marginBottom: 8 },
  // CON SUBTITULO EL TITULO NO DEJA AIRE DEBAJO: los dos son un solo bloque, y 8 puntos en medio los
  // leeria como dos cosas distintas.
  // EL `lineHeight` ES LO QUE EVITA QUE EL SUBTITULO SE LE MONTE. Medido sobre el PDF (2026-11-06): el
  // titulo de 18 puntos caia en y=31,8 y el subtitulo en y=44,9, solapandose 4,9 puntos a lo ancho de
  // 306. Una linea grande sin altura declarada no reserva su espacio, y el `marginBottom: 1` de aqui
  // (que es correcto: son un solo bloque) no alcanzaba a separarlos.
  tituloConSubtitulo: {
    fontSize: CUERPO_DEL_TITULO,
    fontWeight: "bold",
    color: MARCA_HONDA,
    lineHeight: 1.2,
    marginBottom: 1,
  },
  subtitulo: { fontSize: 9, color: "#4b5563", lineHeight: 1.3, marginBottom: 8 },
  firma: {
    fontSize: 9,
    color: MARCA_AZUL,
    marginBottom: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  cuadros: { flexDirection: "row", borderWidth: 1.1, borderColor: BORDE, borderRadius: 3 },
  // LAS TRES COLUMNAS SE REPARTEN A PARTES IGUALES y la separacion es un borde interior, no un hueco: con
  // hueco, tres cajas suenan a tres bloques; con un filete, se leen como una sola caja de tres columnas.
  cuadro: { flex: 1, paddingVertical: 6, paddingHorizontal: 8 },
  cuadroConFilete: { borderLeftWidth: 1.1, borderLeftColor: BORDE },
  rotulo: { fontSize: 7, color: ROTULO, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 2 },
  valor: { fontSize: 10 },
  // ═══ UN NOMBRE LARGO SE ENCOGE EN VEZ DE PARTIRSE (2026-11-06) ═══
  //
  // La caja mide unos 165 puntos de ancho util, asi que a 10 puntos caben unos 33 caracteres. Un nombre
  // con dos nombres y dos apellidos pasa de ahi, se parte en DOS LINEAS y la caja entera crece trece
  // puntos. Esos trece puntos son exactamente los que hacian que en el informe de un paciente con nombre
  // largo NO CUPIERA la observacion de su profesional: medido el 2026-11-06, con el nombre mas largo de
  // la cohorte no cabia ni un caracter, y con un nombre normal si.
  //
  // Que la hoja de un paciente lleve o no las palabras de su profesional no puede depender de cuantos
  // apellidos tenga. Asi que el nombre baja de cuerpo hasta donde entre en una linea, con un piso: por
  // debajo de 7,5 puntos deja de leerse, y entonces se parte, que es preferible a no poder leerlo.
  valorLargo: { fontSize: 8.5 },
  valorMuyLargo: { fontSize: 7.5 },
  // LA LINEA DE DEBAJO: quien atendio a la izquierda y la otra fecha a la derecha, en el mismo renglon.
  // UNA SOLA LINEA, no dos extremos: ver el comentario del bloque que la pinta.
  pie: { flexDirection: "row", marginTop: 4, marginBottom: 5 },
  pieTexto: { fontSize: 9, color: "#374151" },
});

/** Lo que dice una caja cuyo dato no se pudo resolver. No se deja en blanco: un hueco se lee como olvido. */
const NO_CONSTA = "No consta";

/**
 * CUANTOS CARACTERES ENTRAN EN UNA LINEA de la caja, por cuerpo de letra. Medido sobre el PDF: la caja
 * tiene unos 165 puntos utiles y la fuente gasta algo menos de medio punto de ancho por caracter.
 * Los dos cortes son los que hacen que el nombre mas largo de la cohorte (47 caracteres) entre en UNA
 * linea; ver la nota de `valorLargo`.
 */
const CABEN_A_10 = 33;
const CABEN_A_85 = 39;

function estiloDelValor(valor: string) {
  if (valor.length <= CABEN_A_10) return estilos.valor;
  if (valor.length <= CABEN_A_85) return estilos.valorLargo;
  return estilos.valorMuyLargo;
}

export function EncabezadoEnCuadros({ datos }: { datos: DatosDelEncabezado }) {
  const cuadros: CuadroDelEncabezado[] = [
    { rotulo: "Paciente", valor: datos.paciente.trim() || NO_CONSTA },
    { rotulo: "Documento", valor: datos.documento.trim() || NO_CONSTA },
    datos.tercera,
  ];
  return (
    <>
      <Text style={datos.subtitulo ? estilos.tituloConSubtitulo : estilos.titulo}>{datos.titulo}</Text>
      {datos.subtitulo ? <Text style={estilos.subtitulo}>{datos.subtitulo}</Text> : null}
      {datos.sinFirma ? null : <Text style={estilos.firma}>Connected Nutrition Ventures</Text>}

      {/* LA CAJA NO SE PARTE ENTRE DOS HOJAS: media caja de identidad no identifica a nadie. */}
      <View style={estilos.cuadros} wrap={false}>
        {cuadros.map((c, i) => (
          <View key={c.rotulo} style={i === 0 ? estilos.cuadro : [estilos.cuadro, estilos.cuadroConFilete]}>
            <Text style={estilos.rotulo}>{c.rotulo}</Text>
            <Text style={estiloDelValor(c.valor.trim() || NO_CONSTA)}>
              {c.valor.trim() || NO_CONSTA}
            </Text>
          </View>
        ))}
      </View>

      {/* ═══ UNA SOLA LINEA CON SEPARADOR, Y NO DOS EXTREMOS (Santiago, 2026-11-07) ═══

          Pidio *"Te atendió: ... · <profesión> · Fecha de la consulta: ..., con el separador"*.

          Antes eran dos textos con `space-between`: quien atendio pegado al margen izquierdo y la fecha
          pegada al derecho, con un vacio de media hoja en medio. En el papel no se leian como una linea
          sino como dos datos sin relacion, y el paciente tenia que cruzar la hoja con la vista para
          juntar "quien" y "cuando". Con el punto medio los tres datos son una frase.

          LAS PIEZAS SE ARMAN FILTRANDO, no concatenando con ternarios: un dato que falta tiene que
          desaparecer CON su separador, y eso escrito a mano deja un " · " huerfano al principio o al
          final, que es la clase de detalle que solo se ve impreso. */}
      <View style={estilos.pie}>
        <Text style={estilos.pieTexto}>
          {[
            datos.profesional
              ? `${datos.rotuloDelProfesional ?? "Te atendió"}: ${datos.profesional.nombre}`
              : null,
            datos.profesional?.profesion ?? null,
            datos.otraFecha ? `${datos.otraFecha.rotulo}: ${datos.otraFecha.valor}` : null,
          ]
            .filter((x): x is string => Boolean(x && x.trim()))
            .join(" · ")}
        </Text>
      </View>
    </>
  );
}
