
import { SEV_LABEL } from "../severity-labels";
import { SEV_FILL } from "./risk-severity";

// Radar de los 5 dominios del DFI (Diagnostico Funcional Integral): una lectura de forma, de un
// vistazo, de la severidad por dominio. Cada eje es un dominio; el radio es la severidad (0 al
// centro = optimo, 3 en el borde = alto), coherente con la Diana (exterior = mayor riesgo). Los
// datos vienen del snapshot inmutable (computeDFI congelado); esto es presentacion pura. El fondo
// muestra las 4 ZONAS de severidad del MOTOR (no las 5 del render del HTML): color de riesgo de la
// paleta clinica BRAND, reservado para severidad. Accesible: la severidad tambien va en texto
// (etiqueta por eje, leyenda y aria-label), no solo en el color. Server component puro, theme-aware.

// EL LIENZO CRECE CON EL `max-w`, EN LA MISMA PROPORCION (2026-09-09). Es lo que hace que los nombres
// completos quepan sin que el poligono se encoja: 360x300 a 36rem daba escala 1,6, y 420x330 a 42rem da
// exactamente la misma. Si solo se ensancha el viewBox, el dibujo se hace mas pequeño al mismo ancho
// renderizado, que es justo lo contrario de lo que se pidio.
const SIZE_W = 420;
const SIZE_H = 330;
const CX = 210;
const CY = 150;
const RMAX = 95;
const BANDS = 4; // niveles de severidad del motor: 0 Optimo, 1 Leve, 2 Moderado, 3 Alto

// NOMBRES COMPLETOS DESDE EL 2026-09-09 (Santiago: "en vez de Enveje. que diga Envejecimiento").
//
// Antes se usaban los cortos de su `_RAD_SHORT` ("Enveje.", "Epigenét."). No se pierde nada suyo: los
// largos son TAMBIEN suyos, salen del motor congelado (`engine.dfi.js`, `nombre` de cada dominio) y
// llegan aqui en `d.nombre`. Lo que se retira es la ABREVIATURA, que existia porque su radar es pequeño;
// con el nuestro a 42rem esa razon ya no aplica.
//
// SE PARTEN POR EL GUION, que es donde el nombre ya trae la juntura ("Celular-Eléctrico" ->
// "Celular-" / "Eléctrico"). Sin partirlos, "Epigenético-Contextual" en el vertice izquierdo se sale del
// lienzo, y ensanchar el lienzo para que quepan en una linea obligaria a un `max-w` mayor que el de la
// Diana. "Envejecimiento" no lleva guion y se queda en una linea.
function lineasDelNombre(nombre: string): string[] {
  const i = nombre.indexOf("-");
  return i < 0 ? [nombre] : [nombre.slice(0, i + 1), nombre.slice(i + 1)];
}
// Vocabulario de severidad del MOTOR: fuente unica compartida (severity-labels), la misma que usan
// las tarjetas del DFI, para que no puedan divergir.
// Anillos de fondo por severidad, SOLIDOS (no el fill claro -bg), replicando radar-antiguo.png: centro
// blanco (excepcional, que no clasificamos: queda como nucleo decorativo) y luego azul/verde/amarillo/rojo
// del centro al borde (Bajo/Leve/Moderado/Alto). El AZUL se conserva SOLO aqui (en el radar es ESCALA, no
// clasificacion; los badges usan semaforo, decision Santiago 2026-08-15). "A menor poligono, mejor estado".
const BAND_FILL = [
  "fill-clinical-excellent", // Bajo (anillo interno, azul)
  "fill-clinical-optimal", // Leve (verde)
  "fill-clinical-warning", // Moderado (amarillo/ambar)
  "fill-clinical-critical", // Alto (anillo externo, rojo)
];
// Cuadro de color solido para la leyenda (color = severidad, nunca decorativo).
const SWATCH = [
  "bg-clinical-excellent",
  "bg-clinical-optimal",
  "bg-clinical-warning",
  "bg-clinical-critical",
];

function clampSev(s: number): number {
  return Math.min(3, Math.max(0, s));
}

