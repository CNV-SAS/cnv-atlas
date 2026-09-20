import { G, Line, Polygon, Polyline, Svg, Text as SvgText, View, Text } from "@react-pdf/renderer";

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
// informe YA se las dice escritas, dominio por dominio. Lo único que añade el dibujo es la FORMA, que es
// lo que deja ver de un golpe dónde está el trabajo.
//
// Y POR ESO NO LLEVA NINGUNA CIFRA: ni el índice de riesgo, ni el número de severidad, ni una escala
// numérica en los anillos. La posición dice lo mismo que la palabra que está al lado.
//
// "A MENOR POLIGONO, MEJOR ESTADO", igual que el radar del profesional: el centro es equilibrio y el
// borde es prioritario. Se conserva esa orientación a propósito, para que el paciente y su profesional
// estén mirando la misma figura.

const ANCHO = 420;
const ALTO = 250;
const CX = 210;
const CY = 118;
const RMAX = 84;
/** Los cuatro escalones de la escala del paciente. */
const BANDAS = 4;

// LOS ANILLOS, DEL CENTRO AL BORDE. Son los mismos cuatro colores de la escala clínica (verde = en
// equilibrio, rojo = prioritario), en el orden en que el radar del profesional los pinta. El color aquí es
// ESCALA, no veredicto suelto: cada anillo tiene su palabra debajo, en la leyenda.
const ANILLO = ["#e8f3ec", "#eaf2fb", "#fdf1dd", "#fbe4e1"];
const BORDE = "#d4d8e0";
const LINEA_POLIGONO = "#1f3a68";

/** Un punto del eje `i` de `n`, a distancia `r` del centro. El primer eje mira arriba. */
function punto(i: number, n: number, r: number): [number, number] {
  const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

function anillo(nivel: number, n: number): string {
  const r = ((nivel + 1) / BANDAS) * RMAX;
  return Array.from({ length: n }, (_, i) => punto(i, n, r))
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
}

// EL NOMBRE SE PARTE POR EL GUION, que es donde ya trae la juntura ("Celular-Eléctrico"). Sin partirlo,
// "Epigenético-Contextual" en el vértice izquierdo se sale de la hoja. Es el mismo criterio que el radar
// del profesional, y por la misma razón.
function lineas(nombre: string): string[] {
  const i = nombre.indexOf("-");
  return i < 0 ? [nombre] : [nombre.slice(0, i + 1), nombre.slice(i + 1)];
}

/** Dónde anclar el texto de un eje, según de qué lado del círculo cae. */
function anclaje(x: number): "start" | "middle" | "end" {
  if (x > CX + 12) return "start";
  if (x < CX - 12) return "end";
  return "middle";
}

export function RadarDelPaciente({ dominios }: { dominios: DominioPaciente[] }) {
  // UN DOMINIO SIN DATO NO DIBUJA VERTICE (Gildardo, 2026-08-30 §4). Y si quedan menos de tres medidos no
  // hay figura posible: dos puntos son una raya, y una raya no dice nada de la forma.
  const medidos = dominios.filter((d) => d.sev != null);
  if (dominios.length < 3 || medidos.length < 3) return null;

  const n = dominios.length;
  // El vértice se pone a MEDIA banda del escalón, para que "En equilibrio" no caiga en el centro exacto
  // (invisible) ni "Prioritario" sobre el borde.
  const vertices = dominios
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => d.sev != null)
    .map(({ d, i }) => punto(i, n, (((d.sev as number) + 0.5) / BANDAS) * RMAX));

  return (
    <View>
      <Svg width={ANCHO} height={ALTO}>
        {/* Los anillos, del más externo al más interno, para que el de dentro quede encima. */}
        {[3, 2, 1, 0].map((nivel) => (
          <Polygon key={nivel} points={anillo(nivel, n)} fill={ANILLO[nivel]} stroke={BORDE} strokeWidth={0.6} />
        ))}

        {/* Un eje por dominio, con su nombre al final. */}
        {dominios.map((d, i) => {
          const [ex, ey] = punto(i, n, RMAX);
          const [tx, ty] = punto(i, n, RMAX + 14);
          const filas = lineas(d.dominio);
          return (
            <G key={d.id}>
              <Line x1={CX} y1={CY} x2={ex} y2={ey} stroke={BORDE} strokeWidth={0.6} />
              {filas.map((fila, k) => (
                <SvgText
                  key={fila}
                  x={tx}
                  y={ty + k * 10 - (filas.length - 1) * 4}
                  style={{ fontSize: 8, fontFamily: "Helvetica" }}
                  fill="#1a1a2e"
                  textAnchor={anclaje(tx)}
                >
                  {fila}
                </SvgText>
              ))}
              {/* LA ETIQUETA VA EN TEXTO, no solo en la posición: un radar leído por alguien que no
                  distingue los colores, o impreso en blanco y negro, tiene que seguir diciendo lo mismo. */}
              <SvgText
                x={tx}
                y={ty + filas.length * 10 - (filas.length - 1) * 4}
                style={{ fontSize: 7, fontFamily: "Helvetica" }}
                fill="#6b7280"
                textAnchor={anclaje(tx)}
              >
                {d.nivel ?? "sin dato"}
              </SvgText>
            </G>
          );
        })}

        {/* La figura. Cerrada sobre sí misma: se repite el primer vértice. */}
        <Polyline
          points={[...vertices, vertices[0]].map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}
          fill="none"
          stroke={LINEA_POLIGONO}
          strokeWidth={1.4}
        />
      </Svg>
      <Text style={{ fontSize: 8, color: "#6b7280", marginTop: 2 }}>
        Cada punta es una parte de tu salud. Cuanto más cerca del centro, mejor estás en esa parte: la
        figura pequeña es la que buscamos. Lo que queda hacia afuera es donde vas a trabajar con tu
        profesional.
      </Text>
    </View>
  );
}
