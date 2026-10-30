// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA COHORTE EN BARRAS  ·  (Santiago, 2026-10-30: "el resumen con graficas")
//
// ═══ QUE GRAFICA, Y POR QUE ESTA ═══
//
// El panel ya tenia la tabla de "consultas autorizadas por mes", y una tabla de doce filas contesta bien
// "cuantas hubo en junio" y muy mal la pregunta por la que alguien mira una serie: COMO VA. Dos meses
// flojos seguidos, o el escalon del mes en que entro el lote del HTML, se ven de un golpe y no se leen
// restando filas. La tabla SE QUEDA debajo: la grafica responde la forma, la tabla la cifra exacta, y en
// un panel de investigacion la cifra exacta es lo que se cita.
//
// ═══ SVG A MANO, SIN LIBRERIA ═══
//
// Es el patron de la casa (`serie-linea.tsx`, `dfi-radar.tsx`, `diana.tsx`): tres graficas vivas sin una
// sola dependencia de graficos. Meter una libreria por un grafico de barras serian cientos de kilobytes
// de JavaScript en un panel que hoy es Server Component puro, y dejaria de poder rendirse en el servidor.
//
// CON `viewBox` Y SIN `width` FIJO, que es el defecto que se arreglo al portar `lineFollow`: sin viewBox,
// `max-width: 100%` recorta la ventana pero no encoge el dibujo.
//
// ═══ EL COLOR ES EL DE MARCA, NO EL CLINICO ═══
//
// `BRAND.md` reserva el verde/ambar/rojo para los veredictos clinicos sobre un paciente. Aqui no hay
// veredicto: son consultas contadas. Van en el azul de marca (`--primary`), que es el color que ese
// documento deja libre para estructura y datos.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const ALTO = 150;
const PAD_T = 16;
const PAD_B = 34;
const ANCHO_BARRA = 34;
// El hueco entre barras: una barra pegada a la siguiente se lee como un area, no como una serie.
const HUECO = 10;

export type BarraDeLaCohorte = { etiqueta: string; valor: number };

export function BarrasDeLaCohorte({
  barras,
  ariaLabel,
}: {
  barras: BarraDeLaCohorte[];
  /** Lo que la grafica dice, en palabras: es lo unico que recibe quien usa lector de pantalla. */
  ariaLabel: string;
}) {
  if (barras.length === 0) return null;

  const ancho = barras.length * (ANCHO_BARRA + HUECO) + HUECO;
  const maximo = Math.max(...barras.map((b) => b.valor));
  // ESCALA DESDE CERO, SIEMPRE. Arrancar el eje en el minimo exagera las diferencias, y en una serie de
  // conteos eso es decir algo falso: una barra el doble de alta tiene que ser el doble de consultas.
  const alturaUtil = ALTO - PAD_T - PAD_B;
  const alto = (v: number) => (maximo > 0 ? Math.round((v / maximo) * alturaUtil) : 0);

  return (
    <svg
      viewBox={`0 0 ${ancho} ${ALTO}`}
      className="h-auto w-full max-w-full"
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="xMinYMid meet"
    >
      {/* La linea del suelo: sin ella las barras flotan y no se ve desde donde se miden. */}
      <line
        x1={0}
        y1={ALTO - PAD_B}
        x2={ancho}
        y2={ALTO - PAD_B}
        stroke="currentColor"
        strokeWidth={0.5}
        className="text-border"
      />
      {barras.map((b, i) => {
        const x = HUECO + i * (ANCHO_BARRA + HUECO);
        const h = alto(b.valor);
        const y = ALTO - PAD_B - h;
        return (
          <g key={b.etiqueta}>
            {/* LA CIFRA ENCIMA DE SU BARRA. En una serie corta cabe, y con ella la grafica deja de
                necesitar que se mire la tabla para saber cuanto es. */}
            <text
              x={x + ANCHO_BARRA / 2}
              y={Math.max(y - 4, 9)}
              textAnchor="middle"
              className="fill-muted-foreground text-[9px] tabular-nums"
            >
              {b.valor}
            </text>
            <rect
              x={x}
              y={y}
              width={ANCHO_BARRA}
              // Una barra de altura 0 no se ve y se lee como un mes que falta; con 1 punto se ve que es
              // cero y no un hueco.
              height={Math.max(h, 1)}
              rx={2}
              className="fill-primary"
            />
            <text
              x={x + ANCHO_BARRA / 2}
              y={ALTO - PAD_B + 14}
              textAnchor="middle"
              className="fill-muted-foreground text-[9px]"
            >
              {b.etiqueta}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * LA PROPORCION DE UNA FILA, en una barra dentro de la tabla.
 *
 * POR QUE AQUI Y NO OTRA GRAFICA: las razones por las que una consulta queda fuera son una composicion
 * (suman el total de excluidas), y lo que hay que ver es el PESO de cada una. Una barra en la propia fila
 * lo dice sin sacar al lector de la tabla, y sin estrenar un grafico de torta, que para comparar tamaños
 * es peor que una barra.
 *
 * ES UN `div`, no un SVG: una barra horizontal es un rectangulo con un ancho en porcentaje, y el CSS lo
 * hace mejor (se adapta a la columna y no necesita viewBox).
 */
export function BarraDeProporcion({ valor, total }: { valor: number; total: number }) {
  const pct = total > 0 ? Math.round((valor / total) * 100) : 0;
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted"
        title={`${pct}% de las excluidas`}
      >
        <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </span>
      {/* EL PORCENTAJE EN TEXTO, no solo en la barra: es lo que lee un lector de pantalla, y ademas es lo
          que se cita. La barra es la ayuda de lectura, no el dato. */}
      <span className="tabular-nums text-muted-foreground">{pct}%</span>
    </span>
  );
}
