import { Polygon, Rect, Svg, View } from "@react-pdf/renderer";

import { Text } from "./text-seguro";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL ENCABEZADO Y EL PIE DE LA PLANTILLA DE CNV  ·  2026-11-06
//
// Santiago dejo en `C:\Users\sarro\plantillas-cnv\` (FUERA del repositorio, y ahi se queda) la plantilla
// .docx con la que se decoran los documentos de la casa. De ella salen tres cosas: la franja de colores de
// arriba, los datos del pie y la barra degradada de abajo.
//
// ═══ SE REDIBUJA EN VECTORIAL, NO SE COPIA LA IMAGEN ═══
//
// La plantilla trae la franja como un PNG de 1792x52. Meterlo al repositorio seria meter un recorte de
// mapa de bits que se ve borroso al imprimir y que nadie puede ajustar sin volver a Word. Las medidas
// salieron de leer ese PNG pixel a pixel, y lo que se versiona son las MEDIDAS:
//
//   · navy  #102545  del 1,2 % al 67,5 % del ancho
//   · azul  #205dfd  del 67,9 % al 75,3 %      (es el azul de marca, `MARCA_AZUL`)
//   · cian  #0a76a4  del 75,7 % al 82,8 %
//   · verde #12a990  del 83,1 % al 90,7 %
//   · lima  #78be34  del 91,1 % al 99,1 %
//
// Y LA INCLINACION, medida sobre dos filas del PNG (en la fila 20 el borde cae en x=29 y en la 40 en x=6):
// 1,15 puntos hacia la izquierda por cada punto que se baja. Por eso cada tramo es un PARALELOGRAMO y no
// un rectangulo: el corte diagonal es lo que hace reconocible la franja.
//
// EL PIE, VERBATIM DE LA PLANTILLA (su `footer1.xml`), con su tamaño (8 pt) y su gris (#434343):
//
//   Connected Nutrition Ventures S.A.S. · NIT: 902045562-3 · Medellín, Antioquia
//   Cra 79 #46-36 Oficina 107 Multiplicadores · contacto@cnvsystem.com · www.cnvsystem.com
//
// LA BARRA DEGRADADA del pie va de #205DFD a #00A388 (los dos extremos de su `gradFill`). Se dibuja por
// TRAMOS y no con un degradado de verdad: un degradado de SVG depende de la version del renderizador de
// PDF, y si no lo soporta no falla, DEJA LA BARRA EN BLANCO, que es la peor forma de enterarse. Treinta
// tramos no se distinguen de un degradado a simple vista y salen iguales en cualquier version.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** El ancho de una hoja carta en puntos. La franja sangra de borde a borde, asi que lo necesita. */
export const ANCHO_CARTA = 612;

/** Alto de la franja de arriba. */
export const ALTO_FRANJA = 9;

/** Alto de la barra degradada del pie. */
export const ALTO_BARRA_PIE = 5;

/** Cuanto se corre el borde hacia la izquierda por cada punto de alto (medido sobre el PNG). */
const INCLINACION = 1.15;

/** Los cinco tramos: color y los dos limites en fraccion del ancho, en la MITAD de la altura. */
const TRAMOS: readonly { color: string; desde: number; hasta: number }[] = [
  { color: "#102545", desde: 0.012, hasta: 0.675 },
  { color: "#205dfd", desde: 0.679, hasta: 0.753 },
  { color: "#0a76a4", desde: 0.757, hasta: 0.828 },
  { color: "#12a990", desde: 0.831, hasta: 0.907 },
  { color: "#78be34", desde: 0.911, hasta: 0.991 },
];

/**
 * La franja de colores del borde superior, sangrada de lado a lado.
 *
 * VA `fixed` Y EN ABSOLUTO: tiene que salir en TODAS las hojas y pegada al borde del papel, no dentro del
 * margen.
 *
 * `top: 0` Y NO EL NEGATIVO DEL MARGEN, que es lo que se escribio primero: en @react-pdf un elemento
 * absoluto se coloca contra la HOJA, no contra el area de contenido, asi que restar el margen lo saca del
 * papel. Medido: con `bottom: -42` el pie caia en y=812 sobre una hoja de 792, o sea veinte puntos fuera.
 */
