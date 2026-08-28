import { formatDateOnlyShort } from "@/lib/format/date";

// GRAFICO DE SERIE de seguimiento. Porte del `lineFollow` de su archivo, con su semaforo de tramo (verde
// si el punto se acerca al objetivo, rojo si se aleja, neutro si no cambia) y su linea de referencia.
//
// ARREGLO de su defecto (verificado 2026-08-25): el suyo emite el SVG con `width` fijo de 560 y
// `overflow: visible`, SIN `viewBox`. Sin viewBox, `maxWidth: 100%` recorta la ventana pero NO encoge el
// dibujo, y `overflow: visible` deja que lo que sobra se pinte encima del grafico vecino. Aqui el viewBox
// hace que escale con su columna, que es lo que la ausencia impedia.

const W = 560;
const H = 210;
const PAD_L = 52;
const PAD_R = 22;
const PAD_T = 22;
const PAD_B = 46;
const IW = W - PAD_L - PAD_R;
const IH = H - PAD_T - PAD_B;

export type PuntoLinea = { fecha: string; valor: number };

function fmt(v: number): string {
  return Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(3);
}

export function SerieLinea({
  puntos,
  referencia,
  referenciaLabel,
  /**
   * Direccion de la mejora cuando NO hay `referencia`: true = subir mejora, false = bajar mejora.
   * `null` = NO SE SABE, y entonces ningun tramo se colorea (todo neutro).
   *
   * El null existe por la capacitancia (Gildardo 2026-08-27 §9): "mejorar es acercarse a la mediana de
   * su grupo, no subir... por encima de P95, seguir subiendo es una señal, no una mejoria". Hasta que la
   * mediana de CAP_REF este cableada, pintar de verde el tramo que sube afirmaria justo lo que el
   * retiro. Se ignora cuando hay `referencia`: ahi mejora SIEMPRE es acercarse.
   */
  subirEsMejor = true,
  ariaLabel,
}: {
  puntos: PuntoLinea[];
  referencia?: number;
  referenciaLabel?: string;
  subirEsMejor?: boolean | null;
  ariaLabel: string;
}) {
  if (puntos.length === 0) return null;

  const vals = puntos.map((p) => p.valor);
  let minV = Math.min(...vals);
  let maxV = Math.max(...vals);
  if (referencia != null) {
    minV = Math.min(minV, referencia);
    maxV = Math.max(maxV, referencia);
  }
  const span = maxV - minV || 1;
  minV -= span * 0.15;
  maxV += span * 0.15;

  const xOf = (i: number) => (puntos.length === 1 ? PAD_L + IW / 2 : PAD_L + (i * IW) / (puntos.length - 1));
  const yOf = (v: number) => PAD_T + IH - ((v - minV) / (maxV - minV)) * IH;

  const ticks = [0, 1, 2, 3, 4].map((t) => {
    const tv = minV + ((maxV - minV) * t) / 4;
    return { v: tv, y: yOf(tv) };
  });

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={ariaLabel}
        // El viewBox es el arreglo: el dibujo escala con su columna en vez de desbordarse sobre el vecino.
        className="h-auto w-full"
      >
        {ticks.map((t) => (
          <g key={t.y}>
            <line x1={PAD_L} y1={t.y} x2={W - PAD_R} y2={t.y} className="stroke-border" strokeWidth={1} />
            <text
              x={PAD_L - 8}
              y={t.y + 3}
              textAnchor="end"
              className="fill-muted-foreground"
              fontSize={9}
            >
              {fmt(t.v)}
            </text>
          </g>
        ))}

        {referencia != null ? (
          <>
            <line
              x1={PAD_L}
              y1={yOf(referencia)}
              x2={W - PAD_R}
              y2={yOf(referencia)}
              className="stroke-primary"
              strokeWidth={1.2}
              strokeDasharray="5 3"
            />
            <text
              x={W - PAD_R}
              y={yOf(referencia) - 4}
              textAnchor="end"
              className="fill-primary"
              fontSize={9}
              fontWeight={700}
            >
              {referenciaLabel ?? `objetivo ${referencia}`}
            </text>
          </>
        ) : null}

        {puntos.map((p, i) => {
          if (i === 0) return null;
          const prev = puntos[i - 1];
          const delta = p.valor - prev.valor;
          // Sin cambio: NEUTRO, no verde ni rojo. Un valor que no se mueve puede ser estabilidad o un
          // cambio por debajo de lo que la medicion distingue, y no tenemos el cambio minimo detectable
          // (P 9.1 de la ronda). Colorearlo afirmaria mas de lo que sabemos.
          const igual = Math.abs(delta) < 1e-9;
          // SIN CRITERIO DE DIRECCION (subirEsMejor null y sin referencia): todo neutro. No es lo mismo
          // que "no cambio": es que no sabemos si moverse hacia alla es mejorar, y el color no puede
          // inventarlo.
          const sinCriterio = referencia == null && subirEsMejor == null;
          const mejora =
            referencia != null
              ? Math.abs(p.valor - referencia) < Math.abs(prev.valor - referencia)
              : subirEsMejor
                ? delta > 0
                : delta < 0;
          const cls =
            igual || sinCriterio
              ? "stroke-muted-foreground"
              : mejora
                ? "stroke-clinical-optimal"
                : "stroke-clinical-critical";
          return (
            <line
              key={`s${p.fecha}`}
              x1={xOf(i - 1)}
              y1={yOf(prev.valor)}
              x2={xOf(i)}
              y2={yOf(p.valor)}
              className={cls}
              strokeWidth={2.6}
              strokeLinecap="round"
            />
          );
        })}

        {puntos.map((p, i) => (
          <g key={`p${p.fecha}`}>
            <circle cx={xOf(i)} cy={yOf(p.valor)} r={4} className="fill-primary" />
            <text
              x={xOf(i)}
              y={yOf(p.valor) - 10}
              textAnchor="middle"
              className="fill-foreground"
              fontSize={9}
              fontWeight={600}
            >
              {fmt(p.valor)}
            </text>
            <text
              x={xOf(i)}
              y={PAD_T + IH + 16}
              textAnchor="middle"
              className="fill-muted-foreground"
              fontSize={8}
            >
              {formatDateOnlyShort(p.fecha)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
