import { Circle, G, Line, Polygon, Svg, Text as SvgText, View, Text } from "@react-pdf/renderer";

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

const ANCHO = 420;
const ALTO = 272;
const CX = 210;
const CY = 144;
const RMAX = 84;
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
function lineas(nombre: string): string[] {
  const i = nombre.indexOf("-");
  return i < 0 ? [nombre] : [nombre.slice(0, i + 1), nombre.slice(i + 1)];
}

/** La severidad acotada a la escala (0 a 3). */
const acotar = (s: number): number => Math.min(3, Math.max(0, s));

export function RadarDelPaciente({ dominios }: { dominios: DominioPaciente[] }) {
  // UN DOMINIO SIN DATO NO DIBUJA VERTICE (Gildardo, 2026-08-30 §4). Y si quedan menos de tres medidos no
  // hay figura posible: dos puntos son una raya, y una raya no dice nada de la forma.
  const medidos = dominios.filter((d) => d.sev != null);
  if (dominios.length < 3 || medidos.length < 3) return null;

  const n = dominios.length;
  // El vértice al CENTRO de su banda, como el del profesional: "En equilibrio" no cae en el centro exacto
  // (invisible) ni "Prioritario" sobre el borde.
  const vertices = dominios
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => d.sev != null)
    .map(({ d, i }) => punto(i, n, ((acotar(d.sev as number) + 0.5) / BANDAS) * RMAX));
  const poligono = vertices.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  return (
    <View wrap={false}>
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
    </View>
  );
}
