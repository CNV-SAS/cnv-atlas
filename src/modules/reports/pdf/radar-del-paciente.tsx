import { Circle, G, Line, Polygon, Svg, Text as SvgText, View } from "@react-pdf/renderer";

// El `Text` que traduce los simbolos que la fuente del PDF no dibuja (ver `text-seguro`). `SvgText` SI
// viene del paquete: dentro de un `<Svg>` el texto es otra primitiva y no acepta el envoltorio.
import { Text } from "./text-seguro";

import type { DominioPaciente } from "@/clinical-engine";

// ═══ EL RADAR, EN EL INFORME DEL PACIENTE (Santiago, 2026-09-20) ═══
//
// POR QUE ESTE SI Y LA DIANA NO. La Diana rotula sus ejes con los índices del modelo y su lectura es el
// código de estado ("estado N de 81"): eso es exactamente lo que su §7.1 prohíbe, y la prueba de que la
// prohibición cubre el CONCEPTO y no solo la sigla es que Gildardo retiró hasta "Sector funcional (FyR)",
// que ya era un nombre largo.
//
// EL RADAR NO TIENE ESE PROBLEMA: sus ejes son los cinco dominios del DFI con el nombre que su propio
// `informePaciente` ya le manda al paciente (`dominio: d.nombre`), y la escala son sus cuatro etiquetas
// de paciente ("En equilibrio", "A vigilar", "A trabajar", "Prioritario"). Nada de esto es nuevo: el
// informe YA se las dice escritas, dominio por dominio. Lo único que añade el dibujo es la FORMA.
//
// Y POR ESO NO LLEVA NINGUNA CIFRA: ni el índice de riesgo, ni el número de severidad, ni una escala
// numérica en los anillos. La posición dice lo mismo que la palabra que está al lado.
//
// ═══ LA MISMA FIGURA QUE EL DEL PROFESIONAL, OTRO VOCABULARIO (Santiago, 2026-09-21) ═══
//
// La primera versión tenía anillos pastel con bordes grises, y Santiago pidió el de Atlas TAL CUAL: una sola
// figura, dos vocabularios. Así el paciente y su profesional miran el mismo dibujo en la consulta. Se
// replican de `dfi-radar.tsx` los anillos SÓLIDOS (azul, verde, ámbar y rojo del centro al borde), la
// separación entre bandas con trazo BLANCO (no gris: el gris las hacía ver transparentes), el núcleo blanco,
// el polígono oscuro con sus vértices y la etiqueta de cada eje COLOREADA por su severidad.
//
// LOS HEXADECIMALES SON LOS DE LA CAPA CLINICA (`--clinical-*` en globals.css), escritos aquí porque un PDF no
// lee variables CSS. Son los mismos que pinta la pantalla; si cambian allá, cambian aquí (el candado del
// radar lo comprueba contra globals.css).

/** Ancho del dibujo. EXPORTADO para que el candado de maquetacion calcule el centrado en vez de
 *  escribir el numero: un 56 suelto en un test envejece el dia que el radar cambie de tamano. */
// ═══ EL DIBUJO BAJO UN 8 % EL 2026-11-06, Y CONVIENE SABER POR QUE ═══
//
// Santiago pidio tres cosas que tienen que caber en la MISMA hoja: la figura con sus cinco areas, la
// observacion de la profesional ("se queda") y la nota de interpretacion. Medido sobre el PDF: faltaban
// unos veintidos puntos. Las salidas eran achicar la letra del paciente, quitarle sitio a lo que escribe
// la profesional, o achicar el dibujo. Se eligio el dibujo porque es la unica de las tres que no quita
// NADA: las proporciones, los anillos, los colores y los rotulos son los mismos, solo que un 8 % mas
// pequeños, y sigue ocupando un tercio de la hoja.
//
// SE ESCALA TODO JUNTO (ancho, alto, centro y radio) y NO solo el alto: escalar un eje convertiria los
// anillos en elipses, y la Diana es una figura clinica, no un adorno. Los ROTULOS no escalan, por eso
// `SEPARACION_ROTULO` y `ALTO_LINEA` se quedan como estan: achicar la letra seria volver a lo que esta
// decision evita.
export const ANCHO = 388;
const ALTO = 250;
const CX = 194;
const CY = 132;
const RMAX = 77;
const BANDAS = 4;
/** Alto de línea del rótulo, del que se CALCULA el anclaje del bloque. Una constante, no un número suelto. */
const ALTO_LINEA = 11;
const SEPARACION_ROTULO = 18;