// UN DOMINIO SIN DATO NO DIBUJA VERTICE (Gildardo 2026-08-30 §4: "sin dato, el dominio no puntúa y el
// radar no dibuja ese vértice"). Y la forma de no dibujarlo importa: si se le pusiera severidad 0 el
// vértice caería EN EL CENTRO, que es óptimo, y el radar afirmaría de un golpe lo contrario de lo que
// pasa. Lo que se hace es SALTAR el eje: el polígono se cierra entre los medidos (una cuerda que cruza
// el eje sin tocarlo), el eje se conserva en su sitio y se rotula "sin dato".
function poligonoDeMedidos(ds: RadarDomain[], n: number): { pts: [number, number][]; poly: string } {
  const pts = ds
    .map((d, i) => [d, i] as const)
    .filter(([d]) => d.sev != null)
    .map(([d, i]) => axisPoint(i, n, ((clampSev(d.sev as number) + 0.5) / BANDS) * RMAX));
  return { pts, poly: pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ") };
}

// Punto en el eje i (0..n-1), a un radio dado. Eje 0 arriba, luego en sentido horario.
function axisPoint(i: number, n: number, r: number): [number, number] {
  const a = (-90 + (360 / n) * i) * (Math.PI / 180);
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

// Pentagono de los n ejes a un radio dado, como string de puntos.
function ringPoly(n: number, r: number): string {
  return Array.from({ length: n }, (_, i) => axisPoint(i, n, r))
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
}

/** `sev` null = el dominio no se midió. No es 0: 0 es óptimo. */
export type RadarDomain = { id: string; nombre: string; sev: number | null };

export function DfiRadar({
  domains,
  /**
   * SEGUNDO poligono, para el radar comparativo de Seguimiento (2026-08-25): el estado INICIAL debajo del
   * actual. Se dibuja punteado y sin relleno, para que el actual siga siendo el que se lee primero. Se
   * porta su eleccion de comparar inicial contra ultima; las mediciones del medio viven en las series, que
   * si muestran todos los puntos.
   */
  comparar,
  /** Fechas de los dos polígonos, para la leyenda. Solo se usan cuando hay comparación. */
  fechaComparar,
  fechaActual,
}: {
  // El radar solo usa id, nombre y sev: pedir el DfiDomain entero obligaria a los llamadores a arrastrar
  // lectura, clasif e items, que aqui no se pintan (el de Seguimiento los saca del snapshot sellado).
  domains: RadarDomain[];
  comparar?: RadarDomain[];
  fechaComparar?: string;
  fechaActual?: string;
}) {
  const n = domains.length;

  // Poligono de datos: cada vertice al centro de su zona de severidad ((sev+0.5)/BANDS), como en el
  // radar del HTML, para que el punto caiga dentro de la banda y no sobre su borde.
  const { pts: dataPts, poly: dataPoly } = poligonoDeMedidos(domains, n);

  // El poligono de comparacion se alinea por INDICE con el actual: los dominios llegan en el mismo orden
  // del motor. Si por cualquier via llegara con otra longitud, no se dibuja antes que dibujar un poligono
  // que mezcla ejes.
  const cmpPts =
    comparar && comparar.length === n
      ? poligonoDeMedidos(comparar, n).pts
      : null;
  const cmpPoly = cmpPts?.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ") ?? null;

  const label = `Radar funcional: ${domains
    .map((d) => `${d.nombre} ${d.sev == null ? "sin dato" : SEV_LABEL[clampSev(d.sev)]}`)
    .join(", ")}.${
    cmpPts
      ? ` Comparado con el estado inicial: ${comparar!
          .map((d) => `${d.nombre} ${d.sev == null ? "sin dato" : SEV_LABEL[clampSev(d.sev)]}`)
          .join(", ")}.`
      : ""
  }`;

  return (
    // `w-full` EN LA FIGURA, y esto es lo que de verdad limitaba el tamaño (2026-09-09). Es EXACTAMENTE
    // lo que le paso a la Diana en el cotejo del 6: los dos contenedores del radar son
    // `flex flex-col items-center`, y `items-center` hace que el hijo se encoja a su CONTENIDO en vez de
    // estirarse. Con la figura encogida, el `max-w` del SVG no podia mandar nunca: subir la cifra sola no
    // habria hecho nada visible. Primero el `w-full`, y entonces el ancho real lo pone el `max-w` de abajo.
    <figure className="flex w-full flex-col items-center gap-2">
      <svg
        viewBox={`0 0 ${SIZE_W} ${SIZE_H}`}
        role="img"
        aria-label={label}
        // Escala a su columna (el viewBox conserva la geometria); sin width/height fijos en px. max-w algo
        // mayor que la Diana por su aspecto mas ancho (360x300). Asi el radar reclama su mitad del grid.
        // 42rem. Fueron 24 -> 36 ("se ve algo pequeño") y ahora 36 -> 42, que NO agranda el poligono: el
        // viewBox crecio en la misma proporcion para alojar los nombres completos, asi que el dibujo
        // conserva exactamente la escala que Santiago dio por buena. Sigue por debajo de la Diana (50rem).
        className="h-auto w-full max-w-[42rem]"
      >
        {/* Zonas de fondo por severidad: pentagonos concentricos del exterior (peor) al centro (mejor),
            pintados en ese orden para que cada zona interior cubra a la de afuera. Cada banda lleva un
            borde del color del fondo (stroke-background) para SEPARAR las zonas: sin el, los fills claros
            se difuminan entre si y no se ve donde termina una y empieza otra (decision "solido" de
            Santiago, sobre el sombreado transparente que confundia las bandas). */}
        {[3, 2, 1, 0].map((k) => (
          <polygon
            key={`band${k}`}
            points={ringPoly(n, ((k + 1) / BANDS) * RMAX)}
            className={`${BAND_FILL[k]} stroke-background`}
            strokeWidth={1.5}
          />
        ))}
        {/* Nucleo blanco central (excepcional): el centro de radar-antiguo.png es blanco, no azul. No lo
            clasificamos (nuestra escala arranca en Bajo), asi que queda como nucleo decorativo. */}
        <polygon points={ringPoly(n, RMAX * 0.14)} className="fill-background stroke-background" strokeWidth={1.5} />
        {/* Contorno exterior + radios */}
        <polygon points={ringPoly(n, RMAX)} fill="none" className="stroke-border" strokeWidth={1} />
        {domains.map((_, i) => {
          const [x, y] = axisPoint(i, n, RMAX);
          return <line key={`spoke${i}`} x1={CX} y1={CY} x2={x} y2={y} className="stroke-border" strokeWidth={1} />;
        })}
        {/* Poligono del paciente: linea OSCURA + puntos, encima de los anillos solidos (como la imagen). No
            se colorea por el riesgo integrado (eso lo dice el badge de riesgo aparte): aqui es la FORMA. */}
        {/* El INICIAL va primero (debajo) y punteado: el actual es el que se lee. */}
        {cmpPoly ? (
          <polygon
            points={cmpPoly}
            fill="none"
            className="stroke-muted-foreground"
            strokeWidth={1.6}
            strokeDasharray="5 4"
          />
        ) : null}
        <polygon
          points={dataPoly}
          className="fill-foreground stroke-foreground"
          fillOpacity={0.12}
          strokeWidth={2}
        />
        {/* Vertices: punto oscuro con borde claro, para que resalten sobre cualquier banda. */}
        {dataPts.map(([x, y], i) => (
          <circle key={`v${i}`} cx={x} cy={y} r={3.5} className="fill-foreground stroke-background" strokeWidth={1.5} />
        ))}
        {/* Etiquetas de eje: nombre corto fiel del HTML + severidad (vocabulario del motor). */}
        {domains.map((d, i) => {
          // MAS AIRE ENTRE EL POLIGONO Y EL ROTULO: eran 14 y "Celular / bajo" quedaba pegado al borde
          // exterior del anillo (Santiago, con captura). Con 22 la etiqueta se lee como rotulo del eje y
          // no como parte del dibujo.
          const [lx, ly] = axisPoint(i, n, RMAX + 22);
          const lineas = lineasDelNombre(d.nombre);
          const cos = Math.cos((-90 + (360 / n) * i) * (Math.PI / 180));
          const anchor = cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";
          return (
            <text
              key={`lbl${i}`}
              x={lx}
              y={ly}
              textAnchor={anchor}
              dominantBaseline="middle"
              className="fill-foreground"
              fontSize={12}
            >
              {lineas.map((linea, j) => (
                <tspan key={linea} x={lx} dy={j === 0 ? 0 : 13}>
                  {linea}
                </tspan>
              ))}
              {/* El NIVEL del dominio va coloreado por severidad, como en su radar: asi el dominio malo
                  salta a la vista sin leer los cinco. Mismo semaforo que los badges de las tarjetas
                  (SEV_FILL sale de risk-severity, la misma fuente unica), NO la escala del radar: los
                  anillos son ESCALA de fondo y esto es CLASIFICACION, que es lo que el badge dice. */}
              <tspan
                x={lx}
                dy={14}
                className={d.sev == null ? "fill-muted-foreground" : SEV_FILL[clampSev(d.sev)]}
                fontSize={11}
                fontWeight={700}
              >
                {d.sev == null ? "sin dato" : SEV_LABEL[clampSev(d.sev)]}
              </tspan>
            </text>
          );
        })}
      </svg>
      {/* LEYENDA del radar comparativo (porte: su pantalla la tiene, con muestra de linea y fecha). Sin
          ella el punteado no significa nada para quien no sepa que es la inicial: el profesional ve dos
          poligonos y no sabe cual es cual. */}
      {cmpPoly ? (
        <figcaption className="flex flex-col items-center gap-1">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <span className="inline-block w-5 border-t-[3px] border-dashed border-muted-foreground" />
              Inicial{fechaComparar ? ` · ${fechaComparar}` : ""}
            </span>
            <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <span className="inline-block w-5 border-t-[3px] border-solid border-foreground" />
              Actual{fechaActual ? ` · ${fechaActual}` : ""}
            </span>
          </div>
          <span className="text-center text-sm text-muted-foreground">
            A menor polígono, mejor estado funcional.
          </span>
        </figcaption>
      ) : null}
      {/* Leyenda de las 4 zonas de severidad con su color (vocabulario del motor). */}
      {/* LA ESCALA Y LAS NOTAS, UN ESCALON MAS GRANDES (Santiago, 2026-09-09): estaban en 10px y `text-xs`,
          que con el radar pequeño pasaba y con el grande se leen como letra menuda al pie de una figura que
          ya no lo es. La escala pasa a `text-xs` y las notas a `text-sm`, que es el tamaño del cuerpo. */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {SEV_LABEL.map((z, k) => (
          <span key={z} className="inline-flex items-center gap-1">
            <span className={`size-2.5 rounded-[2px] ${SWATCH[k]}`} aria-hidden />
            {z}
          </span>
        ))}
      </div>
      <figcaption className="text-center text-sm text-muted-foreground">
        A menor polígono, mejor estado.
      </figcaption>
    </figure>
  );
}