export function FranjaDeMarca() {
  const h = ALTO_FRANJA;
  const corrimiento = INCLINACION * h;
  return (
    <View fixed style={{ position: "absolute", top: 0, left: 0, width: ANCHO_CARTA, height: h }}>
      <Svg width={ANCHO_CARTA} height={h} viewBox={`0 0 ${ANCHO_CARTA} ${h}`}>
        {TRAMOS.map((t) => {
          // En la mitad de la altura el tramo va de `desde` a `hasta`; arriba se corre a la derecha y
          // abajo a la izquierda, la mitad del corrimiento en cada sentido.
          const a = t.desde * ANCHO_CARTA;
          const b = t.hasta * ANCHO_CARTA;
          const d = corrimiento / 2;
          return (
            <Polygon
              key={t.color}
              points={`${a + d},0 ${b + d},0 ${b - d},${h} ${a - d},${h}`}
              fill={t.color}
            />
          );
        })}
      </Svg>
    </View>
  );
}

/** Las dos lineas del pie de la plantilla, verbatim. */
export const PIE_LINEA_1 = "Connected Nutrition Ventures S.A.S. · NIT: 902045562-3 · Medellín, Antioquia";
export const PIE_LINEA_2 =
  "Cra 79 #46-36 Oficina 107 Multiplicadores · contacto@cnvsystem.com · www.cnvsystem.com";

/** El gris del pie en la plantilla (`w:color val="434343"`). */
const GRIS_DEL_PIE = "#434343";

function mezclar(a: string, b: string, t: number): string {
  const c = (s: string, i: number) => parseInt(s.slice(1 + i * 2, 3 + i * 2), 16);
  const v = [0, 1, 2].map((i) => Math.round(c(a, i) + (c(b, i) - c(a, i)) * t));
  return "#" + v.map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** La barra degradada del borde inferior, por tramos (ver la cabecera). */
function BarraDelPie() {
  const n = 30;
  const ancho = ANCHO_CARTA / n;
  return (
    <Svg width={ANCHO_CARTA} height={ALTO_BARRA_PIE} viewBox={`0 0 ${ANCHO_CARTA} ${ALTO_BARRA_PIE}`}>
      {Array.from({ length: n }, (_, i) => (
        <Rect
          key={i}
          x={i * ancho}
          y={0}
          // Medio punto de mas para que no quede una rendija blanca entre tramo y tramo al redondear.
          width={ancho + 0.5}
          height={ALTO_BARRA_PIE}
          fill={mezclar("#205dfd", "#00a388", i / (n - 1))}
        />
      ))}
    </Svg>
  );
}

/**
 * El pie de la plantilla: las dos lineas de datos, el numero de hoja a la derecha y la barra degradada
 * pegada al borde inferior.
 *
 * EL IDENTIFICADOR DEL DOCUMENTO VA AQUI TAMBIEN, en su propia linea pequeña: es lo unico del pie que el
 * paciente puede USAR (es como nombra su informe si llama a preguntar). En el PDF de la paciente real
 * salia pegado al nombre de la empresa en la misma linea, que ademas se veia como parte de la razon
 * social.
 */
export function PieDeLaPlantilla({
  lado,
  identificador,
}: {
  /** El margen lateral de la hoja: el pie sangra de borde a borde y alinea su texto con el contenido. */
  lado: number;
  identificador?: string | null;
}) {
  return (
    <View fixed style={{ position: "absolute", bottom: 0, left: 0, width: ANCHO_CARTA }}>
      <View style={{ paddingHorizontal: lado, paddingBottom: 3 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 7, color: GRIS_DEL_PIE }}>{PIE_LINEA_1}</Text>
          {/* El numero de hoja lo resuelve el renderizador; la plantilla lo pone a la derecha del pie. */}
          <Text
            style={{ fontSize: 7, color: GRIS_DEL_PIE }}
            render={({ pageNumber, totalPages }) => `${pageNumber} de ${totalPages}`}
            fixed
          />
        </View>
        {/* EL IDENTIFICADOR VA EN LA MISMA LINEA QUE LOS DATOS, no en una tercera: una linea mas de pie
            son ocho puntos menos de hoja, y la hoja 1 tiene que caber entera. Sigue estando porque es lo
            unico del pie que el paciente puede USAR si llama a preguntar por su informe. */}
        <Text style={{ fontSize: 7, color: GRIS_DEL_PIE }}>
          {PIE_LINEA_2}
          {identificador ? ` · Informe ${identificador}` : ""}
        </Text>
      </View>
      <BarraDelPie />
    </View>
  );
}