/** Anillos del centro al borde: excellent, optimal, warning, critical (el orden de `BAND_FILL`). */
export const ANILLO_RADAR = ["#0ea5e9", "#10b981", "#f59e0b", "#dc2626"];
/** Color de la etiqueta de cada severidad: optimal, warning, moderate, critical (el orden de `SEV_FILL`). */
export const COLOR_SEVERIDAD = ["#10b981", "#f59e0b", "#ea580c", "#dc2626"];
const TINTA = "#15161a";
const GRIS = "#6b7280";
const BORDE = "#d1d5db";
const BLANCO = "#ffffff";

/** Un punto del eje `i` de `n`, a distancia `r` del centro. El primer eje mira arriba, en sentido horario. */
function punto(i: number, n: number, r: number): [number, number] {
  const a = (-90 + (360 / n) * i) * (Math.PI / 180);
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

function anillo(n: number, r: number): string {
  return Array.from({ length: n }, (_, i) => punto(i, n, r))
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
}

// EL NOMBRE SE PARTE POR EL GUION, que es donde ya trae la juntura ("Celular-Eléctrico"). Mismo criterio que
// el radar del profesional, y por la misma razón: "Epigenético-Contextual" entero se sale de la hoja.
// ═══ Y SIN ARRASTRAR EL GUION AL FINAL DE LA PRIMERA LINEA (Santiago, 2026-11-03, segunda vez) ═══
//
// Lo reporto dos dias seguidos: *"CelularElectrico"*, pegado. La primera vez se MIDIO sobre los bytes del
// PDF y el guion ESTABA: el rotulo salia "Celular-" / "Eléctrico" en dos lineas, correcto. Lo que pasa es
// que los lectores de PDF DES-HIFENAN al copiar (es lo que hacen con cualquier palabra partida al final
// de una linea), asi que al pegarlo sale "CelularEléctrico".
//
// O SEA QUE EL DIBUJO ESTABA BIEN Y LA LECTURA NO, y eso ya es un defecto: si el documento se lee mal al
// copiarlo, se lee mal. No se le puede pedir a un profesional que sepa que su visor miente.
//
// EL ARREGLO ES TIPOGRAFICO Y NO PIERDE NADA: el guion no se dibuja al final de la primera linea. Un
// guion al final de linea solo hace falta cuando se parte UNA PALABRA; "Celular-Eléctrico" son dos
// unidas, y en un rotulo de eje el propio salto ya dice que van juntas. El nombre COMPLETO, con su guion,
// esta tres lineas mas abajo en el detalle por dominio de la misma hoja.
function lineas(nombre: string): string[] {
  const i = nombre.indexOf("-");
  return i < 0 ? [nombre] : [nombre.slice(0, i), nombre.slice(i + 1)];
}

/** La severidad acotada a la escala (0 a 3). */
const acotar = (s: number): number => Math.min(3, Math.max(0, s));

/** El radio del vértice de una severidad: al CENTRO de su banda, como el del profesional. */
const radioDe = (sev: number): number => ((acotar(sev) + 0.5) / BANDAS) * RMAX;

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL RADAR DE EVOLUCION: LA CONSULTA ANTERIOR DEBAJO DE LA DE HOY  ·  Santiago, 2026-11-05
//
// *"Mostrar el radar de evolucion/seguimiento si el paciente tiene una consulta anterior para que compare
// ambas."*
//
// ═══ UNA FIGURA CON DOS POLIGONOS, NO DOS FIGURAS ═══
//
// Dos radares uno al lado del otro obligan a ir y venir entre dos dibujos para ver si una punta se movio,
// que es precisamente lo que el paciente no va a hacer. Superpuestos, el movimiento SE VE: donde la linea
// de hoy esta por dentro de la de antes, mejoro.
//
// ═══ Y SE DISTINGUEN SIN COLOR, porque este documento se fotocopia ═══
//
// La de hoy es la de siempre (tinta gruesa con relleno tenue y vertices rellenos); la anterior es un
// contorno GRIS FINO sin relleno, con vertices huecos. La diferencia es de GROSOR y de RELLENO, no de
// color: impreso en blanco y negro sigue diciendo cual es cual, que es la misma razon por la que las cinco
// filas de debajo repiten el veredicto en texto.
//
// NO SE USA UN TRAZO DISCONTINUO, que seria lo primero que uno haria: el soporte de `strokeDasharray` en
// el SVG de @react-pdf no es algo que convenga dar por hecho en un documento clinico, y un trazo que no
// se dibuje dejaria dos lineas solidas indistinguibles. Grosor y relleno son primitivas que ya usa este
// mismo dibujo.
//
// ═══ LA LEYENDA NO ES OPCIONAL CUANDO HAY DOS FIGURAS ═══
//
// Con un solo poligono la frase llana basta ("cuanto mas cerca del centro, mejor"). Con dos, un paciente
// que no sepa cual es cual puede leer una mejora como un empeoramiento. Asi que la leyenda dice las dos,
// con su fecha, y solo sale cuando de verdad hay dos.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export function RadarDelPaciente({
  dominios,
  anteriores = null,
}: {
  dominios: DominioPaciente[];
  /**
   * La severidad por id de dominio de la consulta ANTERIOR, con su fecha ya formateada. null = consulta
   * inicial, y entonces el dibujo es el de siempre.
   */
  anteriores?: { fecha: string; porDominio: Record<string, number> } | null;
}) {
  // UN DOMINIO SIN DATO NO DIBUJA VERTICE (Gildardo, 2026-08-30 §4). Y si quedan menos de tres medidos no
  // hay figura posible: dos puntos son una raya, y una raya no dice nada de la forma.
  const medidos = dominios.filter((d) => d.sev != null);
  if (dominios.length < 3 || medidos.length < 3) return null;

  const n = dominios.length;
  const vertices = dominios
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => d.sev != null)
    .map(({ d, i }) => punto(i, n, radioDe(d.sev as number)));
  const poligono = vertices.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  // LA FIGURA DE ANTES SOLO SE DIBUJA SI LA ANTERIOR TIENE AL MENOS TRES AREAS, por la misma razon que la
  // de hoy: con dos la "figura" es una raya. Y se alinea POR ID, no por posicion (ver la cabecera del
  // lector): un dominio que entonces no se midio no pone vertice ahora.
  const verticesAntes = anteriores
    ? dominios
        .map((d, i) => ({ sev: anteriores.porDominio[d.id], i }))
        .filter((v): v is { sev: number; i: number } => typeof v.sev === "number")
        .map(({ sev, i }) => punto(i, n, radioDe(sev)))
    : [];
  const hayAntes = anteriores != null && verticesAntes.length >= 3;
  const poligonoAntes = verticesAntes.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  return (
    // CENTRADO EN LA HOJA (Santiago, 2026-10-30). El SVG mide 420 puntos de ancho y la columna de texto
    // de la hoja carta con sus margenes mide 532: colgaba del margen izquierdo con 112 puntos de aire a la
    // derecha, y en una hoja cuyo unico contenido es la figura eso se ve como un error de maquetacion.
    // Centra el `alignItems` del contenedor y no un margen calculado: si manana cambia ANCHO, sigue
    // centrado sin que nadie se acuerde de recalcular nada.
    <View wrap={false} style={{ alignItems: "center" }}>
      <Svg width={ANCHO} height={ALTO}>
        {/* Las bandas del borde al centro, para que cada una cubra a la de afuera. El trazo BLANCO es lo
            que las separa: sin él, dos colores sólidos contiguos se leen como uno solo. */}
        {[3, 2, 1, 0].map((k) => (
          <Polygon
            key={`banda${k}`}
            points={anillo(n, ((k + 1) / BANDAS) * RMAX)}
            fill={ANILLO_RADAR[k]}
            stroke={BLANCO}
            strokeWidth={1.5}
          />
        ))}
        <Polygon points={anillo(n, RMAX * 0.14)} fill={BLANCO} stroke={BLANCO} strokeWidth={1.5} />
        <Polygon points={anillo(n, RMAX)} fill="none" stroke={BORDE} strokeWidth={1} />
        {dominios.map((d, i) => {
          const [x, y] = punto(i, n, RMAX);
          return <Line key={`radio-${d.id}`} x1={CX} y1={CY} x2={x} y2={y} stroke={BORDE} strokeWidth={1} />;
        })}

        {/* LA FIGURA DE LA CONSULTA ANTERIOR VA DEBAJO de la de hoy: la de hoy es la que el paciente tiene
            que leer, y si quedara tapada por un contorno la comparación habría cambiado de protagonista. */}
        {hayAntes ? (
          <>
            <Polygon points={poligonoAntes} fill="none" stroke={GRIS} strokeWidth={1.25} />
            {verticesAntes.map(([x, y], k) => (
              <Circle
                key={`antes${k}`}
                cx={x}
                cy={y}
                r={2.5}
                fill={BLANCO}
                stroke={GRIS}
                strokeWidth={1.25}
              />
            ))}
          </>
        ) : null}

        {/* La figura del paciente: línea oscura con relleno tenue, encima de los anillos. */}
        <Polygon points={poligono} fill={TINTA} fillOpacity={0.12} stroke={TINTA} strokeWidth={2} />
        {vertices.map(([x, y], k) => (
          <Circle key={`v${k}`} cx={x} cy={y} r={3.5} fill={TINTA} stroke={BLANCO} strokeWidth={1.5} />
        ))}

        {dominios.map((d, i) => {
          const [lx, ly] = punto(i, n, RMAX + SEPARACION_ROTULO);
          const filas = lineas(d.dominio);
          // EL BLOQUE SE ANCLA POR EL LADO QUE MIRA AL CENTRO, que es el arreglo del radar de Atlas
          // (2026-09-09): arriba se sube el bloque entero para que su ÚLTIMA línea quede en el eje, abajo
          // crece hacia afuera y a los lados se centra. Sin esto, el rótulo de arriba ("Celular-Eléctrico /
          // A trabajar") crecía hacia abajo y quedaba montado sobre la figura.
          const angulo = (-90 + (360 / n) * i) * (Math.PI / 180);
          const seno = Math.sin(angulo);
          const coseno = Math.cos(angulo);
          const total = filas.length + 1; // el nombre más la etiqueta
          const inicio =
            seno < -0.3
              ? ly - (total - 1) * ALTO_LINEA
              : seno > 0.3
                ? ly + ALTO_LINEA * 0.6
                : ly - ((total - 1) * ALTO_LINEA) / 2;
          const ancla = coseno > 0.3 ? "start" : coseno < -0.3 ? "end" : "middle";
          return (
            <G key={`rotulo-${d.id}`}>
              {filas.map((fila, k) => (
                <SvgText
                  key={fila}
                  x={lx}
                  y={inicio + k * ALTO_LINEA}
                  style={{ fontSize: 9, fontFamily: "Helvetica" }}
                  fill={TINTA}
                  textAnchor={ancla}
                >
                  {fila}
                </SvgText>
              ))}
              {/* LA ETIQUETA CON SU COLOR, como la del profesional: así la parte que pide trabajo salta a
                  la vista sin leer las cinco. Y va en texto, no solo en la posición: impreso en blanco y
                  negro sigue diciendo lo mismo. Un pelo más de hueco para que no se lea como tercera línea
                  del nombre. */}
              <SvgText
                x={lx}
                y={inicio + filas.length * ALTO_LINEA + 1.5}
                style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold" }}
                fill={d.sev == null ? GRIS : COLOR_SEVERIDAD[acotar(d.sev)]}
                textAnchor={ancla}
              >
                {d.nivel ?? "sin dato"}
              </SvgText>
            </G>
          );
        })}
      </Svg>
      <Text style={{ fontSize: 8, color: GRIS, marginTop: 2, textAlign: "center" }}>
        Cada punta es una parte de tu salud. Cuanto más cerca del centro, mejor estás en esa parte: la figura
        pequeña es la que buscamos.
      </Text>
      {/* LA LEYENDA DE LAS DOS FIGURAS, solo cuando hay dos. Y DICE QUE SIGNIFICA ESTAR POR DENTRO, que es
          lo único que convierte el dibujo en una comparación: sin esa frase, el paciente ve dos formas y no
          sabe cuál de las dos es la buena noticia. */}
      {hayAntes && anteriores ? (
        <Text style={{ fontSize: 8, color: GRIS, marginTop: 2, textAlign: "center" }}>
          La figura de línea gruesa es tu medición de ahora; la de línea delgada es la de tu consulta del{" "}
          {anteriores.fecha}. Donde la de ahora quedó por dentro de la otra, esa parte mejoró.
        </Text>
      ) : null}
    </View>
  );
}
