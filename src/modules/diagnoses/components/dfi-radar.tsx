import type { DfiDomain } from "@/clinical-engine";

// Radar de los 5 dominios del DFI (Diagnostico Funcional Integral): una lectura de forma, de un
// vistazo, de la severidad por dominio. Cada eje es un dominio; el radio es la severidad (0 al
// centro = optimo, 3 en el borde = alto), coherente con la Diana (exterior = mayor riesgo). Los
// datos vienen del snapshot inmutable (computeDFI congelado); esto es presentacion pura. El color
// del poligono es SEMANTICA de riesgo (paleta clinica BRAND), no decoracion. Accesible: la
// severidad tambien va en texto (etiqueta por eje y aria-label), no solo en el color. Server
// component puro, theme-aware via tokens de Tailwind.

const SIZE_W = 360;
const SIZE_H = 300;
const CX = 180;
const CY = 140;
const RMAX = 95;
const RINGS = 3; // sev 1, 2, 3

const SEV_LABEL = ["Optimo", "Leve", "Moderado", "Alto"];
// Clase de color por severidad integrada (fill translucido + stroke solido). Tokens BRAND.
const RISK_FILL = [
  "fill-clinical-optimal",
  "fill-clinical-optimal",
  "fill-clinical-warning",
  "fill-clinical-critical",
];
const RISK_STROKE = [
  "stroke-clinical-optimal",
  "stroke-clinical-optimal",
  "stroke-clinical-warning",
  "stroke-clinical-critical",
];

function clampSev(s: number): number {
  return Math.min(3, Math.max(0, s));
}

// Punto en el eje i (0..n-1), a un radio dado. Eje 0 arriba, luego en sentido horario.
function axisPoint(i: number, n: number, r: number): [number, number] {
  const a = (-90 + (360 / n) * i) * (Math.PI / 180);
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

export function DfiRadar({ domains, riskSev }: { domains: DfiDomain[]; riskSev: number }) {
  const n = domains.length;
  const rs = clampSev(riskSev);

  // Poligono de datos: vertice de cada dominio a radio = (sev/3) * RMAX.
  const dataPts = domains.map((d, i) => axisPoint(i, n, (clampSev(d.sev) / 3) * RMAX));
  const dataPoly = dataPts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  // Anillos guia (pentagonos concentricos en sev 1/2/3).
  const rings = Array.from({ length: RINGS }, (_, k) => {
    const r = ((k + 1) / RINGS) * RMAX;
    return Array.from({ length: n }, (_, i) => axisPoint(i, n, r))
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ");
  });

  const label = `Radar DFI: ${domains
    .map((d) => `${d.nombre} ${SEV_LABEL[clampSev(d.sev)]}`)
    .join(", ")}.`;

  return (
    <figure className="flex flex-col items-center gap-2">
      <svg
        viewBox={`0 0 ${SIZE_W} ${SIZE_H}`}
        width={SIZE_W}
        height={SIZE_H}
        role="img"
        aria-label={label}
        className="max-w-full"
      >
        {/* Anillos guia + radios */}
        {rings.map((pts, k) => (
          <polygon key={`ring${k}`} points={pts} fill="none" className="stroke-border" strokeWidth={1} />
        ))}
        {domains.map((_, i) => {
          const [x, y] = axisPoint(i, n, RMAX);
          return <line key={`spoke${i}`} x1={CX} y1={CY} x2={x} y2={y} className="stroke-border" strokeWidth={1} />;
        })}
        {/* Poligono de datos */}
        <polygon
          points={dataPoly}
          className={`${RISK_FILL[rs]} ${RISK_STROKE[rs]}`}
          fillOpacity={0.2}
          strokeWidth={2}
        />
        {/* Vertices */}
        {dataPts.map(([x, y], i) => (
          <circle key={`v${i}`} cx={x} cy={y} r={3} className={RISK_STROKE[rs].replace("stroke-", "fill-")} />
        ))}
        {/* Etiquetas de eje: nombre del dominio + severidad (parte hifenadas en dos lineas) */}
        {domains.map((d, i) => {
          const [lx, ly] = axisPoint(i, n, RMAX + 14);
          const cos = Math.cos((-90 + (360 / n) * i) * (Math.PI / 180));
          const anchor = cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";
          const parts = d.nombre.includes("-") ? d.nombre.split("-") : [d.nombre];
          return (
            <text
              key={`lbl${i}`}
              x={lx}
              y={ly}
              textAnchor={anchor}
              dominantBaseline="middle"
              className="fill-foreground"
              fontSize={10}
            >
              {parts.map((p, k) => (
                <tspan key={k} x={lx} dy={k === 0 ? (parts.length > 1 ? -6 : 0) : 12}>
                  {parts.length > 1 && k === 0 ? `${p}-` : p}
                </tspan>
              ))}
              <tspan x={lx} dy={12} className="fill-muted-foreground" fontSize={9}>
                {SEV_LABEL[clampSev(d.sev)]}
              </tspan>
            </text>
          );
        })}
      </svg>
      <figcaption className="text-center text-xs text-muted-foreground">
        Severidad por dominio (centro optimo, borde alto).
      </figcaption>
    </figure>
  );
}
